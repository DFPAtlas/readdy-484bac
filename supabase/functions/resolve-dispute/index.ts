
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: admin } = await supabase
      .from('admin_users')
      .select('id, role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!admin || !admin.is_active) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { dispute_id, resolution, refund_amount, admin_notes } = body;

    if (!dispute_id || !resolution) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: dispute_id, resolution' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validResolutions = ['resolved_guard', 'resolved_client_refund', 'resolved_client_partial', 'resolved_cancelled'];
    if (!validResolutions.includes(resolution)) {
      return new Response(
        JSON.stringify({ error: 'Invalid resolution type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: dispute } = await supabase
      .from('disputes')
      .select('*, jobs:job_id(stripe_payment_intent_id, agreed_amount, currency, payment_status, status, job_title, client_id), guards:guard_id(stripe_account_id, stripe_connect_status, user_id, full_name), clients:client_id(user_id)')
      .eq('id', dispute_id)
      .maybeSingle();

    if (!dispute) {
      return new Response(JSON.stringify({ error: 'Dispute not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (dispute.status !== 'open' && dispute.status !== 'under_review') {
      return new Response(JSON.stringify({ error: 'Dispute is already resolved' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const job = dispute.jobs;
    const guard = dispute.guards;
    const clientUserId = dispute.clients?.user_id;
    const now = new Date().toISOString();

    let stripeRefundId = null;
    let stripeTransferId = null;
    let actualRefundAmount = 0;

    if (resolution === 'resolved_client_refund' || resolution === 'resolved_client_partial') {
      if (!job.stripe_payment_intent_id) {
        return new Response(
          JSON.stringify({ error: 'No Stripe payment intent found for refund' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const agreedAmount = job.agreed_amount || 0;
      const refundPence = resolution === 'resolved_client_refund'
        ? Math.round(agreedAmount * 100)
        : Math.round((refund_amount || 0) * 100);

      if (refundPence <= 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid refund amount' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const refund = await stripe.refunds.create({
        payment_intent: job.stripe_payment_intent_id,
        amount: refundPence,
        reason: 'requested_by_customer',
        metadata: {
          disputeId: dispute_id,
          jobId: job.id,
          resolution: resolution,
          adminId: admin.id,
        },
      });

      stripeRefundId = refund.id;
      actualRefundAmount = refundPence / 100;

      await supabase.from('jobs').update({
        payment_status: 'refunded',
        updated_at: now,
      }).eq('id', job.id);
    }

    if (resolution === 'resolved_guard') {
      if (!guard.stripe_account_id || guard.stripe_connect_status !== 'verified') {
        return new Response(
          JSON.stringify({ error: 'Guard Stripe Connect account is not verified for payout' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payoutAmount = job.guard_payout_amount || Math.round((job.agreed_amount || 0) * 0.85 * 100);
      const platformFee = job.platform_fee || Math.round((job.agreed_amount || 0) * 0.15 * 100);

      if (payoutAmount > 0) {
        const transfer = await stripe.transfers.create({
          amount: payoutAmount,
          currency: job.currency || 'gbp',
          destination: guard.stripe_account_id,
          description: `QuickGuard payout — dispute resolved in guard's favour`,
          metadata: {
            jobId: job.id,
            disputeId: dispute_id,
            guardId: guard.id,
            resolution: 'resolved_guard',
          },
        });

        stripeTransferId = transfer.id;

        await supabase.from('guard_payouts').insert({
          guard_id: guard.id,
          job_id: job.id,
          amount: payoutAmount / 100,
          fee_deducted: platformFee / 100,
          net_amount: payoutAmount / 100,
          status: 'completed',
          payout_method: 'stripe_connect',
          stripe_transfer_id: transfer.id,
          reference_number: transfer.id,
          completed_date: now,
          created_at: now,
          updated_at: now,
        });

        await supabase.from('jobs').update({
          payment_status: 'released',
          updated_at: now,
        }).eq('id', job.id);
      }
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
      resolution: resolution,
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
      guard_id: guard.id,
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
          ? 'The dispute was resolved in your favour and payout has been sent.'
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
          ? 'A full refund has been processed to your original payment method.'
          : resolution === 'resolved_client_partial'
          ? 'A partial refund has been processed to your original payment method.'
          : 'The dispute has been reviewed and resolved by our team.',
        link: '/client/dashboard',
        is_read: false,
      }]);
    }

    return new Response(
      JSON.stringify({
        success: true,
        disputeId: dispute_id,
        resolution: resolution,
        stripeRefundId: stripeRefundId,
        stripeTransferId: stripeTransferId,
        refundAmount: actualRefundAmount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[ResolveDispute] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to resolve dispute' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
