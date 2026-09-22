import test from "node:test";
import assert from "node:assert/strict";
import { assembler, supportedPage, newDocument, invalidate, currentEnvelope, summary, preparePrompt, evidenceFor, extendFeedback } from "./shared.js";
test("site access accepts exact HTTPS chat origins only", () => {
  assert.equal(supportedPage("https://chatgpt.com/c/123"), true);
  for (const url of ["https://chatgpt.com.evil.test/", "http://claude.ai/", "https://evil.test/?url=https://claude.ai", "file:///tmp/a"]) assert.equal(supportedPage(url), false);
});
test("editing rejects late results, clears green and preserves historical evidence", () => {
  const state = newDocument(); state.history = [{ previous: true }]; state.result = { final: true };
  const run = { requestId: "r", documentId: state.documentId, revision: state.revision };
  assert.equal(currentEnvelope(state, run, run), true); invalidate(state);
  assert.equal(currentEnvelope(state, run, run), false); assert.equal(state.result, null); assert.equal(state.history.length, 1);
  assert.equal(newDocument().model, "codex-cli/default");
});
test("zero checks and uncertainty never become all kept", () => {
  assert.equal(summary({ final: { verification: { units: [], wording: [] } } }), "No details checked");
  assert.match(summary({ final: { verification: { units: [{ status: "uncertain" }], wording: [] } } }), /uncertain/);
});
test("chat prompts include full context and exact wording rather than highlights only", () => {
  const state = newDocument(); state.source = "Context. Exact  words. Useful closing."; state.constraints = [{ type: "keep_wording", text: "Exact  words." }];
  const prompt = preparePrompt(state); assert.ok(prompt.includes(state.source)); assert.ok(prompt.includes("Exact  words.")); assert.match(prompt, /constraints, not a request to return only/);
});
test("evidence uses canonical sorted P/W IDs and exact reply offsets", () => {
  const state = newDocument(); state.source = "One. Two."; state.constraints = [{ id: "later", type: "keep_wording", start: 5, end: 9 }, { id: "first", type: "keep_wording", start: 0, end: 4 }];
  state.result = { final: { sentences: [], verification: { units: [], wording: [{ id: "W2", kept: true, location: { start: 12, end: 16 } }] } } };
  assert.deepEqual(evidenceFor(state, "later").location, { start: 12, end: 16 }); assert.equal(evidenceFor(state, "first").status, "Not checked");
});
test("individual extracted facts select their own source spans and reply sentences", () => {
  const state = newDocument(); state.constraints = [{ id: "region", type: "must_cover", start: 0, end: 40 }];
  state.facts = [{ id: "F1", constraintId: "region", sources: [{ start: 0, end: 10 }] }, { id: "F2", constraintId: "region", sources: [{ start: 20, end: 40 }] }];
  state.result = { final: { sentences: [{ id: "S1", start: 0, end: 7 }, { id: "S2", start: 8, end: 15 }], verification: { wording: [], units: [{ unit: { id: "F1" }, status: "missing", sentences: [] }, { unit: { id: "F2" }, status: "kept", sentences: ["S2"] }] } } };
  assert.equal(evidenceFor(state, "F2").source.start, 20); assert.equal(evidenceFor(state, "F2").location.start, 8); assert.equal(evidenceFor(state, "F2").status, "kept"); assert.equal(evidenceFor(state, "F1").location, undefined);
});
test("style steering accumulates feedback with engine-compatible bounds", () => {
  const first = extendFeedback([], " Warmer. "); const next = extendFeedback(first, "Use shorter sentences.");
  assert.deepEqual(next, ["Warmer.", "Use shorter sentences."]); assert.deepEqual(extendFeedback(next, "Use shorter sentences."), next);
  assert.throws(() => extendFeedback(Array(30).fill("earlier"), "next"), /30/);
});
test("chunk assembly preserves UTF-8 and rejects conflicting or oversized transfers", () => {
  const decode = assembler(); const data = Buffer.from(JSON.stringify({ type: "result", payload: "é🙂" })); const parts = [data.subarray(0, 7), data.subarray(7)];
  const chunk = (index) => ({ type: "chunk", transferId: "a", index, count: 2, totalBytes: data.length, data: parts[index].toString("base64") });
  assert.equal(decode(chunk(1)), null); assert.deepEqual(decode(chunk(0)), { type: "result", payload: "é🙂" });
  assert.throws(() => decode({ ...chunk(0), totalBytes: 20 * 1024 * 1024 }), /Invalid/);
  const other = assembler(); other(chunk(0)); assert.throws(() => other(chunk(0)), /Conflicting/);
});
