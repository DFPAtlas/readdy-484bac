import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
function providerErrorCode(error: unknown): string | null {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) return reply({ error: 'Server configuration error' }, 503);

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return reply({ error: 'Unauthorized' }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
    if (authError || !user) return reply({ error: 'Invalid or expired token' }, 401);

    const { data: guard, error: guardError } = await supabase.from('guards').select('id,stripe_account_id').eq('user_id', user.id).maybeSingle();
    if (guardError) return reply({ error: 'Payout profile could not be loaded' }, 503);
    if (!guard) return reply({ error: 'Guard profile not found' }, 404);
    if (!guard.stripe_account_id) return reply({
      connected: false, stripeAccountId: null, detailsSubmitted: false, chargesEnabled: false,
      payoutsEnabled: false, transfersEnabled: false, transferCapabilityStatus: 'inactive',
      status: 'not_started', requirementsDue: [], restrictedReason: null, lastCheckedAt: new Date().toISOString(),
    });

    let account: Stripe.Account;
    try {
      account = await stripe.accounts.retrieve(guard.stripe_account_id);
    } catch (error: unknown) {
      const code = providerErrorCode(error);
      // An inaccessible ID can belong to another mode/platform, or access may
      // have been revoked. A failed read never proves that the link is absent.
      // Preserve the link and cached state for reconciliation, and never log
      // the provider exception (which can contain key/account details).
      if (code === 'account_invalid' || code === 'resource_missing') {
        console.warn('Guard Stripe status unavailable', { code });
        return reply({ error: 'The linked Stripe account could not be verified. Contact support to check the connection.', error_code: 'connect_account_unavailable' }, 409);
      }
      console.warn('Guard Stripe provider request failed', { code: code || 'provider_unavailable' });
      return reply({ error: 'Stripe account status is temporarily unavailable. Please retry.', error_code: 'stripe_status_unavailable' }, 503);
    }

    const detailsSubmitted = account.details_submitted === true;
    const chargesEnabled = account.charges_enabled === true;
    const payoutsEnabled = account.payouts_enabled === true;
    const requirementsDue = account.requirements?.currently_due || [];
    const restrictedReason = account.requirements?.disabled_reason || null;
    const transferCapabilityStatus = account.capabilities?.transfers || 'inactive';
    const transfersEnabled = transferCapabilityStatus === 'active';
    const status = detailsSubmitted && transfersEnabled && payoutsEnabled && !restrictedReason && requirementsDue.length === 0
      ? 'ready'
      : restrictedReason || requirementsDue.length > 0 || transferCapabilityStatus === 'inactive' ? 'restricted'
      : detailsSubmitted || transferCapabilityStatus === 'pending' ? 'pending' : 'not_started';
    const now = new Date().toISOString();
    const { data: saved, error: saveError } = await supabase.from('guards').update({
      stripe_account_status: status, stripe_details_submitted: detailsSubmitted,
      stripe_charges_enabled: chargesEnabled, stripe_payouts_enabled: payoutsEnabled,
      stripe_requirements_due: requirementsDue, stripe_last_checked_at: now,
      stripe_connect_status: status === 'ready' ? 'verified' : status,
      stripe_connect_restricted_reason: restrictedReason,
      stripe_connect_verified_at: status === 'ready' ? now : null, updated_at: now,
    }).eq('id', guard.id).eq('stripe_account_id', guard.stripe_account_id).select('id').maybeSingle();
    if (saveError || saved?.id !== guard.id) return reply({ error: 'Stripe status changed or could not be saved. Refresh and retry.' }, 409);

    return reply({ connected: true, stripeAccountId: guard.stripe_account_id, detailsSubmitted, chargesEnabled,
      payoutsEnabled, transfersEnabled, transferCapabilityStatus, status, requirementsDue, restrictedReason, lastCheckedAt: now });
  } catch {
    console.error('Guard Stripe status request could not be completed');
    return reply({ error: 'Stripe status could not be checked. Please retry.' }, 503);
  }
});
