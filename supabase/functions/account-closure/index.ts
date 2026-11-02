import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@22.6.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
serve(async (req: Request) => {
 if (req.method === 'OPTIONS') return new Response('ok', { headers });
 if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
 const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'app' }, auth: { persistSession: false } });
 const token = (req.headers.get('Authorization') || '').replace(/^Bearer /i, '');
 const { data: { user }, error: authError } = await db.auth.getUser(token);
 if (authError || !user) return json(401, { error: 'Not authenticated' });
 try {
  const body = await req.json();
  const action = body.action || 'close';
  if (action === 'list' || action === 'hold' || body.user_id && body.user_id !== user.id) {
   const { data: admin, error } = await db.from('admin_users').select('role,is_active').eq('user_id', user.id).maybeSingle();
   let aal = '';
   try { aal = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).aal; } catch {}
   if (error || admin?.role !== 'super_admin' || !admin.is_active || aal !== 'aal2') return json(403, { error: 'Active super-admin and MFA are required' });
  }
  if (action === 'list') {
   const { data, error } = await db.from('account_closures').select('*').order('closed_at', { ascending: false }).limit(100);
   if (error) throw error; return json(200, { closures: data });
  }
  if (action === 'hold') {
   if (typeof body.hold !== 'boolean' || typeof body.reason !== 'string') return json(400, { error: 'Hold and reason are required' });
   const { error } = await db.rpc('set_account_retention_hold', { p_id: body.closure_id, p_hold: body.hold, p_reason: body.reason, p_actor_id: user.id });
   if (error) throw error; return json(200, { success: true });
  }
  if (action !== 'close' || body.confirmation !== 'CLOSE ACCOUNT') return json(400, { error: 'Type CLOSE ACCOUNT to confirm' });
  const target = body.user_id || user.id;
  // Read Stripe directly: a stale local 'cancelled' flag must not permit
  // closure while recurring billing or an unpaid invoice remains active.
  const subscriptionIds = new Set<string>();
  const customerIds = new Set<string>();
  for (const table of ['subscriptions','guards','clients','users']) {
   const { data: records, error: lookupError } = await db.from(table).select('stripe_subscription_id,stripe_customer_id').eq(table === 'users' ? 'id' : 'user_id', target);
   if (lookupError) throw lookupError;
   for (const record of records || []) {
    if (record.stripe_subscription_id) subscriptionIds.add(record.stripe_subscription_id);
    if (record.stripe_customer_id) customerIds.add(record.stripe_customer_id);
   }
  }
  if (subscriptionIds.size || customerIds.size) {
   const key = Deno.env.get('STRIPE_SECRET_KEY');
   if (!key) return json(503, { error: 'Billing must be verified before this account can close.' });
   const stripe = new Stripe(key, { apiVersion: '2026-08-26.dahlia' });
   for (const id of subscriptionIds) {
    const subscription = await stripe.subscriptions.retrieve(id);
    if (!['canceled','incomplete_expired'].includes(subscription.status)) return json(409, { error: 'Your paid subscription has not ended. Complete cancellation before closing the account.' });
   }
   for (const customer of customerIds) {
    let cursor: string | undefined;
    for (let page = 0; ; page++) {
     if (page >= 10) return json(409, { error: 'Billing history requires manual review before closure.' });
     const subscriptions = await stripe.subscriptions.list({ customer, status: 'all', limit: 100, ...(cursor ? { starting_after: cursor } : {}) });
     if (subscriptions.data.some(subscription => !['canceled','incomplete_expired'].includes(subscription.status))) return json(409, { error: 'A paid subscription is still active. Complete cancellation before closing the account.' });
     if (!subscriptions.has_more) break;
     cursor = subscriptions.data.at(-1)?.id;
     if (!cursor) throw new Error('Billing pagination failed');
    }
    const invoices = await stripe.invoices.list({ customer, status: 'open', limit: 1 });
    if (invoices.data.length) return json(409, { error: 'Resolve outstanding invoices before closing the account.' });
   }
  }
  const { data: closure, error } = await db.rpc('begin_account_closure', { p_user_id: target, p_actor_id: user.id });
  if (error) return json(409, { error: error.message });
  // RLS immediately blocks stale tokens. Auth ban prevents new login/refresh.
  const { error: banError } = await db.auth.admin.updateUserById(target, { ban_duration: '876600h' });
  if (banError) return json(503, { error: 'Closure started and account access is blocked. Authentication shutdown will be retried automatically.', closure_id: closure.id });
  const { error: finishError } = await db.rpc('confirm_account_closure', { p_id: closure.id });
  if (finishError) throw finishError;
  return json(200, { success: true, closed_at: closure.closed_at, profile_purge_at: closure.profile_purge_at, documents_purge_at: closure.documents_purge_at, financial_review_at: closure.financial_review_at });
 } catch (error: any) { return json(500, { error: error.message || 'Closure failed' }); }
});
