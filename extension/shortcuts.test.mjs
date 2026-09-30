import test from 'node:test';
import assert from 'node:assert/strict';
import { isSendShortcut, shortcutLabels } from './shortcuts.js';
import { protectedPrompt } from './protections.js';
const saved = [{ type: 'keep_meaning', text: 'The trial had no control group.', source: { kind: 'chat', label: 'Chat passage' } }];
test('send shortcut requires Shift and exactly one primary modifier', () => {
  for (const modifier of ['ctrlKey', 'metaKey']) assert.equal(isSendShortcut({ key: 'Enter', shiftKey: true, [modifier]: true }), true);
  for (const event of [{key:'Enter'}, {key:'Enter',shiftKey:true}, {key:'Enter',ctrlKey:true}, {key:'Enter',shiftKey:true,altKey:true,ctrlKey:true}, {key:'Enter',shiftKey:true,metaKey:true,ctrlKey:true}, {key:'a',shiftKey:true,ctrlKey:true}]) assert.equal(isSendShortcut(event), false);
  assert.equal(shortcutLabels('Win32').send, 'Ctrl+Shift+Enter');
  assert.equal(shortcutLabels('MacIntel').send, '⌘+Shift+Enter');
});
test('explicit shortcut sends a plain draft without duplicating or requiring the slash command', () => {
  const draft = 'Shorten this to 150 words.\nKeep the caveat.';
  const direct = protectedPrompt(draft,saved,{direct:true});
  assert.equal(direct,protectedPrompt('/lossless '+draft,saved));
  assert.equal(direct,protectedPrompt('/lossless '+draft,saved,{direct:true}));
  assert.ok(direct.startsWith(draft+'\n\n'));
  assert.throws(()=>protectedPrompt(draft,saved),/Start the request/);
  assert.throws(()=>protectedPrompt('',saved,{direct:true}),/Nothing was sent/);
  assert.throws(()=>protectedPrompt(draft,[],{direct:true}),/Nothing sent/);
});
