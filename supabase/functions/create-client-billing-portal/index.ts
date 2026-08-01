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
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';

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

    const { data: client } = await supabase
      .from('clients')
      .select('id, stripe_customer_id, email, company_name, contact_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!client) {
      return new Response(JSON.stringify({ error: 'Client profile not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let customerId = client.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: client.email || user.email,
        name: client.company_name || client.contact_name || 'Client',
        metadata: {
          clientId: client.id,
          userId: user.id,
        },
      });

      customerId = customer.id;

      await supabase.from('clients').update({
        stripe_customer_id: customerId,
        stripe_customer_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', client.id);
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/client/profile?tab=billing`,
    });

    await supabase.from('clients').update({
      stripe_billing_portal_last_opened_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', client.id);

    return new Response(JSON.stringify({ url: portalSession.url }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Create billing portal error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to create billing portal' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
