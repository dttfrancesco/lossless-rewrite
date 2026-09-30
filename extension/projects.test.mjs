import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileId,saveProject,listProjects,projectFile,deleteProject} from './projects.js';
test('saved projects persist PDF bytes and page references, isolate owners and can be removed',async()=>{
 const bytes=new TextEncoder().encode('%PDF test fixture').buffer;
 const file={id:await fileId(bytes),name:'Study.pdf',bytes};
 const items=[{type:'keep_meaning',text:'No causal inference.',source:{kind:'pdf',label:file.name,page:4,fileId:file.id}}];
 const id=await saveProject({owner:'user-A',name:'Discussion',items,files:[file]});
 const projects=await listProjects('user-A');assert.equal(projects.length,1);assert.deepEqual(projects[0].items,items);
 assert.equal((await listProjects('user-B')).length,0);
 assert.deepEqual(new Uint8Array((await projectFile('user-A',id,file)).bytes),new Uint8Array(bytes));
 await assert.rejects(projectFile('user-B',id,file));
 await deleteProject('user-A',id);assert.equal((await listProjects('user-A')).length,0);await assert.rejects(projectFile('user-A',id,file));
});
