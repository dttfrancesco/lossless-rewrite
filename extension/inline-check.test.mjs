import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPayload, localWording, checkedItems, repairDraft, completionGate} from './inline-check.js';
const items = [{type:'keep_wording',text:'No control group.',source:{label:'Paper'}},{type:'keep_meaning',text:'Cannot infer causality.',source:{label:'Paper'}}];
test('check payload preserves offsets for combined marks and never enables a writing pass',()=>{
 const p=checkPayload(items,'Reply'); for(const c of p.constraints) assert.equal(p.source.slice(c.start,c.end),c.text);
 assert.equal(p.maxRepairs,0); assert.throws(()=>checkPayload(items,''));
 assert.equal(localWording(items,'No control group.')[1].status,'unchecked');
});
test('streaming pauses cannot trigger checks; silent layouts require explicit confirmation',()=>{
 let p=completionGate({text:'Partial',streaming:true,now:0});
 p=completionGate({previous:p,text:'Partial',streaming:true,now:8000});assert.equal(p.ready,false);
 p=completionGate({previous:p,text:'Partial',streaming:false,now:9000});assert.equal(p.ready,true);assert.equal(p.automatic,true);
 p=completionGate({text:'Reply',streaming:false,now:0});
 p=completionGate({previous:p,text:'Reply',streaming:false,now:8000});assert.equal(p.ready,true);assert.equal(p.automatic,false);
 assert.equal(completionGate({previous:p,text:'Reply',baseline:'Reply',streaming:false,now:9000}).ready,false);
});
test('incomplete checker results fail closed and repairs retain full reply and uncertain status',()=>{
 assert.throws(()=>checkedItems(items,{final:{verification:{wording:[],units:[]}}}));
 const marked=checkedItems(items,{final:{verification:{wording:[{id:'W1',kept:false}],units:[{unit:{id:'P1'},status:'uncertain'}]}}});
 const prompt=repairDraft('Complete reply content.',marked);assert.match(prompt,/Complete reply content/);assert.match(prompt,/uncertain/);assert.match(prompt,/not just corrections/);
});
