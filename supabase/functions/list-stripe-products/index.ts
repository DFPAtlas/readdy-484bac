import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';

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

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeSecretKey) {
    return new Response(
      JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

  try {
    const products = await stripe.products.list({ limit: 100, active: true });
    const prices = await stripe.prices.list({ limit: 100, active: true });

    const mapped = products.data.map((p) => ({
      product_id: p.id,
      name: p.name,
      description: p.description,
      prices: prices.data
        .filter((pr) => pr.product === p.id)
        .map((pr) => ({
          price_id: pr.id,
          unit_amount: pr.unit_amount,
          currency: pr.currency,
          interval: (pr as any).recurring?.interval || 'one_time',
          interval_count: (pr as any).recurring?.interval_count || 1,
        })),
    }));

    return new Response(
      JSON.stringify({ products: mapped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Stripe list error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
