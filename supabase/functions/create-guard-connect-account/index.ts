import { paymentFreezeResponse } from '../_shared/payment-freeze.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const paymentFreeze = await paymentFreezeResponse(req.method, corsHeaders);
  if (paymentFreeze) return paymentFreeze;

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

    const { data: guard } = await supabase.from('guards').select('id, stripe_account_id, email, full_name').eq('user_id', user.id).maybeSingle();
    if (!guard) {
      return new Response(JSON.stringify({ error: 'Guard profile not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let stripeAccountId = guard.stripe_account_id;

    async function persistAccountStatus(account: any, statusOverride?: string) {
      const now = new Date().toISOString();
      const detailsSubmitted = account.details_submitted ?? false;
      const payoutsEnabled = account.payouts_enabled ?? false;
      const chargesEnabled = account.charges_enabled ?? false;
      const transferCapability = account.capabilities?.transfers || 'inactive';
      const requirementsDue = account.requirements?.currently_due || [];
      const restrictedReason = account.requirements?.disabled_reason || null;
      const ready = detailsSubmitted && payoutsEnabled && transferCapability === 'active' && requirementsDue.length === 0 && !restrictedReason;
      const status = statusOverride || (ready ? 'ready' : (restrictedReason || requirementsDue.length > 0 || transferCapability === 'inactive') ? 'restricted' : (detailsSubmitted || transferCapability === 'pending') ? 'pending' : 'not_started');

      await supabase.from('guards').update({
        stripe_account_id: account.id,
        stripe_account_status: status,
        stripe_details_submitted: detailsSubmitted,
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
        stripe_requirements_due: requirementsDue,
        stripe_last_checked_at: now,
        stripe_connect_status: status === 'ready' ? 'verified' : status === 'restricted' ? 'restricted' : status === 'not_started' ? 'not_started' : 'pending',
        stripe_connect_restricted_reason: restrictedReason,
        ...(status === 'ready' && { stripe_connect_verified_at: now }),
        updated_at: now,
      }).eq('id', guard.id);
    }

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'GB',
        email: guard.email || undefined,
        business_profile: {
          name: guard.full_name || 'QuickGuard Guard',
          url: `${siteUrl}/guard/dashboard`,
        },
        capabilities: { transfers: { requested: true } },
        metadata: { guardId: guard.id, userId: user.id },
      });
      stripeAccountId = account.id;
      await persistAccountStatus(account, 'pending');
    } else {
      try {
        const account = await stripe.accounts.retrieve(stripeAccountId);
        await persistAccountStatus(account);
      } catch (stripeErr: any) {
        if (stripeErr.message?.includes('No such account')) {
          const now = new Date().toISOString();
          await supabase.from('guards').update({
            stripe_account_id: null,
            stripe_account_status: 'not_started',
            stripe_details_submitted: false,
            stripe_charges_enabled: false,
            stripe_payouts_enabled: false,
            stripe_requirements_due: '[]',
            stripe_last_checked_at: now,
            stripe_connect_status: 'not_started',
            stripe_connect_restricted_reason: null,
            updated_at: now,
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
          await persistAccountStatus(account, 'pending');
        } else {
          throw stripeErr;
        }
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${siteUrl}/guard/bank-settings?stripe_onboarding=refresh`,
      return_url: `${siteUrl}/guard/bank-settings?stripe_onboarding=return`,
      type: 'account_onboarding',
    });

    return new Response(JSON.stringify({ url: accountLink.url, stripeAccountId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Create connect account error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to create connect account' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
