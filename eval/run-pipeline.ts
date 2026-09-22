/**
 * The whole loop from the command line: extract the Must cover inventory, rewrite, verify,
 * repair, tighten.
 *
 *   npx tsx eval/run-pipeline.ts                       the built-in demo with its marks
 *   npx tsx eval/run-pipeline.ts --file some.md        a whole file as one Must cover region
 *   options: --instruction "..."  --model sonnet|opus  --out result.md  --no-brief  --repairs 1
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "../lib/env";
import { DecisionClient } from "../lib/decision/client";
import { extractAll } from "../lib/rewrite/extract";
import { runRewrite } from "../lib/rewrite/pipeline";
import type { Constraint } from "../lib/rewrite/types";
import { wordCount } from "../lib/text/sentences";

loadEnv();

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const file = arg("file");
const source = readFileSync(file ?? "demo/lost-in-compression.md", "utf8").replace(/\r\n/g, "\n");
const instruction = arg("instruction") ?? "Cut this to ~250 words and make it much tighter.";
const model = arg("model");

function between(first: string, last: string): string {
  const start = source.indexOf(first);
  const end = source.indexOf(last, start);
  if (start < 0 || end < 0) throw new Error(`Not in the document: ${first.slice(0, 60)}…`);
  return source.slice(start, end + last.length);
}

function span(type: Constraint["type"], id: string, text: string): Constraint {
  const start = source.indexOf(text);
  return { id, type, start, end: start + text.length, text };
}

// The demo's marks: one sentence kept word for word, one tangled caveat kept in meaning, all four sections covered.
const constraints: Constraint[] = file
  ? [{ id: "c1", type: "must_cover", start: 0, end: source.length, text: source }]
  : [
      span("keep_wording", "c1", "The most fluent version was not necessarily the one that kept the most findings."),
      span("keep_meaning", "c2", between("This pattern appeared to extend", "generalizes across fields.")),
      { id: "c3", type: "must_cover", start: 0, end: source.length, text: source },
    ];

const log = (line: string) => console.log(`[${(performance.now() / 1000).toFixed(1)}s] ${line}`);

log(`Source: ${wordCount(source)} words · writer: ${model ?? process.env.LLM_MODEL_WRITE ?? process.env.LLM_MODEL ?? "sonnet"}`);
log("Extracting the Must cover inventory…");
const facts = await extractAll(constraints.filter((c) => c.type === "must_cover"), model);
for (const fact of facts) log(`  ${fact.id}: ${fact.text}`);

const started = performance.now();
const result = await runRewrite(
  {
    source,
    instruction,
    constraints,
    facts,
    writerModel: model,
    maxRepairs: Number(arg("repairs") ?? 1),
    briefFacts: !process.argv.includes("--no-brief"),
  },
  (event) => {
    switch (event.type) {
      case "stage":
        log(`${event.stage}${event.ids?.length ? ` ${event.ids.join(", ")}` : ""} (attempt ${event.attempt})`);
        break;
      case "draft":
        log(`draft ${event.attempt}: ${event.words} words, ${event.sentences.length} sentences`);
        break;
      case "verified": {
        const v = event.verification;
        log(`verified in ${Math.round(v.decisionMs)} ms (+${Math.round(v.adjudicationMs)} ms Claude for ${v.escalated} units)`);
        for (const u of v.units) {
          const mark = u.status === "kept" ? "✓" : u.status === "uncertain" ? "?" : "✕";
          log(`  ${mark} ${u.unit.id} ${u.status}${u.sentences.length ? ` → ${u.sentences.join(", ")}` : ""} (present ${u.present.toFixed(2)}${u.numbersMissing.length ? `, numbers missing: ${u.numbersMissing.join(", ")}` : ""}${u.decidedBy === "llm" ? `, Claude${u.reason ? `: ${u.reason}` : ""}` : ""})`);
        }
        for (const w of v.wording) log(`  ${w.kept ? "✓" : "✕"} ${w.id} wording ${w.kept ? "kept" : "changed"}`);
        break;
      }
      case "error":
        log(`error: ${event.message}`);
        break;
    }
  },
  new DecisionClient(),
);
const rewriteSeconds = (performance.now() - started) / 1000;

const final = result.final;
const kept = final.verification.units.filter((u) => u.status === "kept").length;
const summary = `${result.sourceWords} → ${final.words} words (${Math.round(100 * (1 - final.words / result.sourceWords))}% shorter), ${kept}/${final.verification.units.length} required units kept, ${result.attempts.length} attempt(s) [${result.attempts.map((a) => a.pass).join(" → ")}], ${rewriteSeconds.toFixed(0)} s after extraction`;
console.log(`\n${"-".repeat(80)}\n${final.text}\n${"-".repeat(80)}`);
log(summary);

const out = arg("out");
if (out) {
  writeFileSync(
    out,
    [
      `# ${model ?? "default"} writer — ${summary}`,
      `Instruction: ${instruction}`,
      `## Required ideas`,
      ...final.verification.units.map((u) => `- ${u.status === "kept" ? "✓" : "✕"} ${u.unit.id} ${u.unit.text}`),
      `## Rewrite`,
      final.text,
    ].join("\n\n"),
  );
  log(`Saved to ${out}`);
}
