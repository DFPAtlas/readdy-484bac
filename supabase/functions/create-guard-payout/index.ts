
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

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminUser || !adminUser.is_active) {
      return new Response(
        JSON.stringify({ error: 'Active admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { guardId, amount, guardEmail, jobTitle, stripeAccountId, assignmentId, jobId } = await req.json();

    if (!guardId || !amount) {
      return new Response(
        JSON.stringify({ error: 'guardId and amount required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (jobId) {
      const { data: transaction } = await supabase
        .from('transactions')
        .select('status')
        .eq('job_id', jobId)
        .eq('status', 'completed')
        .maybeSingle();

      if (!transaction) {
        return new Response(
          JSON.stringify({ error: 'Client payment has not been completed for this job', code: 'PAYMENT_NOT_COMPLETED' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: job } = await supabase
        .from('jobs')
        .select('completion_status')
        .eq('id', jobId)
        .maybeSingle();

      if (!job || (job.completion_status !== 'confirmed_by_client' && job.completion_status !== 'completed')) {
        return new Response(
          JSON.stringify({ error: 'Job completion has not been confirmed by the client', code: 'COMPLETION_NOT_CONFIRMED' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const amountInCents = Math.round(amount * 100);

    const { data: guard } = await supabase
      .from('guards')
      .select('promo_tier, promo_ends_at, lifetime_fee_percentage')
      .eq('id', guardId)
      .maybeSingle();

    const { data: feeConfig } = await supabase
      .from('promo_config')
      .select('standard_fee')
      .eq('id', 1)
      .maybeSingle();

    const now = new Date();
    let feePercentage = feeConfig?.standard_fee || 10.00;

    if (guard) {
      const promoEnd = guard.promo_ends_at ? new Date(guard.promo_ends_at) : null;
      if (promoEnd && now < promoEnd) {
        feePercentage = 0;
      } else if (guard.lifetime_fee_percentage != null) {
        feePercentage = guard.lifetime_fee_percentage;
      }
    }

    const feeAmount = (amount * feePercentage) / 100;
    const netAmount = amount - feeAmount;
    const netAmountInCents = Math.round(netAmount * 100);

    await supabase.from('guard_payouts').insert({
      guard_id: guardId,
      assignment_id: assignmentId || null,
      job_id: jobId || null,
      amount: amount,
      fee_deducted: feeAmount,
      net_amount: netAmount,
      status: 'pending',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }).catch(() => {});

    if (stripeAccountId) {
      const transfer = await stripe.transfers.create({
        amount: netAmountInCents,
        currency: 'gbp',
        destination: stripeAccountId,
        description: `Payment for job: ${jobTitle}`,
        metadata: {
          guardId: guardId,
          jobId: jobId || '',
          assignmentId: assignmentId || '',
          jobTitle: jobTitle || '',
          grossAmount: amount,
          feePercentage: feePercentage,
          feeDeducted: feeAmount,
          netAmount: netAmount,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          transferId: transfer.id,
          feePercentage,
          feeAmount: feeAmount.toFixed(2),
          netAmount: netAmount.toFixed(2),
          message: 'Payment transferred to guard account',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } else {
      const payout = await stripe.payouts.create({
        amount: netAmountInCents,
        currency: 'gbp',
        description: `Payment for job: ${jobTitle}`,
        metadata: {
          guardId: guardId,
          jobId: jobId || '',
          assignmentId: assignmentId || '',
          guardEmail: guardEmail || '',
          jobTitle: jobTitle || '',
          grossAmount: amount,
          feePercentage: feePercentage,
          feeDeducted: feeAmount,
          netAmount: netAmount,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          payoutId: payout.id,
          feePercentage,
          feeAmount: feeAmount.toFixed(2),
          netAmount: netAmount.toFixed(2),
          message: 'Payout initiated successfully',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
  } catch (error: any) {
    console.error('[CreateGuardPayout] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
