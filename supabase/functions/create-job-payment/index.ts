import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const STRIPE_FEE_FIXED = 0.20;

const CORS_ALLOWLIST = [
  'https://quickguard.uk',
  'https://www.quickguard.uk',
];

function isAllowedOrigin(origin: string | null): string {
  if (!origin) return 'https://quickguard.uk';
  if (CORS_ALLOWLIST.includes(origin)) return origin;
  return 'https://quickguard.uk';
}

async function getSubscriptionAwareFee(
  supabaseService: any,
  userId: string,
  role: 'client' | 'guard',
): Promise<{ feePercent: number; feeFixed: number; isSubscribed: boolean; planSlug: string | null }> {
  const { data: sub, error: subErr } = await supabaseService
    .from('subscriptions')
    .select('plan_slug, status')
    .eq('user_id', userId)
    .eq('account_type', role)
    .in('status', ['active', 'trialing'])
    .maybeSingle();

  if (subErr) {
    console.error('[create-job-payment] Subscription lookup error:', subErr.message);
  }

  if (sub) {
    return { feePercent: 0, feeFixed: 0, isSubscribed: true, planSlug: sub.plan_slug };
  }

  const table = role === 'client' ? 'clients' : 'guards';
  const { data: profile } = await supabaseService
    .from(table)
    .select('subscription_plan')
    .eq('user_id', userId)
    .maybeSingle();

  const planSlug = profile?.subscription_plan || (role === 'client' ? 'payg' : 'guard-starter');

  const { data: rules } = await supabaseService
    .from('plan_fee_rules')
    .select('platform_fee_percent, platform_fee_fixed_pence')
    .eq('plan_slug', planSlug)
    .maybeSingle();

  return {
    feePercent: rules?.platform_fee_percent ? Number(rules.platform_fee_percent) : 0,
    feeFixed: rules?.platform_fee_fixed_pence ? Number(rules.platform_fee_fixed_pence) : 0,
    isSubscribed: false,
    planSlug,
  };
}

