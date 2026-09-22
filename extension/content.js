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
    const candidates = [...document.querySelectorAll('textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"][aria-label]')].filter((el) => visible(el) && !el.closest('[role="dialog"]') && !el.disabled);
    return candidates.length === 1 ? candidates[0] : null;
  }
  const value = (el) => el instanceof HTMLTextAreaElement ? el.value : el.innerText;
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message.kind !== "lossless") return;
    try {
      if (message.action === "list") return respond({ messages: articles().map((el) => ({ id: reference(el), preview: text(el).slice(0, 180), characters: text(el).length })), note: "Choose and review one visible message. Imported page text is plain text, not original Markdown." });
      if (message.action === "selection") {
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
        el.focus();
        if (el instanceof HTMLTextAreaElement) { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, after); el.dispatchEvent(new Event("input", { bubbles: true })); }
        else { const range = document.createRange(); range.selectNodeContents(el); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); if (!document.execCommand("insertText", false, after)) throw new Error("This editor does not support insertion. Copy and paste the prompt."); }
        return respond({ staged: true }); // Never submit, click send or press Enter.
      }
      if (message.action === "reveal") { const item = references.get(message.id); if (!item?.el.isConnected || text(item.el) !== message.expected) throw new Error("Page message no longer matches the captured text."); item.el.scrollIntoView({ block: "center", behavior: "smooth" }); return respond({ located: true }); }
    } catch (error) { respond({ error: error.message }); }
  });
  let timer;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(() => {
    const navigation = lastURL !== location.href; lastURL = location.href;
    const ids = [];
    for (const [id, item] of references) if (!item.el.isConnected || text(item.el) !== item.text) { ids.push(id); item.text = item.el.isConnected ? text(item.el) : ""; }
    if (navigation || ids.length) chrome.runtime.sendMessage({ kind: "page-changed", ids, navigation }).catch(() => {});
  }, 150); }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
