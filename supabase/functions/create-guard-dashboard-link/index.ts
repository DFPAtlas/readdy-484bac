import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: guard } = await supabase
      .from('guards')
      .select('id, stripe_account_id, stripe_account_status, stripe_payouts_enabled')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!guard) {
      return new Response(JSON.stringify({ error: 'Guard profile not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!guard.stripe_account_id) {
      return new Response(JSON.stringify({ error: 'No Stripe account connected. Set up payouts first.', code: 'NO_ACCOUNT' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const loginLink = await stripe.accounts.createLoginLink(guard.stripe_account_id);

    await supabase.from('guards').update({
      stripe_last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', guard.id);

    return new Response(JSON.stringify({ url: loginLink.url }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Create dashboard link error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to create dashboard link' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
