import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const PROD_ORIGINS = ['https://quickguard.uk', 'https://www.quickguard.uk'];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (origin === 'https://readdy.ai' || origin.endsWith('.readdy.ai')) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

function buildCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin! : PROD_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);

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

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const jwt = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const { data: adminUser } = await supabase.from('admin_users').select('id, is_active, role').eq('user_id', user.id).maybeSingle();
  if (!adminUser || !adminUser.is_active) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (adminUser.role !== 'super_admin' && adminUser.role !== 'finance_admin') {
    return new Response(JSON.stringify({ error: 'Only super_admin or finance_admin can cancel subscriptions' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { stripeSubscriptionId, userId } = await req.json();

    if (!stripeSubscriptionId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing stripeSubscriptionId or userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {data: local, error: lookupError} = await supabase.from('subscriptions')
      .select('id, user_id').eq('stripe_subscription_id', stripeSubscriptionId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!local || local.user_id !== userId) {
      return new Response(JSON.stringify({error: 'Subscription does not belong to this user'}), {
        status: 404, headers: {...corsHeaders, 'Content-Type': 'application/json'},
      });
    }
    const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    const {error: subscriptionError} = await supabase.from('subscriptions')
      .update({cancel_at_period_end: subscription.cancel_at_period_end, updated_at: new Date().toISOString()})
      .eq('id', local.id);
    if (subscriptionError) throw subscriptionError;
    const {error: entitlementError} = await supabase.from('user_entitlements')
      .update({cancel_at_period_end: subscription.cancel_at_period_end, updated_at: new Date().toISOString()})
      .eq('user_id', userId).eq('stripe_subscription_id', stripeSubscriptionId);
    if (entitlementError) throw entitlementError;

    await supabase.from('notifications').insert([{
      user_id: userId,
      title: 'Subscription Scheduled to Cancel',
      message: 'Your subscription will cancel at the end of the current billing period.',
      type: 'warning',
      is_read: false,
    }]);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
