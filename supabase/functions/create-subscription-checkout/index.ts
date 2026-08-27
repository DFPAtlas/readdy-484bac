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

const ALLOWED_SITE_URLS = [
  'https://quickguard.uk',
  'https://www.quickguard.uk',
  'http://localhost:3000',
];

function isReaddyDomain(origin: string): boolean {
  const hostname = new URL(origin).hostname;
  return hostname === 'readdy.ai' || hostname === 'www.readdy.ai' || hostname.endsWith('.readdy.ai');
}

function isVercelDomain(origin: string): boolean {
  const hostname = new URL(origin).hostname;
  return hostname.endsWith('.vercel.app');
}

function isQuickGuardDomain(origin: string): boolean {
  const hostname = new URL(origin).hostname;
  return hostname === 'quickguard.uk' || hostname === 'www.quickguard.uk' || hostname.endsWith('.quickguard.uk');
}

function getValidatedSiteUrl(rawUrl: string | undefined, fallbackOrigin: string, requestOrigin: string): string {
  if (!rawUrl) return fallbackOrigin;
  try {
    const url = new URL(rawUrl);
    const origin = url.origin;
    if (ALLOWED_SITE_URLS.includes(origin)) return origin;
    if (isQuickGuardDomain(origin)) return origin;
    if (origin === 'http://localhost:3000') return origin;
    if (isReaddyDomain(origin)) return origin + url.pathname.replace(/\/$/, '');
    if (isVercelDomain(origin)) return origin + url.pathname.replace(/\/$/, '');
    if (origin === requestOrigin) return origin;
    console.warn(`[getValidatedSiteUrl] Rejected untrusted siteUrl: ${origin}. Fallback: ${fallbackOrigin}`);
    return fallbackOrigin;
  } catch {
    console.warn(`[getValidatedSiteUrl] Invalid URL: ${rawUrl}. Fallback: ${fallbackOrigin}`);
    return fallbackOrigin;
  }
}

async function getPriceId(
  publicSupabase: any,
  planId: string,
  billingCycle?: 'monthly' | 'annual'
): Promise<{ priceId: string | null; error: string | null }> {
  console.log(`[getPriceId] Looking up plan: ${planId}, billing: ${billingCycle || 'monthly'}`);

  const { data: plan, error: planError } = await publicSupabase
    .from('plans')
    .select('name, stripe_price_id, stripe_annual_price_id, stripe_product_id')
    .eq('slug', planId)
    .maybeSingle();

  if (planError) {
    console.error('Database plan lookup error:', planError);
    return { priceId: null, error: `Database error: ${planError.message}` };
  }

  if (!plan) {
    return { priceId: null, error: `Plan "${planId}" not found.` };
  }

  console.log(`[getPriceId] Found plan: ${plan.name}, stripe_price_id: ${plan.stripe_price_id}, stripe_product_id: ${plan.stripe_product_id}`);

  const targetPriceId = billingCycle === 'annual' ? plan?.stripe_annual_price_id : plan?.stripe_price_id;

  if (targetPriceId) {
    try {
      const price = await stripe.prices.retrieve(targetPriceId);
      if (price.active && price.recurring) {
        console.log(`[getPriceId] Using price ${targetPriceId}`);
        return { priceId: targetPriceId, error: null };
      } else {
        console.warn(`Price ${targetPriceId} is inactive or not recurring.`);
      }
    } catch (e: any) {
      console.warn(`Stripe price retrieve failed for ${targetPriceId}:`, e.message);
    }
  }

  if (plan?.stripe_product_id && plan.stripe_product_id.startsWith('prod_')) {
    try {
      const prices = await stripe.prices.list({
        active: true,
        limit: 10,
        product: plan.stripe_product_id,
      });
      const recurringPrice = prices.data.find((p: any) => p.recurring);
      if (recurringPrice) {
        console.log(`[getPriceId] Fallback from product: ${recurringPrice.id}`);
        return { priceId: recurringPrice.id, error: null };
      }
    } catch (e: any) {
      console.warn(`Stripe product price list failed for ${plan.stripe_product_id}:`, e.message);
    }
  }

  const planName = PLAN_NAMES[planId] || plan?.name;
  if (!planName) return { priceId: null, error: `No plan name found for "${planId}".` };

  try {
    const products = await stripe.products.list({ active: true, limit: 100 });
    const product = products.data.find(
      (p: any) => p.name === planName || p.name === `${planName} — Monthly` || p.name === `${planName} — Annual`
    );
    if (!product) {
      return { priceId: null, error: `Stripe product "${planName}" not found. Please run the Stripe price sync from the admin dashboard.` };
    }

    const prices = await stripe.prices.list({ active: true, limit: 10, product: product.id });
    const recurringPrice = prices.data.find((p: any) => p.recurring);
    if (recurringPrice) return { priceId: recurringPrice.id, error: null };
    return { priceId: null, error: `No recurring price found for product "${planName}".` };
  } catch (e: any) {
    return { priceId: null, error: `Stripe API error: ${e.message}` };
  }
}

