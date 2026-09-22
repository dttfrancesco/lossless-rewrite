import { choice, noul, type Questions } from "@typesafe-ai/sdk";

export type UnitKind = "must_cover" | "keep_meaning";

/** Information the rewrite must carry: a fact extracted from a Must cover region, or a Keep meaning selection. */
export interface RequiredUnit {
  id: string;
  kind: UnitKind;
  text: string;
}

export interface SentenceRef {
  id: string;
  text: string;
}

/**
 * The rewrite as the decision model sees it: one `S1| …` line per sentence, so a Choice can
 * point at a sentence by id (the layout TypeSafe's line-search cookbook uses).
 */
export function rewriteState(sentences: SentenceRef[]) {
  return { rewrite: sentences.map((sentence) => `${sentence.id}| ${sentence.text}`).join("\n") };
}

export const DRIFTS = ["certainty", "scope", "causal", "qualifier", "polarity", "numbers"] as const;
export type Drift = (typeof DRIFTS)[number];

const DRIFT_QUESTIONS: Record<Drift, { question: string; examples: string[] }> = {
  certainty: {
    question:
      "Does `rewrite` state the claim in `required_information` with more or less certainty than `required_information` does?",
    examples: ["'may improve' becomes 'improves'", "'suggests' becomes 'shows'", "'could not assess' becomes 'persists'"],
  },
  scope: {
    question:
      "Does `rewrite` apply the claim in `required_information` to a broader or narrower group, amount or set of situations than `required_information` does?",
    examples: ["'10 of 12 participants' becomes 'all participants'", "'most pronounced among caregivers' becomes 'only caregivers'"],
  },
  causal: {
    question:
      "Does `rewrite` present a relationship as causal when `required_information` only reports an association, or the reverse?",
    examples: ["'was associated with' becomes 'caused'", "'was not associated with' becomes 'led to'"],
  },
  qualifier: {
    question: "Does `rewrite` drop a condition, exception or limitation that `required_information` states?",
    examples: ["'except permission errors' is dropped", "'not before the first anniversary' is dropped"],
  },
  polarity: {
    question: "Does `rewrite` state the opposite of the claim in `required_information`?",
    examples: ["'rejected' becomes 'truncated'", "'not atomic' becomes 'atomic'"],
  },
  numbers: {
    question: "Does `rewrite` give different numbers than `required_information` for the same claim?",
    examples: ["'12 participants' becomes '10 participants'", "'11%' becomes '17%'"],
  },
};

/** Is the claim stated anywhere in the rewrite? True means present. */
export function presenceQuestion(unit: RequiredUnit) {
  return noul(
    {
      required_information: unit.text,
      question: "Does `rewrite` state the claim in `required_information`, with the same meaning?",
      counts_as_stated: "Any wording; merged into another sentence; split across sentences; in a different order.",
      does_not_count:
        "Only the same topic or a neighbouring finding; only part of the claim; different numbers, certainty, scope, causality or conditions.",
    },
    {
      true: "`rewrite` states this claim with the same meaning",
      false: "`rewrite` leaves this claim out, or states a different or partial claim",
    },
  );
}

/** Which sentence carries the claim, with NOT_PRESENT as the no-match outcome. */
export function traceQuestion(unit: RequiredUnit, sentenceIds: string[]) {
  return choice(
    {
      required_information: unit.text,
      question: "Which sentence of `rewrite` states the claim in `required_information`?",
    },
    {
      ...Object.fromEntries(sentenceIds.map((id) => [id, null])),
      NOT_PRESENT: "No sentence states this claim; a sentence that only touches the same topic does not count",
    },
  );
}

/** True means the rewrite changes the claim in this particular way. */
export function driftQuestion(unit: RequiredUnit, drift: Drift) {
  const { question, examples } = DRIFT_QUESTIONS[drift];
  return noul(
    { required_information: unit.text, question, examples },
    {
      true: "`rewrite` changes the claim in this way",
      false: "`rewrite` keeps this aspect of the claim unchanged, or does not state the claim at all",
    },
  );
}

/**
 * Every question variant the benchmark compares, for every unit, in one request. The product
 * keeps only the variants that win; the benchmark needs them side by side on identical state.
 */
export function benchmarkQuestions(units: RequiredUnit[], sentenceIds: string[]): Questions {
  const questions: Questions = {};
  for (const unit of units) {
    const info = { required_information: unit.text };
    questions[`${unit.id}::present_plain`] = noul({
      ...info,
      question: "Does `rewrite` state `required_information`?",
    });
    questions[`${unit.id}::present`] = presenceQuestion(unit);
    questions[`${unit.id}::missing`] = noul(
      {
        ...info,
        question: "Is the claim in `required_information` missing from `rewrite`?",
        note: "A sentence about the same topic, or a related but different finding, does not count as stating the claim. Rewording, merging and splitting still count as stating it.",
      },
      {
        true: "`rewrite` does not state this claim",
        false: "`rewrite` states this claim, possibly in different words",
      },
    );
    questions[`${unit.id}::relation`] = choice(
      { ...info, question: "How does `rewrite` treat the claim in `required_information`?" },
      {
        preserved: {
          what: "States the same claim with the same meaning",
          includes: "completely different wording, merging, splitting, reordering",
        },
        altered: {
          what: "States the claim but changes its meaning",
          examples: [
            "different numbers",
            "stronger or weaker certainty",
            "an association turned into a cause",
            "a broader or narrower scope",
            "a dropped condition or exception",
            "the opposite claim",
          ],
        },
        partial: { what: "States only part of the claim; an essential element is left out" },
        related_only: { what: "Discusses the same topic or a neighbouring point, but never states this claim" },
        absent: { what: "Says nothing about this claim or its topic" },
      },
    );
    questions[`${unit.id}::trace`] = traceQuestion(unit, sentenceIds);
    for (const drift of DRIFTS) questions[`${unit.id}::drift_${drift}`] = driftQuestion(unit, drift);
  }
  return questions;
}
