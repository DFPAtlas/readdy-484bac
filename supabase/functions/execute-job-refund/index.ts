import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { claimFinancialOperation, holdFinancialOperation, verifyRefundSafety, type FinancialOperation } from '../_shared/financialOperations.ts';
const allowedOrigins = ['https://quickguard.uk','https://www.quickguard.uk'];
function response(origin: string | null, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {status, headers: {
    'Content-Type':'application/json','Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS',
  }});
}
function aal(token: string) {try {const p=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(p+'='.repeat((4-p.length%4)%4))).aal;} catch {return null;}}
serve(async req => {
  const origin = req.headers.get('Origin');
  if (req.method==='OPTIONS') return response(origin,200,{ok:true});
  if (req.method!=='POST') return response(origin,405,{error:'Method not allowed'});
  const url=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), stripeKey=Deno.env.get('STRIPE_SECRET_KEY');
  if (!url || !key || !stripeKey) return response(origin,500,{error:'Server configuration error'});
  const db=createClient(url,key,{db:{schema:'app'}});
  let operation: FinancialOperation | null=null;
  let stripeStarted=false;
  try {
    const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');
    if (!token) return response(origin,401,{error:'Authentication required'});
    const {data:{user},error:authError}=await db.auth.getUser(token);
    if (authError || !user) return response(origin,401,{error:'Authentication required'});
    const {data:admin,error:adminError}=await db.from('admin_users').select('id,role,is_active').eq('user_id',user.id).maybeSingle();
    if (adminError || !admin?.is_active || !['super_admin','finance_admin'].includes(admin.role)) return response(origin,403,{error:'Finance administrator access required'});
    if (aal(token)!=='aal2') return response(origin,403,{error:'MFA required'});
    const body=await req.json();
    const jobId=typeof body.jobId==='string'?body.jobId.trim():'';
    const refundRequestId=typeof body.refundRequestId==='string'?body.refundRequestId.trim():null;
    if (refundRequestId && body.disputeId) return response(origin,400,{error:'Choose one refund source'});
    const disputeId=typeof body.disputeId==='string'?body.disputeId.trim():null;
    if (!jobId) return response(origin,400,{error:'jobId required'});
    operation=await claimFinancialOperation(db,jobId,`job-refund:${jobId}:${refundRequestId || disputeId || 'approved-job'}:v2`,'refund',user.id);
    if (operation.replayed) return response(origin,200,operation.result);
    const {data:job,error:jobError}=await db.from('jobs').select('id,client_id,status,payment_status').eq('id',jobId).maybeSingle();
    if (jobError || !job) throw {status:404,message:'Job not found'};
    if (!refundRequestId && job.payment_status!=='refund_pending') throw {status:409,message:'Job is not authorised for refund'};
    let approvedAmount: number | null=null;
    let requestTransactionId: string | null=null;
    if (refundRequestId) {
      const {data:request,error}=await db.from('refund_requests').select('id,job_id,client_id,transaction_id,requested_amount,status,type,stripe_refund_id,cancellation_id').eq('id',refundRequestId).maybeSingle();
      if (error || !request || request.job_id!==jobId || request.client_id!==job.client_id || !request.transaction_id) throw {status:400,message:'Refund request does not match job payment'};
      if (!['pending','approved'].includes(request.status) || request.stripe_refund_id) throw {status:409,message:'Refund request is not awaiting processing'};
      const {data:cancellation,error:cancelError}=await db.from('job_cancellations').select('job_id,preferred_resolution').eq('id',request.cancellation_id).maybeSingle();
      if (cancelError || !cancellation || cancellation.job_id!==jobId || cancellation.preferred_resolution!=='full_refund' || request.type!=='full' || job.status!=='cancelled' || !['funded','refund_pending'].includes(job.payment_status)) throw {status:409,message:'Only cancelled full-refund requests can be processed here; other resolutions need finance review'};
      approvedAmount=Math.round(Number(request.requested_amount)*100);
      requestTransactionId=request.transaction_id;
    }
    let resolution='resolved_client_refund';
    if (disputeId) {
      const {data:dispute,error}=await db.from('disputes').select('id,job_id,status,refund_amount,stripe_refund_id').eq('id',disputeId).maybeSingle();
      if (error || !dispute || dispute.job_id!==jobId) throw {status:400,message:'Dispute does not match job'};
      if (!['resolved_client_refund','resolved_client_partial'].includes(dispute.status) || dispute.stripe_refund_id) throw {status:409,message:'Dispute is not awaiting an approved refund'};
      resolution=dispute.status;
      if (resolution==='resolved_client_partial') approvedAmount=Math.round(Number(dispute.refund_amount)*100);
    }
    await verifyRefundSafety(db,job);
    const {data:payment,error:paymentError}=await db.from('transactions').select('id,amount,stripe_payment_intent,status,refund_amount')
      .eq('job_id',jobId).eq('client_id',job.client_id).eq('transaction_type','job_payment').in('status',['completed','partially_refunded']).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if (paymentError || (requestTransactionId && payment?.id!==requestTransactionId) || !payment?.stripe_payment_intent) throw {status:409,message:'Verified Stripe job payment not found'};
    const stripe=new Stripe(stripeKey,{apiVersion:'2023-10-16'});
    const intent=await stripe.paymentIntents.retrieve(payment.stripe_payment_intent,{expand:['latest_charge']});
    const charge=typeof intent.latest_charge==='object'?intent.latest_charge as Stripe.Charge:null;
    if (!charge || !charge.paid || intent.status!=='succeeded') throw {status:409,message:'Verified Stripe charge not found'};
    const remaining=charge.amount-charge.amount_refunded;
    const refundPence=approvedAmount ?? remaining;
    if (refundRequestId && refundPence!==remaining) throw {status:409,message:'Request amount no longer matches remaining funds; finance review required'};
    if (!Number.isSafeInteger(refundPence) || refundPence <= 0 || refundPence > remaining) throw {status:400,message:'Refund amount exceeds remaining client funds'};
    stripeStarted=true;
    const refund=await stripe.refunds.create({charge:charge.id,amount:refundPence,reason:'requested_by_customer',metadata:{jobId,disputeId:disputeId || '',transactionId:payment.id,operationId:operation.id}}, {idempotencyKey:`job-refund:${jobId}:${refundRequestId || disputeId || 'approved-job'}:v2`});
    if (!['succeeded','pending'].includes(refund.status || '')) throw new Error('Refund requires finance review');
    const {error:recordError}=await db.rpc(refundRequestId ? 'record_requested_refund' : 'record_financial_refund',{
      ...(refundRequestId ? {p_request_id:refundRequestId} : {}),
      p_operation_id:operation.id,p_transaction_id:payment.id,p_dispute_id:disputeId,p_refund_id:refund.id,
      p_cumulative_refund:(charge.amount_refunded+refundPence)/100,p_refund_amount:refundPence/100,
      p_succeeded:refund.status==='succeeded',p_role:admin.role,p_resolution:resolution,p_notes:'Approved job refund',
    });
    if (recordError) throw new Error('Refund submitted; database reconciliation required');
    return response(origin,200,{success:true,refundId:refund.id,status:refund.status,refundAmount:refundPence/100});
  } catch (error) {
    if (operation && !operation.replayed) await holdFinancialOperation(db,operation.id,stripeStarted);
    const e=error as {status?:number;message?:string};
    return response(origin,e.status || 500,{error:stripeStarted?'Refund submitted or uncertain; finance reconciliation required. Do not repeat the refund.':e.message || 'Unable to refund payment'});
  }
});
