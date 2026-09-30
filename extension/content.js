import { mountInline } from "./inline.js";
import { sameComposerText } from "./inline-send.js";
import { createContentRuntime } from "./content-runtime.js";
// This script runs in Chrome's isolated world. No window-message or page event bridge.
(() => {
  if (globalThis.__losslessLoaded) return;
  globalThis.__losslessLoaded = true;
  const references = new Map(); let next = 1; let lastURL = location.href;
  const visible = (el) => Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
  const text = (el) => el.innerText || "";
  function reference(el) {
    for (const [id, item] of references) if (item.el === el) return id;
    const id = `message-${next++}`; references.set(id, { el, text: text(el) }); return id;
  }
  function articles() {
    // Conservative semantic fallback: never guess undocumented provider-specific selectors.
    // Unsupported layouts remain usable through explicit text selection or paste.
    return [...document.querySelectorAll('article, [role="article"]')].filter((el) => visible(el) && !el.parentElement?.closest('article,[role="article"]') && text(el).trim()).slice(-60);
  }
  function composer() {
    const candidates = [...document.querySelectorAll('textarea, [contenteditable="true"]')].filter((el) => visible(el) && !el.closest('[role="dialog"]') && !el.disabled && !el.readOnly && el.getAttribute?.("aria-hidden") !== "true" && !el.parentElement?.closest('[contenteditable="true"]'));
    // ChatGPT can show an editable response alongside its composer. Prefer the
    // explicitly labelled chat input inside its form, never the writing block.
    if (new URL(location.href).hostname === 'chatgpt.com') {
      const chat = candidates.filter(el => el.closest('form') && el.getAttribute?.('aria-label') === 'Ask ChatGPT');
      if (chat.length) return chat.length === 1 ? chat[0] : null;
    }
    // Observed named composers distinguish the chat input from helper editors
    // such as Gemini/Quill's off-screen contenteditable clipboard.
    const label = { 'claude.ai': 'Write your prompt to Claude', 'gemini.google.com': 'Enter a prompt for Gemini' }[new URL(location.href).hostname];
    if (label) {
      const chat = candidates.filter(el => el.getAttribute?.('aria-label') === label);
      if (chat.length) return chat.length === 1 ? chat[0] : null;
    }
    return candidates.length === 1 ? candidates[0] : null;
  }
  const value = (el) => el instanceof HTMLTextAreaElement ? el.value : el.innerText;
  function write(el, after) {
    el.focus();
    if (el instanceof HTMLTextAreaElement) { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, after); el.dispatchEvent(new Event("input", { bubbles: true })); }
    else { const range = document.createRange(); range.selectNodeContents(el); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); if (!document.execCommand("insertText", false, after)) throw new Error("This editor does not support insertion. Copy and paste the prompt."); }
    if (!sameComposerText(value(el), after)) throw new Error("The editor did not accept the complete prompt. Review the chat draft and use copy/paste.");
  }
  let inline, disposed = false;
  let timer, observer;
  const runtime = createContentRuntime(chrome.runtime, dispose);
  const allowed = async () => { try { return Boolean((await runtime.send({ kind: "inline-access" }))?.allowed); } catch { return false; } };
  const inlineReady = allowed().then(ok => { if (ok && !disposed) inline = mountInline({ composer, value, write, visible, allowed, sendMessage: runtime.send, active: runtime.active }); });
  function dispose() {
    if (disposed) return;
    disposed = true; clearTimeout(timer); observer?.disconnect(); inline?.destroy(); references.clear();
    try { chrome.runtime.onMessage.removeListener(receive); } catch { /* The old context is already gone. */ }
    delete globalThis.__losslessLoaded;
  }
  function receive(message, sender, respond) {
    if (disposed || !runtime.active() || sender.id !== chrome.runtime.id || message.kind !== "lossless") return;
    try {
      if (message.action === "disable") { dispose(); return respond({ disabled: true }); }
      if (message.action === "access-changed") { allowed().then(ok => { if (!ok) dispose(); }); return respond({ received: true }); }
      if (message.action === "inline-ui") { inlineReady.then(()=>inline?.uiState(message));return respond({received:true}); }
      if (message.action === "activate") return respond({ activated: true, available: Boolean(composer()) });
      if (message.action === "inline-options") { inlineReady.then(() => { if (!inline || disposed) respond({ error: "Refresh this chat after granting site access." }); else { inline.open(); respond({ opened: true }); } }, e => respond({ error: e.message })); return true; }
      if (message.action === "highlight-reply") { inlineReady.then(() => inline && !disposed ? inline.highlight() : { error: "Refresh this chat after granting site access." }).then(respond, e => respond({ error: e.message })); return true; }
      if (message.action === "protections-changed") { inline?.refresh(); return respond({ refreshed: true }); }
      if (message.action === "list") return respond({ messages: articles().map((el) => ({ id: reference(el), preview: text(el).slice(0, 180), characters: text(el).length })), note: "Choose and review one visible message. Imported page text is plain text, not original Markdown." });
      if (message.action === "selection") {
        const focused = document.activeElement;
        if (focused instanceof HTMLTextAreaElement && focused.selectionEnd > focused.selectionStart) {
          const selected = focused.value.slice(focused.selectionStart, focused.selectionEnd);
          if (selected.length > 100000) throw new Error("Selection exceeds 100,000 characters.");
          if (selected.trim()) return respond({ text: selected, fullMessage: null, id: null, url: location.href });
        }
        const s = getSelection(); if (!s?.rangeCount || !s.toString().trim()) throw new Error("Select text in the conversation first, or paste it in Source.");
        if (s.toString().length > 100000) throw new Error("Selection exceeds 100,000 characters.");
        const common = s.getRangeAt(0).commonAncestorContainer;
        const el = common.nodeType === Node.ELEMENT_NODE ? common : common.parentElement;
        const article = el?.closest('article,[role="article"]');
        return respond({ text: s.toString(), fullMessage: article ? text(article) : null, id: article ? reference(article) : null, url: location.href });
      }
      if (message.action === "capture") { const item = references.get(message.id); if (!item?.el.isConnected) throw new Error("Message changed or disappeared. Refresh the message list."); item.text = text(item.el); return respond({ text: item.text, id: message.id, url: location.href }); }
      if (message.action === "composer") { const el = composer(); return respond({ available: Boolean(el), text: el ? value(el) : "" }); }
      if (message.action === "stage") {
        const el = composer(); if (!el) throw new Error("Cannot identify one chat composer. Copy the prompt and paste it yourself.");
        const before = value(el); if (before !== message.expected) throw new Error("The chat draft changed. Review it again before inserting.");
        if (!["append", "replace"].includes(message.mode) || typeof message.text !== "string" || message.text.length > 300000) throw new Error("Invalid prompt");
        const after = message.mode === "append" && before ? `${before}\n\n${message.text}` : message.text;
        write(el, after);
        return respond({ staged: true }); // Never submit, click send or press Enter.
      }
      if (message.action === "reveal") { const item = references.get(message.id); if (!item?.el.isConnected || text(item.el) !== message.expected) throw new Error("Page message no longer matches the captured text."); item.el.scrollIntoView({ block: "center", behavior: "smooth" }); return respond({ located: true }); }
    } catch (error) { respond({ error: error.message }); }
  }
  if (!runtime.active()) return;
  chrome.runtime.onMessage.addListener(receive);
  observer = new MutationObserver(() => { if (disposed || !runtime.active()) return; clearTimeout(timer); timer = setTimeout(() => {
    if (disposed || !runtime.active()) return;
    const navigation = lastURL !== location.href; lastURL = location.href;
    const ids = [];
    for (const [id, item] of references) if (!item.el.isConnected || text(item.el) !== item.text) { ids.push(id); item.text = item.el.isConnected ? text(item.el) : ""; }
    if (navigation || ids.length) void runtime.send({ kind: "page-changed", ids, navigation }).catch(() => {});
  }, 150); });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
