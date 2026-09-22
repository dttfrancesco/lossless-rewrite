/**
 * Coverage benchmark: can a decision model tell a required fact that survived a rewrite
 * (however reworded) from one that was dropped or distorted?
 *
 *   npm run bench                              Jev + Claude baseline, then score
 *   npm run bench -- --providers jev,rizzo     also run a local Rizzo Flow server
 *   npm run bench -- --no-claude               skip the Claude baseline
 *   npm run bench -- --from <raw.json>         re-score a saved run without any API calls
 *
 * Raw answers are saved first, so scoring policies and thresholds can change without re-running.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { loadEnv } from "../lib/env";
import { DecisionClient, decisionConfig, decisionCostUsd, type DecisionProvider } from "../lib/decision/client";
import { benchmarkQuestions, DRIFTS, rewriteState, type RequiredUnit } from "../lib/coverage/questions";
import { completeJson, type Effort } from "../lib/llm";
import { missingNumbers } from "../lib/text/numbers";
import { SCENARIOS, type Label, type Scenario, type Tag } from "./scenarios";

loadEnv();

// ---------------------------------------------------------------------------------------------
// Cases

interface Case {
  key: string;
  scenario: Scenario;
  sentences: Array<{ id: string; text: string }>;
  labels: Record<string, Label>;
}

function buildCases(only?: string): Case[] {
  return SCENARIOS.filter((scenario) => !only || scenario.id === only).flatMap((scenario) =>
    scenario.rewrites.map((rewrite) => ({
      key: `${scenario.id}/${rewrite.id}`,
      scenario,
      sentences: rewrite.sentences.map((text, i) => ({ id: `S${i + 1}`, text })),
      labels: rewrite.labels,
    })),
  );
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------------------------
// Collect

type Answers = Record<string, unknown>;

interface DecisionCaseResult {
  answers?: Answers;
  ms?: number;
  inputTokens?: number;
  questions?: number;
  error?: string;
}

interface DecisionRun {
  provider: DecisionProvider;
  model: string;
  cases: Record<string, DecisionCaseResult>;
}

interface ClaudeUnitVerdict {
  id: string;
  status: "present" | "altered" | "missing";
  sentences: string[];
}

interface ClaudeCaseResult {
  units?: ClaudeUnitVerdict[];
  ms?: number;
  apiMs?: number;
  costUsd?: number;
  error?: string;
}

interface ClaudeRun {
  model: string;
  effort: Effort;
  cases: Record<string, ClaudeCaseResult>;
}

interface RawRun {
  createdAt: string;
  decision: DecisionRun[];
  claude?: ClaudeRun;
}

async function collectDecisions(provider: DecisionProvider, cases: Case[]): Promise<DecisionRun> {
  const config = decisionConfig(provider);
  if (provider === "rizzo") {
    const health = await fetch(`${config.baseURL}/health`).catch(() => undefined);
    if (!health?.ok) throw new Error(`Rizzo Flow is not reachable at ${config.baseURL}. Start it with \`rizzo serve\`.`);
  }
  const client = new DecisionClient(config);
  const run: DecisionRun = { provider, model: config.model, cases: {} };
  // Rizzo accepts at most 64 questions per request, so its units go in chunks over the same state.
  const maxQuestions = provider === "rizzo" ? 64 : Number.POSITIVE_INFINITY;
  // Rizzo serializes requests on the GPU anyway; Jev is happy with a few in flight.
  await mapLimit(cases, provider === "rizzo" ? 1 : 6, async (item) => {
    const ids = item.sentences.map((s) => s.id);
    const perUnit = Object.keys(benchmarkQuestions(item.scenario.units.slice(0, 1), ids)).length;
    const unitsPerRequest = Math.max(1, Math.floor(maxQuestions / perUnit));
    try {
      const answers: Answers = {};
      let ms = 0, inputTokens = 0, questionCount = 0;
      for (let i = 0; i < item.scenario.units.length; i += unitsPerRequest) {
        const questions = benchmarkQuestions(item.scenario.units.slice(i, i + unitsPerRequest), ids);
        const result = await client.ask(rewriteState(item.sentences), questions);
        Object.assign(answers, result.answers);
        ms += result.ms;
        inputTokens += result.inputTokens;
        questionCount += Object.keys(questions).length;
        run.model = result.model;
      }
      run.cases[item.key] = { answers, ms, inputTokens, questions: questionCount };
      process.stdout.write(`  ${provider} ${item.key} ${Math.round(ms)} ms\n`);
    } catch (error) {
      run.cases[item.key] = { error: String(error) };
      process.stdout.write(`  ${provider} ${item.key} ERROR ${String(error).slice(0, 160)}\n`);
    }
  });
  return run;
}

const CLAUDE_SYSTEM = `You check whether a rewrite still carries required information. For each required unit, compare the unit with the rewrite and answer:
- present: the rewrite states the same claim with the same meaning. Any wording counts, including merging it with other content, splitting it across sentences, or reordering.
- altered: the rewrite states the claim but changes its meaning (different numbers, stronger or weaker certainty, an association turned into a cause, a broader or narrower scope, a dropped condition or exception, the opposite claim), or keeps only part of it.
- missing: the rewrite does not state the claim. A sentence about the same topic or a neighbouring finding does not count.
List the ids of the sentences that state the unit (empty when missing). Judge each unit only against its own text.`;

const claudeSchema = (unitIds: string[]) =>
  z.object({
    units: z.array(
      z.object({
        id: z.enum(unitIds as [string, ...string[]]),
        status: z.enum(["present", "altered", "missing"]),
        sentences: z.array(z.string()),
      }),
    ),
  });

function claudePrompt(units: RequiredUnit[], sentences: Array<{ id: string; text: string }>): string {
  return [
    "Required units:",
    ...units.map((unit) => `${unit.id}: ${unit.text}`),
    "",
    "Rewrite:",
    rewriteState(sentences).rewrite,
  ].join("\n");
}

async function collectClaude(model: string, effort: Effort, cases: Case[]): Promise<ClaudeRun> {
  const run: ClaudeRun = { model, effort, cases: {} };
  await mapLimit(cases, 3, async (item) => {
    const units = item.scenario.units;
    try {
      const response = await completeJson({
        system: CLAUDE_SYSTEM,
        prompt: claudePrompt(units, item.sentences),
        model,
        effort,
        purpose: "judge",
        schema: claudeSchema(units.map((unit) => unit.id)),
      });
      run.model = response.model;
      run.cases[item.key] = {
        units: response.data.units,
        ms: response.ms,
        apiMs: response.apiMs,
        costUsd: response.costUsd,
      };
      process.stdout.write(`  claude ${item.key} ${Math.round(response.ms)} ms\n`);
    } catch (error) {
      run.cases[item.key] = { error: String(error) };
      process.stdout.write(`  claude ${item.key} ERROR ${String(error).slice(0, 160)}\n`);
    }
  });
  return run;
}

// ---------------------------------------------------------------------------------------------
// Score

type Verdict = "ok" | "flag";

interface Item {
  key: string;
  unit: RequiredUnit;
  label: Label;
  truth: Verdict;
  numbersMissing: number[];
}

function buildItems(cases: Case[]): Item[] {
  return cases.flatMap((item) => {
    const rewriteText = item.sentences.map((s) => s.text).join(" ");
    return item.scenario.units.map((unit) => {
      const label = item.labels[unit.id];
      if (!label) throw new Error(`${item.key} has no label for ${unit.id}`);
      return {
        key: item.key,
        unit,
        label,
        truth: label.status === "present" ? ("ok" as const) : ("flag" as const),
        numbersMissing: missingNumbers(unit.text, rewriteText),
      };
    });
  });
}

interface Signals {
  presentPlain: number;
  present: number;
  missing: number;
  relation: { choice: string; probabilities: Record<string, number> };
  trace: { choice: string; probabilities: Record<string, number> };
  drift: Record<string, number>;
}

function signalsFor(answers: Answers, unitId: string): Signals {
  const noulOf = (name: string) => (answers[`${unitId}::${name}`] as { noul: number }).noul;
  const choiceOf = (name: string) =>
    answers[`${unitId}::${name}`] as { choice: string; probabilities: Record<string, number> };
  return {
    presentPlain: noulOf("present_plain"),
    present: noulOf("present"),
    missing: noulOf("missing"),
    relation: choiceOf("relation"),
    trace: choiceOf("trace"),
    drift: Object.fromEntries(DRIFTS.map((drift) => [drift, noulOf(`drift_${drift}`)])),
  };
}

const maxDrift = (s: Signals, include: readonly string[] = DRIFTS) =>
  Math.max(...include.map((drift) => s.drift[drift] ?? 0));

/** Semantic drifts only: numbers are checked in code, where they belong. */
const SEMANTIC_DRIFTS = DRIFTS.filter((drift) => drift !== "numbers");

