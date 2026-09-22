import type { Questions } from "@typesafe-ai/sdk";
import type { DecisionClient } from "../decision/client";
import { missingNumbers } from "../text/numbers";
import { adjudicate } from "./adjudicate";
import { presenceQuestion, rewriteState, traceQuestion, type RequiredUnit, type SentenceRef } from "./questions";
import { findWording } from "./wording";

export type UnitStatus = "kept" | "missing" | "altered" | "uncertain";

export interface UnitResult {
  unit: RequiredUnit;
  status: UnitStatus;
  /** The decision model's probability that the rewrite states the unit with the same meaning. */
  present: number;
  /** Rewrite sentence ids that carry the unit, most likely first. */
  sentences: string[];
  numbersMissing: number[];
  decidedBy: "decision" | "llm";
  reason?: string;
}

export interface WordingResult {
  id: string;
  text: string;
  kept: boolean;
  location?: { start: number; end: number };
}

export interface Verification {
  units: UnitResult[];
  wording: WordingResult[];
  escalated: number;
  decisionMs: number;
  adjudicationMs: number;
  decisionTokens: number;
}

/**
 * Accept a unit without a second opinion when the decision model is at least this sure it is
 * present and no number went missing. Lower-confidence units receive a second opinion.
 */
export const ACCEPT_PRESENT = 0.8;
/** Below this the unit is treated as lost when no second opinion is available. */
export const REJECT_PRESENT = 0.2;
/** Secondary sentences are shown when they carry at least this share of the trace. */
const TRACE_SHARE = 0.1;

/** Choice limits differ by backend: Jev takes 255 options, Rizzo Flow 26. */
const MAX_OPTIONS: Record<string, number> = { jev: 255, rizzo: 26 };
/** Rizzo Flow takes at most 64 questions per request. */
const MAX_QUESTIONS: Record<string, number> = { jev: 2000, rizzo: 64 };

function traceOf(probabilities: Record<string, number> | undefined): string[] {
  if (!probabilities) return [];
  return Object.entries(probabilities)
    .filter(([option, p]) => option !== "NOT_PRESENT" && p >= TRACE_SHARE)
    .sort((a, b) => b[1] - a[1])
    .map(([option]) => option);
}

export async function verifyRewrite(options: {
  client: DecisionClient;
  sentences: SentenceRef[];
  /** Original text, required for character-accurate wording locations. */
  text?: string;
  units: RequiredUnit[];
  keepWording: Array<{ id: string; text: string }>;
  /** Ask Claude about units the decision model is unsure of. Default true. */
  adjudicate?: boolean;
  judgeModel?: string;
  onEscalate?: (units: RequiredUnit[]) => void;
}): Promise<Verification> {
  const { client, sentences, units } = options;
  const text = options.text ?? sentences.map((s) => s.text).join(" ");
  const provider = client.config.provider;
  const withTrace = sentences.length < (MAX_OPTIONS[provider] ?? 255);

  // One state, two questions per unit: is it there, and where.
  const perRequest = Math.max(1, Math.floor((MAX_QUESTIONS[provider] ?? 2000) / (withTrace ? 2 : 1)));
  const answers: Record<string, unknown> = {};
  let decisionMs = 0;
  let decisionTokens = 0;
  for (let i = 0; i < units.length; i += perRequest) {
    const questions: Questions = {};
    for (const unit of units.slice(i, i + perRequest)) {
      questions[`${unit.id}::present`] = presenceQuestion(unit);
      if (withTrace) questions[`${unit.id}::trace`] = traceQuestion(unit, sentences.map((s) => s.id));
    }
    const result = await client.ask(rewriteState(sentences), questions);
    Object.assign(answers, result.answers);
    decisionMs += result.ms;
    decisionTokens += result.inputTokens;
  }

  const results: UnitResult[] = units.map((unit) => {
    const answer = answers[`${unit.id}::present`] as { noul?: number } | undefined;
    const present = answer?.noul;
    if (typeof present !== "number" || !Number.isFinite(present) || present < 0 || present > 1) {
      throw new Error(`The checker returned an invalid presence score for ${unit.id}. Nothing has been verified.`);
    }
    const trace = answers[`${unit.id}::trace`] as { probabilities: Record<string, number> } | undefined;
    const numbersMissing = missingNumbers(unit.text, text);
    const confident = present >= ACCEPT_PRESENT && !numbersMissing.length;
    return {
      unit,
      status: confident ? "kept" : present < REJECT_PRESENT ? "missing" : "uncertain",
      present,
      sentences: traceOf(trace?.probabilities),
      numbersMissing,
      decidedBy: "decision",
    };
  });

  // Anything short of a confident "kept" gets a second opinion before it can trigger a repair.
  const unsure = results.filter((r) => r.status !== "kept");
  let adjudicationMs = 0;
  if (unsure.length && options.adjudicate !== false) {
    options.onEscalate?.(unsure.map((r) => r.unit));
    const { verdicts, ms } = await adjudicate(unsure.map((r) => r.unit), sentences, options.judgeModel);
    adjudicationMs = ms;
    for (const verdict of verdicts) {
      const result = results.find((r) => r.unit.id === verdict.id);
      if (!result) continue;
      result.decidedBy = "llm";
      result.status = verdict.status === "present" ? "kept" : verdict.status;
      result.reason = verdict.reason || undefined;
      if (verdict.status === "present" && !result.sentences.length) result.sentences = verdict.sentences;
    }
  }

  const wording = options.keepWording.map(({ id, text: span }) => {
    const location = findWording(span, text);
    return { id, text: span, kept: Boolean(location), location };
  });

  return {
    units: results,
    wording,
    escalated: unsure.length,
    decisionMs,
    adjudicationMs,
    decisionTokens,
  };
}

/** Units and wording that a repair has to fix. */
export function problemsOf(verification: Verification) {
  return {
    units: verification.units.filter((r) => r.status === "missing" || r.status === "altered"),
    wording: verification.wording.filter((w) => !w.kept),
  };
}
