import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: guard } = await supabase
      .from('guards')
      .select('id, stripe_account_id, stripe_connect_status, stripe_connect_restricted_reason')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!guard) {
      return new Response(
        JSON.stringify({ error: 'Guard profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!guard.stripe_account_id) {
      return new Response(
        JSON.stringify({
          connected: false,
          onboarded: false,
          payoutsEnabled: false,
          status: 'not_started',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const account = await stripe.accounts.retrieve(guard.stripe_account_id);

      const isComplete = account.details_submitted;
      const payoutsEnabled = account.payouts_enabled && account.charges_enabled;
      const requirements = account.requirements?.currently_due || [];
      const restrictions = account.requirements?.disabled_reason || null;

      let status = guard.stripe_connect_status;

      if (payoutsEnabled) {
        status = 'verified';
      } else if (isComplete) {
        status = 'pending';
      } else {
        status = 'restricted';
      }

      if (status !== guard.stripe_connect_status || restrictions !== guard.stripe_connect_restricted_reason) {
        const update: any = {
          stripe_connect_status: status,
          stripe_connect_restricted_reason: restrictions,
          updated_at: new Date().toISOString(),
        };
        if (status === 'verified' && !guard.stripe_connect_verified_at) {
          update.stripe_connect_verified_at = new Date().toISOString();
        }
        await supabase.from('guards').update(update).eq('id', guard.id);
      }

      return new Response(
        JSON.stringify({
          connected: true,
          onboarded: isComplete,
          payoutsEnabled: payoutsEnabled,
          status: status,
          accountId: guard.stripe_account_id,
          requirements: requirements,
          restrictedReason: restrictions,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (stripeErr: any) {
      if (stripeErr.message?.includes('No such account')) {
        await supabase.from('guards').update({
          stripe_account_id: null,
          stripe_connect_status: 'not_started',
          stripe_connect_restricted_reason: null,
          updated_at: new Date().toISOString(),
        }).eq('id', guard.id);

        return new Response(
          JSON.stringify({ connected: false, onboarded: false, payoutsEnabled: false, status: 'not_started' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw stripeErr;
    }
  } catch (error: any) {
    console.error('Get connect status error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to check connect status' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
