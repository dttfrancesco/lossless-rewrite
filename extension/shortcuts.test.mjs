import test from 'node:test';
import assert from 'node:assert/strict';
import { isInsertShortcut, insertCommand, commandDraft, isSendShortcut, isRulesShortcut, shortcutLabels } from './shortcuts.js';
import { protectedPrompt } from './protections.js';
const saved = [{ type: 'keep_meaning', text: 'The trial had no control group.', source: { kind: 'chat', label: 'Chat passage' } }];
test('writing rules shortcut ignores composition, repeats and unrelated modifiers',()=>{
  const event={code:'KeyR',altKey:true,shiftKey:true};assert.equal(isRulesShortcut(event),true);
  for(const override of [{code:'KeyL'},{altKey:false},{shiftKey:false},{ctrlKey:true},{metaKey:true},{repeat:true},{isComposing:true}])assert.equal(isRulesShortcut({...event,...override}),false);
  assert.equal(shortcutLabels('Win32').rules,'Alt+Shift+R');assert.equal(shortcutLabels('MacIntel').rules,'Option+Shift+R');
});
test('insert shortcut is separate from send and preserves the full draft', () => {
  assert.equal(isInsertShortcut({code:'KeyL',altKey:true,shiftKey:true}),true);
  for (const event of [{code:'KeyL',altKey:true}, {code:'KeyL',shiftKey:true,ctrlKey:true}, {code:'KeyL',altKey:true,shiftKey:true,ctrlKey:true}, {code:'KeyH',altKey:true,shiftKey:true}]) assert.equal(isInsertShortcut(event),false);
  assert.equal(shortcutLabels('Win32').insert,'Alt+Shift+L');
  assert.equal(shortcutLabels('MacIntel').insert,'Option+Shift+L');
  assert.equal(commandDraft(''),'/lossless ');
  const el = {text:'Shorten this to 150 words.\nKeep the limitations. 📄'};
  let writes = 0;
  const adapter = {value:el=>el.text,write(el,text){writes++;el.text=text;},sendButton(){assert.fail('Insertion must never send');}};
  insertCommand(el,adapter);
  assert.equal(el.text,'/lossless Shorten this to 150 words.\nKeep the limitations. 📄');
  insertCommand(el,adapter);
  assert.equal(writes,1);
  assert.equal(commandDraft(' /LOSELESS example'),' /LOSELESS example');
});
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
