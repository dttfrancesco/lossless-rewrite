import {interest,ownerAccess} from './launch.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { prepare, run } from './check.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token)return json({error:'Sign in to Lossless first.'},401);
  const {data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||!user||user.is_anonymous)return json({error:'Sign in with a verified account.'},401);
  let requestId:string|undefined,reserved=false;
  try{
    // Limit bodies while reading; Content-Length alone is not trusted.
    const reader=req.body?.getReader();if(!reader)throw new Error('Empty request');let size=0;const chunks:Uint8Array[]=[];
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>300000){await reader.cancel();return json({error:'Request too large'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    const body=JSON.parse(new TextDecoder().decode(bytes));
    if(['checkout','portal'].includes(body.action))return json({error:'Paid plans are coming soon. No payment is required to join the interest list.'},403);
    if(['interest','interest-status'].includes(body.action))return json(await interest(db,user,body));
    if(body.action==='account'){
      const {error}=await db.from('lossless_accounts').upsert({user_id:user.id},{onConflict:'user_id',ignoreDuplicates:true});if(error)throw error;
      const owner=await ownerAccess(db,user),plan=owner?'pro':'free';
      const {data:u,error:ue}=await db.from('lossless_usage').select('used').eq('user_id',user.id).eq('month',new Date().toISOString().slice(0,7)+'-01').maybeSingle();if(ue)throw ue;
      return json({plan,owner,allowance:owner?null:25,used:u?.used||0,billingAvailable:false,paidPlansComingSoon:true});
    }
    if(!['quote','check'].includes(body.action))return json({error:'Unknown action'},400);
    const prepared=prepare(body);
    if(body.action==='quote')return json({credits:prepared.credits});
    if(body.acceptedCredits!==prepared.credits)return json({error:'Confirm this check’s usage first.',credits:prepared.credits},409);
    requestId=body.requestId;
    if(!requestId||!/^[0-9a-f-]{36}$/i.test(requestId))throw new Error('Invalid request ID');
    const key=Deno.env.get('LOSSLESS_JEV_KEY');if(prepared.credits&&!key)return json({error:'Hosted checks are not configured yet.'},503);
    if(prepared.credits){await ownerAccess(db,user);const {error}=await db.rpc('lossless_reserve',{p_user:user.id,p_request:requestId,p_credits:prepared.credits});if(error)return json({error:error.message},429);reserved=true;}
    const result=await run(prepared,body.reply,key||'');
    if(reserved){const {error}=await db.rpc('lossless_finish',{p_user:user.id,p_request:requestId,p_success:true,p_tokens:result.inputTokens});if(error)throw new Error('Could not record usage. Please contact support.');}
    return json({...result,credits:prepared.credits});
  }catch(e){
    if(reserved)await db.rpc('lossless_finish',{p_user:user.id,p_request:requestId,p_success:false,p_tokens:0});
    // Do not log manuscript text, credentials or provider response bodies.
    const message=e instanceof Error?e.message:'Check failed';
    return json({error:message.length<240&&!/key|token|fetch|https?:/i.test(message)?message:'Check failed. No automatic retry was made.'},400);
  }
});
