import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { getBookingPolicy, applyClientPromotion, bookingAmounts } from '../_shared/booking-policy.ts';
import { scheduledDays, scheduledHoursPerGuard, grossGuardPence } from '../_shared/shift-hours.ts';

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
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { jobId } = await req.json();
    if (!jobId) return new Response(JSON.stringify({ error: 'jobId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: guardProfile } = await supabaseService.from('guards').select('id').eq('user_id', user.id).maybeSingle();
    const { data: clientProfile } = await supabaseService.from('clients').select('id').eq('user_id', user.id).maybeSingle();

    const { data: job } = await supabaseService
      .from('jobs')
      .select('id, client_id, hourly_rate, start_date, end_date, start_time, end_time, number_of_guards, number_of_days, payment_status, tax_disclaimer_accepted')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const ownsJob = clientProfile?.id === job.client_id;
    if (!ownsJob) {
      if (!guardProfile) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: corsHeaders });
      const { data: ownAssignment } = await supabaseService.from('job_assignments').select('id').eq('job_id', jobId).eq('guard_id', guardProfile.id).maybeSingle();
      if (!ownAssignment) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: corsHeaders });
    }

    if (['funded', 'succeeded', 'completed', 'refunded', 'processing'].includes(job.payment_status)) {
      if (ownsJob) {
        const { data: snapshot, error: snapshotError } = await supabaseService.from('payment_fee_breakdowns')
          .select('*').eq('job_id', jobId).eq('client_id', job.client_id).maybeSingle();
        if (snapshotError || !snapshot) throw new Error('Recorded payment breakdown unavailable');
        return new Response(JSON.stringify({ jobId, guardFees: Number(snapshot.job_amount),
          platformFee: Number(snapshot.platform_fee), platformFeePercent: Number(snapshot.platform_fee_percent),
          stripeFeeEstimate: Number(snapshot.stripe_fee_estimate), stripeFeePercent: Number(snapshot.stripe_fee_percent),
          stripeFeePayer: snapshot.stripe_fee_payer, clientTotalCharge: Number(snapshot.client_total_charge),
          guardPayoutAmount: Number(snapshot.guard_payout_amount), quickguardNetFee: Number(snapshot.quickguard_net_fee),
          taxDisclaimerAccepted: snapshot.tax_disclaimer_accepted, recordedPayment: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: a, error: snapshotError } = await supabaseService.from('job_assignments')
        .select('gross_guard_amount, platform_fee_amount, guard_service_fee_amount, stripe_fee_amount, client_total_amount, guard_net_payout')
        .eq('job_id', jobId).eq('guard_id', guardProfile.id).single();
      if (snapshotError || !a) throw new Error('Recorded payment breakdown unavailable');
      return new Response(JSON.stringify({ jobId, guardFees: Number(a.gross_guard_amount),
        platformFee: Number(a.platform_fee_amount), guardServiceFee: Number(a.guard_service_fee_amount),
        stripeFeeEstimate: Number(a.stripe_fee_amount), clientTotalCharge: Number(a.client_total_amount),
        guardPayoutAmount: Number(a.guard_net_payout), recordedPayment: true,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: client, error: clientError } = await supabaseService.from('clients').select('*').eq('id', job.client_id).single();
    if (clientError || !client) throw new Error('Client billing profile unavailable');
    const policy = applyClientPromotion(await getBookingPolicy(supabaseService, client.user_id), client);
    let assignmentQuery = supabaseService.from('job_assignments')
      .select('id, guard_id, agreed_hourly_rate, agreed_hours, gross_guard_amount')
      .eq('job_id', jobId).in('status', ['selected', 'awaiting_payment']);
    if (!ownsJob) assignmentQuery = assignmentQuery.eq('guard_id', guardProfile.id);
    const { data: assignments, error: assignmentError } = await assignmentQuery;
    if (assignmentError) throw new Error('Unable to load agreed booking amounts');
    // Authoritative schedule: daily shift hours x number of days (_shared/shift-hours).
    const days = scheduledDays(job.number_of_days, job.start_date, job.end_date);
    const rows = assignments?.length ? assignments : Array.from({ length: Number(job.number_of_guards) }, () => ({
      id: null, guard_id: null, agreed_hourly_rate: job.hourly_rate, agreed_hours: scheduledHoursPerGuard(job),
      gross_guard_amount: grossGuardPence(Number(job.hourly_rate), job) / 100,
    }));
    const breakdowns = rows.map((a: any) => {
      const gross = Math.round(Number(a.gross_guard_amount || Number(a.agreed_hourly_rate || job.hourly_rate) * Number(a.agreed_hours || 1)) * 100);
      const amounts = bookingAmounts(gross, policy.feePercent, policy.feeFixedPence);
      return { assignmentId: a.id, guardId: a.guard_id, agreedHourlyRate: Number(a.agreed_hourly_rate), agreedHours: Number(a.agreed_hours),
        grossGuardAmount: amounts.grossGuardPence / 100, platformFeeAmount: amounts.platformFeePence / 100,
        guardServiceFeeAmount: 0, stripeFeeAmount: 0, clientTotalAmount: amounts.clientTotalPence / 100,
        guardNetPayout: amounts.guardNetPence / 100 };
    });
    const sum = (key: string) => breakdowns.reduce((n: number, a: any) => n + Math.round(a[key] * 100), 0) / 100;
    return new Response(JSON.stringify({ jobId, guardFees: sum('grossGuardAmount'), platformFee: sum('platformFeeAmount'),
      platformFeePercent: policy.feePercent, guardServiceFee: 0, guardServiceFeePercent: 0,
      stripeFeeEstimate: 0, stripeFeePercent: policy.stripeFeePct, stripeFeePayer: 'quickguard',
      clientTotalCharge: sum('clientTotalAmount'), guardPayoutAmount: sum('guardNetPayout'),
      quickguardNetFee: sum('platformFeeAmount'), feePolicyVersion: 'client-service-fee-v2',
      payoutDelayDays: policy.payoutDelay, autoReleaseHours: policy.autoRelease, disputeWindowHours: policy.disputeWindow,
      taxDisclaimerAccepted: job.tax_disclaimer_accepted || false, hours: scheduledHoursPerGuard(job), days,
      scheduleMismatch: rows.some((a: any) => a.id && Math.abs(Math.round(Number(a.gross_guard_amount) * 100) - grossGuardPence(Number(a.agreed_hourly_rate || job.hourly_rate), job)) > 1),
      clientIsSubscribed: policy.isSubscribed, promoApplied: policy.promoApplied, promoLabel: policy.promoLabel,
      assignments: breakdowns,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    console.error('[calculate-job-fees] ERROR:', error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});
