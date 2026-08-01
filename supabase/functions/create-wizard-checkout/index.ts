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
  appSupabase: any,
  planId: string,
  billingCycle?: 'monthly' | 'annual'
): Promise<{ priceId: string | null; error: string | null }> {
  console.log(`[getPriceId] Looking up plan: ${planId}, billing: ${billingCycle || 'monthly'}`);

  const { data: plan, error: planError } = await appSupabase
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
    console.log('[create-wizard-checkout] Request body:', JSON.stringify(body));

    const { userId, accountType, planId, userEmail, billingCycle, siteUrl: bodySiteUrl } = body;

    if (!userId || !accountType || !planId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, accountType, planId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'app' }
    });

    const { priceId, error: priceError } = await getPriceId(supabase, planId, billingCycle || 'monthly');
    if (!priceId || priceError) {
      console.error('[create-wizard-checkout] Price lookup failed:', priceError);
      return new Response(
        JSON.stringify({ error: priceError || `Plan "${planId}" not found in Stripe.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const email = userEmail;

    let customerId: string | undefined;
    if (accountType === 'client') {
      const { data: client } = await supabase
        .from('clients')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .maybeSingle();
      customerId = client?.stripe_customer_id || undefined;
    } else {
      const { data: guard } = await supabase
        .from('guards')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .maybeSingle();
      customerId = guard?.stripe_customer_id || undefined;
    }

    if (!customerId) {
      console.log('[create-wizard-checkout] Creating new Stripe customer for', userId);
      const customer = await stripe.customers.create({
        email,
        metadata: { user_id: userId, account_type: accountType, plan_id: planId },
      });
      customerId = customer.id;

      if (accountType === 'client') {
        await supabase.from('clients').update({ stripe_customer_id: customerId }).eq('user_id', userId);
      } else {
        await supabase.from('guards').update({ stripe_customer_id: customerId }).eq('user_id', userId);
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

    console.log('[create-wizard-checkout] Creating checkout session with price:', priceId, 'siteUrl:', siteUrl);
    console.log('[create-wizard-checkout] successUrl:', successUrl);
    console.log('[create-wizard-checkout] cancelUrl:', cancelUrl);

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

    console.log(`[create-wizard-checkout] Created session ${session.id} for ${accountType} plan ${planId}`);
    console.log(`[create-wizard-checkout] Checkout URL: ${session.url}`);

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('create-wizard-checkout error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