async function getStripeFeeConfig(supabaseService: any, clientPlanSlug: string | null) {
  const slug = clientPlanSlug || 'payg';
  const { data: rules } = await supabaseService
    .from('plan_fee_rules')
    .select('stripe_fee_payer, stripe_fee_estimate_percent, payout_delay_days, auto_release_hours, dispute_window_hours')
    .eq('plan_slug', slug)
    .maybeSingle();

  return {
    stripeFeePayer: rules?.stripe_fee_payer || 'quickguard',
    stripeFeePct: rules?.stripe_fee_estimate_percent ? Number(rules.stripe_fee_estimate_percent) : 1.5,
    payoutDelay: rules?.payout_delay_days ? Number(rules.payout_delay_days) : 3,
    autoRelease: rules?.auto_release_hours ? Number(rules.auto_release_hours) : 72,
    disputeWindow: rules?.dispute_window_hours ? Number(rules.dispute_window_hours) : 48,
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const allowedOrigin = isAllowedOrigin(origin);
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const appUrl = Deno.env.get('APP_URL') || 'https://quickguard.uk';

  if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const supabaseService = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let body: { jobId?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const jobId = body.jobId;
    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing jobId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: clientData, error: clientErr } = await supabaseService
      .from('clients')
      .select('id, email, stripe_customer_id, client_service_tier, client_type, client_promo_tier, client_promo_ends_at, client_lifetime_fee_discount, client_promo_jobs_remaining, client_signup_number, subscription_plan')
      .eq('user_id', user.id)
      .maybeSingle();

    if (clientErr || !clientData) {
      console.error('[create-job-payment] Client not found for authenticated user');
      return new Response(
        JSON.stringify({ error: 'Account not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: jobData, error: jobErr } = await supabaseService
      .from('jobs')
      .select('id, job_title, client_id, status, hourly_rate, start_date, end_date, start_time, end_time, number_of_guards, number_of_days, tax_disclaimer_accepted, payment_status')
      .eq('id', jobId)
      .maybeSingle();

    if (jobErr || !jobData) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (jobData.client_id !== clientData.id) {
      console.error('[create-job-payment] Ownership mismatch for job:', jobId);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (jobData.status === 'cancelled' || jobData.status === 'completed') {
      return new Response(
        JSON.stringify({ error: 'This job cannot be paid at this time' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: completedTx } = await supabaseService
      .from('transactions')
      .select('id')
      .eq('job_id', jobId)
      .eq('client_id', clientData.id)
      .eq('status', 'completed')
      .maybeSingle();

    if (completedTx) {
      return new Response(
        JSON.stringify({ error: 'Payment already completed for this job' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: existingTx } = await supabaseService
      .from('transactions')
      .select('id, status, stripe_session_id, retry_count, metadata')
      .eq('job_id', jobId)
      .eq('client_id', clientData.id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingTx?.stripe_session_id) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(existingTx.stripe_session_id);
        if (existingSession.status === 'open' && existingSession.url) {
          return new Response(
            JSON.stringify({
              sessionId: existingSession.id,
              url: existingSession.url,
              breakdown: existingTx.metadata?.breakdown || {},
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
          );
        }
        if (existingSession.status === 'complete') {
          return new Response(
            JSON.stringify({ error: 'Payment already completed for this job' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      } catch {
        console.error('[create-job-payment] Existing Stripe session', existingTx.stripe_session_id, 'no longer retrievable, will create new one');
      }
    }

    const { data: assignments, error: assignErr } = await supabaseService
      .from('job_assignments')
      .select('id, guard_id, agreed_hourly_rate, agreed_hours, gross_guard_amount, guards(user_id, full_name, hourly_rate)')
      .eq('job_id', jobId);

    if (assignErr) {
      console.error('[create-job-payment] Assignment load error:', assignErr.message);
      return new Response(
        JSON.stringify({ error: 'Unable to load job assignments' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!assignments || assignments.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No guards assigned to this job' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const feeResult = await getSubscriptionAwareFee(supabaseService, user.id, 'client');
    const stripeConfig = await getStripeFeeConfig(supabaseService, feeResult.planSlug);

    let effectiveFeePercent = feeResult.feePercent;
    let promoApplied = false;
    let promoLabel = '';
    let jobsRemainingAfter: number | null = null;
    const now = new Date();
    const promoEnds = clientData?.client_promo_ends_at ? new Date(clientData.client_promo_ends_at) : null;
    const promoTier = clientData?.client_promo_tier || 'standard';

    if (!feeResult.isSubscribed && clientData?.client_type !== 'security_company' && clientData?.client_signup_number !== null) {
      if (promoTier === 'launch_client' && clientData.client_promo_jobs_remaining !== null && clientData.client_promo_jobs_remaining > 0) {
        effectiveFeePercent = 0;
        promoApplied = true;
        promoLabel = `Launch promo — ${clientData.client_promo_jobs_remaining} free jobs remaining`;
        jobsRemainingAfter = (clientData.client_promo_jobs_remaining || 0) - 1;
      } else if (promoEnds && now < promoEnds) {
        effectiveFeePercent = 0;
        promoApplied = true;
        promoLabel = promoTier === 'founding_client' ? 'Founding Client — zero fees' : 'Early Client — zero fees';
      } else if (clientData.client_lifetime_fee_discount !== null) {
        effectiveFeePercent = effectiveFeePercent * (1 - clientData.client_lifetime_fee_discount);
        promoApplied = true;
        promoLabel = `Founding Client — ${Math.round(clientData.client_lifetime_fee_discount * 100)}% off forever`;
      }
    }

    const effectiveFeeFixedPence = feeResult.feeFixed * 100;

    let totalGrossGuardPence = 0;
    let totalPlatformFeePence = 0;
    let totalGuardServiceFeePence = 0;
    let totalStripeFeePence = 0;
    let totalClientChargePence = 0;
    let totalGuardNetPence = 0;

    const assignmentUpdates: Array<{
      id: string;
      gross_guard_amount: number;
      platform_fee_amount: number;
      guard_service_fee_amount: number;
      stripe_fee_amount: number;
      client_total_amount: number;
      guard_net_payout: number;
    }> = [];

    for (const assignment of assignments) {
      const grossGuardPence = assignment.gross_guard_amount
        ? Math.round(Number(assignment.gross_guard_amount) * 100)
        : Math.round(Number(assignment.agreed_hourly_rate || jobData.hourly_rate) * Number(assignment.agreed_hours || 1) * 100);

      const guardUserId = assignment.guards?.user_id || null;
      const guardFeeResult = guardUserId
        ? await getSubscriptionAwareFee(supabaseService, guardUserId, 'guard')
        : { feePercent: 10, feeFixed: 0, isSubscribed: false, planSlug: 'guard-starter' };

      const guardServiceFeePence = Math.round(grossGuardPence * (guardFeeResult.feePercent / 100));
      const guardNetPence = grossGuardPence - guardServiceFeePence;

      const platformFeePence = Math.round(grossGuardPence * (effectiveFeePercent / 100) + effectiveFeeFixedPence);

      const subTotalBeforeStripePence = grossGuardPence + platformFeePence;
      const stripeFeePence = stripeConfig.stripeFeePayer === 'client'
        ? Math.round(subTotalBeforeStripePence * (stripeConfig.stripeFeePct / 100) + (STRIPE_FEE_FIXED * 100))
        : 0;

      const clientTotalPence = subTotalBeforeStripePence + stripeFeePence;

      totalGrossGuardPence += grossGuardPence;
      totalPlatformFeePence += platformFeePence;
      totalGuardServiceFeePence += guardServiceFeePence;
      totalStripeFeePence += stripeFeePence;
      totalClientChargePence += clientTotalPence;
      totalGuardNetPence += guardNetPence;

      assignmentUpdates.push({
        id: assignment.id,
        gross_guard_amount: grossGuardPence / 100,
        platform_fee_amount: platformFeePence / 100,
        guard_service_fee_amount: guardServiceFeePence / 100,
        stripe_fee_amount: stripeFeePence / 100,
        client_total_amount: clientTotalPence / 100,
        guard_net_payout: guardNetPence / 100,
      });
    }

    if (totalClientChargePence <= 0 || !isFinite(totalClientChargePence)) {
      return new Response(
        JSON.stringify({ error: 'Invalid payment amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const totalGrossGuardGbp = totalGrossGuardPence / 100;
    const totalPlatformFeeGbp = totalPlatformFeePence / 100;
    const totalGuardServiceFeeGbp = totalGuardServiceFeePence / 100;
    const totalStripeFeeGbp = totalStripeFeePence / 100;
    const totalClientChargeGbp = totalClientChargePence / 100;
    const totalGuardNetGbp = totalGuardNetPence / 100;

    const paymentVersion = 1;
    const idempotencyKey = `job-payment:${jobId}:${clientData.id}:v${paymentVersion}`;

    const sessionPayload: Record<string, unknown> = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `Security Job: ${jobData.job_title}`,
            description: [
              `Guard pay: £${totalGrossGuardGbp.toFixed(2)}`,
              ...(totalPlatformFeePence > 0 ? [`Platform fee (${effectiveFeePercent}%): £${totalPlatformFeeGbp.toFixed(2)}`] : []),
              ...(stripeConfig.stripeFeePayer === 'client' && totalStripeFeePence > 0 ? [`Stripe fee: £${totalStripeFeeGbp.toFixed(2)}`] : []),
            ].join(' | '),
          },
          unit_amount: totalClientChargePence,
        },
        quantity: 1,
      }],
      success_url: `${appUrl}/client/payment/success?session_id={CHECKOUT_SESSION_ID}&job_id=${jobId}`,
      cancel_url: `${appUrl}/client/jobs/${jobId}/payment`,
      client_reference_id: clientData.id,
      metadata: {
        jobId,
        clientId: clientData.id,
        paymentType: 'job_payment',
        paymentVersion: String(paymentVersion),
        guardFees: totalGrossGuardGbp.toFixed(2),
        serviceFeePct: String(effectiveFeePercent),
        platformFee: totalPlatformFeeGbp.toFixed(2),
        guardServiceFee: totalGuardServiceFeeGbp.toFixed(2),
        stripeFeeEstimate: totalStripeFeeGbp.toFixed(2),
        stripeFeePayer: stripeConfig.stripeFeePayer,
        clientTotalCharge: totalClientChargeGbp.toFixed(2),
        guardPayoutAmount: totalGuardNetGbp.toFixed(2),
        quickguardNetFee: (totalPlatformFeeGbp + totalGuardServiceFeeGbp - totalStripeFeeGbp).toFixed(2),
        promoApplied: String(promoApplied),
        promoLabel,
        jobsRemainingAfter: jobsRemainingAfter !== null ? String(jobsRemainingAfter) : '',
        total: totalClientChargeGbp.toFixed(2),
        payoutDelayDays: String(stripeConfig.payoutDelay),
        autoReleaseHours: String(stripeConfig.autoRelease),
        clientIsSubscribed: String(feeResult.isSubscribed),
      },
    };

    if (clientData.stripe_customer_id) {
      sessionPayload.customer = clientData.stripe_customer_id;
    } else {
      sessionPayload.customer_email = clientData.email;
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionPayload as any, {
        idempotencyKey,
      });
    } catch (stripeErr: any) {
      console.error('[create-job-payment] Stripe session creation failed:', stripeErr.type || 'stripe_error');
      return new Response(
        JSON.stringify({ error: 'Unable to create payment checkout' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const nowIso = new Date().toISOString();

    for (const update of assignmentUpdates) {
      const { error: ae } = await supabaseService
        .from('job_assignments')
        .update({
          gross_guard_amount: update.gross_guard_amount,
          platform_fee_amount: update.platform_fee_amount,
          guard_service_fee_amount: update.guard_service_fee_amount,
          stripe_fee_amount: update.stripe_fee_amount,
          client_total_amount: update.client_total_amount,
          guard_net_payout: update.guard_net_payout,
          currency: 'GBP',
          payment_status: 'payment_pending',
          updated_at: nowIso,
        })
        .eq('id', update.id);

      if (ae) {
        console.error('[create-job-payment] Failed to update assignment', update.id, ':', ae.message);
        try { await stripe.checkout.sessions.expire(session.id); } catch {}
        return new Response(
          JSON.stringify({ error: 'Unable to create payment checkout' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const { error: jobUpdateErr } = await supabaseService
      .from('jobs')
      .update({
        agreed_amount: totalGrossGuardGbp,
        platform_fee: totalPlatformFeeGbp,
        guard_payout_amount: totalGuardNetGbp,
        payment_status: 'payment_pending',
        currency: 'GBP',
        stripe_fee_estimate: totalStripeFeeGbp,
        stripe_fee_payer: stripeConfig.stripeFeePayer,
        client_total_charge: totalClientChargeGbp,
        quickguard_net_fee: totalPlatformFeeGbp + totalGuardServiceFeeGbp - totalStripeFeeGbp,
        updated_at: nowIso,
      })
      .eq('id', jobId);

    if (jobUpdateErr) {
      console.error('[create-job-payment] Failed to update job:', jobUpdateErr.message);
      for (const update of assignmentUpdates) {
        await supabaseService
          .from('job_assignments')
          .update({ payment_status: null, updated_at: nowIso })
          .eq('id', update.id);
      }
      try { await stripe.checkout.sessions.expire(session.id); } catch {}
      return new Response(
        JSON.stringify({ error: 'Unable to create payment checkout' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const breakdownPayload = {
      job_id: jobId,
      client_id: clientData.id,
      job_amount: totalGrossGuardGbp,
      platform_fee: totalPlatformFeeGbp,
      platform_fee_percent: effectiveFeePercent,
      stripe_fee_estimate: totalStripeFeeGbp,
      stripe_fee_percent: stripeConfig.stripeFeePct,
      stripe_fee_payer: stripeConfig.stripeFeePayer,
      guard_payout_amount: totalGuardNetGbp,
      quickguard_net_fee: totalPlatformFeeGbp + totalGuardServiceFeeGbp - totalStripeFeeGbp,
      client_total_charge: totalClientChargeGbp,
      tax_disclaimer_accepted: jobData.tax_disclaimer_accepted || false,
      currency: 'GBP',
      updated_at: nowIso,
    };

    const { data: existingFeeBreakdown } = await supabaseService
      .from('payment_fee_breakdowns')
      .select('id')
      .eq('job_id', jobId)
      .eq('client_id', clientData.id)
      .maybeSingle();

    if (existingFeeBreakdown) {
      await supabaseService.from('payment_fee_breakdowns').update(breakdownPayload).eq('id', existingFeeBreakdown.id);
    } else {
      await supabaseService.from('payment_fee_breakdowns').insert({ ...breakdownPayload, created_at: nowIso });
    }

    const breakdownResponse = {
      guardFees: totalGrossGuardGbp,
      serviceFeePct: effectiveFeePercent,
      platformFee: totalPlatformFeeGbp,
      guardServiceFee: totalGuardServiceFeeGbp,
      stripeFeeEstimate: totalStripeFeeGbp,
      stripeFeePayer: stripeConfig.stripeFeePayer,
      clientTotalCharge: totalClientChargeGbp,
      guardPayoutAmount: totalGuardNetGbp,
      quickguardNetFee: totalPlatformFeeGbp + totalGuardServiceFeeGbp - totalStripeFeeGbp,
      promoApplied,
      promoLabel,
      jobsRemainingAfter,
      total: totalClientChargeGbp,
      payoutDelay: stripeConfig.payoutDelay,
      autoRelease: stripeConfig.autoRelease,
      clientIsSubscribed: feeResult.isSubscribed,
    };

    const txMetadata = {
      guard_fees: totalGrossGuardGbp,
      service_fee_pct: effectiveFeePercent,
      platform_fee: totalPlatformFeeGbp,
      stripe_fee_estimate: totalStripeFeeGbp,
      stripe_fee_payer: stripeConfig.stripeFeePayer,
      guard_payout: totalGuardNetGbp,
      quickguard_net_fee: totalPlatformFeeGbp + totalGuardServiceFeeGbp - totalStripeFeeGbp,
      client_total_charge: totalClientChargeGbp,
      promo_applied: promoApplied,
      promo_label: promoLabel,
      jobs_remaining_after: jobsRemainingAfter,
      client_is_subscribed: feeResult.isSubscribed,
      payment_version: paymentVersion,
      breakdown: breakdownResponse,
    };

    if (existingTx) {
      await supabaseService
        .from('transactions')
        .update({
          status: 'pending',
          stripe_session_id: session.id,
          amount: totalClientChargeGbp,
          retry_count: (existingTx.retry_count || 0) + 1,
          last_retry_at: nowIso,
          updated_at: nowIso,
          failure_reason: null,
          metadata: txMetadata,
        })
        .eq('id', existingTx.id);
    } else {
      await supabaseService
        .from('transactions')
        .insert({
          job_id: jobId,
          client_id: clientData.id,
          amount: totalClientChargeGbp,
          transaction_type: 'job_payment',
          payment_method: 'stripe',
          status: 'pending',
          stripe_session_id: session.id,
          description: `Payment for job: ${jobData.job_title}`,
          metadata: txMetadata,
          created_at: nowIso,
        });
    }

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
        breakdown: breakdownResponse,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error: any) {
    console.error('[create-job-payment] Unhandled error:', error?.message || 'unknown');
    return new Response(
      JSON.stringify({ error: 'Unable to create payment checkout' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
