import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno';

const ALLOWED_ORIGINS = [
  'https://quickguard.uk',
  'https://www.quickguard.uk',
  'http://localhost:3000',
  'http://localhost:3001',
];

function getCorsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing env vars' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  const appSupabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  try {
    const { data: plans } = await appSupabase
      .from('plans')
      .select('*')
      .eq('active', true)
      .order('monthly_price_pence', { ascending: true });

    const created: any[] = [];
    const existing: any[] = [];
    const errors: any[] = [];

    for (const plan of plans || []) {
      if (plan.monthly_price_pence === 0) continue;

      const monthlyPence = plan.monthly_price_pence;
      const annualPence = plan.monthly_price_pence * 10;
      const name = plan.name;
      const slug = plan.slug;

      const metadata = {
        plan_slug: slug,
        source: 'quickguard_auto',
      };

      let monthlyPriceId = plan.stripe_price_id;
      let annualPriceId = plan.stripe_annual_price_id;
      let productId = plan.stripe_product_id;

      if (monthlyPriceId && monthlyPriceId.startsWith('price_')) {
        try {
          const existingPrice = await stripe.prices.retrieve(monthlyPriceId);
          if (!existingPrice.active) {
            monthlyPriceId = null;
          }
        } catch {
          monthlyPriceId = null;
        }
      }

      if (annualPriceId && annualPriceId.startsWith('price_')) {
        try {
          const existingPrice = await stripe.prices.retrieve(annualPriceId);
          if (!existingPrice.active) {
            annualPriceId = null;
          }
        } catch {
          annualPriceId = null;
        }
      }

      if (productId && productId.startsWith('prod_')) {
        try {
          const existingProduct = await stripe.products.retrieve(productId);
          if (!existingProduct.active) {
            productId = null;
          }
        } catch {
          productId = null;
        }
      }

      if (!productId) {
        try {
          const product = await stripe.products.create({
            name: name,
            description: plan.description || `${name} plan`,
            metadata,
          });
          productId = product.id;
          created.push({ slug, type: 'product', id: productId });
        } catch (e: any) {
          errors.push({ slug, type: 'product', error: e.message });
          continue;
        }
      }

      if (!monthlyPriceId || !monthlyPriceId.startsWith('price_')) {
        try {
          const monthlyPrice = await stripe.prices.create({
            unit_amount: monthlyPence,
            currency: 'gbp',
            recurring: { interval: 'month' },
            product: productId,
            metadata,
          });
          monthlyPriceId = monthlyPrice.id;
          created.push({ slug, type: 'monthly', id: monthlyPriceId });
        } catch (e: any) {
          errors.push({ slug, type: 'monthly', error: e.message });
          continue;
        }
      } else {
        existing.push({ slug, type: 'monthly', id: monthlyPriceId });
      }

      if (!annualPriceId || !annualPriceId.startsWith('price_')) {
        try {
          const annualPrice = await stripe.prices.create({
            unit_amount: annualPence,
            currency: 'gbp',
            recurring: { interval: 'year' },
            product: productId,
            metadata,
          });
          annualPriceId = annualPrice.id;
          created.push({ slug, type: 'annual', id: annualPriceId });
        } catch (e: any) {
          errors.push({ slug, type: 'annual', error: e.message });
          continue;
        }
      } else {
        existing.push({ slug, type: 'annual', id: annualPriceId });
      }

      const updatePayload = {
        stripe_price_id: monthlyPriceId,
        stripe_annual_price_id: annualPriceId,
        stripe_product_id: productId,
      };

      await appSupabase
        .from('plans')
        .update(updatePayload)
        .eq('slug', slug);
    }

    return new Response(
      JSON.stringify({ created, existing, errors, message: 'Stripe prices synced to app.plans.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
