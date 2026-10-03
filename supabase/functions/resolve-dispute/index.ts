import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
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

    if (dispute.status !== 'open' && dispute.status !== 'under_review') {
      return new Response(JSON.stringify({ error: 'Dispute is already resolved' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const job = dispute.jobs;
    const guard = dispute.guards;
    const clientUserId = dispute.clients?.user_id;
    const now = new Date().toISOString();

    let stripeRefundId: string | null = null;
    let stripeTransferId: string | null = null;
    let actualRefundAmount = 0;

    if (resolution === 'resolved_client_refund' || resolution === 'resolved_client_partial') {
      const { data: assignments, error: assignmentError } = await supabase.from('job_assignments')
        .select('payment_status, payout_released, stripe_transfer_id').eq('job_id', job.id);
      const { data: payouts, error: payoutError } = await supabase.from('guard_payouts')
        .select('status').eq('job_id', job.id);
      if (assignmentError || payoutError) throw new Error('Unable to verify payout safety');
      const protectedStates = ['payout_pending', 'payout_processing', 'paid_out', 'paid', 'client_released'];
      if (['payout_approved', 'paid_out'].includes(job.status) ||
          protectedStates.includes(job.payment_status) ||
          (assignments || []).some((a: any) => protectedStates.includes(a.payment_status) || a.payout_released || a.stripe_transfer_id) ||
          (payouts || []).some((p: any) => !['failed', 'cancelled'].includes(p.status))) {
        return new Response(JSON.stringify({ error: 'Refund blocked: guard payout has started. Finance recovery review required.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: transaction } = await supabase
        .from('transactions')
        .select('id, amount, currency, stripe_payment_intent, stripe_charge_id, refunded, refund_amount')
        .eq('job_id', job.id)
        .eq('client_id', job.client_id)
        .not('stripe_payment_intent', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const paymentIntentId = transaction?.stripe_payment_intent || job.stripe_payment_intent_id;
      if (!paymentIntentId) {
        return new Response(JSON.stringify({ error: 'No Stripe payment intent found for refund' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      let charge: Stripe.Charge | null = null;

      if (transaction?.stripe_charge_id) {
        charge = await stripe.charges.retrieve(transaction.stripe_charge_id);
      } else if (typeof paymentIntent.latest_charge === 'string') {
        charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
      }

      if (!charge) {
        return new Response(JSON.stringify({ error: 'Unable to resolve the Stripe charge for this payment' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const maxRefundablePence = Math.max(0, charge.amount - charge.amount_refunded);
      if (maxRefundablePence <= 0) {
        return new Response(JSON.stringify({ error: 'This payment has already been fully refunded' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const requestedPence = resolution === 'resolved_client_refund'
        ? maxRefundablePence
        : Math.round(Number(refund_amount || 0) * 100);

      if (!Number.isFinite(requestedPence) || requestedPence <= 0 || requestedPence > maxRefundablePence) {
        return new Response(JSON.stringify({
          error: 'Invalid refund amount',
          maxRefundable: maxRefundablePence / 100,
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

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

      if (transaction?.id) {
        const cumulativeRefund = Number(transaction.refund_amount || 0) + actualRefundAmount;
        const fullRefund = cumulativeRefund >= Number(transaction.amount || 0) - 0.005;
        await supabase.from('transactions').update({
          stripe_refund_id: refund.id,
          refunded: fullRefund,
          refund_amount: cumulativeRefund,
          refunded_at: now,
          status: fullRefund ? 'refunded' : 'partially_refunded',
          updated_at: now,
        }).eq('id', transaction.id);
      }
    }

    if (resolution === 'resolved_guard') {
      if (!guard?.stripe_account_id || guard.stripe_connect_status !== 'verified') {
        return new Response(JSON.stringify({ error: 'Guard Stripe Connect account is not verified for payout' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const payoutPence = job.guard_payout_amount != null
        ? Math.round(Number(job.guard_payout_amount) * 100)
        : Math.round(Number(job.agreed_amount || 0) * 100);

      const platformFeePence = job.platform_fee != null
        ? Math.round(Number(job.platform_fee) * 100)
        : 0;

      if (payoutPence <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid guard payout amount' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const transfer = await stripe.transfers.create({
        amount: payoutPence,
        currency: job.currency || 'gbp',
        destination: guard.stripe_account_id,
        description: `QuickGuard payout — dispute resolved in guard's favour`,
        metadata: {
          jobId: job.id,
          disputeId: dispute_id,
          guardId: guard.id,
          resolution: 'resolved_guard',
        },
      }, {
        idempotencyKey: `quickguard:dispute-payout:${dispute_id}:${payoutPence}`,
      });

      stripeTransferId = transfer.id;

      await supabase.from('guard_payouts').insert({
        guard_id: guard.id,
        job_id: job.id,
        amount: payoutPence / 100,
        fee_deducted: platformFeePence / 100,
        net_amount: payoutPence / 100,
        status: 'processing',
        payout_method: 'stripe_connect',
        stripe_transfer_id: transfer.id,
        reference_number: transfer.id,
        created_at: now,
        updated_at: now,
      });
    }

    if (resolution === 'resolved_cancelled') {
      await supabase.from('jobs').update({
        disputed: false,
        disputed_at: null,
        disputed_reason: null,
        updated_at: now,
      }).eq('id', job.id);
    }

    await supabase.from('disputes').update({
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

    await supabase.from('payment_audit_logs').insert({
      job_id: job.id,
      guard_id: guard?.id || null,
      action: 'dispute_resolved',
      previous_status: 'disputed',
      new_status: resolution,
      amount: actualRefundAmount,
      platform_fee: job.platform_fee,
      performed_by: admin.id,
      stripe_reference: stripeRefundId || stripeTransferId,
      notes: admin_notes || `Admin resolved dispute: ${resolution}`,
      created_at: now,
    });

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
    console.error('[ResolveDispute] ERROR:', error?.type || error?.code || error?.message || 'unknown');
    return new Response(JSON.stringify({ error: 'Failed to resolve dispute' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