async function logPlanChange(
  publicSupabase: any,
  userId: string,
  oldPlanSlug: string | null,
  newPlanSlug: string,
  oldPlanName: string | null,
  newPlanName: string,
  accountType: string,
  changeSource: string,
  prorationApplied: boolean,
  stripeSubId: string | null,
) {
  await publicSupabase.from('plan_change_history').insert({
    user_id: userId,
    old_plan_slug: oldPlanSlug,
    new_plan_slug: newPlanSlug,
    old_plan_name: oldPlanName,
    new_plan_name: newPlanName,
    account_type: accountType,
    changed_by: 'user',
    change_source: changeSource,
    proration_applied: prorationApplied,
    stripe_subscription_id: stripeSubId,
  });
}

async function sendAdminAlert(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  oldPlanSlug: string | null,
  newPlanSlug: string,
  oldPlanName: string | null,
  newPlanName: string,
  accountType: string,
  changeSource: string,
  prorationApplied: boolean,
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-plan-change-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        user_id: userId,
        old_plan_slug: oldPlanSlug,
        new_plan_slug: newPlanSlug,
        old_plan_name: oldPlanName,
        new_plan_name: newPlanName,
        account_type: accountType,
        change_source: changeSource,
        proration_applied: prorationApplied,
      }),
    });
  } catch (alertErr: any) {
    console.error('[create-subscription-checkout] Failed to send admin alert:', alertErr.message);
  }
}

