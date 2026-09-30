import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.117.2';
import {hashMailToken} from '../_shared/mail-token.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type','Cache-Control':'no-store','Content-Type':'application/json'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
export async function unsubscribeRequest(req:Request,db:SupabaseClient){
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply({error:'Use the unsubscribe page to confirm.'},405);
  try{
    const reader=req.body?.getReader();if(!reader)return reply({error:'Invalid link.'},400);
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return reply({error:'Invalid request.'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const body=JSON.parse(new TextDecoder().decode(bytes));
    if(!['status','unsubscribe'].includes(body.action)||!/^[0-9a-f-]{36}$/.test(body.id)||!/^[0-9a-f]{64}$/.test(body.token))return reply({error:'This unsubscribe link is invalid.'},400);
    const {data:mail,error}=await db.from('lossless_interest_mail').select('user_id,plan').eq('id',body.id).eq('unsubscribe_hash',await hashMailToken(body.token)).maybeSingle();
    if(error)throw error;if(!mail)return reply({error:'This unsubscribe link is invalid.'},404);
    if(body.action==='unsubscribe'){
      const removed=await db.from('lossless_plan_interest').delete().eq('user_id',mail.user_id).eq('plan',mail.plan);if(removed.error)throw removed.error;
      return reply({plan:mail.plan,subscribed:false});
    }
    const {data:interest,error:readError}=await db.from('lossless_plan_interest').select('plan').eq('user_id',mail.user_id).eq('plan',mail.plan).maybeSingle();if(readError)throw readError;
    return reply({plan:mail.plan,subscribed:Boolean(interest)});
  }catch{return reply({error:'Could not update your preference. Please try again.'},500);}
}
