import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {recordBankPayout} from '../_shared/bank-payouts.ts';
const headers={'Access-Control-Allow-Origin':'https://quickguard.uk','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers});
  if(req.method!=='POST')return respond(405,{error:'Method not allowed'});
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{db:{schema:'app'}});
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!token)return respond(401,{error:'Unauthorized'});
  const {data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||!user)return respond(401,{error:'Unauthorized'});
  try {
    const body=await req.json().catch(()=>({}));
    let query=db.from('guards').select('id,user_id,stripe_account_id');
    if(body.guardId){
      const {data:admin,error}=await db.from('admin_users').select('role,is_active').eq('user_id',user.id).maybeSingle();
      if(error||!admin?.is_active||!['super_admin','finance_admin'].includes(admin.role))return respond(403,{error:'Finance access required'});
      query=query.eq('id',body.guardId);
    }else query=query.eq('user_id',user.id);
    const {data:guard,error}=await query.maybeSingle();
    if(error)throw error;
    if(!guard)return respond(404,{error:'Guard not found'});
    if(!guard.stripe_account_id)return respond(200,{synced:0});
    const stripe=new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!,{apiVersion:'2023-10-16'});
    let startingAfter:string|undefined; let synced=0;
    for(let page=0;page<10;page++){
      const payouts=await stripe.payouts.list({limit:100,...(startingAfter?{starting_after:startingAfter}:{})},{stripeAccount:guard.stripe_account_id});
      for(const payout of payouts.data){await recordBankPayout(db,stripe,guard.stripe_account_id,payout.id);synced++;}
      if(!payouts.has_more)return respond(200,{synced});
      startingAfter=payouts.data[payouts.data.length-1].id;
    }
    return respond(200,{synced,olderHistoryRemaining:true});
  } catch(error){console.error('[BankPayoutSync]',error instanceof Error?error.message:'Sync failed');return respond(500,{error:'Bank payout refresh failed. Please try again.'});}
});
