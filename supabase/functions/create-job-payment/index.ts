import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const STRIPE_FEE_PERCENT = 1.5;
const STRIPE_FEE_FIXED = 0.20;

async function getSubscriptionAwareFee(
  supabaseService: any,
  userId: string,
  role: 'client' | 'guard',
): Promise<{ feePercent: number; feeFixed: number; isSubscribed: boolean; planSlug: string | null }> {
  const { data: sub } = await supabaseService
    .from('subscriptions')
    .select('plan_slug, status')
    .eq('user_id', userId)
    .eq('account_type', role)
    .in('status', ['active', 'trialing'])
    .maybeSingle();
  if (sub) {
    return { feePercent: 0, feeFixed: 0, isSubscribed: true, planSlug: sub.plan_slug };
  }
  const table = role === 'client' ? 'clients' : 'guards';
  const { data: profile } = await supabaseService.from(table).select('subscription_plan').eq('user_id', userId).maybeSingle();
  const planSlug = profile?.subscription_plan || (role === 'client' ? 'payg' : 'guard-starter');
  const { data: rules } = await supabaseService.from('plan_fee_rules').select('platform_fee_percent, platform_fee_fixed_pence').eq('plan_slug', planSlug).maybeSingle();
  return {
    feePercent: rules?.platform_fee_percent ? Number(rules.platform_fee_percent) : 0,
    feeFixed: rules?.platform_fee_fixed_pence ? Number(rules.platform_fee_fixed_pence) : 0,
    isSubscribed: false,
    planSlug,
  };
}

