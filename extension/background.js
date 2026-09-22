import { HOST, OPERATIONS, supportedPage, assembler } from "./shared.js";
const panels = new Set();
let native;
const requests = new Map();
const decode = assembler();
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
function broadcast(message) { for (const port of panels) { try { port.postMessage(message); } catch { panels.delete(port); } } }
function connect() {
  if (native) return native;
  native = chrome.runtime.connectNative(HOST);
  native.onMessage.addListener((part) => {
    try {
      const envelope = decode(part); if (!envelope) return;
      const request = requests.get(envelope.requestId);
      if (!request || envelope.version !== 1 || envelope.documentId !== request.documentId || envelope.revision !== request.revision) return;
      broadcast({ kind: "native", envelope });
      if (["result", "error"].includes(envelope.type)) requests.delete(envelope.requestId);
    } catch (e) { broadcast({ kind: "connection", error: e.message }); native?.disconnect(); native = null; }
  });
  native.onDisconnect.addListener(() => { const error = chrome.runtime.lastError?.message || "Companion disconnected. The current request may have finished; it was not restarted."; native = null; requests.clear(); broadcast({ kind: "connection", error }); });
  return native;
}
function trustedPanel(sender) { return sender.id === chrome.runtime.id && sender.url?.split("?")[0] === chrome.runtime.getURL("panel.html"); }
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "lossless-panel" || !trustedPanel(port.sender)) return port.disconnect();
  panels.add(port); port.onDisconnect.addListener(() => panels.delete(port));
  port.onMessage.addListener((message) => {
    if (message.kind !== "native" || !message.envelope || !OPERATIONS.has(message.envelope.operation)) return;
    const e = message.envelope;
    if (e.version !== 1 || typeof e.requestId !== "string" || typeof e.documentId !== "string" || !Number.isSafeInteger(e.revision) || new TextEncoder().encode(JSON.stringify(e)).length > 4 * 1024 * 1024) {
      port.postMessage({ kind: "native", envelope: { ...e, type: "error", payload: { message: "Request is invalid or too large. Reduce overlapping marks or source length." } } }); return;
    }
    requests.set(e.requestId, { documentId: e.documentId, revision: e.revision });
    try { connect().postMessage(e); } catch (error) { requests.delete(e.requestId); broadcast({ kind: "connection", error: error.message }); }
  });
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.kind === "page-changed" && sender.id === chrome.runtime.id && sender.tab && supportedPage(sender.url)) {
    broadcast({ kind: "page-changed", tabId: sender.tab.id, ids: Array.isArray(message.ids) ? message.ids.filter((id) => typeof id === "string").slice(0, 100) : [], navigation: Boolean(message.navigation) }); return;
  }
  if (!trustedPanel(sender) || message.kind !== "page") return;
  (async () => {
    let tab;
    if (message.tabId) tab = await chrome.tabs.get(message.tabId);
    else [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !supportedPage(tab.url)) throw new Error("Open ChatGPT or Claude, then try again. You can always paste text here.");
    const origin = `${new URL(tab.url).origin}/*`;
    if (!await chrome.permissions.contains({ origins: [origin] })) throw new Error("Enable this site first using the site access buttons.");
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    if (!["list", "selection", "capture", "composer", "stage", "reveal"].includes(message.action)) throw new Error("Unknown page action");
    const result = await chrome.tabs.sendMessage(tab.id, { kind: "lossless", action: message.action, id: message.id, text: message.text, mode: message.mode, expected: message.expected });
    return { ...result, tabId: tab.id };
  })().then(respond, (error) => respond({ error: error.message }));
  return true;
});
