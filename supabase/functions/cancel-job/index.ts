import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

serve(async (req) => {
  const origin = req.headers.get('origin') || 'https://quickguard.uk';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

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
  const supabaseService = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { jobId, cancelledBy } = await req.json();
    if (!jobId || !cancelledBy) {
      return new Response(
        JSON.stringify({ error: 'jobId and cancelledBy are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: job, error: jobError } = await supabaseService
      .from('jobs')
      .select('id, client_id, guard_id, status, start_date, start_time, hourly_rate, number_of_guards, number_of_days, total_amount, stripe_payment_intent_id')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: clientData } = await supabaseService
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!clientData || clientData.id !== job.client_id) {
      return new Response(
        JSON.stringify({ error: 'You do not own this job' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const startDateTime = new Date(`${job.start_date}T${job.start_time}`);
    const hoursUntilStart = (startDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    let refundGuardFeePct = 0;
    let refundServiceFee = false;
    let reason = '';

    if (cancelledBy === 'guard') {
      refundGuardFeePct = 1.0;
      refundServiceFee = true;
      reason = 'Guard cancelled — full refund';
    } else if (cancelledBy === 'client') {
      if (hoursUntilStart >= 24) {
        refundGuardFeePct = 1.0;
        refundServiceFee = true;
        reason = 'Client cancelled >24h — full refund';
      } else if (hoursUntilStart >= 12) {
        refundGuardFeePct = 0.5;
        refundServiceFee = false;
        reason = 'Client cancelled 12–24h — 50% guard fee refund';
      } else {
        refundGuardFeePct = 0;
        refundServiceFee = false;
        reason = 'Client cancelled <12h — no refund';
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'cancelledBy must be "client" or "guard"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: txn } = await supabaseService
      .from('transactions')
      .select('amount, metadata, stripe_payment_intent_id')
      .eq('job_id', jobId)
      .eq('transaction_type', 'job_payment')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const guardFees = txn?.metadata?.guard_fees ?? (job.total_amount ? job.total_amount * 0.85 : 0);
    const serviceFee = txn?.metadata?.service_fee ?? (job.total_amount ? job.total_amount * 0.15 : 0);
    const totalPaid = txn?.amount ?? job.total_amount ?? 0;

    const refundGuardAmount = guardFees * refundGuardFeePct;
    const refundServiceAmount = refundServiceFee ? serviceFee : 0;
    const refundTotal = refundGuardAmount + refundServiceAmount;

    let stripeRefund = null;
    const paymentIntentId = job.stripe_payment_intent_id || txn?.stripe_payment_intent_id;

    if (refundTotal > 0 && paymentIntentId) {
      try {
        stripeRefund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: Math.round(refundTotal * 100),
          reason: 'requested_by_customer',
          metadata: { jobId, cancelledBy, reason },
        });
      } catch (stripeErr: any) {
        console.error('Stripe refund error:', stripeErr.message);
      }
    }

    const { error: updateError } = await supabaseService
      .from('jobs')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: cancelledBy,
        refund_amount: refundTotal,
        refund_reason: reason,
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('Job update error:', updateError);
    }

    await supabaseService.from('job_cancellations').insert({
      job_id: jobId,
      client_id: job.client_id,
      guard_id: job.guard_id,
      cancelled_by: cancelledBy,
      hours_before_start: hoursUntilStart,
      refund_guard_pct: refundGuardFeePct,
      refund_service_fee: refundServiceFee,
      refund_total: refundTotal,
      stripe_refund_id: stripeRefund?.id || null,
      reason,
    });

    const { data: newCancellation } = await supabaseService
      .from('job_cancellations')
      .select('id')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (newCancellation?.id) {
      try {
        await fetch('https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/send-cancellation-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ cancellation_id: newCancellation.id }),
        });
      } catch (emailErr) {
        console.error('Failed to send cancellation email:', emailErr);
      }
    }

    const notifications = [];
    if (job.client_id) {
      notifications.push({
        user_id: job.client_id,
        type: 'job_cancelled',
        title: 'Job Cancelled',
        message: reason,
        related_id: jobId,
      });
    }
    if (job.guard_id) {
      notifications.push({
        user_id: job.guard_id,
        type: 'job_cancelled',
        title: 'Job Cancelled',
        message: `Job cancelled by ${cancelledBy}. ${reason}`,
        related_id: jobId,
      });
    }

    if (notifications.length > 0) {
      await supabaseService.from('notifications').insert(notifications);
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        cancelledBy,
        reason,
        hoursUntilStart: Math.round(hoursUntilStart * 100) / 100,
        refundGuardAmount,
        refundServiceAmount,
        refundTotal,
        stripeRefundId: stripeRefund?.id || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Cancel job error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
