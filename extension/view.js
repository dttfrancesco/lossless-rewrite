import { evidenceFor } from "./shared.js";

export function evidenceLabel(state, id, prefix) {
  const constraint = state.constraints.find((c) => c.id === id);
  if (constraint?.type === "must_cover") {
    const count = state.facts.filter((f) => f.constraintId === id).length;
    return `${prefix} · ${count} idea${count === 1 ? "" : "s"}`;
  }
  return `${prefix} · ${evidenceFor(state, id)?.status || "Not checked"}`;
}

/** Update verdict text without replacing editable controls or disturbing selection. */
export function refreshEvidenceLabels(root, state) {
  for (const label of root.querySelectorAll("[data-evidence-id]")) {
    label.textContent = evidenceLabel(state, label.dataset.evidenceId, label.dataset.evidencePrefix);
  }
}

export function requireIdle(inference) {
  if (inference) throw new Error("A request is already running. Wait for it to finish before starting another.");
}

export function beginOperation(state, message) {
  state.result = null;
  state.recorded = false;
  state.notice = message;
}
