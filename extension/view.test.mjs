import test from "node:test";
import assert from "node:assert/strict";
import { newDocument, invalidate } from "./shared.js";
import { refreshEvidenceLabels, beginOperation, requireIdle, evidenceLabel } from "./view.js";

function fixture() {
  const state = newDocument(); state.constraints = [{ id: "region", type: "must_cover", start: 0, end: 4 }]; state.facts = [{ id: "F1", constraintId: "region", sources: [{ start: 0, end: 4 }] }];
  state.result = { final: { sentences: [], verification: { wording: [], units: [{ unit: { id: "F1" }, status: "kept", sentences: [] }] } } };
  const labels = [{ dataset: { evidenceId: "region", evidencePrefix: "Must cover" }, textContent: "Must cover · kept" }, { dataset: { evidenceId: "F1", evidencePrefix: "Trace idea" }, textContent: "Trace idea · kept" }];
  const input = { value: "Currently typing", selectionStart: 5, selectionEnd: 5 };
  const root = { querySelectorAll(selector) { assert.equal(selector, "[data-evidence-id]"); return labels; }, input };
  return { state, root, labels, input };
}
test("editing an idea clears every visible verdict without replacing its input", () => {
  const { state, root, labels, input } = fixture(); invalidate(state); refreshEvidenceLabels(root, state);
  assert.deepEqual(labels.map((l) => l.textContent), ["Must cover · 1 idea", "Trace idea · Not checked"]);
  assert.equal(root.input, input); assert.equal(input.selectionStart, 5); assert.equal(input.value, "Currently typing");
});
test("rechecking clears live success while historical evidence remains available", () => {
  const { state, root, labels } = fixture(); const prior = state.result; state.history = [{ result: prior }];
  beginOperation(state, "Checking this reply…"); refreshEvidenceLabels(root, state);
  assert.equal(state.result, null); assert.equal(state.notice, "Checking this reply…"); assert.equal(state.history[0].result, prior); assert.equal(labels[1].textContent, "Trace idea · Not checked");
});
test("inference remains busy even when an edit invalidates its visible active result", () => {
  const { state } = fixture(); const inference = { requestId: "still-running" }; invalidate(state);
  assert.throws(() => requireIdle(inference), /already running/); assert.doesNotThrow(() => requireIdle(null));
});
test("must-cover parent counts ideas instead of inheriting the first fact verdict", () => {
  const { state } = fixture(); state.facts.push({ id: "F2", constraintId: "region", sources: [{ start: 0, end: 4 }] }); state.result.final.verification.units.push({ unit: { id: "F2" }, status: "missing", sentences: [] });
  assert.equal(evidenceLabel(state, "region", "Must cover"), "Must cover · 2 ideas");
  assert.equal(evidenceLabel(state, "F1", "Trace idea"), "Trace idea · kept");
  assert.equal(evidenceLabel(state, "F2", "Trace idea"), "Trace idea · missing");
});
