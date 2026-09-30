import Stripe from 'npm:stripe@22.6.2';
export async function billing(db:any,user:any,body:any){
  const key=Deno.env.get('LOSSLESS_STRIPE_KEY');if(!key)throw new Error('Subscriptions are not available yet.');
  const stripe=new Stripe(key);
  const {error:upsertError}=await db.from('lossless_accounts').upsert({user_id:user.id},{onConflict:'user_id',ignoreDuplicates:true});if(upsertError)throw upsertError;
  let {data:a,error}=await db.from('lossless_accounts').select('*').eq('user_id',user.id).single();if(error)throw error;
  if(!a.stripe_customer_id){
    const customer=await stripe.customers.create({email:user.email,metadata:{lossless_user:user.id}},{idempotencyKey:`lossless-customer-${user.id}`});
    const saved=await db.from('lossless_accounts').update({stripe_customer_id:customer.id}).eq('user_id',user.id);if(saved.error)throw saved.error;a.stripe_customer_id=customer.id;
  }
  const returnURL='https://lossless-rewrite.vercel.app/account-return.html';
  if(body.action==='portal'||(a.paid_until&&new Date(a.paid_until)>new Date())){
    const portal=await stripe.billingPortal.sessions.create({customer:a.stripe_customer_id,return_url:returnURL,configuration:Deno.env.get('LOSSLESS_PORTAL_CONFIG')});return {url:portal.url};
  }
  if(!['plus','pro'].includes(body.plan))throw new Error('Choose Plus or Pro.');
  const price=Deno.env.get(body.plan==='plus'?'LOSSLESS_PLUS_PRICE':'LOSSLESS_PRO_PRICE');if(!price)throw new Error('This plan is not available yet.');
  const existing=await stripe.checkout.sessions.list({customer:a.stripe_customer_id,status:'open',limit:10});
  const same=existing.data.find(s=>s.metadata?.lossless_plan===body.plan);if(same)return {url:same.url};
  // Never create a second payable checkout while another plan is open.
  for(const s of existing.data)if(s.metadata?.lossless_plan)await stripe.checkout.sessions.expire(s.id);
  const session=await stripe.checkout.sessions.create({mode:'subscription',customer:a.stripe_customer_id,line_items:[{price,quantity:1}],success_url:returnURL+'?checkout=complete',cancel_url:returnURL+'?checkout=cancelled',metadata:{lossless_plan:body.plan},subscription_data:{metadata:{lossless_user:user.id}},integration_identifier:'lossless_rewrite_qmxrptla'},{idempotencyKey:`lossless-checkout-${user.id}-${body.plan}-${Math.floor(Date.now()/60000)}`});
  return {url:session.url};
}
