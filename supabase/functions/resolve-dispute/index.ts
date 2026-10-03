import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { claimFinancialOperation, finishFinancialOperation, holdFinancialOperation, verifyRefundSafety, type FinancialOperation } from '../_shared/financialOperations.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const CORS_ALLOWLIST = [
  'https://quickguard.uk',
  'https://www.quickguard.uk',
];

function corsHeadersFor(origin: string | null) {
  const allowedOrigin = origin && CORS_ALLOWLIST.includes(origin) ? origin : 'https://quickguard.uk';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function readAal(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    return JSON.parse(atob(padded))?.aal || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  let operation: FinancialOperation | null = null;
  let stripeStarted = false;
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: admin } = await supabase
      .from('admin_users')
      .select('id, role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!admin || !admin.is_active || !['super_admin', 'finance_admin'].includes(admin.role)) {
      return new Response(JSON.stringify({ error: 'Finance admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (readAal(token) !== 'aal2') {
      return new Response(JSON.stringify({ error: 'MFA verification required for payment resolution' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { dispute_id, resolution, refund_amount, admin_notes } = body;

    if (!dispute_id || !resolution) {
      return new Response(JSON.stringify({ error: 'Missing required fields: dispute_id, resolution' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validResolutions = ['resolved_guard', 'resolved_client_refund', 'resolved_client_partial', 'resolved_cancelled'];
    if (!validResolutions.includes(resolution)) {
      return new Response(JSON.stringify({ error: 'Invalid resolution type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: dispute } = await supabase
      .from('disputes')
      .select('*, jobs:job_id(id, stripe_payment_intent_id, agreed_amount, guard_payout_amount, platform_fee, currency, payment_status, status, job_title, client_id), guards:guard_id(id, stripe_account_id, stripe_connect_status, user_id, full_name), clients:client_id(user_id)')
      .eq('id', dispute_id)
      .maybeSingle();

    if (!dispute) {
      return new Response(JSON.stringify({ error: 'Dispute not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const operationKey = `dispute:${dispute_id}:${resolution}:${resolution === 'resolved_client_partial' ? Math.round(Number(refund_amount) * 100) : 'all'}`;
    operation = await claimFinancialOperation(supabase, dispute.job_id, operationKey, resolution.startsWith('resolved_client_') ? 'refund' : resolution === 'resolved_guard' ? 'payout' : 'dispute', user.id);
    if (operation.replayed) return new Response(JSON.stringify(operation.result), {status: 200, headers: {...corsHeaders, 'Content-Type': 'application/json'}});

    if (!['open','under_review'].includes(dispute.status)) throw {status: 409, message: 'Dispute is already resolved'};
    const job = dispute.jobs;
    const guard = dispute.guards;
    const clientUserId = dispute.clients?.user_id;
    const now = new Date().toISOString();

    let stripeRefundId: string | null = null;
    let stripeTransferId: string | null = null;
    let actualRefundAmount = 0;

    if (resolution === 'resolved_client_refund' || resolution === 'resolved_client_partial') {
      await verifyRefundSafety(supabase, job);
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .select('id, amount, currency, stripe_payment_intent, stripe_charge_id, refunded, refund_amount')
        .eq('job_id', job.id)
        .eq('client_id', job.client_id)
        .eq('transaction_type', 'job_payment')
        .not('stripe_payment_intent', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (transactionError || !transaction) throw {status: 409, message: 'Verified job payment could not be loaded'};
      const paymentIntentId = transaction?.stripe_payment_intent || job.stripe_payment_intent_id;
      if (!paymentIntentId) {
        throw {status: 400, message: 'No Stripe payment intent found for refund'};
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      let charge: Stripe.Charge | null = null;

      if (transaction?.stripe_charge_id) {
        charge = await stripe.charges.retrieve(transaction.stripe_charge_id);
      } else if (typeof paymentIntent.latest_charge === 'string') {
        charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
      }

      if (!charge) {
        throw {status: 409, message: 'Unable to resolve the Stripe charge for this payment'};
      }

      const maxRefundablePence = Math.max(0, charge.amount - charge.amount_refunded);
      if (maxRefundablePence <= 0) {
        throw {status: 409, message: 'This payment has already been fully refunded'};
      }

      const requestedPence = resolution === 'resolved_client_refund'
        ? maxRefundablePence
        : Math.round(Number(refund_amount || 0) * 100);

      if (!Number.isFinite(requestedPence) || requestedPence <= 0 || requestedPence > maxRefundablePence) {
        throw {status: 400, message: `Refund must be between £0.01 and £${(maxRefundablePence / 100).toFixed(2)}`};
      }

      stripeStarted = true;
      const refund = await stripe.refunds.create({
        charge: charge.id,
        amount: requestedPence,
        reason: 'requested_by_customer',
        metadata: {
          disputeId: dispute_id,
          jobId: job.id,
          transactionId: transaction?.id || '',
          resolution,
          adminId: admin.id,
        },
      }, {
        idempotencyKey: `quickguard:dispute-refund:${dispute_id}:${requestedPence}`,
      });

      stripeRefundId = refund.id;
      actualRefundAmount = requestedPence / 100;

      if (!['succeeded','pending'].includes(refund.status || '')) throw new Error('Refund requires finance review');
      const {error: recordError} = await supabase.rpc('record_financial_refund', {
        p_operation_id: operation.id, p_transaction_id: transaction.id, p_dispute_id: dispute_id,
        p_refund_id: refund.id, p_cumulative_refund: (charge.amount_refunded + requestedPence) / 100,
        p_refund_amount: actualRefundAmount, p_succeeded: refund.status === 'succeeded',
        p_role: admin.role, p_resolution: resolution, p_notes: admin_notes || 'Admin dispute refund',
      });
      if (recordError) throw new Error('Stripe refund submitted; database reconciliation required');
      return new Response(JSON.stringify({success: true, disputeId: dispute_id, resolution, stripeRefundId: refund.id, refundAmount: actualRefundAmount, status: refund.status}), {status: 200, headers: {...corsHeaders, 'Content-Type': 'application/json'}});
    }

    if (resolution === 'resolved_guard') {
      if (!guard?.stripe_account_id || guard.stripe_connect_status !== 'verified') {
        throw {status: 403, message: 'Guard Stripe Connect account is not verified for payout'};
      }

      const payoutPence = job.guard_payout_amount != null
        ? Math.round(Number(job.guard_payout_amount) * 100)
        : Math.round(Number(job.agreed_amount || 0) * 100);

      const platformFeePence = job.platform_fee != null
        ? Math.round(Number(job.platform_fee) * 100)
        : 0;

      if (payoutPence <= 0) {
        throw {status: 400, message: 'Invalid guard payout amount'};
      }

      const {data: assignment, error: assignmentError} = await supabase.from('job_assignments')
        .select('id,status,payment_status,payout_released,stripe_transfer_id').eq('job_id',job.id).eq('guard_id',guard.id).maybeSingle();
      if (assignmentError || !assignment || assignment.status !== 'completed' || assignment.payout_released || assignment.stripe_transfer_id) throw {status: 409, message: 'Completed, unpaid guard assignment required'};
      const {data: payment, error: paymentError} = await supabase.from('transactions').select('stripe_payment_intent,refunded,refund_amount,status')
        .eq('job_id',job.id).eq('transaction_type','job_payment').order('created_at',{ascending:false}).limit(1).maybeSingle();
      if (paymentError || !payment?.stripe_payment_intent || payment.refunded || Number(payment.refund_amount) > 0 || payment.status !== 'completed') throw {status:409,message:'Refunded or unverified payment requires finance review; payout blocked'};
      const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent, {expand:['latest_charge']});
      const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge as Stripe.Charge : null;
      const {data: payouts, error: payoutsError} = await supabase.from('guard_payouts').select('status,net_amount,stripe_transfer_id').eq('job_id',job.id);
      if (payoutsError || !charge || !charge.paid || charge.amount_refunded > 0 || (payouts || []).some(p => !['failed','cancelled'].includes(p.status))) throw {status:409,message:'Existing payout or refund requires finance review'};
      if (payoutPence > charge.amount - charge.amount_refunded) throw {status:409,message:'Payout exceeds available client funds'};
      // Reserve local processing records before Stripe can send its transfer webhook.
      stripeStarted = true;
      const {data: payoutRecord,error: payoutReserveError}=await supabase.from('guard_payouts').insert({
        assignment_id:assignment.id,guard_id:guard.id,job_id:job.id,amount:payoutPence/100,
        fee_deducted:platformFeePence/100,net_amount:payoutPence/100,status:'processing',payout_method:'stripe_connect',
        idempotency_key:`quickguard:dispute-payout:${dispute_id}:${payoutPence}`,created_at:now,updated_at:now,
      }).select('id').single();
      if(payoutReserveError || !payoutRecord) throw new Error('Payout reservation requires reconciliation');
      const {error: assignmentReserveError}=await supabase.from('job_assignments').update({payment_status:'payout_processing',updated_at:now}).eq('id',assignment.id);
      if(assignmentReserveError) throw new Error('Payout assignment reservation requires reconciliation');
      const {error: jobReserveError}=await supabase.from('jobs').update({status:'payout_approved',payment_status:'payout_processing',disputed:false,disputed_at:null,disputed_reason:null,updated_at:now}).eq('id',job.id);
      if(jobReserveError) throw new Error('Payout job reservation requires reconciliation');
      const transfer = await stripe.transfers.create({
        amount: payoutPence,
        currency: job.currency || 'gbp',
        destination: guard.stripe_account_id,
        source_transaction: charge.id,
        description: `QuickGuard payout — dispute resolved in guard's favour`,
        metadata: {
          jobId: job.id,
          assignmentId: assignment.id,
          disputeId: dispute_id,
          guardId: guard.id,
          resolution: 'resolved_guard',
        },
      }, {
        idempotencyKey: `quickguard:dispute-payout:${dispute_id}:${payoutPence}`,
      });

      stripeTransferId = transfer.id;

      const {error: payoutWriteError}=await supabase.from('guard_payouts').update({stripe_transfer_id:transfer.id,reference_number:transfer.id,updated_at:now}).eq('id',payoutRecord.id);
      if(payoutWriteError) throw new Error('Transfer submitted; payout reconciliation required');
      const {error: assignmentWriteError}=await supabase.from('job_assignments').update({stripe_transfer_id:transfer.id,updated_at:now}).eq('id',assignment.id);
      if(assignmentWriteError) throw new Error('Transfer submitted; assignment reconciliation required');
    }

    if (resolution === 'resolved_cancelled') {
      const {error: jobWriteError} = await supabase.from('jobs').update({
        disputed: false,
        disputed_at: null,
        disputed_reason: null,
        updated_at: now,
      }).eq('id', job.id);
      if (jobWriteError) throw jobWriteError;
    }

    const {error: disputeWriteError} = await supabase.from('disputes').update({
      status: resolution,
      resolution,
      admin_notes: admin_notes || null,
      refund_amount: actualRefundAmount > 0 ? actualRefundAmount : null,
      admin_decided_by: admin.id,
      stripe_refund_id: stripeRefundId,
      stripe_transfer_id: stripeTransferId,
      resolved_at: now,
      updated_at: now,
    }).eq('id', dispute_id);
    if (disputeWriteError) throw disputeWriteError;

    const { error: auditError } = await supabase.from('payment_audit_logs').insert({
      job_id: job.id, guard_id: guard?.id || null, client_id: job.client_id,
      from_status: 'disputed', to_status: resolution,
      changed_by: user.id, changed_by_role: admin.role,
      reason: admin_notes || `Admin resolved dispute: ${resolution}`,
      event_type: 'dispute_resolved', reference_type: 'dispute', reference_id: dispute_id,
      metadata: { refund_amount: actualRefundAmount, platform_fee: job.platform_fee, stripe_refund_id: stripeRefundId, stripe_transfer_id: stripeTransferId },
      created_at: now,
    });
    if (auditError) throw new Error('Dispute resolution audit could not be recorded');

    await finishFinancialOperation(supabase, operation.id, {success:true,disputeId:dispute_id,resolution,stripeRefundId,stripeTransferId,refundAmount:actualRefundAmount});

    if (guard?.user_id) {
      await supabase.from('notifications').insert([{
        user_id: guard.user_id,
        user_type: 'guard',
        type: 'dispute',
        title: 'Dispute Resolved',
        message: resolution === 'resolved_guard'
          ? 'The dispute was resolved in your favour and payout processing has started.'
          : 'The dispute has been resolved. Check your dashboard for details.',
        link: '/guard/dashboard#notifications',
        is_read: false,
      }]);
    }

    if (clientUserId) {
      await supabase.from('notifications').insert([{
        user_id: clientUserId,
        user_type: 'client',
        type: 'dispute',
        title: 'Dispute Resolved',
        message: resolution === 'resolved_client_refund'
          ? 'A full refund has been submitted to your original payment method.'
          : resolution === 'resolved_client_partial'
          ? 'A partial refund has been submitted to your original payment method.'
          : 'The dispute has been reviewed and resolved by our team.',
        link: '/client/dashboard',
        is_read: false,
      }]);
    }

    return new Response(JSON.stringify({
      success: true,
      disputeId: dispute_id,
      resolution,
      stripeRefundId,
      stripeTransferId,
      refundAmount: actualRefundAmount,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    if (operation && !operation.replayed) await holdFinancialOperation(supabase, operation.id, stripeStarted);
    console.error('[ResolveDispute] ERROR:', error?.type || error?.code || error?.message || 'unknown');
    return new Response(JSON.stringify({ error: stripeStarted ? 'Payment operation submitted or uncertain; finance reconciliation required. Do not repeat the money movement.' : error?.message || 'Failed to resolve dispute' }), {
      status: error?.status || 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
