import assert from "node:assert/strict";
import { test } from "node:test";
import { best } from "./pipeline";
import { rewriteSchema } from "./request";
import type { Attempt } from "./types";
import { reduce } from "../../components/use-rewrite";

const attempt = (status: "kept" | "missing" | "uncertain", words: number, pass: Attempt["pass"] = "draft"): Attempt => ({
  text: `${status} ${words}`, words, pass, sentences: [], repairing: [], writeMs: 1,
  verification: { units: [{ unit: { id: "F1", kind: "must_cover", text: "A claim." }, status, present: .9, sentences: [], numbersMissing: [], decidedBy: "decision" }], wording: [], escalated: 0, decisionMs: 1, adjudicationMs: 0, decisionTokens: 1 },
});
test("a verified draft beats a shorter uncertain tightening", () => {
  const verified = attempt("kept", 120);
  assert.equal(best([verified, attempt("uncertain", 100, "tighten")], 100), verified);
});
test("repair evidence survives JSON serialization and a later tightening", () => {
  const attempts = [attempt("missing", 80), attempt("kept", 120, "repair"), attempt("kept", 100, "tighten")];
  const event = JSON.parse(JSON.stringify({ type: "done", result: { attempts, final: attempts[2], sourceWords: 200 } }));
  const state = reduce({ status: "running" }, event);
  assert.equal(state.draft?.attempt, 2);
  assert.equal(state.previous?.units[0]?.status, "missing");
});
test("HTTP requests reject malformed marks, empty inventories and unbounded passes", () => {
  const request = { source: "A claim.", instruction: "Shorten.", constraints: [], facts: [] };
  assert.equal(rewriteSchema.safeParse(request).success, true);
  assert.equal(rewriteSchema.safeParse({ ...request, maxRepairs: 100 }).success, false);
  assert.equal(rewriteSchema.safeParse({ ...request, constraints: [{ id: "c", type: "must_cover", text: "A claim.", start: 0, end: 8 }] }).success, false);
  assert.equal(rewriteSchema.safeParse({ ...request, constraints: [{ id: "c", type: "keep_meaning", text: "B claim.", start: 0, end: 8 }] }).success, false);
});
