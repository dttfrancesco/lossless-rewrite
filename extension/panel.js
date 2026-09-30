import { setupWritingRules } from './writing-rules-ui.js';
const writingRules=setupWritingRules();
import recorded from "../demo/document-repair.json";
import { newDocument, invalidate, currentEnvelope, summary, preparePrompt, evidenceFor, extendFeedback, assertCheckerOnly } from "./shared.js";
import { refreshEvidenceLabels, requireIdle, beginOperation, evidenceLabel } from "./view.js";
import { SITES, siteFor } from "./sites.js";
import { createChatTask, applyChatResponse, unitsForChat, localResult, revisionChanges } from "./chat-workflow.js";
import { wordCount } from "../lib/text/sentences.ts";
import { shortcutLabels } from './shortcuts.js';
const $ = (id) => document.getElementById(id);
const keyboard = shortcutLabels();
for (const el of document.querySelectorAll("[data-insert-keys]")) el.textContent = keyboard.insert;
for (const el of document.querySelectorAll('[data-send-keys]')) el.textContent = keyboard.send;
for (const el of document.querySelectorAll('[data-highlight-keys]')) el.textContent = keyboard.highlight;
for (const el of document.querySelectorAll('[data-rules-keys]')) el.textContent = keyboard.rules;
$("open-shortcuts").onclick = () => $("shortcuts-dialog").showModal();
$("close-shortcuts").onclick = () => $("shortcuts-dialog").close();
let state = newDocument(); let active = null; let inference = null; let connection = false; let port; const callbacks = new Map();
let composer = null; let promptTabId; const instance = crypto.randomUUID();
const markUndo = [];
function rememberMarks() { markUndo.push({ documentId: state.documentId, source: state.source, constraints: structuredClone(state.constraints), facts: structuredClone(state.facts), focus: state.focus }); if (markUndo.length > 30) markUndo.shift(); $("undo-marks").disabled = false; }
function taskUI() { $("chat-task").hidden = !state.chatTask; $("task-label").textContent = state.chatTask?.kind === "inventory" ? "Next: get your list of ideas" : "Next: review this rewrite in your chat"; }
function counts() { $("source-count").textContent = `${wordCount(state.source)} words`; }
document.body.classList.toggle("expanded", new URLSearchParams(location.search).has("expanded"));
function editor(open) { $("advanced-editor").hidden = !open; $("launcher").hidden = open; }
$("open-editor").onclick = () => editor(true);
$("close-editor").onclick = () => editor(false);
$("manage-selections").onclick = async () => { try { await page("inline-options"); $("launch-status").textContent = "Selections and Open PDF are now beside your chat box."; } catch (e) { $("launch-status").textContent = e.message; } };
$("highlight-reply").onclick = async () => { try { const result = await page("highlight-reply"); $("launch-status").textContent = result.message; } catch (e) { $("launch-status").textContent = e.message; } };
$("companion-command").textContent = `npx tsx companion/setup.ts --extension-id ${chrome.runtime.id || 'YOUR_EXTENSION_ID'} --browser chrome`;
$("jev-setup").onclick = () => $("jev-dialog").showModal();
$("close-jev").onclick = () => $("jev-dialog").close();
for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { const r = dialog.getBoundingClientRect(); if (e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dialog.close(); });
if (document.body.classList.contains("expanded")) editor(true);
let launchTab;
async function launchSite() {
  try {
    [launchTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const site = siteFor(launchTab?.url);
    if (!site) { $("enable-here").hidden = false; $("launch-status").textContent = "Open your chat, then click the Lossless extension icon there."; return; }
    const result = await page("activate", { tabId: launchTab.id });
    $("enable-here").hidden = result.available;
    $("launch-status").textContent = result.available ? `Connected to this ${site.name} chat. You can close the sidebar.` : `${site.name} detected. Open a chat with a text box.`;
  } catch (e) { $("enable-here").hidden = false; $("launch-status").textContent = e.message + " Check this extension's site access in Chrome."; }
}
$("enable-here").onclick = launchSite;
chrome.tabs.onActivated?.addListener(launchSite);
chrome.tabs.onUpdated?.addListener((_id, info) => { if (info.url) launchSite(); });
function persist() { state._instance = instance; return chrome.storage.session.set({ document: state }).catch(() => { notice("This document is too large for session storage. Export the evidence before closing the panel.", true); }); }
function notice(text, error = false) { $("status").textContent = text; $("status").classList.toggle("error", error); }
function changed(reason, refresh = true) { invalidate(state, reason); active = null; $("cancel").hidden = true; persist(); notice(state.notice); if (refresh) renderRequirements(); else refreshEvidenceLabels($("requirements"), state); renderTraces(); taskUI(); counts(); $("revision-changes").replaceChildren(); }
function saveEdit(key, value) { state[key] = value; changed(); }
let panelWindow;
async function reportPanelPresence() {
  try { panelWindow ??= (await chrome.windows.getCurrent()).id;port?.postMessage({kind:'panel-presence',windowId:panelWindow,visible:document.visibilityState==='visible' && !document.body.classList.contains('expanded')}); } catch { /* The panel can be closing. */ }
}
document.addEventListener('visibilitychange',reportPanelPresence);
function attachPort() {
  port = chrome.runtime.connect({ name: "lossless-panel" });
  reportPanelPresence();
  port.onDisconnect.addListener(() => { port = null; connection = false; $("connection").textContent = "Extension worker disconnected. Reconnect before continuing. A running request was not restarted."; active = null; $("cancel").hidden = true; for (const cb of callbacks.values()) cb.reject(new Error("Extension worker disconnected")); callbacks.clear(); });
  port.onMessage.addListener((m) => {
    if(m.kind==='open-writing-rules'){writingRules.open();return;}
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
function render() {
  for (const key of ["source", "reply", "instruction"]) $(key).value = state[key];
  $("complete").checked = Boolean(state.complete);
  $("run").textContent = "Prepare rewrite";
  $("checking").value = state.checking || "chat"; $("word-target").value = state.wordTarget || "";
  taskUI(); counts();
  renderRequirements(); renderTraces(); renderHistory(); renderChanges(); notice(`${state.recorded ? "Recorded example · " : state.result?.method === "chat-review" ? "Chat model review · " : state.result?.method === "local-exact" ? "Local wording check · " : ""}${state.result ? summary(state.result) : state.notice || "Not checked"}`);
}
function renderChanges() {
  const root = $("revision-changes"); root.replaceChildren(); if (!state.result) return;
  const previous = state.history.slice(0, -1).reverse().find(h => h.result && h.source === state.source);
  const changes = revisionChanges(previous?.result, state.result);
  if (!changes.length) return;
  const title = document.createElement("strong"); title.textContent = "Changed since the previous check"; root.append(title);
  for (const c of changes) { const p = document.createElement("p"); p.textContent = `${c.before} → ${c.after}: ${c.text}`; root.append(p); }
}
function renderRequirements() {
  const root = $("requirements"); root.replaceChildren();
  if (!state.constraints.length) { root.textContent = "No protected details yet. Select text in Source, or find key ideas."; return; }
  for (const c of state.constraints) {
    const box = document.createElement("div"); box.className = "requirement";
    const b = document.createElement("button"); b.textContent = c.text; b.setAttribute("aria-pressed", String(state.focus === c.id)); b.onclick = () => { state.focus = c.id; persist(); renderRequirements(); renderTraces(); };
    const label = document.createElement("p"); label.className = "kind"; label.dataset.evidenceId = c.id; label.dataset.evidencePrefix = { keep_wording: "Keep wording", keep_meaning: "Keep meaning", must_cover: "Must cover" }[c.type]; label.textContent = evidenceLabel(state, c.id, label.dataset.evidencePrefix);
    const remove = document.createElement("button"); remove.textContent = "Remove mark"; remove.onclick = () => { rememberMarks(); state.constraints = state.constraints.filter((x) => x.id !== c.id); state.facts = state.facts.filter((f) => f.constraintId !== c.id); changed(); renderRequirements(); };
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
  if (evidence.reason) { const reason = document.createElement("p"); reason.textContent = evidence.reason; $("reply-trace").append(reason); }
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
async function extract() { return prepareTask("inventory"); }
function validate() {
  if (!$("word-target").checkValidity()) throw new Error("Use a whole-number word budget between 20 and 50,000.");
  if (!state.source.trim()) throw new Error("Add the complete source first.");
  if (!state.instruction.trim()) throw new Error("Write an editing instruction.");
  if (state.constraints.some((c) => c.type === "must_cover" && !state.facts.some((f) => f.constraintId === c.id))) throw new Error("Extract ideas for each Must cover mark, or remove the incomplete mark.");
  if (state.facts.some((f) => !f.text.trim())) throw new Error("Required ideas cannot be blank.");
}
async function runCheck() {
  validate(); if (!connection) throw new Error("Connect the local companion first.");
  if (!state.reply.trim() || !state.complete) throw new Error("Import a reply and confirm that it is complete.");
  requireIdle(inference);
  const payload = { source: state.source, instruction: state.instruction, constraints: state.constraints, facts: state.facts, initialText: state.reply };
  beginOperation(state, "Checking this reply…"); refreshEvidenceLabels($("requirements"), state); renderTraces();
  const request = rpc("check", payload); active = inference = request.envelope; state.pendingRun = request.envelope.requestId; persist(); $("cancel").hidden = false; notice(state.notice);
  try {
    const result = await request.promise;
    if (!currentEnvelope(state, request.envelope, active)) return notice("Result ignored because the source, reply or settings changed. Check the current version.");
    state.result = result; state.reply = result.final.text; state.complete = true; state.recorded = false; delete state.chatTask;
    state.history.push({ kind: "Jev check", time: Date.now(), revision: state.revision, source: state.source, instruction: state.instruction, result });
    state.history = state.history.slice(-15); delete state.pendingRun; active = null; persist(); render(); tab("reply");
  } finally { if (active?.requestId === request.envelope.requestId) active = null; if (inference?.requestId === request.envelope.requestId) inference = null; $("cancel").hidden = true; }
}
async function prepare(repair = false, feedback = "") {
  validate(); if (repair && !state.reply.trim()) throw new Error("Import a reply first.");
  return openPrompt(preparePrompt(state, repair, feedback));
}
async function openPrompt(prompt) {
  $("prompt-preview").value = prompt; composer = null; promptTabId = undefined;
  try { composer = await page("composer"); promptTabId = composer.tabId; } catch { /* Manual copy remains available. */ }
  $("existing-draft").textContent = composer?.text || "No existing draft found.";
  $("append-prompt").disabled = $("replace-prompt").disabled = !composer?.available;
  $("prompt-help").textContent = composer?.available ? "Insert only stages the text. You choose when to send it." : "Composer unavailable. Copy this prompt and paste it into the conversation.";
  $("prompt-dialog").showModal();
}
async function prepareTask(kind) {
  requireIdle(inference);
  if (kind === "check") validate();
  state.chatTask = createChatTask(state, kind); beginOperation(state, "Send the prepared request in your chat, then import its completed response."); await persist(); render();
  await openPrompt(state.chatTask.prompt);
}
function acceptResult(result, kind) {
  state.result = result; state.recorded = false;
  state.history.push({ kind, time: Date.now(), revision: state.revision, source: state.source, result });
  state.history = state.history.slice(-15); delete state.chatTask; persist(); render(); tab("reply");
}
async function checkReply() {
  validate(); requireIdle(inference);
  if (!state.reply.trim() || !state.complete) throw new Error("Add a reply and confirm it is complete first.");
  if (!state.constraints.length) throw new Error("Choose at least one idea or exact passage to check in Source.");
  if (!unitsForChat(state).length) return acceptResult(localResult(state), "Local wording check");
  if (state.checking === "companion") return runCheck();
  return prepareTask("check");
}
async function chooseMessages(target) {
  const result = await page("list"); const box = $("message-list"); box.replaceChildren(); tab("source");
  if (!result.messages.length) { notice("This page does not expose identifiable messages. Select text in the chat or paste the full message."); return; }
  for (const m of result.messages) { const b = document.createElement("button"); b.textContent = `${target === "reply" ? "Use as reply" : "Use as source"} · ${m.preview}`; b.onclick = async () => { try { const captured = await page("capture", { id: m.id, tabId: result.tabId }); importText(target, captured.text, { id: m.id, tabId: result.tabId, url: captured.url }); box.replaceChildren(); } catch (e) { notice(e.message, true); } }; box.append(b); }
}
function importText(target, value, ref) {
  if (value.length > 100000) throw new Error("Text exceeds the 100,000-character limit.");
  state[target] = value; state[`${target}Ref`] = ref;
  if (target === "source") { markUndo.length = 0; $("undo-marks").disabled = true; state.constraints = []; state.facts = []; state.focus = null; state.styleFeedback = []; } else state.complete = false;
  changed("Imported plain text. Review it before protecting details or checking."); render(); tab(target);
}
async function importSelection(target) { const result = await page("selection"); importText(target, result.text, result.id ? { id: result.id, tabId: result.tabId, url: result.url } : undefined); if (target === "source" && result.fullMessage && result.fullMessage !== result.text) notice("Only the selected text was imported. Use Choose a message if you need the whole source."); }
function download(name, contents, type) { const url = URL.createObjectURL(new Blob([contents], { type })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
action("expand", () => chrome.tabs.create({ url: chrome.runtime.getURL("panel.html?expanded=1") }));
async function connectCompanion() {
  $("connect").disabled = $("setup-connect").disabled = true;
  $("setup-status").textContent = "Connecting to the local companion…";
  try {
    if (!await chrome.permissions.request({ permissions: ["nativeMessaging"] })) throw new Error("Companion permission was not granted.");
    if (!port) attachPort();
    const hello = await call("hello"); assertCheckerOnly(hello);
    const models = await call("models.list"); connection = true;
    $("connection").textContent = "Local companion connected";
    $("readiness").textContent = `Checker: ${models.checker.configured ? "configured" : "not configured"}. Cancellation: ${hello.cancellation || "stop listening only"}.`;
    $("setup-status").textContent = models.checker.configured ? `Companion connected. Checker: ${models.checker.provider}. Configuration found; key validity has not been tested.` : "Companion connected, but no checker key found. Add TYPESAFE_API_KEY to .env.local, then close and reopen Chrome to restart the companion.";
  } catch (e) { connection = false; $("setup-status").textContent = `${e.message} Check the companion installation in step 2.`; notice(e.message, true); }
  finally { $("connect").disabled = $("setup-connect").disabled = false; }
}
$("connect").addEventListener("click", connectCompanion);
$("setup-connect").addEventListener("click", connectCompanion);
async function renderSites() {
  const labels = await Promise.all(SITES.map(async site => {
    const enabled = await chrome.permissions.contains({ origins: [`https://${site.host}/*`] });
    const label = document.createElement("span"); label.textContent = `${site.name} · ${enabled ? "allowed" : "blocked in Chrome"}`; return label;
  })); $("site-access").replaceChildren(...labels);
}

action("selection", () => importSelection("source")); action("reply-selection", () => importSelection("reply")); action("messages", () => chooseMessages("source")); action("reply-messages", () => chooseMessages("reply"));
$("file").onchange = async () => { const file = $("file").files[0]; if (!file) return; if (file.size > 400000) return notice("File is too large.", true); try { importText("source", await file.text()); } catch (e) { notice(e.message, true); } $("file").value = ""; };
$("source").oninput = () => { markUndo.length = 0; $("undo-marks").disabled = true; state.constraints = []; state.facts = []; delete state.sourceRef; saveEdit("source", $("source").value); };
$("reply").oninput = () => { state.complete = false; $("complete").checked = false; delete state.replyRef; saveEdit("reply", $("reply").value); };
$("instruction").oninput = () => saveEdit("instruction", $("instruction").value);
$("complete").onchange = () => { state.complete = $("complete").checked; if (!state.complete) changed(); persist(); };
document.querySelectorAll("[data-mark]").forEach((b) => b.addEventListener("click", async () => {
  try {
    if (b.dataset.mark === "must_cover") requireIdle(inference);
    const input = $("source"); const start = input.selectionStart; const end = input.selectionEnd;
    if (end <= start || !state.source.slice(start, end).trim()) throw new Error("Select a passage in the Source text box first.");
    if (state.constraints.length >= 100) throw new Error("At most 100 marks are supported.");
    rememberMarks(); const c = { id: crypto.randomUUID(), type: b.dataset.mark, start, end, text: state.source.slice(start, end) }; state.constraints.push(c); state.focus = c.id; changed(); renderRequirements();
    if (c.type === "must_cover") await extract(); else tab("details");
  } catch (e) { notice(e.message, true); }
}));
action("extract-all", async () => { requireIdle(inference); if (!state.source.trim()) throw new Error("Add the full source first."); if (state.constraints.length >= 100) throw new Error("At most 100 marks are supported."); rememberMarks(); if (!state.constraints.some(c => c.type === "must_cover" && c.start === 0 && c.end === state.source.length)) state.constraints.push({ id: crypto.randomUUID(), type: "must_cover", start: 0, end: state.source.length, text: state.source }); changed(); await extract(); });
action("undo-marks", () => { const prior = markUndo.pop(); if (!prior || prior.documentId !== state.documentId || prior.source !== state.source) { markUndo.length = 0; $("undo-marks").disabled = true; return; } Object.assign(state, { constraints: prior.constraints, facts: prior.facts, focus: prior.focus }); changed("Selection undone. Check again for updated evidence."); $("undo-marks").disabled = !markUndo.length; });
document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey && !e.target.closest("textarea,input,[contenteditable=true]")) { e.preventDefault(); $("undo-marks").click(); } });
$("checking").onchange = () => { saveEdit("checking", $("checking").value); render(); };
$("word-target").onchange = () => { if (!$("word-target").checkValidity()) { $("word-target").reportValidity(); return; } saveEdit("wordTarget", $("word-target").value ? Number($("word-target").value) : undefined); };
action("run", () => prepare()); action("check", checkReply); action("repair", () => prepare(true));
action("steer", () => { state.styleFeedback = extendFeedback(state.styleFeedback, $("feedback").value); persist(); return prepare(true, state.styleFeedback.join("\n")); });
action("cancel", async () => { const runId = active?.requestId; active = null; $("cancel").hidden = true; notice("Stopped listening. The current provider request may still finish."); if (runId) { const callback = callbacks.get(runId); callbacks.delete(runId); callback?.reject(new Error("Stopped listening. The current provider request may still finish.")); await call("cancel", { runId }); } });
action("copy", () => navigator.clipboard.writeText(state.reply)); action("export-text", () => download("lossless-rewrite.txt", state.reply, "text/plain")); action("export-json", () => download("lossless-evidence.json", JSON.stringify(state, null, 2), "application/json"));
action("copy-prompt", () => navigator.clipboard.writeText($("prompt-preview").value));
for (const mode of ["append", "replace"]) action(`${mode}-prompt`, async () => { await page("stage", { text: $("prompt-preview").value, expected: composer.text, mode, tabId: promptTabId }); $("prompt-dialog").close(); notice("Prompt inserted. Review and send it in the chat yourself."); });
action("close-prompt", () => $("prompt-dialog").close());
for (const id of ["prompt-dialog", "response-dialog"]) { const dialog = $(id); dialog.addEventListener("click", e => { if (e.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); }); }
action("reopen-task", () => { if (!state.chatTask) throw new Error("Prepare a request first."); return openPrompt(state.chatTask.prompt); });
action("discard-task", () => { delete state.chatTask; persist(); taskUI(); });
action("import-task", () => { $("task-response").value = ""; $("task-complete").checked = false; $("response-error").textContent = ""; $("response-dialog").showModal(); });
action("close-response", () => $("response-dialog").close());
action("read-task-selection", async () => { try { const selected = await page("selection"); $("task-response").value = selected.text; } catch (e) { $("response-error").textContent = e.message; } });
action("apply-task", () => { try {
  if (!$("task-complete").checked) throw new Error("Confirm that the response has finished.");
  const parsed = applyChatResponse(state, $("task-response").value);
  if (parsed.facts) { rememberMarks(); state.facts = parsed.facts; changed("Review these extracted ideas. Edit or remove anything that does not belong."); render(); tab("details"); }
  else acceptResult(parsed.result, "Chat model review");
  $("response-dialog").close();
} catch (e) { $("response-error").textContent = e.message; } });
action("save-local", async () => { await chrome.storage.local.set({ savedDocument: state }); notice("Saved on this device. Use Clear document to delete it."); });
action("restore-local", async () => { const saved = (await chrome.storage.local.get("savedDocument")).savedDocument; if (!saved) throw new Error("No saved document found."); state = saved; changed("Restored document. Check again before relying on previous evidence."); render(); });
action("clear", async () => { if (!confirm("Clear this document, its history and the local saved copy?")) return; state = newDocument(); active = null; await chrome.storage.local.remove("savedDocument"); await persist(); render(); });
action("demo", () => { state = newDocument(); state.source = recorded.source; state.reply = recorded.result.final.text; state.instruction = recorded.instruction || "Make the tone friendlier. Keep the delivery condition."; state.constraints = recorded.constraints || [{ id: "demo", type: "must_cover", start: 0, end: recorded.source.length, text: recorded.source }]; state.facts = recorded.facts || []; state.result = recorded.result; state.complete = true; state.recorded = true; state.history = [{ kind: "Recorded run", time: Date.now(), result: recorded.result }]; persist(); render(); tab("reply"); });
chrome.storage.onChanged.addListener((changes, area) => { if (area === "session" && changes.document && changes.document.newValue?._instance !== instance) { state = changes.document.newValue; if (active && (active.revision !== state.revision || active.documentId !== state.documentId)) active = null; render(); } });
attachPort();
const saved = await chrome.storage.session.get("document"); if (saved.document) state = saved.document;
if (state.sourceRef || state.replyRef) { invalidate(state, "Review captured messages after reopening; previous page evidence is stale."); state.complete = false; await persist(); }
render(); await renderSites(); await launchSite();

chrome.storage.local.get('autoCheckConsent').then(v => { $('auto-check-consent').checked = Boolean(v.autoCheckConsent); });
$('auto-check-consent').onchange = () => chrome.storage.local.set({autoCheckConsent:$('auto-check-consent').checked});
