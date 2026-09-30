// A single explicit send transaction. Never retries, simulates Enter, or guesses a button.
export function sameComposerText(a, b) {
  // Chromium's contenteditable insertText may render one extra empty block.
  // Tolerate blank-line multiplicity only; never ignore words or punctuation.
  const normalize = text => text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return normalize(a) === normalize(b);
}
export async function sendPrepared({ snapshot, prepared, adapter, wait = () => new Promise(r => setTimeout(r, 180)) }) {
  const sameDraft = expected => adapter.url() === snapshot.url && adapter.composer() === snapshot.el && sameComposerText(adapter.value(snapshot.el), expected);
  if (!await adapter.allowed()) throw new Error("Site access was removed. Nothing was sent.");
  if (!sameDraft(snapshot.text)) throw new Error("The chat or draft changed. Close this preview and review it again.");
  if (!prepared.trim() || prepared.length > 300000) throw new Error("The prompt is empty or too long.");
  adapter.write(snapshot.el, prepared);
  await wait();
  if (!await adapter.allowed()) throw new Error("Access changed. The prompt may be staged, but was not sent.");
  if (!sameDraft(prepared)) throw new Error("The editor changed the prompt. Review the chat draft; nothing was sent.");
  const button = adapter.sendButton(snapshot.el);
  if (!button) return "staged";
  button.click();
  return "clicked";
}