type Policy = (s: Signals, item: Item) => Verdict;

const POLICIES: Array<[string, Policy]> = [
  ["present_plain < 0.5", (s) => (s.presentPlain < 0.5 ? "flag" : "ok")],
  ["present < 0.5", (s) => (s.present < 0.5 ? "flag" : "ok")],
  ["missing > 0.5", (s) => (s.missing > 0.5 ? "flag" : "ok")],
  ["relation ≠ preserved", (s) => (s.relation.choice !== "preserved" ? "flag" : "ok")],
  ["trace = NOT_PRESENT", (s) => (s.trace.choice === "NOT_PRESENT" ? "flag" : "ok")],
  ["numbers missing (code only)", (_s, item) => (item.numbersMissing.length ? "flag" : "ok")],
  ["present < 0.5 or drift > 0.5", (s) => (s.present < 0.5 || maxDrift(s, SEMANTIC_DRIFTS) > 0.5 ? "flag" : "ok")],
  [
    "present < 0.5 or drift > 0.5 or numbers",
    (s, item) =>
      s.present < 0.5 || maxDrift(s, SEMANTIC_DRIFTS) > 0.5 || item.numbersMissing.length ? "flag" : "ok",
  ],
  [
    "relation ≠ preserved or numbers",
    (s, item) => (s.relation.choice !== "preserved" || item.numbersMissing.length ? "flag" : "ok"),
  ],
  [
    "present < 0.5 or relation ≠ preserved or numbers",
    (s, item) =>
      s.present < 0.5 || s.relation.choice !== "preserved" || item.numbersMissing.length ? "flag" : "ok",
  ],
];

