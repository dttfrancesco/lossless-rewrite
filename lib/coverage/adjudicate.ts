import { z } from "zod";
import { completeJson } from "../llm";
import { rewriteState, type RequiredUnit, type SentenceRef } from "./questions";

export type AdjudicatedStatus = "present" | "altered" | "missing";

export interface Adjudication {
  id: string;
  status: AdjudicatedStatus;
  sentences: string[];
  /** A few words on what was lost or changed; empty when present. */
  reason: string;
}

const SYSTEM = `You check whether a rewrite still carries required information. For each required unit, compare the unit with the rewrite and answer:
- present: the rewrite states the same claim with the same meaning. Any wording counts, including merging it with other content, splitting it across sentences, or reordering. Equivalent expressions count ("7 days" and "a week", "25%" and "a quarter").
- altered: the rewrite states the claim but changes its meaning (different numbers, stronger or weaker certainty, an association turned into a cause, a broader or narrower scope, a dropped condition or exception, the opposite claim), or keeps only part of it.
- missing: the rewrite does not state the claim. A sentence about the same topic or a neighbouring finding does not count.
List the ids of the sentences that state the unit (empty when missing). For altered or missing units, give a reason of at most 12 words saying what was lost or changed. Judge each unit only against its own text.`;

const verdicts = (unitIds: string[]) =>
  z.object({
    units: z.array(
      z.object({
        id: z.enum(unitIds as [string, ...string[]]),
        status: z.enum(["present", "altered", "missing"]),
        sentences: z.array(z.string()),
        reason: z.string(),
      }),
    ),
  });

/**
 * A second opinion from Claude on units the decision model was not confident about. Slower
 * and pricier than Jev, so it only sees the uncertain units.
 */
export async function adjudicate(
  units: RequiredUnit[],
  sentences: SentenceRef[],
  model?: string,
): Promise<{ verdicts: Adjudication[]; ms: number }> {
  if (!units.length) return { verdicts: [], ms: 0 };
  const { data, ms } = await completeJson({
    system: SYSTEM,
    prompt: [
      "Required units:",
      ...units.map((unit) => `${unit.id}: ${unit.text}`),
      "",
      "Rewrite:",
      rewriteState(sentences).rewrite,
    ].join("\n"),
    schema: verdicts(units.map((unit) => unit.id)),
    purpose: "judge",
    model,
    effort: "medium",
  });
  const requested = new Set(units.map((u) => u.id));
  if (data.units.length !== requested.size || new Set(data.units.map((v) => v.id)).size !== requested.size || data.units.some((v) => !requested.has(v.id) || v.sentences.some((id) => !sentences.some((s) => s.id === id)))) {
    throw new Error("The second opinion returned an incomplete or invalid set of verdicts. Please retry.");
  }
  return { verdicts: data.units, ms };
}
