import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {bankPayoutEventTypes,recordBankPayout} from '../_shared/bank-payouts.ts';

Deno.serve(async(req:Request)=>{
  if(req.method!=='POST') return new Response('Method not allowed',{status:405});
  const signature=req.headers.get('stripe-signature');
  if(!signature) return new Response('Missing Stripe signature',{status:400});
  const stripeKey=Deno.env.get('STRIPE_SECRET_KEY')!;
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{db:{schema:'app'}});
  const stripe=new Stripe(stripeKey,{apiVersion:'2023-10-16'});
  try {
    const {data:keys,error}=await db.from('bank_payout_webhook_keys').select('signing_secret,livemode').eq('active',true);
    if(error||!keys?.length) throw new Error('Bank payout webhook configuration missing');
    const body=await req.text(); let event:any=null;
    const keyIsLive=/^(?:sk|rk)_live_/.test(stripeKey);
    for(const key of keys){
      try {
        const verified=await stripe.webhooks.constructEventAsync(body,signature,key.signing_secret);
        if(verified.livemode===key.livemode && verified.livemode===keyIsLive) {event=verified;break;}
      } catch { /* Try another active signing key during rotation. */ }
    }
    if(!event) return new Response('Invalid Stripe signature or environment',{status:400});
    if(!bankPayoutEventTypes.includes(event.type)) return Response.json({ignored:true});
    if(!event.account) return new Response('Connected account required',{status:400});
    const result=await recordBankPayout(db,stripe,event.account,event.data.object.id,event.id);
    return Response.json({received:true,...result});
  } catch(error){
    console.error('[BankPayoutWebhook]',error instanceof Error?error.message:'Processing failed');
    return Response.json({error:'Bank payout processing failed; retry required'},{status:500});
  }
});