interface Rates {
  n: number;
  falseGreen: number;
  falseGreenNearMiss: number;
  falseRed: number;
  accuracy: number;
  flagged: number;
}

function rates(items: Item[], verdicts: Verdict[]): Rates {
  let fg = 0, fr = 0, nFlag = 0, nOk = 0, nNear = 0, fgNear = 0, correct = 0;
  items.forEach((item, i) => {
    const verdict = verdicts[i];
    if (verdict === item.truth) correct++;
    if (item.truth === "flag") {
      nFlag++;
      if (verdict === "ok") fg++;
      if (item.label.tags?.includes("near_miss")) {
        nNear++;
        if (verdict === "ok") fgNear++;
      }
    } else {
      nOk++;
      if (verdict === "flag") fr++;
    }
  });
  return {
    n: items.length,
    falseGreen: fg / Math.max(1, nFlag),
    falseGreenNearMiss: fgNear / Math.max(1, nNear),
    falseRed: fr / Math.max(1, nOk),
    accuracy: correct / Math.max(1, items.length),
    flagged: verdicts.filter((v) => v === "flag").length,
  };
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const percentile = (xs: number[], p: number) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? NaN;
};

function claudeVerdicts(run: ClaudeRun, items: Item[]): Array<Verdict | undefined> {
  return items.map((item) => {
    const status = run.cases[item.key]?.units?.find((unit) => unit.id === item.unit.id)?.status;
    return status === undefined ? undefined : status === "present" ? "ok" : "flag";
  });
}

