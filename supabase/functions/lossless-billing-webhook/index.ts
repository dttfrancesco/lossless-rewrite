import Stripe from 'npm:stripe@22.6.2';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405});
  const stripe=new Stripe(Deno.env.get('LOSSLESS_STRIPE_KEY')!);
  let event:Stripe.Event;
  try{
    if(Number(req.headers.get('content-length'))>1000000)return new Response('Too large',{status:413});
    event=await stripe.webhooks.constructEventAsync(await req.text(),req.headers.get('stripe-signature')||'',Deno.env.get('LOSSLESS_STRIPE_WEBHOOK')!,undefined,Stripe.createSubtleCryptoProvider());
  }catch{return new Response('Invalid signature',{status:400});}
  const object:any=event.data.object;
  const subscriptionId=object.object==='subscription'?object.id:typeof object.subscription==='string'?object.subscription:object.parent?.subscription_details?.subscription;
  if(!subscriptionId)return new Response('Ignored');
  try{
    // Retrieve current Stripe state: late or duplicated events cannot restore an old plan.
    const sub=await stripe.subscriptions.retrieve(subscriptionId,{expand:['latest_invoice']});
    const customer=typeof sub.customer==='string'?sub.customer:sub.customer.id;
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    const {data:a,error}=await db.from('lossless_accounts').select('user_id').eq('stripe_customer_id',customer).maybeSingle();if(error)throw error;if(!a)return new Response('Unknown customer');
    const item=sub.items.data[0];if(!item)throw new Error('Subscription has no item');const price=item?.price.id;
    const plan=price===Deno.env.get('LOSSLESS_PRO_PRICE')?'pro':price===Deno.env.get('LOSSLESS_PLUS_PRICE')?'plus':'free';
    const invoice:any=sub.latest_invoice;
    const paid=sub.status==='active'&&invoice?.status==='paid'&&plan!=='free';
    const {error:saveError}=await db.from('lossless_accounts').update({plan:paid?plan:'free',paid_until:paid?new Date(item.current_period_end*1000).toISOString():null,stripe_subscription_id:sub.id}).eq('user_id',a.user_id);if(saveError)throw saveError;
    return new Response('OK');
  }catch{return new Response('Billing update failed; retry delivery.',{status:500});}
});
