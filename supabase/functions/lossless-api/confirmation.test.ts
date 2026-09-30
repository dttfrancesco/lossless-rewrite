import assert from 'node:assert/strict';
import {confirmInterest,confirmationMessage} from './confirmation.ts';

function fixture(){
  let row:any;
  const db:any={from(table:string){
    let action='read',values:any;
    const query:any={
      upsert(v:any){action='insert';values=v;return query;},
      update(v:any){action='update';values=v;return query;},
      select(){return query;},eq(){return query;},maybeSingle(){return query;},
      then(resolve:any){
        if(table==='lossless_plan_interest')return Promise.resolve({data:{plan:'plus'},error:null}).then(resolve);
        let data:any=row;
        if(action==='insert'){data=row?[]:[{id:'claim-id'}];if(!row)row={...values,id:'claim-id',status:'sending'};}
        if(action==='update'){row={...row,...values};data=null;}
        return Promise.resolve({data,error:null}).then(resolve);
      },
    };return query;
  }};
  return {db,get row(){return row;}};
}
const user:any={id:'verified-user',email:'verified@example.test'};

Deno.test('confirmation thanks the registrant and includes withdrawal instructions',()=>{
  const message=confirmationMessage('pro','https://example.test/unsubscribe#id=test&token=test');
  assert.match(message.subject,/Pro/);
  assert.match(message.textContent,/Thanks for your interest/);
  assert.match(message.textContent,/Unsubscribe from Pro updates/);
  assert.match(message.htmlContent,/assets\/logo.png/);
  assert.match(message.htmlContent,/assets\/less-words-v2.png/);
  assert.match(message.htmlContent,/id=test&amp;token=test/);
  assert.throws(()=>confirmationMessage('<script>',''));
});

Deno.test('concurrent registration requests send only one email to the verified account',async()=>{
  const savedFetch=globalThis.fetch;
  Deno.env.set('LOSSLESS_BREVO_KEY','test-key');Deno.env.set('LOSSLESS_MAIL_FROM','sender@example.test');
  const f=fixture();let calls=0;
  try{
    globalThis.fetch=async(_url,options)=>{
      calls++;const body=JSON.parse(options!.body as string);
      assert.equal(body.to[0].email,user.email);
      assert.equal(body.headers.idempotencyKey,'claim-id');
      const token=body.textContent.match(/token=([a-f0-9]{64})/)[1];
      assert.equal(f.row.unsubscribe_hash.length,64);
      assert.notEqual(f.row.unsubscribe_hash,token);
      return Response.json({messageId:'test-message'});
    };
    const results=await Promise.all([confirmInterest(f.db,user,'plus'),confirmInterest(f.db,user,'plus')]);
    assert.equal(calls,1);assert.ok(results.includes('sent'));
    assert.equal(await confirmInterest(f.db,user,'plus'),'already_sent');
    assert.equal(calls,1);assert.equal(f.row.provider_id,'test-message');
  }finally{globalThis.fetch=savedFetch;Deno.env.delete('LOSSLESS_BREVO_KEY');Deno.env.delete('LOSSLESS_MAIL_FROM');}
});

Deno.test('provider errors and uncertain timeouts never claim that mail was sent or retry blindly',async()=>{
  const savedFetch=globalThis.fetch;
  Deno.env.set('LOSSLESS_BREVO_KEY','test-key');Deno.env.set('LOSSLESS_MAIL_FROM','sender@example.test');
  try{
    const failed=fixture();globalThis.fetch=async()=>new Response('',{status:401});
    assert.equal(await confirmInterest(failed.db,user,'plus'),'failed');
    assert.equal(failed.row.sent_at,null);
    const unknown=fixture();let calls=0;globalThis.fetch=async()=>{calls++;throw Error('timeout');};
    assert.equal(await confirmInterest(unknown.db,user,'plus'),'pending');
    assert.equal(await confirmInterest(unknown.db,user,'plus'),'pending');assert.equal(calls,1);
  }finally{globalThis.fetch=savedFetch;Deno.env.delete('LOSSLESS_BREVO_KEY');Deno.env.delete('LOSSLESS_MAIL_FROM');}
});
