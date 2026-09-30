import assert from 'node:assert/strict';
import {unsubscribeRequest} from './handler.ts';
import {hashMailToken,newMailToken} from '../_shared/mail-token.ts';
const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', token=newMailToken();
async function fixture(){
 const hash=await hashMailToken(token);let subscribed=true,deleted=0;
 const db:any={from(table:string){let remove=false;const filters:Record<string,string>={};const query:any={select(){return query;},eq(k:string,v:string){filters[k]=v;return query;},maybeSingle(){return query;},delete(){remove=true;return query;},then(resolve:any){
  if(table==='lossless_interest_mail')return Promise.resolve({data:filters.id===id&&filters.unsubscribe_hash===hash?{user_id:'owner',plan:'pro'}:null,error:null}).then(resolve);
  assert.equal(filters.user_id,'owner');assert.equal(filters.plan,'pro');if(remove){subscribed=false;deleted++;}
  return Promise.resolve({data:subscribed?{plan:'pro'}:null,error:null}).then(resolve);
 }};return query;}};return {db,get deleted(){return deleted;}};
}
function request(action='status',overrides={}){return new Request('https://example.test',{method:'POST',body:JSON.stringify({action,id,token,...overrides})});}
Deno.test('status is non-mutating; unsubscribe is plan-scoped, idempotent and requires the secret token',async()=>{
 const f=await fixture();assert.deepEqual(await (await unsubscribeRequest(request(),f.db)).json(),{plan:'pro',subscribed:true});assert.equal(f.deleted,0);
 assert.equal((await unsubscribeRequest(request('unsubscribe',{token:'b'.repeat(64)}),f.db)).status,404);assert.equal(f.deleted,0);
 assert.deepEqual(await (await unsubscribeRequest(request('unsubscribe'),f.db)).json(),{plan:'pro',subscribed:false});
 assert.deepEqual(await (await unsubscribeRequest(request('unsubscribe'),f.db)).json(),{plan:'pro',subscribed:false});
 assert.deepEqual(await (await unsubscribeRequest(request(),f.db)).json(),{plan:'pro',subscribed:false});
});
Deno.test('email scanners GET and malformed or oversized requests cannot unsubscribe',async()=>{
 const f=await fixture();assert.equal((await unsubscribeRequest(new Request('https://example.test'),f.db)).status,405);
 assert.equal((await unsubscribeRequest(request('unsubscribe',{token:''}),f.db)).status,400);
 assert.equal((await unsubscribeRequest(new Request('https://example.test',{method:'POST',body:'x'.repeat(2049)}),f.db)).status,413);
 assert.equal(f.deleted,0);
});
