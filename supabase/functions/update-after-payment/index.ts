
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

serve(async (req) => {
  const origin = req.headers.get('origin') || 'https://quickguard.uk';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const { userId, accountType, planId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    const { data: sessionData } = await supabase
      .from('subscriptions')
      .select('stripe_session_id, stripe_subscription_id, plan_slug, plan_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sessionData?.stripe_session_id) {
      return new Response(
        JSON.stringify({ updated: false, message: 'No subscription found for user' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionData.stripe_session_id, {
      expand: ['subscription'],
    });

    let stripeSub: Stripe.Subscription | null = null;
    if (session.subscription) {
      if (typeof session.subscription === 'string') {
        stripeSub = await stripe.subscriptions.retrieve(session.subscription);
      } else {
        stripeSub = session.subscription as Stripe.Subscription;
      }
    }

    const subStatus = stripeSub?.status || null;
    const currentPeriodStart = stripeSub?.current_period_start
      ? new Date(stripeSub.current_period_start * 1000).toISOString()
      : null;
    const currentPeriodEnd = stripeSub?.current_period_end
      ? new Date(stripeSub.current_period_end * 1000).toISOString()
      : null;
    const trialEnd = stripeSub?.trial_end
      ? new Date(stripeSub.trial_end * 1000).toISOString()
      : null;
    const customerId = (session.customer as string) || null;
    const effectivePlanId = planId || sessionData.plan_slug || null;
    const effectivePlanName = sessionData.plan_name || 'QuickGuard Plan';

    const isValidSubscription = session.mode === 'subscription' &&
      ['trialing', 'active', 'past_due'].includes(subStatus || '');

    if (!isValidSubscription) {
      return new Response(
        JSON.stringify({
          updated: false,
          message: 'Session is not a valid subscription',
          status: subStatus,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingGuard } = await supabase
      .from('guards')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    const resolvedAudience = accountType || (existingGuard ? 'guard' : existingClient ? 'client' : null);

    const updateData: any = {
      subscription_status: subStatus,
      subscription_plan: effectivePlanId,
      plan_slug: effectivePlanId,
      plan_name: effectivePlanName,
      stripe_customer_id: customerId,
      stripe_subscription_id: stripeSub?.id || null,
      stripe_session_id: sessionData.stripe_session_id,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      trial_end_date: trialEnd,
      profile_completed: true,
      updated_at: new Date().toISOString(),
    };

    if (existingGuard) {
      updateData.onboarding_status = 'active';
      const { error: guardError } = await supabase
        .from('guards')
        .update(updateData)
        .eq('user_id', userId);
      if (guardError) {
        console.error('Guard update error:', guardError);
        return new Response(
          JSON.stringify({ error: `Guard update failed: ${guardError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`[update-after-payment] Updated guard ${userId}: subscription_status=${subStatus}`);
    } else if (existingClient) {
      updateData.onboarding_status = 'active';
      const { error: clientError } = await supabase
        .from('clients')
        .update(updateData)
        .eq('user_id', userId);
      if (clientError) {
        console.error('Client update error:', clientError);
        return new Response(
          JSON.stringify({ error: `Client update failed: ${clientError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`[update-after-payment] Updated client ${userId}: subscription_status=${subStatus}`);
    } else {
      return new Response(
        JSON.stringify({ error: 'No profile found for user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: plan } = await supabase
      .from('plans')
      .select('slug, name, audience, features, monthly_price_pence')
      .eq('slug', effectivePlanId)
      .eq('active', true)
      .maybeSingle();

    let entitlementSlug: string;
    let entitlementName: string;
    let entitlementAudience: string;
    let entitlementFeatures: any;
    let entitlementPricePence: number;

    if (plan) {
      entitlementSlug = plan.slug;
      entitlementName = plan.name;
      entitlementAudience = plan.audience;
      entitlementFeatures = plan.features;
      entitlementPricePence = plan.monthly_price_pence;
    } else {
      const freeSlug = resolvedAudience === 'guard' ? 'guard_starter' : 'client_free';
      const { data: freePlan } = await supabase
        .from('plans')
        .select('slug, name, audience, features, monthly_price_pence')
        .eq('slug', freeSlug)
        .eq('active', true)
        .maybeSingle();

      if (freePlan) {
        entitlementSlug = freePlan.slug;
        entitlementName = freePlan.name;
        entitlementAudience = freePlan.audience;
        entitlementFeatures = freePlan.features;
        entitlementPricePence = freePlan.monthly_price_pence;
      } else {
        entitlementSlug = effectivePlanId || 'unknown';
        entitlementName = effectivePlanName;
        entitlementAudience = resolvedAudience || 'unknown';
        entitlementFeatures = [];
        entitlementPricePence = 0;
      }
    }

    const { error: entitlementError } = await supabase
      .from('user_entitlements_data')
      .upsert({
        user_id: userId,
        plan_slug: entitlementSlug,
        plan_name: entitlementName,
        audience: entitlementAudience,
        features: entitlementFeatures,
        monthly_price_pence: entitlementPricePence,
        subscription_status: subStatus,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: stripeSub?.cancel_at_period_end || false,
        stripe_subscription_id: stripeSub?.id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (entitlementError) {
      console.error('Entitlement sync error:', entitlementError);
    } else {
      console.log(`[update-after-payment] Synced entitlement for ${userId}: plan=${entitlementSlug}, status=${subStatus}`);
    }

    return new Response(
      JSON.stringify({
        updated: true,
        subscription_status: subStatus,
        trial_end_date: trialEnd,
        entitlement_synced: !entitlementError,
        plan_slug: entitlementSlug,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('update-after-payment error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
