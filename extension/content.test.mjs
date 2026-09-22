import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const code = await readFile(new URL("./content.js", import.meta.url), "utf8");
function harness() {
  let handler; let mutation; let timer; const events = []; const sent = [];
  class Textarea {
    constructor(text) { this._value = text; this.disabled = false; this.events = []; }
    get value() { return this._value; } set value(v) { this._value = v; }
    getClientRects() { return [1]; } closest() { return null; } focus() { this.focused = true; } dispatchEvent(e) { this.events.push(e.type); }
  }
  const article = { innerText: "User\nComplete source with a condition.", isConnected: true, getClientRects: () => [1], parentElement: { closest: () => null }, scrollIntoView: () => events.push("scroll") };
  const composer = new Textarea("Existing unsent draft"); let composers = [composer];
  const document = { documentElement: {}, querySelectorAll: (selector) => selector.startsWith("article") ? [article] : composers };
  const chrome = { runtime: { id: "extension-id", onMessage: { addListener: (fn) => handler = fn }, sendMessage: (m) => { sent.push(m); return Promise.resolve(); } } };
  vm.runInNewContext(code, { chrome, document, location: { href: "https://chatgpt.com/c/1" }, HTMLTextAreaElement: Textarea, getComputedStyle: () => ({ visibility: "visible" }), MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} }, Event: class { constructor(type) { this.type = type; } }, clearTimeout() {}, setTimeout(fn) { timer = fn; }, getSelection: () => null });
  return { article, composer, sent, ambiguous() { composers = [composer, new Textarea("Other")]; }, mutate() { mutation(); timer(); }, request(action, fields = {}, senderId = "extension-id") { let response; handler({ kind: "lossless", action, ...fields }, { id: senderId }, (r) => response = r); return response; } };
}
test("adapter captures only a chosen message and ignores foreign extension messages", () => {
  const h = harness(); assert.equal(h.request("list", {}, "other-id"), undefined);
  const listed = h.request("list"); assert.equal(listed.messages.length, 1);
  const captured = h.request("capture", { id: listed.messages[0].id }); assert.equal(captured.text, h.article.innerText);
  assert.equal(h.sent.length, 0);
});
test("staging preserves draft unless explicit append/replace and never sends", () => {
  const h = harness();
  const stale = h.request("stage", { mode: "replace", expected: "stale draft", text: "Prompt" }); assert.match(stale.error, /draft changed/); assert.equal(h.composer.value, "Existing unsent draft");
  const result = h.request("stage", { mode: "append", expected: h.composer.value, text: "Prompt" }); assert.equal(result.staged, true); assert.equal(h.composer.value, "Existing unsent draft\n\nPrompt"); assert.deepEqual(h.composer.events, ["input"]); assert.equal(h.sent.length, 0);
});
test("ambiguous composer fails closed and changed captured messages invalidate evidence", () => {
  const h = harness(); const id = h.request("list").messages[0].id;
  h.ambiguous(); assert.equal(h.request("composer").available, false); assert.match(h.request("stage", { mode: "replace", expected: "", text: "x" }).error, /Cannot identify/);
  h.article.innerText = "A regenerated answer."; h.mutate(); assert.equal(h.sent.length, 1); assert.equal(h.sent[0].ids[0], id);
  const reveal = h.request("reveal", { id, expected: "A previous answer." }); assert.match(reveal.error, /no longer matches/);
});
