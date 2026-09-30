import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeInlinePrompt, isSendLabel } from './inline-prompt.js';
import { sendPrepared, sameComposerText } from './inline-send.js';

test('inline prompt retains the complete draft and explicit constraints without claiming verification', () => {
  const draft = 'Condense these results.\nThe primary outcome was null.\nSubgroup A improved.';
  const prompt = composeInlinePrompt(draft, { budget: '150', keep: 'Keep the null result.' });
  assert.ok(prompt.startsWith(draft + '\n\n'));
  assert.match(prompt, /150 words/); assert.match(prompt, /Keep the null result\./);
  assert.match(prompt, /not a verification result/);
});
test('invalid budgets and oversized or empty text cannot be sent', () => {
  for (const budget of ['1', '50001', '-20', '30.5', '2e2', 'no']) assert.throws(() => composeInlinePrompt('Draft', { budget }));
  assert.throws(() => composeInlinePrompt('   '));
  assert.throws(() => composeInlinePrompt('a'.repeat(100001)));
  assert.throws(() => composeInlinePrompt('Draft', { keep: 'a'.repeat(4001) }));
});
test('only explicit send labels qualify, not stop, delete, voice or unrelated actions', () => {
  for (const label of ['Send', 'Send message', 'Send prompt', 'Submit', 'Submit prompt']) assert.equal(isSendLabel(label), true);
  for (const label of ['', 'Stop response', 'Send feedback', 'Delete chat', 'Start voice chat', 'Subscribe']) assert.equal(isSendLabel(label), false);
});
function fixture() {
  const el = {}, calls = [], snapshot = { el, text: 'Original', url: 'https://chatgpt.com/' };
  let text = snapshot.text, url = snapshot.url, permission = true;
  const adapter = { allowed: async () => permission, url: () => url, composer: () => el, value: () => text, write: (_el, t) => { text = t; calls.push('write'); }, sendButton: () => ({ click: () => calls.push('click') }) };
  return { snapshot, adapter, calls, prepared: 'Prepared', wait: async () => {}, setText: t => text = t, navigate: () => url += 'new', revoke: () => permission = false };
}
test('explicit send writes the reviewed text and clicks exactly once', async () => {
  const f = fixture(); assert.equal(await sendPrepared(f), 'clicked'); assert.deepEqual(f.calls, ['write', 'click']);
});
test('changed draft or navigation refuses to overwrite or submit', async () => {
  for (const change of ['setText', 'navigate', 'revoke']) {
    const f = fixture(); f[change]('User edit'); await assert.rejects(sendPrepared(f)); assert.deepEqual(f.calls, []);
  }
});
test('changes during editor render never submit', async () => {
  for (const change of ['setText', 'navigate', 'revoke']) {
    const f = fixture(); f.wait = async () => f[change]('Changed'); await assert.rejects(sendPrepared(f)); assert.deepEqual(f.calls, ['write']);
  }
});
test('unknown send control stages the prompt without guessing or retrying', async () => {
  const f = fixture(); f.adapter.sendButton = () => null;
  assert.equal(await sendPrepared(f), 'staged'); assert.deepEqual(f.calls, ['write']);
});
test('rich editor blank blocks are tolerated but lost words and changed punctuation are not', () => {
  assert.equal(sameComposerText('Finding.\n\n\nCaveat.', 'Finding.\n\nCaveat.'), true);
  assert.equal(sameComposerText('Finding.\nCaveat.', 'Finding.\n\nCaveat.'), true);
  assert.equal(sameComposerText('Finding.Caveat.', 'Finding.\n\nCaveat.'), false);
  assert.equal(sameComposerText('Finding.', 'Finding.\n\nCaveat.'), false);
  assert.equal(sameComposerText('Finding!', 'Finding.'), false);
});
