import test from 'node:test';
import assert from 'node:assert/strict';
import {sameComposerText,sendPrepared} from './inline-send.js';

test('ChatGPT paragraph spacing preserves the complete protected prompt',async()=>{
 const prepared='Shorten this to 100 words.\n\n[Lossless Rewrite: protected source passages]\nReturn the complete text.\n[{"text":"No control group.","type":"keep_wording"}]';
 // Observed live ChatGPT <p> blocks: blank paragraph adds five newlines;
 // subsequent single newlines are read back as double newlines by innerText.
 const rendered=prepared.replace(/\n\n/g,'\n\n\n\n\n').replace(/(?<!\n)\n(?!\n)/g,'\n\n');
 assert.ok(sameComposerText(rendered,prepared));
 let draft='Shorten this to 100 words.',clicks=0;const el={};
 const result=await sendPrepared({snapshot:{url:'chat',el,text:draft},prepared,wait:async()=>{},adapter:{allowed:async()=>true,url:()=> 'chat',composer:()=>el,value:()=>draft,write:()=>{draft=rendered;},sendButton:()=>({click(){clicks++;}})}});
 assert.equal(result,'clicked');assert.equal(clicks,1);
});

test('spacing tolerance still rejects omissions, changed words, spaces and merged lines',()=>{
 const expected='Six-week trial.\nNo control group.\nKeep 12%.';
 for(const changed of ['Six-week trial.\nKeep 12%.','Six-week trial.\nA control group.\nKeep 12%.','Six-weektrial.\nNo control group.\nKeep 12%.','Six-week trial.No control group.\nKeep 12%.','Six-week trial.\nNo control group.\nKeep 13%.'])assert.equal(sameComposerText(changed,expected),false);
});
