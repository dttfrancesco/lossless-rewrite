import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRules,activeRules,checkItems} from './writing-rules.js';
import {protectedPrompt} from './protections.js';
import {localWording,repairDraft} from './inline-check.js';
import {build} from 'esbuild';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
test('saved rules are bounded, optional and distinct from source passages',()=>{
 assert.deepEqual(validateRules({enabled:true,rules:[' Be concise. ']}),{enabled:true,rules:['Be concise.']});
 assert.deepEqual(activeRules({enabled:false,rules:['Do not repeat.']}),[]);
 for(const rules of [['x','x'],[''],['x'.repeat(501)],Array.from({length:21},(_,i)=>String(i))])assert.throws(()=>validateRules({enabled:true,rules}));
 const prompt=protectedPrompt('Tighten this discussion.',[],{direct:true,rules:['Preserve uncertainty.']});assert.match(prompt,/my writing rules/);assert.match(prompt,/Preserve uncertainty/);
 const items=checkItems([],['Use active voice.']);assert.equal(localWording(items,'Use active voice.')[0].status,'unchecked');
 assert.match(repairDraft('This was done.',[{...items[0],status:'missing'}]),/not as sentences to copy/);
});
const output=await build({entryPoints:[fileURLToPath(new URL('../supabase/functions/lossless-api/check.ts',import.meta.url))],bundle:true,write:false,format:'iife',globalName:'checking',plugins:[{name:'mock-sdk',setup(b){b.onResolve({filter:/^npm:/},args=>({path:args.path,namespace:'sdk'}));b.onLoad({filter:/.*/,namespace:'sdk'},()=>({contents:'export const noul=(instruction,labels)=>({instruction,labels});export class TypeSafeClient{async systemOne(payload){return fixture.result(payload)}}'}));}}]});
test('hosted checks evaluate rules as compliance, preserve uncertainty and meter their cost',async()=>{
 const context={TextEncoder,fixture:{result:()=>({answers:{P0:{noul:.92},P1:{noul:.08},P2:{noul:.5}},usage:{input_tokens:120}})}};vm.runInNewContext(output.outputFiles[0].text,context);
 const {prepare,run}=context.checking;
 const prepared=prepare({reply:'We measured a rise.',items:[{type:'writing_rule',text:'Use active voice.'},{type:'writing_rule',text:'Use bullet points.'},{type:'writing_rule',text:'Follow an unspecified book.'}]});
 assert.equal(prepared.credits,1);assert.match(prepared.payload.questions.P0.instruction.question,/not whether the rule is quoted/);
 const result=await run(prepared,'We measured a rise.','test');assert.deepEqual(Array.from(result.items,i=>i.status),['kept','missing','uncertain']);
 context.fixture.result=()=>({answers:{},usage:{input_tokens:0}});await assert.rejects(run(prepared,'Text','test'),/incomplete/);
 assert.throws(()=>prepare({reply:'Text',items:[{type:'writing_rule',text:'x'.repeat(501)}]}));
 assert.ok(prepare({reply:'x'.repeat(13000),items:[{type:'writing_rule',text:'Use active voice.'}]}).credits>1);
});
