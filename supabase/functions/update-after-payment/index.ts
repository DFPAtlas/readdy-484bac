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
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    const { data: subRecord } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, stripe_session_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!subRecord?.stripe_subscription_id && !subRecord?.stripe_session_id) {
      return new Response(
        JSON.stringify({ updated: false, message: 'No subscription found for user' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let stripeSub = null;

    if (subRecord.stripe_subscription_id) {
      try {
        stripeSub = await stripe.subscriptions.retrieve(subRecord.stripe_subscription_id);
      } catch (e) {
        console.warn('Stripe subscription retrieve failed:', e.message);
        stripeSub = null;
      }
    }

    if (!stripeSub && subRecord.stripe_session_id) {
      const session = await stripe.checkout.sessions.retrieve(subRecord.stripe_session_id, {
        expand: ['subscription'],
      });
      if (session.subscription) {
        stripeSub = typeof session.subscription === 'string'
          ? await stripe.subscriptions.retrieve(session.subscription)
          : session.subscription;
      }
    }

    if (!stripeSub) {
      return new Response(
        JSON.stringify({ updated: false, message: 'No Stripe subscription found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subStatus = stripeSub.status || null;
    const currentPeriodEnd = stripeSub.current_period_end
      ? new Date(stripeSub.current_period_end * 1000).toISOString()
      : null;
    const priceId = stripeSub.items?.data?.[0]?.price?.id || null;

    if (!priceId) {
      return new Response(
        JSON.stringify({ updated: false, message: 'Subscription has no price' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: mappedPlan } = await supabase
      .from('plans')
      .select('slug, name, audience, features, monthly_price_pence')
      .or(`stripe_price_id.eq.${priceId},stripe_annual_price_id.eq.${priceId}`)
      .eq('active', true)
      .maybeSingle();

    const profileUpdate = {
      subscription_status: subStatus,
      updated_at: new Date().toISOString(),
    };

    if (mappedPlan) {
      profileUpdate.plan_slug = mappedPlan.slug;
      profileUpdate.plan_name = mappedPlan.name;
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

    if (existingGuard) {
      const { error } = await supabase
        .from('guards')
        .update(profileUpdate)
        .eq('user_id', userId);
      if (error) {
        console.error('Guard update error:', error);
        return new Response(
          JSON.stringify({ error: `Guard update failed: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (existingClient) {
      const { error } = await supabase
        .from('clients')
        .update(profileUpdate)
        .eq('user_id', userId);
      if (error) {
        console.error('Client update error:', error);
        return new Response(
          JSON.stringify({ error: `Client update failed: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'No profile found for user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let entitlementSlug = null;
    let entitlementError = null;

    if (mappedPlan) {
      const entitlementResult = await supabase
        .from('user_entitlements_data')
        .upsert({
          user_id: userId,
          plan_slug: mappedPlan.slug,
          plan_name: mappedPlan.name,
          audience: mappedPlan.audience,
          features: mappedPlan.features,
          monthly_price_pence: mappedPlan.monthly_price_pence,
          subscription_status: subStatus,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: stripeSub.cancel_at_period_end || false,
          stripe_subscription_id: stripeSub.id || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      entitlementError = entitlementResult.error;
      entitlementSlug = mappedPlan.slug;

      if (entitlementError) {
        console.error('Entitlement sync error:', entitlementError);
      } else {
        console.log(`[update-after-payment] Synced entitlement for ${userId}: plan=${mappedPlan.slug}, status=${subStatus}`);
      }
    } else {
      console.warn(`[update-after-payment] No active plan maps to Stripe price ${priceId} for user ${userId}; entitlements left unchanged.`);
    }

    return new Response(
      JSON.stringify({
        updated: true,
        subscription_status: subStatus,
        entitlement_synced: mappedPlan ? !entitlementError : false,
        plan_slug: entitlementSlug,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('update-after-payment error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
