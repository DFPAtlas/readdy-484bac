import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const PLAN_NAMES: Record<string, string> = {
  'client-starter': 'Client Starter',
  'client-pro': 'Client Pro',
  'client-enterprise': 'Client Enterprise',
  'guard-basic': 'Guard Basic',
  'guard-pro': 'Guard Pro',
  'guard-elite': 'Guard Elite',
};

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
    const { sessionId } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[check-stripe-session] Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'app' }
    });

    console.log(`[check-stripe-session] Retrieving session ${sessionId}`);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    const metadata = session.metadata || {};
    const userId = session.client_reference_id || metadata.user_id || metadata.userId || null;
    const accountType = metadata.account_type || metadata.accountType || null;
    const planId = metadata.plan_id || metadata.planId || metadata.planSlug || metadata.plan_slug || null;
    const planName = metadata.planName || metadata.plan_name || PLAN_NAMES[planId || ''] || planId || 'Unknown';
    const billingCycle = metadata.billing_cycle || 'monthly';

    if (!userId || !accountType || !planId) {
      console.error('[check-stripe-session] Missing metadata. sessionId:', sessionId, 'metadata:', metadata);
      return new Response(
        JSON.stringify({ error: 'Missing metadata in session', meta: metadata }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let stripeSub: Stripe.Subscription | null = null;
    let stripePriceId: string | null = null;

    if (session.subscription) {
      if (typeof session.subscription === 'string') {
        console.log(`[check-stripe-session] Subscription is string ID, retrieving: ${session.subscription}`);
        stripeSub = await stripe.subscriptions.retrieve(session.subscription);
      } else {
        stripeSub = session.subscription as Stripe.Subscription;
      }
    }

    if (stripeSub) {
      const subItems = stripeSub.items?.data;
      if (subItems && subItems.length > 0) {
        stripePriceId = subItems[0].price?.id || null;
      }
    }

    if (!stripePriceId && session.line_items) {
      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
        if (lineItems.data.length > 0) {
          stripePriceId = lineItems.data[0].price?.id || null;
        }
      } catch (e: any) {
        console.warn('[check-stripe-session] Could not fetch line items:', e.message);
      }
    }

    console.log(`[check-stripe-session] stripePriceId: ${stripePriceId}, billingCycle: ${billingCycle}`);

    const paymentStatus = session.payment_status;
    const subStatus = stripeSub?.status || null;
    const trialStart = stripeSub?.trial_start
      ? new Date(stripeSub.trial_start * 1000).toISOString()
      : null;
    const trialEnd = stripeSub?.trial_end
      ? new Date(stripeSub.trial_end * 1000).toISOString()
      : null;
    const currentPeriodStart = stripeSub?.current_period_start
      ? new Date(stripeSub.current_period_start * 1000).toISOString()
      : null;
    const currentPeriodEnd = stripeSub?.current_period_end
      ? new Date(stripeSub.current_period_end * 1000).toISOString()
      : null;

    const isValidSubscription = session.mode === 'subscription' &&
      ['trialing', 'active', 'past_due'].includes(subStatus || '');

    let profileUpdated = false;
    let guardVerificationStatus: string | null = null;
    let subscriptionUpdated = false;
    let entitlementSynced = false;
    let dbErrors: string[] = [];

    if (isValidSubscription) {
      const subPayload: any = {
        user_id: userId,
        plan_name: planName,
        plan_slug: planId,
        status: subStatus,
        stripe_subscription_id: stripeSub?.id || null,
        stripe_customer_id: (session.customer as string) || null,
        stripe_session_id: sessionId,
        stripe_price_id: stripePriceId,
        billing_cycle: billingCycle,
        account_type: accountType,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        trial_start: trialStart,
        trial_end: trialEnd,
        trial_start_date: trialStart,
        trial_end_date: trialEnd,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertSubError } = await supabase
        .from('subscriptions')
        .upsert(subPayload, { onConflict: 'user_id' });

      if (upsertSubError) {
        console.error('[check-stripe-session] Subscription upsert error:', upsertSubError);
        dbErrors.push(`sub upsert: ${upsertSubError.message}`);
      } else {
        subscriptionUpdated = true;
        console.log(`[check-stripe-session] Upserted subscription record for user ${userId}`);
      }

      const profileUpdate: any = {
        subscription_status: subStatus,
        subscription_plan: planId,
        subscription_tier: planId,
        plan_slug: planId,
        plan_name: planName,
        stripe_customer_id: (session.customer as string) || null,
        stripe_subscription_id: stripeSub?.id || null,
        stripe_session_id: sessionId,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      };

      if (accountType === 'guard') {
        profileUpdate.profile_completed = true;
        profileUpdate.onboarding_status = 'active';
        if (trialStart) profileUpdate.trial_start_date = trialStart;
        if (trialEnd) profileUpdate.trial_end_date = trialEnd;

        const { data: guardData, error: guardSelectError } = await supabase
          .from('guards')
          .select('verification_status')
          .eq('user_id', userId)
          .maybeSingle();

        if (guardSelectError) {
          console.error('[check-stripe-session] Guard select error:', guardSelectError);
          dbErrors.push(`guard select: ${guardSelectError.message}`);
        }

        guardVerificationStatus = guardData?.verification_status || null;

        const { error: guardUpdateError } = await supabase
          .from('guards')
          .update(profileUpdate)
          .eq('user_id', userId);

        if (guardUpdateError) {
          console.error('[check-stripe-session] Guard update error:', guardUpdateError);
          dbErrors.push(`guard update: ${guardUpdateError.message}`);
        } else {
          profileUpdated = true;
          console.log(`[check-stripe-session] Guard ${userId} updated successfully`);
        }
      } else {
        profileUpdate.profile_completed = true;
        profileUpdate.onboarding_status = 'active';
        const { error: clientUpdateError } = await supabase
          .from('clients')
          .update(profileUpdate)
          .eq('user_id', userId);
        if (clientUpdateError) {
          console.error('[check-stripe-session] Client update error:', clientUpdateError);
          dbErrors.push(`client update: ${clientUpdateError.message}`);
        } else {
          profileUpdated = true;
          console.log(`[check-stripe-session] Client ${userId} updated successfully`);
        }
      }

      const { data: planData } = await supabase
        .from('plans')
        .select('slug, name, audience, features, monthly_price_pence')
        .eq('slug', planId)
        .eq('active', true)
        .maybeSingle();

      const isActiveStatus = ['trialing', 'active', 'past_due'].includes(subStatus || '');
      const entitlementPayload: any = {
        plan_slug: planId,
        plan_name: planName,
        subscription_status: subStatus,
        is_active: isActiveStatus,
        is_free_tier: false,
        stripe_subscription_id: stripeSub?.id || null,
        monthly_price_pence: planData?.monthly_price_pence || 0,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: stripeSub?.cancel_at_period_end || false,
        updated_at: new Date().toISOString(),
      };

      if (planData) {
        entitlementPayload.audience = planData.audience;
        entitlementPayload.features = planData.features;
      } else {
        console.warn(`[check-stripe-session] Plan "${planId}" not found in app.plans. Trying public.plans as fallback.`);
        const { data: publicPlan } = await createClient(supabaseUrl, supabaseServiceKey)
          .from('plans')
          .select('slug, name, audience, features, monthly_price_pence')
          .eq('slug', planId)
          .eq('active', true)
          .maybeSingle();
        if (publicPlan) {
          entitlementPayload.audience = publicPlan.audience;
          entitlementPayload.features = publicPlan.features;
          console.log(`[check-stripe-session] Found plan in public.plans: ${publicPlan.name}`);
        } else {
          console.warn(`[check-stripe-session] Plan "${planId}" not found in either schema. Entitlement features will be empty!`);
        }
      }

      const { data: existingEnt } = await supabase
        .from('user_entitlements_data')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingEnt) {
        const { error: entUpdateErr } = await supabase
          .from('user_entitlements_data')
          .update(entitlementPayload)
          .eq('user_id', userId);
        if (entUpdateErr) {
          console.error('[check-stripe-session] Entitlement update error:', entUpdateErr);
          dbErrors.push(`entitlement update: ${entUpdateErr.message}`);
        } else {
          entitlementSynced = true;
          console.log(`[check-stripe-session] Updated entitlements for user ${userId}`);
        }
      } else {
        const { error: entInsertErr } = await supabase
          .from('user_entitlements_data')
          .insert({
            user_id: userId,
            ...entitlementPayload,
            created_at: new Date().toISOString(),
          });
        if (entInsertErr) {
          console.error('[check-stripe-session] Entitlement insert error:', entInsertErr);
          dbErrors.push(`entitlement insert: ${entInsertErr.message}`);
        } else {
          entitlementSynced = true;
          console.log(`[check-stripe-session] Inserted entitlements for user ${userId}`);
        }
      }

      if (profileUpdated || subscriptionUpdated) {
        const { error: notifError } = await supabase.from('notifications').insert([{
          user_id: userId,
          title: 'Subscription Activated',
          message: `Your ${planName} subscription is now active. Welcome aboard!`,
          type: 'success',
          is_read: false,
        }]);
        if (notifError) {
          console.error('[check-stripe-session] Notification insert error:', notifError);
        }
      }
    } else {
      console.warn(`[check-stripe-session] Session not valid for activation. mode: ${session.mode}, subStatus: ${subStatus}`);
    }

    return new Response(
      JSON.stringify({
        success: isValidSubscription,
        payment_status: paymentStatus,
        user_id: userId,
        account_type: accountType,
        plan_id: planId,
        plan_name: planName,
        billing_cycle: billingCycle,
        stripe_price_id: stripePriceId,
        customer: session.customer,
        subscription: stripeSub ? {
          id: stripeSub.id,
          status: stripeSub.status,
          trial_start: stripeSub.trial_start,
          trial_end: stripeSub.trial_end,
          current_period_start: stripeSub.current_period_start,
          current_period_end: stripeSub.current_period_end,
        } : null,
        subscription_status: subStatus,
        trial_start: trialStart,
        trial_end: trialEnd,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        guard_verification_status: guardVerificationStatus,
        profile_updated: profileUpdated,
        subscription_updated: subscriptionUpdated,
        entitlement_synced: entitlementSynced,
        activated: isValidSubscription,
        db_errors: dbErrors.length > 0 ? dbErrors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[check-stripe-session] ERROR:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
