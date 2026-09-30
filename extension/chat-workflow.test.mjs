import test from "node:test";
import assert from "node:assert/strict";
import { newDocument, invalidate } from "./shared.js";
import { SITES, siteFor } from "./sites.js";
import { createChatTask, applyChatResponse, localResult, revisionChanges } from "./chat-workflow.js";
function state() {
  const s = newDocument(); s.source = "Accuracy improved. Speed did not change."; s.reply = "Accuracy improved."; s.complete = true;
  s.constraints = [{ id: "a", type: "keep_meaning", start: 19, end: 40, text: "Speed did not change." }];
  s.chatTask = createChatTask(s, "check"); return s;
}
function response(s, extra = {}) { return { format: "lossless-v1", kind: s.chatTask.kind, token: s.chatTask.token, units: [{ id: "P1", status: "missing", sentences: [], reason: "The unchanged speed is absent." }], ...extra }; }
test("each supported origin is exact, HTTPS and has no nonstandard port", () => {
  for (const site of SITES) {
    assert.equal(siteFor(`https://${site.host}/chat/123`).id, site.id);
    for (const url of [`http://${site.host}/`, `https://${site.host}.evil.test/`, `https://${site.host}:8443/`]) assert.equal(Boolean(siteFor(url)), false);
  }
});
test("chat check applies all verdicts to original sentence offsets without inventing confidence", () => {
  const s = state(), r = applyChatResponse(s, JSON.stringify(response(s)));
  assert.equal(r.result.method, "chat-review"); assert.equal(r.result.final.verification.units[0].status, "missing");
  assert.equal(r.result.final.verification.units[0].present, undefined);
  assert.equal(s.source, "Accuracy improved. Speed did not change.");
});
test("stale or foreign replies cannot re-green edited text", () => {
  const s = state(), raw = JSON.stringify(response(s));
  assert.throws(() => applyChatResponse(s, JSON.stringify(response(s, { token: "other" }))), /different request/);
  invalidate(s); assert.throws(() => applyChatResponse(s, raw), /stale/);
});
test("omitted, duplicate, extra and fabricated evidence verdicts are rejected atomically", () => {
  const s = state();
  for (const units of [[], [response(s).units[0], response(s).units[0]], [{ ...response(s).units[0], id: "P2" }], [{ id: "P1", status: "kept", sentences: [], reason: "" }], [{ id: "P1", status: "kept", sentences: ["S999"], reason: "" }], [{ id: "P1", status: "missing", sentences: ["S1"], reason: "" }]]) {
    assert.throws(() => applyChatResponse(s, JSON.stringify(response(s, { units }))));
  }
  assert.equal(s.result, null);
});
test("JSON fences are accepted but prose or an oversized response is not", () => {
  const s = state(), raw = JSON.stringify(response(s));
  assert.ok(applyChatResponse(s, '```json\n' + raw + '\n```').result);
  assert.throws(() => applyChatResponse(s, "Here it is: " + raw), /complete JSON/);
  assert.throws(() => applyChatResponse(s, "x".repeat(300001)), /too large/);
});
test("idea extraction validates each region and maps local sentence IDs into full-source offsets", () => {
  const s = state(); s.constraints = [{ id: "region", type: "must_cover", start: 19, end: 40, text: "Speed did not change." }];
  s.chatTask = createChatTask(s, "inventory");
  const r = response(s, { regions: [{ id: "region", facts: [{ text: "Speed did not change.", sources: ["S1"] }] }] }); delete r.units;
  const parsed = applyChatResponse(s, JSON.stringify(r));
  assert.equal(parsed.facts[0].constraintId, "region"); assert.equal(parsed.facts[0].sources[0].start, 19);
  assert.equal(s.facts.length, 0);
  r.regions[0].facts[0].sources = ["fake"];
  assert.throws(() => applyChatResponse(s, JSON.stringify(r)), /invalid text or source/);
});
test("exact wording stays a local exact-character check", () => {
  const s = state(); s.constraints = [{ type: "keep_wording", start: 0, text: "Accuracy improved." }, { type: "keep_wording", start: 19, text: "Speed did not change." }];
  const result = localResult(s); assert.equal(result.method, "local-exact");
  assert.deepEqual(result.final.verification.wording.map(w => w.kept), [true, false]);
  s.reply = "Accuracy  improved."; assert.equal(localResult(s).final.verification.wording[0].kept, false);
});
test("revision comparison matches meaning texts, not unstable extracted IDs", () => {
  const a = { final: { verification: { units: [{ unit: { id: "F1", text: "Speed unchanged", kind: "must_cover" }, status: "kept" }] } } };
  const b = { final: { verification: { units: [{ unit: { id: "F2", text: "Speed unchanged", kind: "must_cover" }, status: "missing" }, { unit: { id: "F1", text: "Different idea", kind: "must_cover" }, status: "missing" }] } } };
  assert.deepEqual(revisionChanges(a, b), [{ text: "Speed unchanged", before: "kept", after: "missing" }]);
});
