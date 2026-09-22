/** Capture real checker + repair output for the public demo. Input omission is deliberate. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadEnv } from "../lib/env";
import { runRewrite } from "../lib/rewrite/pipeline";
import type { PipelineEvent, Constraint } from "../lib/rewrite/types";

loadEnv();
const refund = process.argv.includes("--refund");
const eligibility = process.argv.includes("--eligibility");
const document = process.argv.includes("--document") ? JSON.parse(readFileSync("demo/document-example.json", "utf8")) as { sourceFile: string; initialText: string; instruction: string; requirements: Array<{text: string; quote: string}> } : undefined;
const chat = eligibility || refund || process.argv.includes("--chat") ? JSON.parse(readFileSync(eligibility ? "demo/eligibility-example.json" : refund ? "demo/refund-example.json" : "demo/chat-example.json", "utf8")) as { source: string; initialText: string; instruction: string; requirement: string } : undefined;
const source = document ? readFileSync(document.sourceFile, "utf8").replace(/\r\n/g, "\n").trim() : chat?.source ?? readFileSync("demo/delivery-policy.md", "utf8").replace(/\r\n/g, "\n").trim();
const initialText = document?.initialText ?? chat?.initialText ?? "Shopping online should feel straightforward, with delivery and returns explained before checkout. Delivery is free, and any available shipping options are shown before payment. Returns are accepted within 30 days of delivery, with instructions in the order confirmation email. Customers can review these details before buying and contact the support team if they need help with their order.";
const constraints: Constraint[] = [{ id: "demo", type: "must_cover", start: 0, end: source.length, text: source }];
const facts = document ? document.requirements.map((requirement, i) => {
  const start = source.indexOf(requirement.quote);
  if (start < 0) throw new Error(`Requirement ${i + 1} does not match the source.`);
  return { id: `F${i + 1}`, constraintId: "demo", text: requirement.text, sources: [{ start, end: start + requirement.quote.length }] };
}) : [{ id: "F1", constraintId: "demo", text: chat?.requirement ?? "Delivery is free only on orders of $50 or more; orders below $50 have a delivery charge.", sources: [{ start: 0, end: source.length }] }];
const events: Array<{ elapsedMs: number; event: PipelineEvent }> = [];
const began = performance.now();
const instruction = document?.instruction ?? chat?.instruction ?? "Make the tone friendlier. Do not change any delivery or returns conditions.";
const result = await runRewrite({ source, initialText, instruction, constraints, facts, writerModel: "codex-cli/default", maxRepairs: 1, maxTightens: 0 }, (event) => {
  events.push({ elapsedMs: Math.round(performance.now() - began), event });
  if (event.type === "stage") console.log(event.stage);
});
// Keep unsuccessful runs too; never silently cherry-pick them out of the audit trail.
mkdirSync("eval/results", { recursive: true });
writeFileSync(`eval/results/demo-capture-${Date.now()}.json`, JSON.stringify({ source, initialText, instruction, facts, events, result }, null, 2));
if (result.attempts[0]?.verification.units.find((u) => u.unit.id === (document ? "F4" : "F1"))?.status === "kept") throw new Error("The deliberate omission was not detected; do not publish this capture.");
if (!result.final.verification.units.every((u) => u.status === "kept")) throw new Error("Repair did not pass; do not publish this capture.");
mkdirSync("demo", { recursive: true });
writeFileSync(document ? "demo/document-repair.json" : eligibility ? "demo/eligibility-repair.json" : refund ? "demo/refund-repair.json" : chat ? "demo/chat-repair.json" : "demo/verified-repair.json", JSON.stringify({ provenance: "Illustrative source; deliberately flawed input draft; real Jev checks and Codex repair. Edited replay, not live generation.", capturedAt: new Date().toISOString(), source, initialText, instruction, facts, events, result }, null, 2));
console.log(`Saved real repair: ${result.sourceWords} → ${result.final.words} words, ${result.final.verification.units.length} ideas verified.`);
