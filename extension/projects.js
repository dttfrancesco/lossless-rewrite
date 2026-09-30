// PDFs stay in this browser profile. Encrypt their stored contents; the
// non-extractable key is local too, so an unlocked profile is still trusted.
let database;
const result=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
async function db(){
  if(database)return database;
  const request=indexedDB.open('lossless-projects',1);
  request.onupgradeneeded=()=>{for(const name of ['projects','files','keys'])request.result.createObjectStore(name);};
  database=await result(request);return database;
}
async function read(store,key){return result((await db()).transaction(store).objectStore(store).get(key));}
async function key(){
  const existing=await read('keys','aes');if(existing)return existing;
  const made=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const database=await db();return new Promise((resolve,reject)=>{
    const tx=database.transaction('keys','readwrite'),s=tx.objectStore('keys');let actual=made;
    const get=s.get('aes');get.onsuccess=()=>{if(get.result)actual=get.result;else s.put(made,'aes');};
    tx.oncomplete=()=>resolve(actual);tx.onerror=()=>reject(tx.error);
  });
}
async function encrypt(bytes){const iv=crypto.getRandomValues(new Uint8Array(12));return {iv,data:await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),bytes)};}
async function decrypt(value){return crypto.subtle.decrypt({name:'AES-GCM',iv:value.iv},await key(),value.data);}
export async function fileId(bytes){const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));return [...hash].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function saveProject({owner,id=crypto.randomUUID(),name,items,files}){
  if(!owner||!name?.trim()||name.length>120||!Array.isArray(items)||items.length>100||files.length>20)throw new Error('Use a project name under 120 characters and at most 20 PDFs.');
  const data=await db(),ownerKey=`${owner}:${id}`;
  const records=[];let total=0;
  for(const file of files){total+=file.bytes.byteLength;if(total>100*1024*1024)throw new Error('Keep a project under 100 MB.');records.push({id:file.id,name:file.name,value:await encrypt(file.bytes)});}
  const project=await encrypt(new TextEncoder().encode(JSON.stringify({id,name:name.trim(),items,files:records.map(({id,name})=>({id,name})),updatedAt:Date.now()})));
  await new Promise((resolve,reject)=>{const tx=data.transaction(['projects','files'],'readwrite');tx.objectStore('projects').put(project,ownerKey);for(const file of records)tx.objectStore('files').put(file.value,`${ownerKey}:${file.id}`);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Project storage is full.'));});
  return id;
}
export async function listProjects(owner){
  const data=await db(),tx=data.transaction('projects'),store=tx.objectStore('projects');
  const [keys,values]=await Promise.all([result(store.getAllKeys()),result(store.getAll())]);
  const out=[];for(let i=0;i<keys.length;i++)if(String(keys[i]).startsWith(owner+':'))out.push(JSON.parse(new TextDecoder().decode(await decrypt(values[i]))));
  return out.sort((a,b)=>b.updatedAt-a.updatedAt);
}
export async function projectFile(owner,projectId,file){const value=await read('files',`${owner}:${projectId}:${file.id}`);if(!value)throw new Error('This reference is no longer saved.');return {...file,bytes:await decrypt(value)};}
export async function deleteProject(owner,id){
  const data=await db(),prefix=`${owner}:${id}`;
  const keys=await result(data.transaction('files').objectStore('files').getAllKeys());
  await new Promise((resolve,reject)=>{const tx=data.transaction(['projects','files'],'readwrite');tx.objectStore('projects').delete(prefix);for(const k of keys)if(String(k).startsWith(prefix+':'))tx.objectStore('files').delete(k);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
