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

    const { data: guard } = await supabase
      .from('guards')
      .select('id, stripe_account_id, email, full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!guard) {
      return new Response(JSON.stringify({ error: 'Guard profile not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let stripeAccountId = guard.stripe_account_id;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'GB',
        email: guard.email || undefined,
        business_profile: {
          name: guard.full_name || 'QuickGuard Guard',
          url: `${siteUrl}/guard/dashboard`,
        },
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          guardId: guard.id,
          userId: user.id,
        },
      });

      stripeAccountId = account.id;

      await supabase.from('guards').update({
        stripe_account_id: stripeAccountId,
        stripe_account_status: 'not_started',
        stripe_details_submitted: false,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
        stripe_requirements_due: '[]',
        stripe_last_checked_at: new Date().toISOString(),
        stripe_connect_status: 'pending',
        stripe_connect_onboarded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', guard.id);
    } else {
      try {
        const acct = await stripe.accounts.retrieve(stripeAccountId);
        await supabase.from('guards').update({
          stripe_details_submitted: acct.details_submitted ?? false,
          stripe_charges_enabled: acct.charges_enabled ?? false,
          stripe_payouts_enabled: acct.payouts_enabled ?? false,
          stripe_requirements_due: acct.requirements?.currently_due ?? [],
          stripe_last_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', guard.id);
      } catch (stripeErr: any) {
        if (stripeErr.message?.includes('No such account')) {
          stripeAccountId = null;
          await supabase.from('guards').update({
            stripe_account_id: null,
            stripe_account_status: 'not_started',
            stripe_details_submitted: false,
            stripe_charges_enabled: false,
            stripe_payouts_enabled: false,
            stripe_requirements_due: '[]',
            stripe_last_checked_at: new Date().toISOString(),
            stripe_connect_status: 'not_started',
            stripe_connect_restricted_reason: null,
            updated_at: new Date().toISOString(),
          }).eq('id', guard.id);

          const account = await stripe.accounts.create({
            type: 'express',
            country: 'GB',
            email: guard.email || undefined,
            business_profile: { name: guard.full_name || 'QuickGuard Guard', url: `${siteUrl}/guard/dashboard` },
            capabilities: { transfers: { requested: true } },
            metadata: { guardId: guard.id, userId: user.id },
          });
          stripeAccountId = account.id;
          await supabase.from('guards').update({
            stripe_account_id: stripeAccountId,
            stripe_account_status: 'not_started',
            stripe_details_submitted: false,
            stripe_charges_enabled: false,
            stripe_payouts_enabled: false,
            stripe_requirements_due: '[]',
            stripe_last_checked_at: new Date().toISOString(),
            stripe_connect_status: 'pending',
            stripe_connect_onboarded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', guard.id);
        } else {
          throw stripeErr;
        }
      }
    }

    const refreshUrl = `${siteUrl}/guard/bank-settings?stripe_onboarding=refresh`;
    const returnUrl = `${siteUrl}/guard/bank-settings?stripe_onboarding=return`;

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return new Response(JSON.stringify({ url: accountLink.url, stripeAccountId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Create connect account error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to create connect account' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
