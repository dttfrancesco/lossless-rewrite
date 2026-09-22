import { DecisionClient } from "../decision/client";
import type { RequiredUnit } from "../coverage/questions";
import { problemsOf, verifyRewrite, type Verification } from "../coverage/verify";
import { splitSentences, wordCount } from "../text/sentences";
import type { Attempt, Constraint, Fact, PipelineEvent, RewriteResult } from "./types";
import { targetWords } from "./target";
import { repairRewrite, tightenRewrite, writeRewrite, type Brief, type Problem, type Steer } from "./write";

export interface RewriteRequest {
  source: string;
  instruction: string;
  constraints: Constraint[];
  /** The Must cover inventory, already extracted and reviewed by the user. */
  facts: Fact[];
  /** Repair passes allowed. Default 1. */
  maxRepairs?: number;
  /** Tightening passes allowed when a draft overshoots the requested length. Default 1. */
  maxTightens?: number;
  /** Give the writer the fact inventory up front. Default true. */
  briefFacts?: boolean;
  /** Ask Claude about units the decision model is unsure of. Default true. */
  adjudicate?: boolean;
  /** Start from this text instead of writing a draft, e.g. a rewrite the user edited by hand. */
  initialText?: string;
  /** "Not this": write in a different direction from a version the user turned down. */
  steer?: Steer;
  /** Writer model for this run, e.g. `sonnet` or `opus`. */
  writerModel?: string;
}

/** Keep meaning selections become units P1…Pn; Keep wording spans W1…Wn. */
export function unitsFor(request: Pick<RewriteRequest, "constraints" | "facts">) {
  const keepMeaning: RequiredUnit[] = request.constraints
    .filter((c) => c.type === "keep_meaning")
    .sort((a, b) => a.start - b.start)
    .map((c, i) => ({ id: `P${i + 1}`, kind: "keep_meaning", text: c.text }));
  const facts: RequiredUnit[] = request.facts.map((f) => ({ id: f.id, kind: "must_cover", text: f.text }));
  const keepWording = request.constraints
    .filter((c) => c.type === "keep_wording")
    .sort((a, b) => a.start - b.start)
    .map((c, i) => ({ id: `W${i + 1}`, text: c.text }));
  return { keepMeaning, facts, keepWording };
}

function problems(verification: Verification): Problem[] {
  const { units, wording } = problemsOf(verification);
  return [
    ...units.map((r) => ({
      id: r.unit.id,
      kind: r.status === "altered" ? ("altered" as const) : ("missing" as const),
      text: r.unit.text,
      reason: r.reason,
    })),
    ...wording.map((w) => ({ id: w.id, kind: "wording" as const, text: w.text })),
  ];
}

/**
 * Losing an idea is worse than missing the length target: fewest problems wins, then the draft
 * closest to the target, then the latest.
 */
export function best(attempts: Attempt[], target?: number): Attempt {
  const distance = (a: Attempt) => (target ? Math.abs(a.words - target) : 0);
  return attempts.reduce((a, b) => {
    const pa = problems(a.verification).length + a.verification.units.filter((u) => u.status === "uncertain").length;
    const pb = problems(b.verification).length + b.verification.units.filter((u) => u.status === "uncertain").length;
    if (pb !== pa) return pb < pa ? b : a;
    return distance(b) <= distance(a) ? b : a;
  });
}

/** A draft this much over the requested length gets a tightening pass. */
const OVERSHOOT = 1.15;

/**
 * Write, verify, then repair or tighten until every required unit is carried and the length
 * fits, or the budgets run out. Repairs take priority over tightening.
 */
export async function runRewrite(
  request: RewriteRequest,
  emit: (event: PipelineEvent) => void = () => {},
  client: DecisionClient = new DecisionClient(),
): Promise<RewriteResult> {
  const { keepMeaning, facts, keepWording } = unitsFor(request);
  const units = [...facts, ...keepMeaning];
  const brief: Brief = {
    source: request.source,
    instruction: request.instruction,
    keepWording,
    keepMeaning,
    facts,
    briefFacts: request.briefFacts,
    steer: request.steer,
    model: request.writerModel,
  };
  const sourceWords = wordCount(request.source);
  const target = targetWords(request.instruction, sourceWords);
  let repairsLeft = request.maxRepairs ?? 1;
  let tightensLeft = request.maxTightens ?? 1;
  const attempts: Attempt[] = [];

  let started = performance.now();
  let text: string;
  let pass: Attempt["pass"];
  if (request.initialText !== undefined) {
    text = request.initialText;
    pass = "edit";
  } else {
    emit({ type: "stage", stage: "writing", attempt: 0 });
    text = await writeRewrite(brief);
    pass = "draft";
  }
  let writeMs = performance.now() - started;
  let repairing: string[] = [];

  for (let attempt = 0; ; attempt++) {
    const sentences = splitSentences(text);
    const words = wordCount(text);
    emit({ type: "draft", attempt, text, sentences, words });
    emit({ type: "stage", stage: "verifying", attempt });
    const verification = await verifyRewrite({
      client,
      sentences,
      text,
      units,
      keepWording,
      adjudicate: request.adjudicate,
      judgeModel: request.writerModel,
      onEscalate: (escalated) =>
        emit({ type: "stage", stage: "adjudicating", attempt, ids: escalated.map((u) => u.id) }),
    });
    emit({ type: "verified", attempt, verification });
    attempts.push({ pass, text, sentences, words, verification, repairing, writeMs });

    const toFix = problems(verification);
    if (toFix.length && repairsLeft > 0) {
      repairsLeft--;
      pass = "repair";
      repairing = toFix.map((p) => p.id);
      emit({ type: "stage", stage: "repairing", attempt: attempt + 1, ids: repairing });
      started = performance.now();
      text = await repairRewrite(brief, text, words, toFix);
    } else if (!toFix.length && verification.units.every((u) => u.status === "kept") && target && words > target * OVERSHOOT && tightensLeft > 0) {
      tightensLeft--;
      pass = "tighten";
      repairing = [];
      emit({ type: "stage", stage: "tightening", attempt: attempt + 1 });
      started = performance.now();
      text = await tightenRewrite(brief, text, words, target);
    } else {
      break;
    }
    writeMs = performance.now() - started;
  }

  const result: RewriteResult = { attempts, final: best(attempts, target), sourceWords, targetWords: target };
  emit({ type: "done", result });
  return result;
}
