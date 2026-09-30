import test from 'node:test';
import assert from 'node:assert/strict';
import {chosenPDF,installPDFDrop} from './pdf-upload.js';
test('PDF input rejects empty, multiple, non-PDF and oversized files',()=>{
 const pdf={name:'reference.pdf',size:123};assert.equal(chosenPDF([pdf]),pdf);assert.equal(chosenPDF([]),null);
 for(const files of [[{name:'image.png',size:123}],[{...pdf,size:0}],[{...pdf,size:26*1024*1024}],[pdf,pdf]])assert.throws(()=>chosenPDF(files));
});
test('click and drop use the same upload handler; text drags remain untouched',async()=>{
 const listeners={},opened=[],errors=[],classes=new Set(),input={files:[{name:'reference.pdf',size:123}],value:'old'};
 installPDFDrop({zone:{classList:{add:s=>classes.add(s),remove:s=>classes.delete(s)}},input,open:async f=>opened.push(f),status:s=>errors.push(s),container:{addEventListener:(t,f)=>listeners[t]=f}});
 await input.onchange();assert.equal(opened.length,1);assert.equal(input.value,'');
 let prevented=0;const event={dataTransfer:{types:['Files'],files:input.files},preventDefault:()=>prevented++};listeners.dragenter(event);assert.ok(classes.has('drag-over'));listeners.drop(event);await new Promise(r=>setImmediate(r));assert.equal(opened.length,2);assert.equal(classes.size,0);assert.equal(prevented,2);
 listeners.drop({dataTransfer:{types:['text/plain']},preventDefault:()=>assert.fail('Text drag intercepted')});
 event.dataTransfer.files=[{name:'bad.txt',size:5}];listeners.drop(event);assert.equal(opened.length,2);assert.match(errors[0],/PDF/);
});
