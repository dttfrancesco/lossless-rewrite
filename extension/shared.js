export const HOST = "com.lossless_rewrite.companion";
export const OPERATIONS = new Set(["hello", "models.list", "extract", "check", "rewrite", "cancel", "run.status"]);
export function supportedPage(url) {
  try { const u = new URL(url); return u.protocol === "https:" && ["chatgpt.com", "claude.ai"].includes(u.hostname); } catch { return false; }
}
export function newDocument() {
  return { documentId: crypto.randomUUID(), revision: 0, source: "", reply: "", instruction: "Make the tone friendlier. Keep the details unchanged.", constraints: [], facts: [], history: [], result: null, focus: null, writer: "conversation", model: "codex-cli/default", maxRepairs: 1, maxTightens: 0, recorded: false };
}
export function invalidate(state, reason) {
  state.revision += 1; state.result = null; state.recorded = false; state.notice = reason || "Not checked — the document changed.";
}
export function currentEnvelope(state, envelope, active) {
  return envelope.requestId === active?.requestId && envelope.documentId === state.documentId && envelope.revision === state.revision;
}
export function evidenceFor(state, focus) {
  const fact = state.facts.find((f) => f.id === focus);
  const c = state.constraints.find((c) => c.id === (fact?.constraintId || focus)) || state.constraints[0];
  if (!c) return null;
  const v = state.result?.final?.verification;
  const sorted = state.constraints.filter((x) => x.type === c.type).sort((a, b) => a.start - b.start);
  const id = c.type === "keep_wording" ? `W${sorted.findIndex((x) => x.id === c.id) + 1}` : c.type === "keep_meaning" ? `P${sorted.findIndex((x) => x.id === c.id) + 1}` : (fact || state.facts.find((f) => f.constraintId === c.id))?.id;
  const wording = v?.wording.find((w) => w.id === id); const unit = v?.units.find((u) => u.unit.id === id);
  const sentence = state.result?.final?.sentences.find((s) => s.id === unit?.sentences[0]);
  return { source: fact?.sources[0] || c, location: wording?.location || sentence, status: wording ? wording.kept ? "kept" : "missing" : unit?.status || "Not checked" };
}
export function extendFeedback(previous, feedback) {
  const clean = feedback.trim();
  if (!clean) throw new Error("Add style feedback first.");
  if (clean.length > 4000) throw new Error("Style feedback exceeds 4,000 characters.");
  const trail = previous || [];
  if (trail[trail.length - 1] === clean) return trail;
  if (trail.length >= 30) throw new Error("This document already has 30 style instructions. Start a new document to continue.");
  return [...trail, clean];
}
export function summary(result) {
  const v = result?.final?.verification;
  if (!v) return "Not checked";
  const statuses = [...v.units.map((u) => u.status), ...v.wording.map((w) => w.kept ? "kept" : "missing")];
  if (!statuses.length) return "No details checked";
  const failed = statuses.filter((s) => s === "missing" || s === "altered").length;
  const uncertain = statuses.filter((s) => s === "uncertain").length;
  return failed ? `${failed} detail${failed === 1 ? " needs" : "s need"} repair${uncertain ? `; ${uncertain} uncertain` : ""}` : uncertain ? `${uncertain} detail${uncertain === 1 ? " is" : "s are"} uncertain` : `${statuses.length} selected detail${statuses.length === 1 ? "" : "s"} kept`;
}
export function preparePrompt(state, repair = false, feedback = "") {
  const wording = state.constraints.filter((c) => c.type === "keep_wording").map((c) => c.text);
  const meaning = state.constraints.filter((c) => c.type === "keep_meaning").map((c) => c.text);
  const required = state.facts.map((f) => f.text);
  return [repair ? "Revise the draft below. Return the complete revised document." : "Rewrite the complete source below.",
    `Instruction: ${state.instruction}`, feedback && `Style feedback: ${feedback}`,
    "Preserve useful surrounding context. The protected details are constraints, not a request to return only those details.",
    wording.length && `Keep these exact characters:\n${wording.map((t) => `- ${t}`).join("\n")}`,
    meaning.length && `Keep the meaning, conditions, scope and numbers:\n${meaning.map((t) => `- ${t}`).join("\n")}`,
    required.length && `Cover these ideas:\n${required.map((t) => `- ${t}`).join("\n")}`,
    repair && state.result && `Check findings:\n${JSON.stringify(state.result.final.verification)}`,
    `SOURCE:\n${state.source}`, repair && `DRAFT:\n${state.reply}`].filter(Boolean).join("\n\n");
}
export function assembler() {
  const transfers = new Map();
  return (message) => {
    if (message.type !== "chunk") return message;
    const { transferId, index, count, totalBytes, data } = message;
    if (typeof transferId !== "string" || !Number.isInteger(index) || !Number.isInteger(count) || index < 0 || index >= count || count > 64 || !Number.isInteger(totalBytes) || totalBytes < 1 || totalBytes > 16 * 1024 * 1024 || typeof data !== "string" || data.length > 550000) throw new Error("Invalid companion transfer");
    for (const [id, t] of transfers) if (Date.now() - t.created > 60000) transfers.delete(id);
    if (!transfers.has(transferId)) { if (transfers.size >= 4) throw new Error("Too many companion transfers"); transfers.set(transferId, { count, totalBytes, parts: new Map(), created: Date.now() }); }
    const t = transfers.get(transferId);
    if (t.count !== count || t.totalBytes !== totalBytes || t.parts.has(index)) throw new Error("Conflicting companion transfer");
    t.parts.set(index, Uint8Array.from(atob(data), (c) => c.charCodeAt(0)));
    if (t.parts.size !== count) return null;
    transfers.delete(transferId);
    const bytes = new Uint8Array(totalBytes); let offset = 0;
    for (let i = 0; i < count; i++) { const part = t.parts.get(i); if (offset + part.length > totalBytes) throw new Error("Oversized companion transfer"); bytes.set(part, offset); offset += part.length; }
    if (offset !== totalBytes) throw new Error("Incomplete companion transfer");
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  };
}
