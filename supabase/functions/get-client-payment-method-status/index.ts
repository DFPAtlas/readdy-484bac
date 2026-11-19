import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const idOf = (value: any): string | null => typeof value === 'string' ? value : value?.id || null;
const missing = (error: any) => error?.code === 'resource_missing' && error?.statusCode === 404;

// Read only. Never create/link a customer, open a portal, or repair historical
// subscription bindings while answering a readiness question.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const token = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') || '')?.[1];
    if (!token) return json(401, { error: 'Unauthorized' });
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      db: { schema: 'app' }, auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return json(401, { error: 'Unauthorized' });
    const closure = await db.from('account_closures').select('user_id').eq('user_id', user.id).maybeSingle();
    if (closure.error) throw closure.error;
    if (closure.data) return json(403, { error: 'Account closed' });
    const { data: client, error: clientError } = await db.from('clients')
      .select('id, stripe_customer_id, stripe_subscription_id, is_active').eq('user_id', user.id).maybeSingle();
    if (clientError) throw clientError;
    if (!client || client.is_active === false) return json(403, { error: 'Active client account required' });
    const { data: rows, error: subscriptionError } = await db.from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id').eq('user_id', user.id).limit(2);
    if (subscriptionError || !Array.isArray(rows)) throw subscriptionError || new Error('Invalid subscriptions');

    const customerId = client.stripe_customer_id;
    const profileSubscription = client.stripe_subscription_id || null;
    const record = rows.length === 1 ? rows[0] : null;
    const recordSubscription = record?.stripe_subscription_id || null;
    let billingLink: 'matched' | 'not_linked' | 'needs_review' = rows.length || profileSubscription ? 'matched' : 'not_linked';
    if (rows.length > 1 || (record && record.stripe_customer_id !== customerId) ||
      profileSubscription !== recordSubscription || (rows.length && !recordSubscription)) billingLink = 'needs_review';
    const result = (status: 'saved' | 'none' | 'unverified', link = billingLink) => json(200, {
      status, billing_link: link, checked_at: new Date().toISOString(),
    });
    if (!customerId) return result(profileSubscription || rows.length ? 'unverified' : 'none', profileSubscription || rows.length ? 'needs_review' : 'not_linked');
    if (!/^cus_[A-Za-z0-9]+$/.test(customerId)) return result('unverified', 'needs_review');
    const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
    if (!/^(?:sk|rk)_(?:live|test)_/.test(key)) throw new Error('Stripe configuration unavailable');
    const live = /^(?:sk|rk)_live_/.test(key);
    const stripe = new Stripe(key, { apiVersion: '2023-10-16', timeout: 10000, maxNetworkRetries: 1 });
    let customer;
    try { customer = await stripe.customers.retrieve(customerId); }
    catch (error) { if (missing(error)) return result('unverified', 'needs_review'); throw error; }
    if (customer.deleted || customer.id !== customerId || customer.livemode !== live) return result('unverified', 'needs_review');
    // Existing server-owned bindings are authoritative; contradictory provider
    // ownership metadata must never become a positive readiness result.
    if ((customer.metadata?.userId && customer.metadata.userId !== user.id) ||
      (customer.metadata?.clientId && customer.metadata.clientId !== client.id)) return result('unverified', 'needs_review');

    if (billingLink === 'matched' && profileSubscription) {
      try {
        const subscription = await stripe.subscriptions.retrieve(profileSubscription);
        if (subscription.id !== profileSubscription || idOf(subscription.customer) !== customerId || subscription.livemode !== live ||
          (subscription.metadata?.userId && subscription.metadata.userId !== user.id) ||
          (subscription.metadata?.clientId && subscription.metadata.clientId !== client.id)) billingLink = 'needs_review';
      } catch (error) { if (missing(error)) billingLink = 'needs_review'; else throw error; }
    }
    // One attached method proves existence; this is not a total, card type, or
    // assertion that a future charge or subscription renewal will succeed.
    const methods = await stripe.paymentMethods.list({ customer: customerId, limit: 1 });
    if (!Array.isArray(methods.data) || (!methods.data.length && methods.has_more)) throw new Error('Invalid payment methods');
    if (methods.data.length) {
      const method = methods.data[0];
      if (!method.id || idOf(method.customer) !== customerId || method.livemode !== live) throw new Error('Invalid payment method binding');
      return result('saved');
    }
    // Legacy default sources are not returned by PaymentMethods.list.
    const sourceId = idOf(customer.default_source);
    if (sourceId) {
      const source = await stripe.customers.retrieveSource(customerId, sourceId);
      if (source.deleted || source.id !== sourceId || idOf(source.customer) !== customerId || !['card', 'bank_account'].includes(source.object)) throw new Error('Invalid legacy source');
      return result('saved');
    }
    if (idOf(customer.invoice_settings?.default_payment_method)) throw new Error('Unconfirmed default payment method');
    return result('none');
  } catch {
    return json(503, { error: 'Payment method status could not be checked. Please try again.' });
  }
});
