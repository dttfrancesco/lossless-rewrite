import test from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const code = buildSync({ entryPoints: [fileURLToPath(new URL("./content.js", import.meta.url))], bundle: true, write: false, format: "iife" }).outputFiles[0].text;
function harness(host = 'chatgpt.com') {
  let handler; let mutation; let timer; let disconnected = false; const events = []; const sent = [];
  class Textarea {
    constructor(text) { this._value = text; this.disabled = false; this.events = []; }
    get value() { return this._value; } set value(v) { this._value = v; }
    getClientRects() { return [1]; } closest() { return null; } focus() { this.focused = true; } dispatchEvent(e) { this.events.push(e.type); }
  }
  const article = { innerText: "User\nComplete source with a condition.", isConnected: true, getClientRects: () => [1], parentElement: { closest: () => null }, scrollIntoView: () => events.push("scroll") };
  const composer = new Textarea("Existing unsent draft"); let composers = [composer];
  const document = { documentElement: {}, querySelectorAll: (selector) => selector.startsWith("article") ? [article] : composers };
  const chrome = { runtime: { id: "extension-id", onMessage: { addListener: (fn) => handler = fn, removeListener() {} }, sendMessage: (m) => { if (m.kind === "inline-access") return Promise.resolve({ allowed: false }); sent.push(m); return Promise.resolve(); } } };
  vm.runInNewContext(code, { chrome, document, URL, location: { href: `https://${host}/c/1` }, HTMLTextAreaElement: Textarea, getComputedStyle: () => ({ visibility: "visible" }), MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} disconnect() { disconnected = true; } }, Event: class { constructor(type) { this.type = type; } }, clearTimeout() {}, setTimeout(fn) { timer = fn; }, getSelection: () => null });
  return { article, composer, sent, get disconnected() { return disconnected; }, invalidate() { chrome.runtime.sendMessage = () => { throw new Error('Extension context invalidated.'); }; }, ambiguous() { composers = [composer, new Textarea("Other")]; }, writingBlock() { const block = new Textarea('Editable response'); block.getAttribute = name => name === 'aria-label' ? 'Start writing' : null; composer.getAttribute = name => name === 'aria-label' ? 'Ask ChatGPT' : null; composer.closest = selector => selector === 'form' ? {} : null; composers = [block, composer]; return block; }, mutate() { mutation(); timer(); }, request(action, fields = {}, senderId = "extension-id") { let response; handler({ kind: "lossless", action, ...fields }, { id: senderId }, (r) => response = r); return response; } };
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

test('ChatGPT editable answers do not disable or receive chat composer insertion', () => {
  const h = harness(), block = h.writingBlock();
  assert.equal(h.request('composer').available, true);
  assert.equal(h.request('composer').text, 'Existing unsent draft');
  assert.equal(h.request('stage', { mode: 'append', expected: h.composer.value, text: 'Prompt' }).staged, true);
  assert.equal(block.value, 'Editable response');
  assert.equal(block.events.length, 0);
  assert.equal(h.composer.value, 'Existing unsent draft\n\nPrompt');
});

for (const [host,label] of [['gemini.google.com','Enter a prompt for Gemini'],['claude.ai','Write your prompt to Claude']]) {
  test(`${host} uses the labelled composer despite another editable helper`, () => {
    const h=harness(host),helper=h.writingBlock();
    h.composer.getAttribute=name=>name==='aria-label'?label:null;
    assert.equal(h.request('composer').available,true);
    assert.equal(h.request('stage',{mode:'replace',expected:h.composer.value,text:'Keep the caveat.'}).staged,true);
    assert.equal(helper.value,'Editable response');
    assert.equal(h.composer.value,'Keep the caveat.');
  });
}


test('an old content observer stops after reload without changing the chat draft', async () => {
  const h = harness();
  h.request('list');
  h.invalidate();
  h.article.innerText = 'Chat changed after the extension reload.';
  assert.doesNotThrow(() => h.mutate());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.disconnected, true);
  assert.equal(h.request('composer'), undefined);
  assert.equal(h.composer.value, 'Existing unsent draft');
  assert.equal(h.sent.length, 0);
});