async function getStripeFeeConfig(supabaseService: any, clientPlanSlug: string | null) {
  const slug = clientPlanSlug || 'payg';
  const { data: rules } = await supabaseService.from('plan_fee_rules').select('stripe_fee_payer, stripe_fee_estimate_percent, payout_delay_days, auto_release_hours, dispute_window_hours').eq('plan_slug', slug).maybeSingle();
  return {
    stripeFeePayer: rules?.stripe_fee_payer || 'quickguard',
    stripeFeePct: rules?.stripe_fee_estimate_percent ? Number(rules.stripe_fee_estimate_percent) : STRIPE_FEE_PERCENT,
    payoutDelay: rules?.payout_delay_days ? Number(rules.payout_delay_days) : 3,
    autoRelease: rules?.auto_release_hours ? Number(rules.auto_release_hours) : 72,
    disputeWindow: rules?.dispute_window_hours ? Number(rules.dispute_window_hours) : 48,
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin') || 'https://quickguard.uk';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const supabaseService = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { jobId } = await req.json();
    if (!jobId) return new Response(JSON.stringify({ error: 'jobId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: clientData } = await supabaseService.from('clients').select('id, email, stripe_customer_id, client_service_tier, client_type, client_promo_tier, client_promo_ends_at, client_lifetime_fee_discount, client_promo_jobs_remaining, client_signup_number, subscription_plan').eq('user_id', user.id).maybeSingle();
    if (!clientData) return new Response(JSON.stringify({ error: 'Client account not found' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: jobData } = await supabaseService.from('jobs').select('id, job_title, client_id, status, hourly_rate, start_date, end_date, start_time, end_time, number_of_guards, number_of_days, tax_disclaimer_accepted').eq('id', jobId).maybeSingle();
    if (!jobData) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (jobData.client_id !== clientData.id) return new Response(JSON.stringify({ error: 'You do not own this job' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: existingCompleted } = await supabaseService.from('transactions').select('id').eq('job_id', jobId).eq('client_id', clientData.id).eq('status', 'completed').maybeSingle();
    if (existingCompleted) return new Response(JSON.stringify({ error: 'Payment already completed for this job' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: assignments } = await supabaseService.from('job_assignments').select('id, guard_id, agreed_hourly_rate, agreed_hours, gross_guard_amount, guards(user_id, full_name, hourly_rate)').eq('job_id', jobId);

    if (!assignments || assignments.length === 0) {
      return new Response(JSON.stringify({ error: 'No guards assigned to this job. Please select guards first.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const clientFeeResult = await getSubscriptionAwareFee(supabaseService, user.id, 'client');
    const stripeConfig = await getStripeFeeConfig(supabaseService, clientFeeResult.planSlug);

    let totalGuardFees = 0;
    let totalPlatformFee = 0;
    let totalGuardServiceFee = 0;
    let totalStripeFeeEstimate = 0;
    let totalClientCharge = 0;
    let totalGuardNet = 0;

    for (const assignment of assignments) {
      const guardUserId = assignment.guards?.user_id || null;
      const guardFeeResult = guardUserId ? await getSubscriptionAwareFee(supabaseService, guardUserId, 'guard') : { feePercent: 10, feeFixed: 0, isSubscribed: false, planSlug: 'guard-starter' };

      const grossGuardAmount = assignment.gross_guard_amount ? Number(assignment.gross_guard_amount) : (Number(assignment.agreed_hourly_rate || jobData.hourly_rate) * Number(assignment.agreed_hours || 1));
      const guardServiceFee = grossGuardAmount * (guardFeeResult.feePercent / 100);
      const guardNetPayout = grossGuardAmount - guardServiceFee;
      const platformFee = grossGuardAmount * (clientFeeResult.feePercent / 100) + clientFeeResult.feeFixed;
      const subTotal = grossGuardAmount + platformFee;
      const stripeFee = stripeConfig.stripeFeePayer === 'client' ? (subTotal * (stripeConfig.stripeFeePct / 100)) + STRIPE_FEE_FIXED : 0;
      const clientTotalForGuard = stripeConfig.stripeFeePayer === 'client' ? subTotal + stripeFee : subTotal;

      totalGuardFees += grossGuardAmount;
      totalPlatformFee += platformFee;
      totalGuardServiceFee += guardServiceFee;
      if (stripeConfig.stripeFeePayer === 'client') totalStripeFeeEstimate += stripeFee;
      totalClientCharge += clientTotalForGuard;
      totalGuardNet += guardNetPayout;

      await supabaseService.from('job_assignments').update({
        gross_guard_amount: Math.round(grossGuardAmount * 100) / 100,
        platform_fee_amount: Math.round(platformFee * 100) / 100,
        guard_service_fee_amount: Math.round(guardServiceFee * 100) / 100,
        stripe_fee_amount: Math.round(stripeFee * 100) / 100,
        client_total_amount: Math.round(clientTotalForGuard * 100) / 100,
        guard_net_payout: Math.round(guardNetPayout * 100) / 100,
        currency: 'GBP',
        payment_status: 'payment_pending',
        updated_at: new Date().toISOString(),
      }).eq('id', assignment.id);
    }

    let feePct = clientFeeResult.feePercent;
    let promoApplied = false;
    let promoLabel = '';
    let jobsRemainingAfter: number | null = null;
    const now = new Date();
    const promoEnds = clientData?.client_promo_ends_at ? new Date(clientData.client_promo_ends_at) : null;
    const promoTier = clientData?.client_promo_tier || 'standard';

    if (!clientFeeResult.isSubscribed && clientData?.client_type !== 'security_company' && clientData?.client_signup_number !== null) {
      if (promoTier === 'launch_client' && clientData.client_promo_jobs_remaining !== null && clientData.client_promo_jobs_remaining > 0) {
        feePct = 0;
        promoApplied = true;
        promoLabel = `Launch promo — ${clientData.client_promo_jobs_remaining} free jobs remaining`;
        jobsRemainingAfter = (clientData.client_promo_jobs_remaining || 0) - 1;
      } else if (promoEnds && now < promoEnds) {
        feePct = 0;
        promoApplied = true;
        promoLabel = promoTier === 'founding_client' ? 'Founding Client — zero fees' : 'Early Client — zero fees';
      } else if (clientData.client_lifetime_fee_discount !== null) {
        feePct = feePct * (1 - clientData.client_lifetime_fee_discount);
        promoApplied = true;
        promoLabel = `Founding Client — ${Math.round(clientData.client_lifetime_fee_discount * 100)}% off forever`;
      }
    }

    if (promoApplied && feePct === 0) {
      totalPlatformFee = 0;
      totalClientCharge = totalGuardFees + (stripeConfig.stripeFeePayer === 'client' ? totalStripeFeeEstimate : 0);
    }

    const finalAmountInCents = Math.round(totalClientCharge * 100);

    const sessionPayload: any = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `Security Job: ${jobData.job_title}`,
            description: `Guard pay: £${totalGuardFees.toFixed(2)}${totalPlatformFee > 0 ? ` | Platform fee (${feePct}%): £${totalPlatformFee.toFixed(2)}` : ''}${stripeConfig.stripeFeePayer === 'client' && totalStripeFeeEstimate > 0 ? ` | Stripe fee: £${totalStripeFeeEstimate.toFixed(2)}` : ''}`,
          },
          unit_amount: finalAmountInCents,
        },
        quantity: 1,
      }],
      success_url: `${req.headers.get('origin')}/client/payment/success?session_id={CHECKOUT_SESSION_ID}&job_id=${jobId}`,
      cancel_url: `${req.headers.get('origin')}/client/jobs/${jobId}/payment`,
      client_reference_id: clientData.id,
      metadata: {
        jobId,
        clientId: clientData.id,
        paymentType: 'job_payment',
        guardFees: totalGuardFees.toFixed(2),
        serviceFeePct: String(feePct),
        platformFee: totalPlatformFee.toFixed(2),
        guardServiceFee: totalGuardServiceFee.toFixed(2),
        stripeFeeEstimate: totalStripeFeeEstimate.toFixed(2),
        stripeFeePayer: stripeConfig.stripeFeePayer,
        clientTotalCharge: totalClientCharge.toFixed(2),
        guardPayoutAmount: totalGuardNet.toFixed(2),
        quickguardNetFee: (totalPlatformFee + totalGuardServiceFee - totalStripeFeeEstimate).toFixed(2),
        promoApplied: String(promoApplied),
        promoLabel,
        jobsRemainingAfter: jobsRemainingAfter !== null ? String(jobsRemainingAfter) : '',
        total: totalClientCharge.toFixed(2),
        payoutDelayDays: String(stripeConfig.payoutDelay),
        autoReleaseHours: String(stripeConfig.autoRelease),
        clientIsSubscribed: String(clientFeeResult.isSubscribed),
      },
    };

    if (clientData.stripe_customer_id) sessionPayload.customer = clientData.stripe_customer_id;
    else sessionPayload.customer_email = clientData.email;

    const session = await stripe.checkout.sessions.create(sessionPayload);

    const now2 = new Date().toISOString();
    await supabaseService.from('jobs').update({
      agreed_amount: totalGuardFees,
      platform_fee: totalPlatformFee,
      guard_payout_amount: totalGuardNet,
      payment_status: 'payment_pending',
      currency: 'GBP',
      stripe_fee_estimate: totalStripeFeeEstimate,
      stripe_fee_payer: stripeConfig.stripeFeePayer,
      client_total_charge: totalClientCharge,
      quickguard_net_fee: totalPlatformFee + totalGuardServiceFee - totalStripeFeeEstimate,
      updated_at: now2,
    }).eq('id', jobId);

    const { data: existingFeeBreakdown } = await supabaseService.from('payment_fee_breakdowns').select('id').eq('job_id', jobId).eq('client_id', clientData.id).maybeSingle();
    const feePayload = {
      job_id: jobId, client_id: clientData.id, job_amount: totalGuardFees, platform_fee: totalPlatformFee,
      platform_fee_percent: feePct, stripe_fee_estimate: totalStripeFeeEstimate, stripe_fee_percent: stripeConfig.stripeFeePct,
      stripe_fee_payer: stripeConfig.stripeFeePayer, guard_payout_amount: totalGuardNet,
      quickguard_net_fee: totalPlatformFee + totalGuardServiceFee - totalStripeFeeEstimate,
      client_total_charge: totalClientCharge, tax_disclaimer_accepted: jobData.tax_disclaimer_accepted || false,
      currency: 'GBP', updated_at: now2,
    };
    if (existingFeeBreakdown) {
      await supabaseService.from('payment_fee_breakdowns').update(feePayload).eq('id', existingFeeBreakdown.id);
    } else {
      await supabaseService.from('payment_fee_breakdowns').insert({ ...feePayload, created_at: now2 });
    }

    const { data: existingTransaction } = await supabaseService.from('transactions').select('id, retry_count').eq('job_id', jobId).eq('client_id', clientData.id).in('status', ['pending', 'failed']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (existingTransaction) {
      await supabaseService.from('transactions').update({
        status: 'pending', stripe_session_id: session.id, retry_count: (existingTransaction.retry_count || 0) + 1,
        last_retry_at: now2, updated_at: now2, failure_reason: null,
      }).eq('id', existingTransaction.id);
    } else {
      await supabaseService.from('transactions').insert({
        job_id: jobId, client_id: clientData.id, amount: totalClientCharge, transaction_type: 'job_payment',
        payment_method: 'stripe', status: 'pending', stripe_session_id: session.id,
        description: `Payment for job: ${jobData.job_title}`,
        metadata: {
          guard_fees: totalGuardFees, service_fee_pct: feePct, platform_fee: totalPlatformFee,
          stripe_fee_estimate: totalStripeFeeEstimate, stripe_fee_payer: stripeConfig.stripeFeePayer,
          guard_payout: totalGuardNet, quickguard_net_fee: totalPlatformFee + totalGuardServiceFee - totalStripeFeeEstimate,
          client_total_charge: totalClientCharge, promo_applied: promoApplied, promo_label: promoLabel,
          jobs_remaining_after: jobsRemainingAfter, client_is_subscribed: clientFeeResult.isSubscribed,
        },
      });
    }

    return new Response(JSON.stringify({
      sessionId: session.id,
      url: session.url,
      breakdown: {
        guardFees: totalGuardFees,
        serviceFeePct: feePct,
        platformFee: totalPlatformFee,
        guardServiceFee: totalGuardServiceFee,
        stripeFeeEstimate: totalStripeFeeEstimate,
        stripeFeePayer: stripeConfig.stripeFeePayer,
        clientTotalCharge: totalClientCharge,
        guardPayoutAmount: totalGuardNet,
        quickguardNetFee: totalPlatformFee + totalGuardServiceFee - totalStripeFeeEstimate,
        promoApplied,
        promoLabel,
        jobsRemainingAfter,
        total: totalClientCharge,
        payoutDelay: stripeConfig.payoutDelay,
        autoRelease: stripeConfig.autoRelease,
        clientIsSubscribed: clientFeeResult.isSubscribed,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    console.error('[create-job-payment] ERROR:', error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});