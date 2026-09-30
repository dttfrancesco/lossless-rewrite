import type { SupabaseClient, User } from 'npm:@supabase/supabase-js@2.117.2';
import {confirmInterest} from './confirmation.ts';

export async function ownerAccess(db:SupabaseClient,user:User){
  const clearBinding=async()=>{const {error}=await db.from('lossless_owner_allowlist').update({user_id:null}).eq('user_id',user.id);if(error)throw error;return false;};
  if(!user.email||!user.email_confirmed_at)return clearBinding();
  const {data,error}=await db.from('lossless_owner_allowlist').select('user_id').eq('email',user.email.toLowerCase()).eq('enabled',true).maybeSingle();
  if(error)throw error;
  if(!data)return clearBinding();
  if(data.user_id!==user.id){
    const result=await db.from('lossless_owner_allowlist').update({user_id:user.id}).eq('email',user.email.toLowerCase()).eq('enabled',true).select('user_id');
    if(result.error)throw result.error;
    return result.data.length===1;
  }
  return true;
}

export async function interest(db:SupabaseClient,user:User,body:any){
  let confirmation:string|undefined;
  if(!user.email||!user.email_confirmed_at)throw new Error('Use a verified email to join the launch list.');
  if(body.action==='interest'){
    if(!['plus','pro'].includes(body.plan)||typeof body.interested!=='boolean')throw new Error('Choose Plus or Pro.');
    const result=body.interested
      ? await db.from('lossless_plan_interest').upsert({user_id:user.id,plan:body.plan,email:user.email.toLowerCase(),consent_version:'plan-launch-v1'},{onConflict:'user_id,plan',ignoreDuplicates:true})
      : await db.from('lossless_plan_interest').delete().eq('user_id',user.id).eq('plan',body.plan);
    if(result.error)throw result.error;
    if(body.interested)confirmation=await confirmInterest(db,user,body.plan);
  }
  const {data,error}=await db.from('lossless_plan_interest').select('plan').eq('user_id',user.id);if(error)throw error;
  return {plans:data.map(row=>row.plan),...(confirmation?{confirmation}:{})};
}
