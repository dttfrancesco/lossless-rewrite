import test from 'node:test';
import assert from 'node:assert/strict';
import {createReplyHighlighter} from './reply-highlights.js';
test('highlights survive markup updates and replacement nodes but clear changed text; toggles are independent',()=>{
 const names=['document','CSS','Highlight','MutationObserver','getComputedStyle','NodeFilter'];const saved=Object.fromEntries(names.map(n=>[n,globalThis[n]]));
 try {
  let latest;const observers=[];const makeReply=text=>{const r={isConnected:true,getClientRects:()=>[1]};r.node={data:text,parentElement:{closest:()=>null,getClientRects:()=>[1]}};return r;};latest=makeReply('No control group. Short rewrite.');
  const makeRange=()=>({setStart(node,offset){this.start={node,offset};},setEnd(node,offset){this.end={node,offset};}});
  globalThis.CSS={highlights:new Map()};globalThis.Highlight=class extends Set{add(r){super.add(r);return this;}};
  globalThis.getComputedStyle=()=>({visibility:'visible'});globalThis.NodeFilter={SHOW_TEXT:4};
  globalThis.MutationObserver=class{constructor(fn){this.fn=fn;observers.push(this);}observe(target){this.target=target;}disconnect(){}};
  globalThis.document={querySelectorAll:()=>[latest],head:{append(){}},createElement:()=>({dataset:{},remove(){}}),createRange:makeRange,createTreeWalker:root=>{let done=false;return {nextNode:()=>{if(done)return null;done=true;return root.node;}};}};
  const h=createReplyHighlighter();const item={id:'one',type:'keep_wording',text:'No control group.'};
  const source={startContainer:{isConnected:true},toString:()=>item.text};source.cloneRange=()=>source;h.remember(item,source);h.reply([item]);
  const marked=()=>[...CSS.highlights.get('lossless-kept-wording')];assert.equal(marked().length,2);
  latest.node={...latest.node};observers.at(-1).fn();assert.equal(marked().length,2);assert.equal(marked()[1].start.node,latest.node);
  const old=latest;latest=makeReply('No control group. Short rewrite.');old.isConnected=false;h.reconcile();assert.equal(marked()[1].start.node,latest.node);
  h.setEnabled(false,'source');assert.equal(marked().length,1);h.setEnabled(false,'reply');assert.equal(CSS.highlights.size,0);
  h.setEnabled(true,'source');assert.deepEqual(marked(),[source]);h.setEnabled(true,'reply');assert.equal(marked().length,2);
  latest.node.data='A genuinely different reply.';observers.at(-1).fn();assert.deepEqual(marked(),[source]);assert.equal(CSS.highlights.get('lossless-other-wording').size,0);h.reset();
 } finally {for(const name of names){if(saved[name]===undefined)delete globalThis[name];else globalThis[name]=saved[name];}}
});
