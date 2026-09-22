import { z } from "zod";
import { completeJson } from "../llm";
import { splitSentences } from "../text/sentences";
import type { Constraint, Fact } from "./types";

const SYSTEM = `You list the key ideas of a passage: the findings, claims, requirements or conditions that a much shorter version must still convey. The user will check a rewrite against this list, so each item must be something a reader would genuinely miss.

Rules:
- One idea per item, as one plain sentence of at most 25 words that makes sense on its own.
- Keep the details that define the idea: the key numbers and comparisons, hedges ("may", "preliminary"), scope ("most", "at complex intersections") and conditions or exceptions. Copy them exactly; never round, generalize or strengthen.
- Leave out how things were measured, definitions, procedure, examples and restatements, unless the idea cannot be understood without them.
- Merge a minor detail into the idea it supports, or leave it out if a reader would not miss it.
- List the ids of the passage sentences each idea comes from.
Aim for one idea per three to five sentences of passage (a page of results usually has six to ten), never more than 12.`;

const Inventory = z.object({
  facts: z.array(z.object({ text: z.string(), sources: z.array(z.string()) })),
});

/** Extract the fact inventory of one Must cover region. Fact ids start at `F{firstNumber}`. */
export async function extractFacts(region: Constraint, firstNumber = 1, model?: string): Promise<Fact[]> {
  const sentences = splitSentences(region.text);
  const { data } = await completeJson({
    system: SYSTEM,
    prompt: `Passage:\n${sentences.map((s) => `${s.id}| ${s.text}`).join("\n")}`,
    schema: Inventory,
    purpose: "extract",
    model,
    effort: "medium",
  });
  if (!data.facts.length) throw new Error("No ideas were extracted. Select a more specific passage and try again.");
  if (data.facts.some((f) => !f.text.trim() || !f.sources.length || f.sources.some((id) => !sentences.some((s) => s.id === id)))) {
    throw new Error("The idea inventory contained an empty finding or an invalid source reference. Please retry.");
  }
  return data.facts.map((fact, i) => ({
    id: `F${firstNumber + i}`,
    text: fact.text.trim(),
    constraintId: region.id,
    sources: fact.sources.flatMap((id) => {
      const sentence = sentences.find((s) => s.id === id);
      return sentence ? [{ start: region.start + sentence.start, end: region.start + sentence.end }] : [];
    }),
  }));
}

/** Extract every Must cover region in parallel and number the facts in document order. */
export async function extractAll(regions: Constraint[], model?: string): Promise<Fact[]> {
  const ordered = [...regions].sort((a, b) => a.start - b.start);
  const perRegion = await Promise.all(ordered.map((region) => extractFacts(region, 1, model)));
  let n = 0;
  return perRegion.flat().map((fact) => ({ ...fact, id: `F${++n}` }));
}