function score(raw: RawRun, cases: Case[]): string {
  const items = buildItems(cases);
  const nFlag = items.filter((i) => i.truth === "flag").length;
  const nNear = items.filter((i) => i.truth === "flag" && i.label.tags?.includes("near_miss")).length;
  const lines: string[] = [];
  const out = (line = "") => lines.push(line);

  out(`# Coverage benchmark — ${raw.createdAt}`);
  out();
  out(`${items.length} unit checks over ${cases.length} rewrites: ${items.length - nFlag} should pass, ${nFlag} should be flagged (${nNear} of them near misses).`);
  out();
  out("False green = a missing or altered unit passed (the fatal error). False red = a preserved unit flagged.");
  out();

  const claude = raw.claude ? claudeVerdicts(raw.claude, items) : undefined;

  for (const run of raw.decision) {
    const usable = items.filter((item) => run.cases[item.key]?.answers);
    const errors = Object.values(run.cases).filter((c) => c.error).length;
    out(`## ${run.provider} (${run.model})${errors ? ` — ${errors} failed requests` : ""}`);
    out();
    out("| Policy | False green | …near misses | False red | Accuracy |");
    out("|---|---:|---:|---:|---:|");
    const signals = usable.map((item) => signalsFor(run.cases[item.key]!.answers!, item.unit.id));
    for (const [name, policy] of POLICIES) {
      const r = rates(usable, usable.map((item, i) => policy(signals[i]!, item)));
      out(`| ${name} | ${pct(r.falseGreen)} | ${pct(r.falseGreenNearMiss)} | ${pct(r.falseRed)} | ${pct(r.accuracy)} |`);
    }
    out();

    out("Threshold sweep, `present < t or semantic drift > d or numbers missing`:");
    out();
    out("| t | d | False green | …near misses | False red |");
    out("|---:|---:|---:|---:|---:|");
    for (const t of [0.3, 0.5, 0.7, 0.9]) {
      for (const d of [0.5, 0.7, 0.9]) {
        const r = rates(
          usable,
          usable.map((item, i) => {
            const s = signals[i]!;
            return s.present < t || maxDrift(s, SEMANTIC_DRIFTS) > d || item.numbersMissing.length ? "flag" : "ok";
          }),
        );
        out(`| ${t} | ${d} | ${pct(r.falseGreen)} | ${pct(r.falseGreenNearMiss)} | ${pct(r.falseRed)} |`);
      }
    }
    out();

    // Trace: for preserved units, does the top sentence (ignoring NOT_PRESENT) point at a gold sentence?
    let traceHits = 0, traceTotal = 0, traceNotPresent = 0;
    usable.forEach((item, i) => {
      if (item.truth !== "ok" || !item.label.at) return;
      const { probabilities } = signals[i]!.trace;
      const best = Object.entries(probabilities)
        .filter(([option]) => option !== "NOT_PRESENT")
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      traceTotal++;
      if (best && item.label.at.includes(Number(best.slice(1)))) traceHits++;
      if (signals[i]!.trace.choice === "NOT_PRESENT") traceNotPresent++;
    });
    out(`Trace: the top sentence is a correct location for ${traceHits}/${traceTotal} preserved units (${pct(traceHits / Math.max(1, traceTotal))}); NOT_PRESENT won for ${traceNotPresent} of them.`);
    out();

    // Margins: how far the presence probability sits from the 0.5 line on each side.
    const presentOk = usable.flatMap((item, i) => (item.truth === "ok" ? [signals[i]!.present] : []));
    const presentFlag = usable.flatMap((item, i) => (item.truth === "flag" ? [signals[i]!.present] : []));
    const fmt = (xs: number[]) =>
      `min ${Math.min(...xs).toFixed(2)}, p10 ${percentile(xs, 10).toFixed(2)}, median ${percentile(xs, 50).toFixed(2)}, max ${Math.max(...xs).toFixed(2)}`;
    out(`Presence probability — preserved units: ${fmt(presentOk)}; missing or altered units: ${fmt(presentFlag)}.`);
    out();
    const closest = usable
      .map((item, i) => ({ item, p: signals[i]!.present }))
      .filter(({ item, p }) => (item.truth === "ok" ? p < 0.9 : p > 0.1))
      .sort((a, b) => Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5))
      .slice(0, 10);
    if (closest.length) {
      out("Closest calls (preserved units under 0.9, missing or altered units over 0.1):");
      out();
      out("| Rewrite | Unit | Truth | Tags | present |");
      out("|---|---|---|---|---:|");
      for (const { item, p } of closest) {
        out(`| ${item.key} | ${item.unit.id}: ${item.unit.text} | ${item.label.status} | ${(item.label.tags ?? []).join(", ")} | ${p.toFixed(2)} |`);
      }
      out();
    }

    if (claude) {
      out("Cascade: accept when Jev is confident the unit is intact, otherwise ask Claude.");
      out();
      out("| Accept if present ≥ | and drift ≤ | Escalated to Claude | False green | …near misses | False red |");
      out("|---:|---:|---:|---:|---:|---:|");
      for (const hi of [0.7, 0.8, 0.9, 0.95]) {
        for (const lo of [0.3, 0.5]) {
          let escalated = 0;
          const pairs: Array<[Item, Verdict]> = [];
          usable.forEach((item, i) => {
            const s = signals[i]!;
            const confident = s.present >= hi && maxDrift(s, SEMANTIC_DRIFTS) <= lo && !item.numbersMissing.length;
            if (confident) return pairs.push([item, "ok"]);
            escalated++;
            const fromClaude = claude[items.indexOf(item)];
            if (fromClaude) pairs.push([item, fromClaude]);
          });
          const r = rates(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
          out(`| ${hi} | ${lo} | ${pct(escalated / usable.length)} | ${pct(r.falseGreen)} | ${pct(r.falseGreenNearMiss)} | ${pct(r.falseRed)} |`);
        }
      }
      out();
    }

    const ok = Object.values(run.cases).filter((c) => c.ms !== undefined);
    const ms = ok.map((c) => c.ms!);
    const tokens = ok.map((c) => c.inputTokens ?? 0);
    const questions = ok.map((c) => c.questions ?? 0);
    const cost = tokens.reduce((a, b) => a + decisionCostUsd(run.provider, b), 0) / Math.max(1, ok.length);
    out(`Latency per request (${Math.round(questions.reduce((a, b) => a + b, 0) / Math.max(1, ok.length))} questions on average): p50 ${Math.round(percentile(ms, 50))} ms, p95 ${Math.round(percentile(ms, 95))} ms. Input tokens per request: ${Math.round(tokens.reduce((a, b) => a + b, 0) / Math.max(1, ok.length))}. Cost per request: $${cost.toFixed(5)}.`);
    out();
  }

  if (raw.claude && claude) {
    const pairs = items.flatMap((item, i) => (claude[i] ? [[item, claude[i]!] as const] : []));
    const r = rates(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
    const ok = Object.values(raw.claude.cases).filter((c) => c.ms !== undefined);
    const errors = Object.values(raw.claude.cases).filter((c) => c.error).length;
    out(`## Claude baseline (${raw.claude.model}, effort ${raw.claude.effort})${errors ? ` — ${errors} failed calls` : ""}`);
    out();
    out(`False green ${pct(r.falseGreen)} (near misses ${pct(r.falseGreenNearMiss)}), false red ${pct(r.falseRed)}, accuracy ${pct(r.accuracy)} over ${pairs.length} unit checks.`);
    out();
    out(`Latency per call (all units of one rewrite): p50 ${Math.round(percentile(ok.map((c) => c.ms!), 50))} ms wall / ${Math.round(percentile(ok.map((c) => c.apiMs!), 50))} ms API, p95 ${Math.round(percentile(ok.map((c) => c.ms!), 95))} ms wall. List-price cost per call: $${(ok.reduce((a, c) => a + (c.costUsd ?? 0), 0) / Math.max(1, ok.length)).toFixed(4)}.`);
    out();
  }

  // Where each system goes wrong, by label tag.
  const tags: Tag[] = ["near_miss", "omission", "partial", "certainty", "scope", "causal", "qualifier", "polarity", "numbers", "fact", "strong_paraphrase", "merge", "split"];
  const header = ["Tag", "n"];
  const columns: Array<(item: Item, index: number) => Verdict | undefined> = [];
  for (const run of raw.decision) {
    header.push(`${run.provider}: present < 0.5 or drift > 0.5 or numbers`);
    columns.push((item) => {
      const answers = run.cases[item.key]?.answers;
      if (!answers) return undefined;
      const s = signalsFor(answers, item.unit.id);
      return s.present < 0.5 || maxDrift(s, SEMANTIC_DRIFTS) > 0.5 || item.numbersMissing.length ? "flag" : "ok";
    });
  }
  if (claude) {
    header.push("Claude");
    columns.push((_item, index) => claude[index]);
  }
  out("## Errors by tag");
  out();
  out("Share of units with this tag that each system got wrong.");
  out();
  out(`| ${header.join(" | ")} |`);
  out(`|${header.map((_, i) => (i === 0 ? "---" : "---:")).join("|")}|`);
  for (const tag of tags) {
    const tagged = items.map((item, index) => ({ item, index })).filter(({ item }) => item.label.tags?.includes(tag));
    if (!tagged.length) continue;
    const cells = columns.map((column) => {
      const judged = tagged.map(({ item, index }) => [item, column(item, index)] as const).filter(([, v]) => v);
      const wrong = judged.filter(([item, v]) => v !== item.truth).length;
      return judged.length ? `${wrong}/${judged.length}` : "–";
    });
    out(`| ${tag} | ${tagged.length} | ${cells.join(" | ")} |`);
  }
  out();

  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------------

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const cases = buildCases(arg("only"));
  let raw: RawRun;
  const from = arg("from");
  if (from) {
    raw = JSON.parse(readFileSync(from, "utf8")) as RawRun;
  } else {
    const providers = (arg("providers") ?? "jev").split(",") as DecisionProvider[];
    // --add-to <raw.json>: collect only what is asked and merge it into an earlier run.
    const addTo = arg("add-to");
    raw = addTo
      ? (JSON.parse(readFileSync(addTo, "utf8")) as RawRun)
      : { createdAt: new Date().toISOString(), decision: [] };
    const claudeModel = process.argv.includes("--no-claude") ? undefined : (arg("claude") ?? "sonnet");
    const effort = (arg("claude-effort") ?? "medium") as Effort;
    const jobs: Array<Promise<void>> = providers.map(async (provider) => {
      console.log(`Collecting ${provider} answers for ${cases.length} rewrites…`);
      const run = await collectDecisions(provider, cases);
      raw.decision = [...raw.decision.filter((existing) => existing.provider !== provider), run];
    });
    if (claudeModel) {
      jobs.push(
        (async () => {
          console.log(`Collecting Claude (${claudeModel}, effort ${effort}) verdicts…`);
          raw.claude = await collectClaude(claudeModel, effort, cases);
        })(),
      );
    }
    await Promise.all(jobs);
    mkdirSync("eval/results", { recursive: true });
    const file = `eval/results/coverage-${raw.createdAt.replace(/[:.]/g, "-")}.json`;
    writeFileSync(file, JSON.stringify(raw, null, 1));
    console.log(`Raw answers saved to ${file}`);
  }
  const report = score(raw, cases);
  const reportFile = (from ?? `eval/results/coverage-${raw.createdAt.replace(/[:.]/g, "-")}.json`).replace(/\.json$/, ".md");
  writeFileSync(reportFile, report);
  console.log(`\n${report}\nReport saved to ${reportFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
