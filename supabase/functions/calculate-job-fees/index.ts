import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

  const feePercent = rules?.platform_fee_percent ? Number(rules.platform_fee_percent) : 0;
  const feeFixed = rules?.platform_fee_fixed_pence ? Number(rules.platform_fee_fixed_pence) : 0;

  return { feePercent, feeFixed, isSubscribed: false, planSlug };
}

async function getStripeFeeConfig(
  supabaseService: any,
  clientPlanSlug: string | null,
): Promise<{ stripeFeePayer: string; stripeFeePct: number; payoutDelay: number; autoRelease: number; disputeWindow: number }> {
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
  const origin = req.headers.get('origin') || 'https://quickguard.uk';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

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

    const { data: guardProfile } = await supabaseService.from('guards').select('id').eq('user_id', user.id).maybeSingle();
    const { data: clientProfile } = await supabaseService.from('clients').select('id').eq('user_id', user.id).maybeSingle();

    const { data: job } = await supabaseService
      .from('jobs')
      .select('id, client_id, hourly_rate, start_date, end_date, start_time, end_time, number_of_guards, tax_disclaimer_accepted')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (guardProfile) {
      const { data: assignment } = await supabaseService.from('job_assignments').select('id').eq('job_id', jobId).eq('guard_id', guardProfile.id).maybeSingle();
      if (!assignment && !clientProfile) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else if (clientProfile) {
      if (job.client_id !== clientProfile.id) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: assignments } = await supabaseService
      .from('job_assignments')
      .select('id, guard_id, agreed_hourly_rate, agreed_hours, gross_guard_amount, guards(user_id)')
      .eq('job_id', jobId);

    if (!assignments || assignments.length === 0) {
      const start = new Date(`1970-01-01T${job.start_time}`);
      const end = new Date(`1970-01-01T${job.end_time}`);
      let hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (hours <= 0) hours += 24;
      const days = Math.max(1, Number(job.number_of_days ?? 1));
      const totalHours = hours * days;
      const guardFees = totalHours * Number(job.hourly_rate) * Number(job.number_of_guards);

      return new Response(JSON.stringify({
        jobId,
        guardFees: Math.round(guardFees * 100) / 100,
        platformFee: 0,
        platformFeePercent: 0,
        guardServiceFee: 0,
        guardServiceFeePercent: 0,
        stripeFeeEstimate: 0,
        stripeFeePercent: 1.5,
        stripeFeePayer: 'quickguard',
        clientTotalCharge: Math.round(guardFees * 100) / 100,
        guardPayoutAmount: Math.round(guardFees * 100) / 100,
        quickguardNetFee: 0,
        payoutDelayDays: 3,
        autoReleaseHours: 72,
        disputeWindowHours: 48,
        taxDisclaimerAccepted: job.tax_disclaimer_accepted || false,
        hours: totalHours,
        days,
        assignments: [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const { data: clientUser } = await supabaseService.from('clients').select('user_id, subscription_plan').eq('id', job.client_id).maybeSingle();
    const clientUserId = clientUser?.user_id || null;

    const clientFeeResult = clientUserId
      ? await getSubscriptionAwareFee(supabaseService, clientUserId, 'client')
      : { feePercent: 0, feeFixed: 0, isSubscribed: false, planSlug: 'payg' };

    const stripeConfig = await getStripeFeeConfig(supabaseService, clientFeeResult.planSlug);

    const STRIPE_FEE_FIXED = 0.20;

    let totalGuardFees = 0;
    let totalPlatformFee = 0;
    let totalGuardServiceFee = 0;
    let totalStripeFeeEstimate = 0;
    let totalClientCharge = 0;
    let totalGuardNet = 0;
    let guardServiceFeePercent = 0;

    const assignmentBreakdowns = [];

    for (const assignment of assignments) {
      const guardUserId = assignment.guards?.user_id || null;

      const guardFeeResult = guardUserId
        ? await getSubscriptionAwareFee(supabaseService, guardUserId, 'guard')
        : { feePercent: 10, feeFixed: 0, isSubscribed: false, planSlug: 'guard-starter' };

      guardServiceFeePercent = guardFeeResult.feePercent;

      const grossGuardAmount = assignment.gross_guard_amount
        ? Number(assignment.gross_guard_amount)
        : (Number(assignment.agreed_hourly_rate || job.hourly_rate) * Number(assignment.agreed_hours || 1));

      const guardServiceFee = grossGuardAmount * (guardServiceFeePercent / 100);
      const guardNetPayout = grossGuardAmount - guardServiceFee;

      const platformFee = grossGuardAmount * (clientFeeResult.feePercent / 100) + clientFeeResult.feeFixed;
      const subTotal = grossGuardAmount + platformFee;

      const stripeFee = stripeConfig.stripeFeePayer === 'client'
        ? (subTotal * (stripeConfig.stripeFeePct / 100)) + STRIPE_FEE_FIXED
        : 0;

      const clientTotalForGuard = stripeConfig.stripeFeePayer === 'client'
        ? subTotal + stripeFee
        : subTotal;

      totalGuardFees += grossGuardAmount;
      totalPlatformFee += platformFee;
      totalGuardServiceFee += guardServiceFee;
      if (stripeConfig.stripeFeePayer === 'client') totalStripeFeeEstimate += stripeFee;
      totalClientCharge += clientTotalForGuard;
      totalGuardNet += guardNetPayout;

      assignmentBreakdowns.push({
        assignmentId: assignment.id,
        guardId: assignment.guard_id,
        agreedHourlyRate: Number(assignment.agreed_hourly_rate || job.hourly_rate),
        agreedHours: Number(assignment.agreed_hours || 1),
        grossGuardAmount: Math.round(grossGuardAmount * 100) / 100,
        platformFeeAmount: Math.round(platformFee * 100) / 100,
        guardServiceFeeAmount: Math.round(guardServiceFee * 100) / 100,
        stripeFeeAmount: Math.round(stripeFee * 100) / 100,
        clientTotalAmount: Math.round(clientTotalForGuard * 100) / 100,
        guardNetPayout: Math.round(guardNetPayout * 100) / 100,
      });
    }

    const quickguardNetFee = totalPlatformFee + totalGuardServiceFee - totalStripeFeeEstimate;

    return new Response(JSON.stringify({
      jobId,
      guardFees: Math.round(totalGuardFees * 100) / 100,
      platformFee: Math.round(totalPlatformFee * 100) / 100,
      platformFeePercent: clientFeeResult.feePercent,
      guardServiceFee: Math.round(totalGuardServiceFee * 100) / 100,
      guardServiceFeePercent,
      stripeFeeEstimate: Math.round(totalStripeFeeEstimate * 100) / 100,
      stripeFeePercent: stripeConfig.stripeFeePct,
      stripeFeePayer: stripeConfig.stripeFeePayer,
      clientTotalCharge: Math.round(totalClientCharge * 100) / 100,
      guardPayoutAmount: Math.round(totalGuardNet * 100) / 100,
      quickguardNetFee: Math.round(quickguardNetFee * 100) / 100,
      payoutDelayDays: stripeConfig.payoutDelay,
      autoReleaseHours: stripeConfig.autoRelease,
      disputeWindowHours: stripeConfig.disputeWindow,
      taxDisclaimerAccepted: job.tax_disclaimer_accepted || false,
      hours: assignments.reduce((s, a) => s + Number(a.agreed_hours || 0), 0),
      days: 1,
      clientIsSubscribed: clientFeeResult.isSubscribed,
      assignments: assignmentBreakdowns,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    console.error('[calculate-job-fees] ERROR:', error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});
