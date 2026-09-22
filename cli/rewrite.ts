import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import type { Constraint, RewriteResult } from "../lib/rewrite/types";

const help = `Lossless Rewrite — semantic tests for AI rewrites

  npm run rewrite -- --file input.md --instruction "Shorten to 100 words"
  npm run rewrite -- --file input.md --model codex-cli/default --out rewritten.md
  npm run demo                      replay saved evidence; no keys or network

Options:
  --file PATH          Source document; use - to read stdin
  --instruction TEXT   Editing request (default: clearer and more concise)
  --model ID           Provider/model, e.g. codex-cli/default, claude-cli/sonnet
  --keep-meaning TEXT  Protect an exact source passage's meaning; repeatable
  --keep-wording TEXT  Protect exact source characters; repeatable
  --draft PATH         Check and repair an existing rewrite instead of generating
  --repairs N          Repair budget: 0, 1 (default), or 2
  --out PATH           Save plain rewritten text (refuses existing files)
  --report PATH        Save full JSON evidence (refuses existing files)
  --json               Emit JSON instead of plain text on stdout
  --replay             Inspect the recorded demo without any model calls
  --help               Show this help

With no explicit protections, key ideas are extracted from the whole source.
Highlights constrain a full rewrite; they do not select the only output content.
Progress goes to stderr. Use npm run --silent rewrite for clean piping.
Exit codes: 0 = selected checks passed; 1 = error; 2 = unresolved checks.
Live runs require a Jev key and a configured writer. No web server is needed.
`;

async function main() {
  const { values } = parseArgs({ options: {
    help: { type: "boolean", short: "h" }, file: { type: "string" }, instruction: { type: "string" }, model: { type: "string" },
    "keep-meaning": { type: "string", multiple: true }, "keep-wording": { type: "string", multiple: true },
    draft: { type: "string" }, repairs: { type: "string" }, out: { type: "string" }, report: { type: "string" },
    json: { type: "boolean" }, replay: { type: "boolean" },
  }, strict: true, allowPositionals: false });
  if (values.help) { process.stdout.write(help); return; }
  if (!values.replay && !values.file) throw new Error("Choose --file PATH (or --file - for stdin), or --replay. See --help.");
  if (values.replay && [values.file, values.instruction, values.model, values.draft, values.repairs, values["keep-meaning"], values["keep-wording"]].some((value) => value !== undefined)) {
    throw new Error("--replay is saved evidence, so it cannot be combined with live input/model options.");
  }
  const destinations = [values.out, values.report].filter((path): path is string => path !== undefined).map((path) => resolve(path));
  if (new Set(destinations).size !== destinations.length) throw new Error("--out and --report must use different files.");
  for (const path of destinations) if (existsSync(path)) throw new Error(`Refusing to overwrite ${path}. Choose a new output path.`);

  const log = (line: string) => process.stderr.write(`${line}\n`);
  let result: RewriteResult;
  let provenance: string | undefined;
  let recordedAt: string | undefined;
  if (values.replay) {
    const capture = JSON.parse(readFileSync(new URL("../demo/document-repair.json", import.meta.url), "utf8"));
    result = capture.result;
    provenance = capture.provenance;
    recordedAt = capture.capturedAt;
    log("RECORDED DEMO — no model calls, no API keys, no network.");
    log("The initial mistake was deliberately seeded. These are saved real checks and repair.");
    for (const [index, attempt] of result.attempts.entries()) {
      log(`Attempt ${index + 1} (${attempt.pass}): ${attempt.verification.units.map((unit) => `${unit.unit.id} ${unit.status}`).join(", ")}`);
    }
  } else {
    const { loadEnv } = await import("../lib/env");
    const { rewriteSchema, modelSchema } = await import("../lib/rewrite/request");
    const maxRepairs = Number(values.repairs ?? 1);
    if (!Number.isInteger(maxRepairs) || maxRepairs < 0 || maxRepairs > 2) throw new Error("--repairs must be 0, 1, or 2.");
    if (values.model) modelSchema.parse(values.model);
    let source = "";
    if (values.file === "-") {
      if (process.stdin.isTTY) throw new Error("Pipe a document to stdin, or supply a file path.");
      process.stdin.setEncoding("utf8");
      for await (const chunk of process.stdin) {
        source += chunk;
        if (source.length > 100_000) throw new Error("Source exceeds 100,000 characters.");
      }
    } else source = readFileSync(values.file!, "utf8");
    source = source.replace(/\r\n/g, "\n");
    if (!source.trim() || source.length > 100_000) throw new Error("Source must contain 1–100,000 characters.");
    const instruction = values.instruction ?? "Make this clearer and more concise while preserving its purpose and useful context.";
    if (!instruction.trim() || instruction.length > 4000) throw new Error("Instruction must contain 1–4,000 characters.");
    const constraints: Constraint[] = [];
    for (const [option, type] of [["keep-meaning", "keep_meaning"], ["keep-wording", "keep_wording"]] as const) {
      for (const selection of values[option] ?? []) {
        const text = selection.replace(/\r\n/g, "\n");
        const start = source.indexOf(text);
        if (!text.trim() || start < 0) throw new Error(`--${option} must match a nonempty passage in the source.`);
        constraints.push({ id: `c${constraints.length + 1}`, type, text, start, end: start + text.length });
      }
    }
    if (constraints.length > 100) throw new Error("At most 100 protections are allowed.");
    loadEnv();
    if (!process.env.TYPESAFE_API_KEY) throw new Error("Set TYPESAFE_API_KEY in .env.local for live checks; use --replay for a no-key demo.");
    const { extractAll } = await import("../lib/rewrite/extract");
    const { runRewrite } = await import("../lib/rewrite/pipeline");
    if (!constraints.length) constraints.push({ id: "c1", type: "must_cover", start: 0, end: source.length, text: source });
    const regions = constraints.filter((constraint) => constraint.type === "must_cover");
    if (regions.length) log("Extracting key ideas from the full document…");
    const facts = await extractAll(regions, values.model);
    for (const fact of facts) log(`  ${fact.id}: ${fact.text}`);
    const request = rewriteSchema.parse({ source, instruction, constraints, facts, writerModel: values.model, maxRepairs,
      initialText: values.draft ? readFileSync(values.draft, "utf8").replace(/\r\n/g, "\n") : undefined });
    result = await runRewrite(request, (event) => {
      if (event.type === "stage") log(`${event.stage}…`);
      if (event.type === "verified") log(event.verification.units.map((unit) => `${unit.unit.id} ${unit.status}`).join(" · "));
    });
  }
  const verification = result.final.verification;
  const checked = verification.units.length + verification.wording.length;
  const kept = verification.units.filter((unit) => unit.status === "kept").length + verification.wording.filter((wording) => wording.kept).length;
  const passed = checked > 0 && kept === checked;
  const report = { mode: values.replay ? "recorded" : "live", passed, provenance, recordedAt, result };
  const json = JSON.stringify(report, null, 2) + "\n";
  if (values.out) writeFileSync(values.out, result.final.text + "\n", { flag: "wx" });
  if (values.report) writeFileSync(values.report, json, { flag: "wx" });
  log(`${result.sourceWords} → ${result.final.words} words · ${kept}/${checked} selected checks passed${passed ? "" : " · review unresolved checks"}`);
  process.stdout.write(values.json ? json : result.final.text + "\n");
  if (!passed) process.exitCode = 2;
}

main().catch((error: unknown) => {
  process.stderr.write(`Lossless Rewrite: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
