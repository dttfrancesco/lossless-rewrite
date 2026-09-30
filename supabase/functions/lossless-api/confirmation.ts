import type { SupabaseClient, User } from 'npm:@supabase/supabase-js@2.117.2';

import {confirmationMessage,mailSite} from './mail-content.ts';
import {newMailToken,hashMailToken} from '../_shared/mail-token.ts';
export {confirmationMessage} from './mail-content.ts';

// Atomic insert claims the send. Concurrent clicks and client retries see the
// same record. Ambiguous provider timeouts are not retried automatically.
export async function confirmInterest(db:SupabaseClient,user:User,plan:string){
  const key=Deno.env.get('LOSSLESS_BREVO_KEY'),from=Deno.env.get('LOSSLESS_MAIL_FROM');
  if(!key||!from)return 'unavailable';
  const token=newMailToken();
  const {data:claim,error}=await db.from('lossless_interest_mail').upsert({user_id:user.id,plan,unsubscribe_hash:await hashMailToken(token)},{onConflict:'user_id,plan',ignoreDuplicates:true}).select('id');
  if(error){console.error('lossless_confirmation_claim_failed');return 'unavailable';}
  if(!claim.length){
    const {data}=await db.from('lossless_interest_mail').select('status').eq('user_id',user.id).eq('plan',plan).maybeSingle();
    return data?.status==='sent'?'already_sent':data?.status==='failed'?'failed':'pending';
  }
  const id=claim[0]!.id;
  let state='unknown',providerId:string|null=null,errorCode:string|null=null;
  try{
    const {data:stillJoined,error:joinError}=await db.from('lossless_plan_interest').select('plan').eq('user_id',user.id).eq('plan',plan).maybeSingle();
    if(joinError||!stillJoined){state='failed';errorCode='registration_unavailable';}
    else{
      const response=await fetch('https://api.brevo.com/v3/smtp/email',{
        method:'POST',headers:{'api-key':key,'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({sender:{email:from,name:'Lossless Rewrite'},to:[{email:user.email}],...confirmationMessage(plan,`${mailSite}/unsubscribe.html#id=${id}&token=${token}`),headers:{idempotencyKey:id},tags:['lossless-plan-confirmation']}),
        signal:AbortSignal.timeout(15000),
      });
      if(response.ok){const body=await response.json();providerId=body.messageId||null;state='sent';}
      else{state=response.status>=500?'unknown':'failed';errorCode=`provider_${response.status}`;}
    }
  }catch{errorCode='provider_response_unknown';}
  const {error:updateError}=await db.from('lossless_interest_mail').update({status:state,provider_id:providerId,error_code:errorCode,sent_at:state==='sent'?new Date().toISOString():null}).eq('id',id);
  if(updateError)console.error('lossless_confirmation_record_failed');
  if(state!=='sent')console.error('lossless_confirmation_not_sent',errorCode);
  return state==='unknown'?'pending':state;
}
