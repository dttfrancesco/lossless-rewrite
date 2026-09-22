/**
 * The same rewrite with different writer models, side by side: one extraction, the same marks
 * and instruction, every writer through the full loop in parallel.
 *
 *   npx tsx eval/compare-writers.ts                          the built-in demo, Sonnet vs Opus
 *   npx tsx eval/compare-writers.ts --file some.md --out dir --models sonnet,opus --instruction "..."
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "../lib/env";
import { extractAll } from "../lib/rewrite/extract";
import { runRewrite } from "../lib/rewrite/pipeline";
import type { Constraint, RewriteResult } from "../lib/rewrite/types";
import { wordCount } from "../lib/text/sentences";

loadEnv();

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const file = arg("file");
const source = readFileSync(file ?? "demo/lost-in-compression.md", "utf8").replace(/\r\n/g, "\n");
const instruction = arg("instruction") ?? "Cut this to ~250 words and make it much tighter.";
const models = (arg("models") ?? "sonnet,opus").split(",");
const outDir = arg("out") ?? "eval/results";

function between(first: string, last: string): Constraint["text"] {
  const start = source.indexOf(first);
  return source.slice(start, source.indexOf(last, start) + last.length);
}
const mark = (type: Constraint["type"], id: string, text: string): Constraint => {
  const start = source.indexOf(text);
  return { id, type, start, end: start + text.length, text };
};
const constraints: Constraint[] = file
  ? [{ id: "c1", type: "must_cover", start: 0, end: source.length, text: source }]
  : [
      mark("keep_wording", "c1", "The most fluent version was not necessarily the one that kept the most findings."),
      mark("keep_meaning", "c2", between("This pattern appeared to extend", "generalizes across fields.")),
      { id: "c3", type: "must_cover", start: 0, end: source.length, text: source },
    ];

console.log(`${wordCount(source)} words · "${instruction}" · writers: ${models.join(", ")}`);
const facts = await extractAll(constraints.filter((c) => c.type === "must_cover"));
console.log(`${facts.length} required ideas extracted once, shared by every writer.`);

const runs = await Promise.all(
  models.map(async (model) => {
    const started = performance.now();
    const stages: string[] = [];
    try {
      const result = await runRewrite({ source, instruction, constraints, facts, writerModel: model }, (event) => {
        if (event.type === "stage" && (event.stage === "repairing" || event.stage === "tightening")) {
          stages.push(`${event.stage}${event.ids?.length ? ` ${event.ids.join(",")}` : ""}`);
        }
      });
      return { model, result, seconds: (performance.now() - started) / 1000, stages };
    } catch (error) {
      return { model, error: String(error), seconds: (performance.now() - started) / 1000, stages };
    }
  }),
);

mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const row = (model: string, r: RewriteResult, seconds: number, stages: string[]) => {
  const kept = r.final.verification.units.filter((u) => u.status === "kept").length;
  const wording = r.final.verification.wording.every((w) => w.kept) ? "kept" : "changed";
  return `| ${model} | ${r.sourceWords} → ${r.final.words} (${Math.round(100 * (1 - r.final.words / r.sourceWords))}% shorter) | ${kept}/${r.final.verification.units.length} | ${wording} | ${stages.join(" → ") || "none"} | ${seconds.toFixed(0)} s |`;
};
const table = [
  "| Writer | Words | Ideas kept | Keep wording | Extra passes | Time |",
  "|---|---|---|---|---|---|",
  ...runs.map((run) => ("result" in run && run.result ? row(run.model, run.result, run.seconds, run.stages) : `| ${run.model} | failed: ${"error" in run ? run.error : ""} | | | | |`)),
].join("\n");
console.log(`\n${table}\n`);

for (const run of runs) {
  if (!("result" in run) || !run.result) continue;
  const path = join(outDir, `writer-${run.model}-${stamp}.md`);
  writeFileSync(
    path,
    [
      `# ${run.model}`,
      `Instruction: ${instruction}`,
      "## Required ideas",
      ...run.result.final.verification.units.map((u) => `- ${u.status === "kept" ? "✓" : "✕"} ${u.unit.id}: ${u.unit.text}`),
      "## Rewrite",
      run.result.final.text,
    ].join("\n\n"),
  );
  console.log(`${run.model}: ${path}`);
}