async function syncPlanToDb(
  publicSupabase: any,
  userId: string,
  planId: string,
  accountType: string,
  stripeSubId: string,
  status: string,
  periodEnd: string,
  planAmount: number,
  planFeatures: any,
  cancelAtPeriodEnd: boolean,
) {
  const planName = PLAN_NAMES[planId] || planId;

  await publicSupabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      plan_name: planName,
      plan_slug: planId,
      status,
      stripe_subscription_id: stripeSubId,
      account_type: accountType,
      current_period_end: periodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      plan_amount: planAmount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  const profileUpdate: any = {
    subscription_status: status,
    subscription_plan: planId,
    subscription_tier: planId,
    plan_slug: planId,
    plan_name: planName,
    updated_at: new Date().toISOString(),
  };

  if (accountType === 'guard') {
    await publicSupabase.from('guards').update(profileUpdate).eq('user_id', userId);
  } else {
    await publicSupabase.from('clients').update(profileUpdate).eq('user_id', userId);
  }

  const { data: existingEnt } = await publicSupabase.from('user_entitlements_data').select('user_id').eq('user_id', userId).maybeSingle();

  if (existingEnt) {
    await publicSupabase.from('user_entitlements_data').update({
      plan_slug: planId,
      plan_name: planName,
      subscription_status: status,
      stripe_subscription_id: stripeSubId,
      monthly_price_pence: planAmount || 0,
      features: planFeatures,
      current_period_end: periodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);
  } else {
    await publicSupabase.from('user_entitlements_data').insert({
      user_id: userId,
      plan_slug: planId,
      plan_name: planName,
      audience: accountType,
      features: planFeatures,
      monthly_price_pence: planAmount || 0,
      subscription_status: status,
      stripe_subscription_id: stripeSubId,
      current_period_end: periodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  await publicSupabase.from('notifications').insert([{
    user_id: userId,
    title: 'Plan Changed',
    message: `Your plan has been changed to ${planName}. Changes take effect immediately with prorated billing.`,
    type: 'success',
    is_read: false,
  }]);
}

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
    const body = await req.json();
    console.log('[create-subscription-checkout] Request body:', JSON.stringify(body));

    const { userId, accountType, planId, userEmail, billingCycle, siteUrl: bodySiteUrl } = body;

    if (!userId || !accountType || !planId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, accountType, planId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const publicSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'app' }
    });

    const { priceId, error: priceError } = await getPriceId(publicSupabase, planId, billingCycle || 'monthly');
    if (!priceId || priceError) {
      console.error('[create-subscription-checkout] Price lookup failed:', priceError);
      return new Response(
        JSON.stringify({ error: priceError || `Plan "${planId}" not found in Stripe.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: planData } = await publicSupabase
      .from('plans')
      .select('monthly_price_pence, features')
      .eq('slug', planId)
      .maybeSingle();

    const planAmount = planData?.monthly_price_pence || 0;
    const planFeatures = planData?.features || '[]';

    const { data: existingSub } = await publicSupabase
      .from('subscriptions')
      .select('stripe_subscription_id, status, plan_slug')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingSub?.stripe_subscription_id && (existingSub.status === 'active' || existingSub.status === 'trialing')) {
      const oldPlanSlug = existingSub.plan_slug;

      if (oldPlanSlug === planId) {
        return new Response(
          JSON.stringify({ error: `You are already subscribed to the ${PLAN_NAMES[planId] || planId} plan.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[create-subscription-checkout] Switching plan: ${oldPlanSlug} → ${planId} for user ${userId}`);

      try {
        const stripeSub = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id);
        const subItemId = stripeSub.items.data[0]?.id;

        if (!subItemId) {
          console.error('[create-subscription-checkout] No subscription item found on existing sub');
          return new Response(
            JSON.stringify({ error: 'Could not find subscription item to update.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updatedSub = await stripe.subscriptions.update(existingSub.stripe_subscription_id, {
          items: [{ id: subItemId, price: priceId }],
          proration_behavior: 'create_prorations',
          metadata: {
            plan_slug: planId,
            plan_name: PLAN_NAMES[planId] || planId,
            billing_cycle: billingCycle || 'monthly',
            account_type: accountType,
          },
        });

        console.log(`[create-subscription-checkout] Subscription updated. New status: ${updatedSub.status}`);

        const periodEnd = new Date(updatedSub.current_period_end * 1000).toISOString();

        await syncPlanToDb(
          publicSupabase,
          userId,
          planId,
          accountType,
          existingSub.stripe_subscription_id,
          updatedSub.status,
          periodEnd,
          planAmount,
          planFeatures,
          updatedSub.cancel_at_period_end || false,
        );

        const oldPlanName = PLAN_NAMES[oldPlanSlug] || oldPlanSlug;
        const newPlanName = PLAN_NAMES[planId] || planId;

        await logPlanChange(
          publicSupabase,
          userId,
          oldPlanSlug,
          planId,
          oldPlanName,
          newPlanName,
          accountType,
          'checkout',
          true,
          existingSub.stripe_subscription_id,
        );

        await sendAdminAlert(
          supabaseUrl,
          supabaseServiceKey,
          userId,
          oldPlanSlug,
          planId,
          oldPlanName,
          newPlanName,
          accountType,
          'checkout',
          true,
        );

        return new Response(
          JSON.stringify({
            switched: true,
            success: true,
            message: `Switched from ${oldPlanName} to ${newPlanName}. Prorated billing applied.`,
            planName: newPlanName,
            planSlug: planId,
            oldPlanName,
            newPlanName,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (switchErr: any) {
        console.error('[create-subscription-checkout] Plan switch failed:', switchErr.message);

        if (switchErr.message?.includes('No such subscription')) {
          console.log('[create-subscription-checkout] Stale subscription in DB, creating new checkout');
        } else {
          return new Response(
            JSON.stringify({ error: `Plan switch failed: ${switchErr.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const email = userEmail;

    let customerId: string | undefined;
    if (accountType === 'client') {
      const { data: client } = await publicSupabase
        .from('clients')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .maybeSingle();
      customerId = client?.stripe_customer_id || undefined;
    } else {
      const { data: guard } = await publicSupabase
        .from('guards')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .maybeSingle();
      customerId = guard?.stripe_customer_id || undefined;
    }

    if (!customerId) {
      console.log('[create-subscription-checkout] Creating new Stripe customer for', userId);
      const customer = await stripe.customers.create({
        email,
        metadata: { user_id: userId, account_type: accountType, plan_id: planId },
      });
      customerId = customer.id;

      if (accountType === 'client') {
        await publicSupabase.from('clients').update({ stripe_customer_id: customerId }).eq('user_id', userId);
      } else {
        await publicSupabase.from('guards').update({ stripe_customer_id: customerId }).eq('user_id', userId);
      }
    }

    const referer = req.headers.get('referer') || '';
    let refererOrigin = '';
    try {
      if (referer) refererOrigin = new URL(referer).origin;
    } catch { /* ignore */ }
    const rawSiteUrl = bodySiteUrl || refererOrigin || origin;
    const siteUrl = getValidatedSiteUrl(rawSiteUrl, 'https://quickguard.uk', origin);

    const successUrl = `${siteUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl}/pricing?cancelled=true`;

    console.log('[create-subscription-checkout] Creating checkout session with price:', priceId, 'siteUrl:', siteUrl);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        paymentType: 'subscription',
        user_id: userId,
        account_type: accountType,
        plan_id: planId,
        plan_slug: planId,
        plan_name: PLAN_NAMES[planId] || planId,
        billing_cycle: billingCycle || 'monthly',
      },
    });

    console.log(`[create-subscription-checkout] Created session ${session.id} for ${accountType} plan ${planId}`);

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('create-subscription-checkout error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});