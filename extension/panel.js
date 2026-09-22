import { CATALOG } from "../lib/llm/catalog.ts";
import recorded from "../demo/document-repair.json";
import { newDocument, invalidate, currentEnvelope, summary, preparePrompt, evidenceFor, extendFeedback } from "./shared.js";
import { refreshEvidenceLabels, requireIdle, beginOperation, evidenceLabel } from "./view.js";
const $ = (id) => document.getElementById(id);
let state = newDocument(); let active = null; let inference = null; let connection = false; let providers = CATALOG; let port; const callbacks = new Map();
let composer = null; let promptTabId; const instance = crypto.randomUUID();
document.body.classList.toggle("expanded", new URLSearchParams(location.search).has("expanded"));
function persist() { state._instance = instance; return chrome.storage.session.set({ document: state }).catch(() => { notice("This document is too large for session storage. Export the evidence before closing the panel.", true); }); }
function notice(text, error = false) { $("status").textContent = text; $("status").classList.toggle("error", error); }
function changed(reason, refresh = true) { invalidate(state, reason); active = null; $("cancel").hidden = true; persist(); notice(state.notice); if (refresh) renderRequirements(); else refreshEvidenceLabels($("requirements"), state); renderTraces(); }
function saveEdit(key, value) { state[key] = value; changed(); }
function attachPort() {
  port = chrome.runtime.connect({ name: "lossless-panel" });
  port.onDisconnect.addListener(() => { port = null; connection = false; $("connection").textContent = "Extension worker disconnected. Reconnect before continuing. A running request was not restarted."; active = null; $("cancel").hidden = true; for (const cb of callbacks.values()) cb.reject(new Error("Extension worker disconnected")); callbacks.clear(); });
  port.onMessage.addListener((m) => {
    if (m.kind === "connection") { connection = false; $("connection").textContent = m.error; for (const cb of callbacks.values()) cb.reject(new Error(m.error)); callbacks.clear(); active = null; $("cancel").hidden = true; return; }
    if (m.kind === "page-changed") {
      if ([state.sourceRef, state.replyRef].some((r) => r && r.tabId === m.tabId && (m.navigation || m.ids.includes(r.id)))) { changed("The captured page message changed. Import it again before checking."); state.complete = false; $("complete").checked = false; persist(); } return;
    }
    if (m.kind !== "native") return;
    const e = m.envelope; const cb = callbacks.get(e.requestId);
    if (["result", "error", "status"].includes(e.type) && cb) {
      callbacks.delete(e.requestId);
      if (e.type === "error") cb.reject(new Error(typeof e.payload === "string" ? e.payload : e.payload?.message || e.payload?.error || "Companion operation failed")); else cb.resolve(e.payload);
    }
    if (!currentEnvelope(state, e, active)) return;
    if (e.type === "event" && e.sequence > (active.sequence || 0)) { active.sequence = e.sequence; const event = e.payload; if (event.type === "stage") notice(`${event.stage} · attempt ${event.attempt + 1}`); }
  });
}
function rpc(operation, payload = {}) {
  const envelope = { version: 1, requestId: crypto.randomUUID(), documentId: state.documentId, revision: state.revision, operation, payload };
  const promise = new Promise((resolve, reject) => callbacks.set(envelope.requestId, { resolve, reject }));
  port.postMessage({ kind: "native", envelope }); return { envelope, promise };
}
async function call(operation, payload) { return rpc(operation, payload).promise; }
async function page(action, args = {}) { const target = document.body.classList.contains("expanded") ? state.targetTabId : undefined; const result = await chrome.runtime.sendMessage({ kind: "page", action, ...(target ? { tabId: target } : {}), ...args }); if (result?.error) throw new Error(result.error); if (result?.tabId) { state.targetTabId = result.tabId; persist(); } return result; }
function action(id, fn) { $(id).addEventListener("click", () => Promise.resolve().then(fn).catch((e) => notice(e.message, true))); }
function tab(name) { for (const n of ["source", "reply", "details"]) { $(`${n}-pane`).hidden = n !== name; document.querySelector(`[data-tab="${n}"]`).setAttribute("aria-selected", String(n === name)); } }
document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => tab(b.dataset.tab)));
function renderModels() {
  const provider = state.model.split("/")[0]; const model = state.model.slice(provider.length + 1);
  $("provider").replaceChildren(...providers.map((p) => new Option(`${p.name}${p.configured === false ? " · not configured" : ""}`, p.id)));
  $("provider").value = provider;
  const found = providers.find((p) => p.id === provider) || providers[0];
  $("model").replaceChildren(...found.models.map((id) => new Option(id, id)));
  if (found.models.includes(model)) { $("model").value = model; $("custom-model").value = ""; } else $("custom-model").value = model;
  $("model-summary").textContent = `${state.writer === "conversation" ? "Assistant" : "Writer"}: ${found.name} / ${model}`;
}
function render() {
  for (const key of ["source", "reply", "instruction", "writer"]) $(key).value = state[key];
  $("complete").checked = Boolean(state.complete); $("repairs").value = state.maxRepairs; $("tightens").value = state.maxTightens;
  $("run").textContent = state.writer === "conversation" ? "Prepare chat prompt" : "Rewrite";
  $("assistant-note").textContent = state.writer === "conversation" ? "Used for extraction and second opinions. The chat site's model stays selected there." : "Used for extraction, writing, repairs and second opinions.";
  renderModels(); renderRequirements(); renderTraces(); renderHistory(); notice(`${state.recorded ? "Recorded example · " : ""}${state.result ? summary(state.result) : state.notice || "Not checked"}`);
}
function renderRequirements() {
  const root = $("requirements"); root.replaceChildren();
  if (!state.constraints.length) { root.textContent = "No protected details yet. Select text in Source, or find key ideas."; return; }
  for (const c of state.constraints) {
    const box = document.createElement("div"); box.className = "requirement";
    const b = document.createElement("button"); b.textContent = c.text; b.setAttribute("aria-pressed", String(state.focus === c.id)); b.onclick = () => { state.focus = c.id; persist(); renderRequirements(); renderTraces(); };
    const label = document.createElement("p"); label.className = "kind"; label.dataset.evidenceId = c.id; label.dataset.evidencePrefix = { keep_wording: "Keep wording", keep_meaning: "Keep meaning", must_cover: "Must cover" }[c.type]; label.textContent = evidenceLabel(state, c.id, label.dataset.evidencePrefix);
    const remove = document.createElement("button"); remove.textContent = "Remove mark"; remove.onclick = () => { state.constraints = state.constraints.filter((x) => x.id !== c.id); state.facts = state.facts.filter((f) => f.constraintId !== c.id); changed(); renderRequirements(); };
    box.append(b, label, remove);
    for (const f of state.facts.filter((f) => f.constraintId === c.id)) {
      const focus = document.createElement("button"); focus.dataset.evidenceId = f.id; focus.dataset.evidencePrefix = "Trace idea"; focus.textContent = `Trace idea · ${evidenceFor(state, f.id).status}`; focus.setAttribute("aria-pressed", String(state.focus === f.id)); focus.onclick = () => { state.focus = f.id; persist(); renderRequirements(); renderTraces(); };
      const input = document.createElement("textarea"); input.value = f.text; input.maxLength = 4000; input.setAttribute("aria-label", "Required idea"); input.oninput = () => { f.text = input.value; changed(undefined, false); }; input.onchange = () => renderRequirements();
      const del = document.createElement("button"); del.textContent = "Remove idea"; del.onclick = () => { state.facts = state.facts.filter((x) => x.id !== f.id); changed(); renderRequirements(); };
      box.append(focus, input, del);
    }
    if (c.type === "must_cover" && !state.facts.some((f) => f.constraintId === c.id)) { const p = document.createElement("p"); p.textContent = "Ideas not extracted. Retry extraction or remove this mark before running."; const retry = document.createElement("button"); retry.textContent = "Extract ideas"; retry.onclick = () => extract().catch((e) => notice(e.message, true)); box.append(p, retry); }
    root.append(box);
  }
}
function trace(root, text, start, end, label) {
  root.replaceChildren(); const title = document.createElement("strong"); title.textContent = label; root.append(title, document.createElement("br"));
  if (start === undefined) { root.append(document.createTextNode(text)); return; }
  const mark = document.createElement("mark"); mark.textContent = text.slice(start, end); root.append(document.createTextNode(text.slice(Math.max(0, start - 120), start)), mark, document.createTextNode(text.slice(end, end + 200)));
}
function renderTraces() {
  const evidence = evidenceFor(state, state.focus);
  $("source-trace").replaceChildren(); $("reply-trace").replaceChildren(); if (!evidence) return;
  trace($("source-trace"), state.source, evidence.source.start, evidence.source.end, "Selected source passage");
  if (!state.result) return;
  const location = evidence.location;
  if (location) trace($("reply-trace"), state.reply, location.start, location.end, `Reply evidence · ${evidence.status}`);
  else trace($("reply-trace"), "No matching passage.", undefined, undefined, evidence.status);
}
function renderHistory() {
  $("history").replaceChildren(...state.history.slice().reverse().map((entry) => {
    const article = document.createElement("article"); const details = document.createElement("details"); const heading = document.createElement("summary"); heading.textContent = `${entry.kind} · ${new Date(entry.time).toLocaleTimeString()} · ${summary(entry.result)}`;
    details.append(heading);
    if (entry.feedback?.length) { const feedback = document.createElement("p"); feedback.textContent = `Style instructions: ${entry.feedback.join("; ")}`; details.append(feedback); }
    for (const a of entry.result.attempts) { const pre = document.createElement("pre"); pre.textContent = `${a.pass}\n${a.text}\n\n${summary({ final: a })}`; details.append(pre); }
    article.append(details); return article;
  }));
}
async function extract() {
  if (!connection) throw new Error("Connect the companion to extract ideas.");
  requireIdle(inference);
  beginOperation(state, "Finding key ideas…"); refreshEvidenceLabels($("requirements"), state); renderTraces(); persist();
  const request = rpc("extract", { source: state.source, constraints: state.constraints.filter((c) => c.type === "must_cover"), writerModel: state.model });
  active = inference = request.envelope; notice("Finding key ideas…");
  try {
    const result = await request.promise;
    if (!currentEnvelope(state, request.envelope, active)) return notice("Extraction ignored because the source or settings changed. Retry it.");
    state.facts = result.facts; active = null; persist(); render(); tab("details");
  } finally { if (active?.requestId === request.envelope.requestId) active = null; if (inference?.requestId === request.envelope.requestId) inference = null; }
}
function validate() {
  if (!state.source.trim()) throw new Error("Add the complete source first.");
  if (!state.instruction.trim()) throw new Error("Write an editing instruction.");
  if (state.constraints.some((c) => c.type === "must_cover" && !state.facts.some((f) => f.constraintId === c.id))) throw new Error("Extract ideas for each Must cover mark, or remove the incomplete mark.");
  if (state.facts.some((f) => !f.text.trim())) throw new Error("Required ideas cannot be blank.");
}
async function run(operation, { existing = false, steer } = {}) {
  validate(); if (!connection) throw new Error("Connect the local companion first.");
  if (existing && (!state.reply.trim() || !state.complete)) throw new Error("Import a reply and confirm that it is complete.");
  requireIdle(inference);
  const payload = { source: state.source, instruction: state.instruction, constraints: state.constraints, facts: state.facts, writerModel: state.model, maxRepairs: state.maxRepairs, maxTightens: state.maxTightens, ...(existing ? { initialText: state.reply } : {}), ...(steer ? { steer } : {}) };
  beginOperation(state, operation === "check" ? "Checking this reply…" : "Writing and checking…"); refreshEvidenceLabels($("requirements"), state); renderTraces();
  const request = rpc(operation, payload); active = inference = request.envelope; state.pendingRun = request.envelope.requestId; persist(); $("cancel").hidden = false; notice(state.notice);
  try {
    const result = await request.promise;
    if (!currentEnvelope(state, request.envelope, active)) return notice("Result ignored because the source, reply or settings changed. Check the current version.");
    state.result = result; state.reply = result.final.text; state.complete = true; state.recorded = false;
    if (operation === "rewrite") delete state.replyRef;
    state.history.push({ kind: operation, time: Date.now(), revision: state.revision, instruction: state.instruction, feedback: steer?.feedback, model: state.model, result });
    state.history = state.history.slice(-15); delete state.pendingRun; active = null; persist(); render(); tab("reply");
  } finally { if (active?.requestId === request.envelope.requestId) active = null; if (inference?.requestId === request.envelope.requestId) inference = null; $("cancel").hidden = true; }
}
async function prepare(repair = false, feedback = "") {
  validate(); if (repair && !state.reply.trim()) throw new Error("Import a reply first.");
  $("prompt-preview").value = preparePrompt(state, repair, feedback); composer = null; promptTabId = undefined;
  try { composer = await page("composer"); promptTabId = composer.tabId; } catch { /* Manual copy remains available. */ }
  $("existing-draft").textContent = composer?.text || "No existing draft found.";
  $("append-prompt").disabled = $("replace-prompt").disabled = !composer?.available;
  $("prompt-help").textContent = composer?.available ? "Insert only stages the text. You choose when to send it." : "Composer unavailable. Copy this prompt and paste it into the conversation.";
  $("prompt-dialog").showModal();
}
async function chooseMessages(target) {
  const result = await page("list"); const box = $("message-list"); box.replaceChildren(); tab("source");
  if (!result.messages.length) { notice("This page does not expose identifiable messages. Select text in the chat or paste the full message."); return; }
  for (const m of result.messages) { const b = document.createElement("button"); b.textContent = `${target === "reply" ? "Use as reply" : "Use as source"} · ${m.preview}`; b.onclick = async () => { try { const captured = await page("capture", { id: m.id, tabId: result.tabId }); importText(target, captured.text, { id: m.id, tabId: result.tabId, url: captured.url }); box.replaceChildren(); } catch (e) { notice(e.message, true); } }; box.append(b); }
}
function importText(target, value, ref) {
  if (value.length > 100000) throw new Error("Text exceeds the 100,000-character limit.");
  state[target] = value; state[`${target}Ref`] = ref;
  if (target === "source") { state.constraints = []; state.facts = []; state.focus = null; state.styleFeedback = []; } else state.complete = false;
  changed("Imported plain text. Review it before protecting details or checking."); render(); tab(target);
}
async function importSelection(target) { const result = await page("selection"); importText(target, result.text, result.id ? { id: result.id, tabId: result.tabId, url: result.url } : undefined); if (target === "source" && result.fullMessage && result.fullMessage !== result.text) notice("Only the selected text was imported. Use Choose a message if you need the whole source."); }
function download(name, contents, type) { const url = URL.createObjectURL(new Blob([contents], { type })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
action("expand", () => chrome.tabs.create({ url: chrome.runtime.getURL("panel.html?expanded=1") }));
action("connect", async () => { if (!port) attachPort(); const hello = await call("hello"); if (hello.protocolVersion !== 1) throw new Error("Companion protocol differs. Rebuild the extension and companion together."); const models = await call("models.list"); connection = true; providers = models.providers; $("connection").textContent = "Local companion connected"; $("readiness").textContent = `Checker: ${models.checker.configured ? "configured" : "not configured"}. Cancellation: ${hello.cancellation || "stop listening only"}.`; renderModels(); if (state.pendingRun) notice("A previous run may have finished. Its result was not automatically applied; check your current reply again."); });
for (const [id, origin] of [["enable-chatgpt", "https://chatgpt.com/*"], ["enable-claude", "https://claude.ai/*"]]) action(id, async () => { const allowed = await chrome.permissions.request({ origins: [origin] }); notice(allowed ? "Site enabled. Choose a message or import selected text." : "Site access was not granted. Paste remains available."); });
action("selection", () => importSelection("source")); action("reply-selection", () => importSelection("reply")); action("messages", () => chooseMessages("source")); action("reply-messages", () => chooseMessages("reply"));
$("file").onchange = async () => { const file = $("file").files[0]; if (!file) return; if (file.size > 400000) return notice("File is too large.", true); try { importText("source", await file.text()); } catch (e) { notice(e.message, true); } $("file").value = ""; };
$("source").oninput = () => { state.constraints = []; state.facts = []; delete state.sourceRef; saveEdit("source", $("source").value); };
$("reply").oninput = () => { state.complete = false; $("complete").checked = false; delete state.replyRef; saveEdit("reply", $("reply").value); };
$("instruction").oninput = () => saveEdit("instruction", $("instruction").value);
$("complete").onchange = () => { state.complete = $("complete").checked; if (!state.complete) changed(); persist(); };
document.querySelectorAll("[data-mark]").forEach((b) => b.addEventListener("click", async () => {
  try {
    if (b.dataset.mark === "must_cover") requireIdle(inference);
    const input = $("source"); const start = input.selectionStart; const end = input.selectionEnd;
    if (end <= start || !state.source.slice(start, end).trim()) throw new Error("Select a passage in the Source text box first.");
    if (state.constraints.length >= 100) throw new Error("At most 100 marks are supported.");
    const c = { id: crypto.randomUUID(), type: b.dataset.mark, start, end, text: state.source.slice(start, end) }; state.constraints.push(c); state.focus = c.id; changed(); renderRequirements();
    if (c.type === "must_cover") await extract(); else tab("details");
  } catch (e) { notice(e.message, true); }
}));
action("extract-all", async () => { requireIdle(inference); if (!state.source.trim()) throw new Error("Add the full source first."); state.constraints.push({ id: crypto.randomUUID(), type: "must_cover", start: 0, end: state.source.length, text: state.source }); changed(); await extract(); });
$("writer").onchange = () => { saveEdit("writer", $("writer").value); render(); };
$("provider").onchange = () => { const p = providers.find((p) => p.id === $("provider").value); state.model = `${p.id}/${p.models[0] || "default"}`; changed(); renderModels(); };
function updateModel() { state.model = `${$("provider").value}/${$("custom-model").value.trim() || $("model").value}`; changed(); renderModels(); }
$("model").onchange = () => { $("custom-model").value = ""; updateModel(); }; $("custom-model").onchange = updateModel;
$("repairs").onchange = () => saveEdit("maxRepairs", Number($("repairs").value)); $("tightens").onchange = () => saveEdit("maxTightens", Number($("tightens").value));
action("run", () => state.writer === "conversation" ? prepare() : run("rewrite")); action("check", () => run("check", { existing: true })); action("repair", () => { if (state.writer === "conversation") return prepare(true); return run("rewrite", { existing: true }); }); action("prepare-repair", () => prepare(true));
action("steer", () => { state.styleFeedback = extendFeedback(state.styleFeedback, $("feedback").value); persist(); return state.writer === "conversation" ? prepare(true, state.styleFeedback.join("\n")) : run("rewrite", { steer: { previous: state.reply, feedback: state.styleFeedback } }); });
action("cancel", async () => { const runId = active?.requestId; active = null; $("cancel").hidden = true; notice("Stopped listening. The current provider request may still finish."); if (runId) { const callback = callbacks.get(runId); callbacks.delete(runId); callback?.reject(new Error("Stopped listening. The current provider request may still finish.")); await call("cancel", { runId }); } });
action("copy", () => navigator.clipboard.writeText(state.reply)); action("export-text", () => download("lossless-rewrite.txt", state.reply, "text/plain")); action("export-json", () => download("lossless-evidence.json", JSON.stringify(state, null, 2), "application/json"));
action("copy-prompt", () => navigator.clipboard.writeText($("prompt-preview").value));
for (const mode of ["append", "replace"]) action(`${mode}-prompt`, async () => { await page("stage", { text: $("prompt-preview").value, expected: composer.text, mode, tabId: promptTabId }); $("prompt-dialog").close(); notice("Prompt inserted. Review and send it in the chat yourself."); });
action("close-prompt", () => $("prompt-dialog").close());
action("save-local", async () => { await chrome.storage.local.set({ savedDocument: state }); notice("Saved on this device. Use Clear document to delete it."); });
action("restore-local", async () => { const saved = (await chrome.storage.local.get("savedDocument")).savedDocument; if (!saved) throw new Error("No saved document found."); state = saved; changed("Restored document. Check again before relying on previous evidence."); render(); });
action("clear", async () => { if (!confirm("Clear this document, its history and the local saved copy?")) return; state = newDocument(); active = null; await chrome.storage.local.remove("savedDocument"); await persist(); render(); });
action("demo", () => { state = newDocument(); state.source = recorded.source; state.reply = recorded.result.final.text; state.instruction = recorded.instruction || "Make the tone friendlier. Keep the delivery condition."; state.constraints = recorded.constraints || [{ id: "demo", type: "must_cover", start: 0, end: recorded.source.length, text: recorded.source }]; state.facts = recorded.facts || []; state.result = recorded.result; state.complete = true; state.recorded = true; state.history = [{ kind: "Recorded run", time: Date.now(), result: recorded.result }]; persist(); render(); tab("reply"); });
chrome.storage.onChanged.addListener((changes, area) => { if (area === "session" && changes.document && changes.document.newValue?._instance !== instance) { state = changes.document.newValue; if (active && (active.revision !== state.revision || active.documentId !== state.documentId)) active = null; render(); } });
attachPort();
const saved = await chrome.storage.session.get("document"); if (saved.document) state = saved.document;
if (state.sourceRef || state.replyRef) { invalidate(state, "Review captured messages after reopening; previous page evidence is stale."); state.complete = false; await persist(); }
render();
