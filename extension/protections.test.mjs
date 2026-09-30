import test from 'node:test';
import assert from 'node:assert/strict';
import { chatScope, contextFor, addProtection, slashRequest, protectedPrompt } from './protections.js';
import { protectionMessage, forgetProtectionTab } from './protection-store.js';
const url = 'https://chatgpt.com/c/one';
const passage = { text: 'No effect on speed.', type: 'keep_meaning', source: { kind: 'pdf', label: 'Results.pdf', page: 3 } };
test('slash activation is explicit, strips only the leading command and preserves the full request', () => {
  assert.equal(slashRequest(' /lossless\nCondense to 150 words.'), 'Condense to 150 words.');
  assert.equal(slashRequest('/loseless Shorten it.'), 'Shorten it.');
  for (const text of ['Explain /lossless', '/losslessly shorten', 'Hello']) assert.equal(slashRequest(text), null);
  const prompt = protectedPrompt('/lossless Synthesize the discussion.', [passage]);
  assert.ok(prompt.startsWith('Synthesize the discussion.'));
  assert.match(prompt, /No effect on speed/); assert.match(prompt, /Results.pdf/); assert.match(prompt, /"page":3/);
  assert.throws(() => protectedPrompt('/lossless', []));
  assert.throws(() => protectedPrompt('/lossless Make it 150 words.', []), /Nothing sent/);
});
test('protections are scoped to a conversation; only a recent explicit send carries a new-chat draft forward', () => {
  const old = addProtection(contextFor(null, 'https://chatgpt.com/'), passage);
  assert.equal(contextFor(old, url, 40000).items.length, 0);
  assert.equal(contextFor({ ...old, armedAt: 30000 }, url, 40000).items.length, 1);
  assert.equal(contextFor({ ...old, armedAt: 1 }, url, 40000).items.length, 0);
  const existing = { ...old, scope: url, armedAt: 30000 };
  assert.equal(contextFor(existing, 'https://chatgpt.com/c/two', 40000).items.length, 0);
  assert.equal(contextFor(existing, 'https://claude.ai/new', 40000).items.length, 0);
  assert.equal(chatScope(url + '?model=x#latest'), url);
  assert.throws(() => chatScope('https://chatgpt.com.evil.example/'));
});
test('overlapping wording and meaning are retained, identical marks deduplicated, and bounds enforced', () => {
  let c = addProtection(contextFor(null, url), passage);
  c = addProtection(c, passage); assert.equal(c.items.length, 1);
  c = addProtection(c, { ...passage, type: 'keep_wording' }); assert.equal(c.items.length, 2);
  assert.throws(() => addProtection(c, { ...passage, text: 'x'.repeat(12001) }));
  assert.throws(() => addProtection(c, { ...passage, source: { kind: 'pdf', label: 'x', page: -1 } }));
});
test('real worker store serializes selections, rejects stale readers and blocks foreign senders', async () => {
  const stored = {}, tab = { id: 5, url };
  globalThis.chrome = { runtime: { getURL: file => `chrome-extension://test/${file}` }, permissions: { contains: async () => true }, storage: { session: { get: async key => key === null ? structuredClone(stored) : ({ [key]: structuredClone(stored[key]) }), set: async data => Object.assign(stored, structuredClone(data)), remove: async keys => { for (const key of keys) delete stored[key]; } } }, tabs: { get: async () => tab, sendMessage: async () => {} } };
  const sender = { tab, url, frameId: 0 };
  await Promise.all([protectionMessage({ action: 'add', item: passage }, sender), protectionMessage({ action: 'add', item: { ...passage, text: 'Sample size 42.' } }, sender)]);
  assert.equal((await protectionMessage({ action: 'get' }, sender)).context.items.length, 2);
  await assert.rejects(protectionMessage({ action: 'clear', scope: 'https://chatgpt.com/c/elsewhere' }, sender));
  stored['reader:token'] = { tabId: 5, readerTabId: 8, scope: url };
  const reader = { tab: { id: 8 }, url: 'chrome-extension://test/reference.html?token=token' };
  assert.equal((await protectionMessage({ action: 'get', token: 'token' }, reader)).context.items.length, 2);
  assert.equal((await protectionMessage({ action: 'get', token: 'token' }, { url: reader.url })).context.items.length, 2);
  await assert.rejects(protectionMessage({ action: 'get', token: 'token' }, { url: 'chrome-extension://test/reference.html?token=another' }));
  tab.url = 'https://chatgpt.com/c/two';
  await assert.rejects(protectionMessage({ action: 'add', token: 'token', item: passage }, reader), /linked chat changed/);
  await assert.rejects(protectionMessage({ action: 'get' }, { ...sender, url: 'https://evil.example/' }));
  await assert.rejects(protectionMessage({ action: 'get' }, { ...sender, frameId: 1 }));
  // A reference opened before the first message stays linked after the site assigns a URL.
  stored['inline:5'] = { scope: 'https://chatgpt.com/', items: [passage], armedAt: Date.now() };
  stored['reader:token'].scope = 'https://chatgpt.com/';
  assert.equal((await protectionMessage({ action: 'get', token: 'token' }, reader)).context.items.length, 1);
  assert.equal(stored['reader:token'].scope, tab.url);
  await forgetProtectionTab(5); assert.deepEqual(stored, {});
  delete globalThis.chrome;
});
