
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { invoiceReferences, stripeId } from '../_shared/invoice-lifecycle.ts';
import { invoiceServicePeriod, unixTime } from '../_shared/subscription-invoice-period.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function hasMfa(token: string): boolean {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(atob(part + '='.repeat((4 - part.length % 4) % 4)));
    return !!payload && typeof payload === 'object' && 'aal' in payload && payload.aal === 'aal2';
  } catch { return false; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const configuredStripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Missing config' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const appSupabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'app' } });
    const authHeader = req.headers.get('Authorization') || '';
    if (authHeader !== `Bearer ${supabaseKey}`) {
      if (!authHeader.startsWith('Bearer ') || !authHeader.slice(7)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const token = authHeader.slice(7);
      const { data: { user }, error: authError } = await appSupabase.auth.getUser(token);
      if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: admin, error: adminError } = await appSupabase.from('admin_users').select('id, role, is_active').eq('user_id', user.id).maybeSingle();
      if (!hasMfa(token) || adminError || !admin?.is_active || !['super_admin', 'admin', 'finance_admin'].includes(admin.role)) {
        return new Response(JSON.stringify({ error: 'Active finance admin with MFA required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const rawBody = await req.text();
    const body: unknown = rawBody ? JSON.parse(rawBody) : {};
    if (!body || typeof body !== 'object') throw new Error('Invalid request');
    const subscriptionId: unknown = Object.getOwnPropertyDescriptor(body, 'subscription_id')?.value;
    const dryRun = Object.getOwnPropertyDescriptor(body, 'dry_run')?.value === true;
    if (subscriptionId !== undefined && (typeof subscriptionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subscriptionId))) throw new Error('Invalid subscription ID');
    const stripeEnvironment: unknown = Object.getOwnPropertyDescriptor(body, 'stripe_environment')?.value;
    if (stripeEnvironment !== undefined && stripeEnvironment !== 'configured' && stripeEnvironment !== 'sandbox') {
      return new Response(JSON.stringify({ error: 'Invalid Stripe environment' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const sandboxPreview = stripeEnvironment === 'sandbox';
    if (sandboxPreview && (!dryRun || typeof subscriptionId !== 'string')) {
      return new Response(JSON.stringify({ error: 'Sandbox access requires a scoped read-only preview' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Sandbox credentials never participate in the existing reconciliation path.
    const stripeSecretKey = sandboxPreview ? Deno.env.get('STRIPE_SANDBOX_READ_KEY') : configuredStripeKey;
    if (sandboxPreview && (!stripeSecretKey || !/^(sk|rk)_test_/.test(stripeSecretKey))) {
      return new Response(JSON.stringify({ success: false, stripe_environment: 'sandbox', results: [{
        sub_id: subscriptionId, action: 'error', error_code: !stripeSecretKey ? 'sandbox_not_configured' : 'invalid_sandbox_key',
      }] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Missing config' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    let query = appSupabase.from('subscriptions').select('*').not('stripe_subscription_id', 'is', null).order('created_at', { ascending: false });
    if (typeof subscriptionId === 'string') query = query.eq('id', subscriptionId);
    const { data: subs, error: subscriptionError } = await query;
    if (subscriptionError) throw subscriptionError;
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    const results: any[] = [];

    for (const sub of subs || []) {
      const stripeSubId = sub.stripe_subscription_id;

      try {
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
        if (sandboxPreview && stripeSub.livemode !== false) throw new Error('Sandbox preview did not return a sandbox subscription');
        console.log(`Fetched Stripe sub ${stripeSubId}, status=${stripeSub.status}, latest_invoice=${stripeSub.latest_invoice}`);

        const latestInvoiceId = stripeId(stripeSub.latest_invoice);

        if (latestInvoiceId) {
          const invoice = await stripe.invoices.retrieve(latestInvoiceId);
          console.log(`Invoice ${latestInvoiceId}: amount_paid=${invoice.amount_paid}, status=${invoice.status}`);

          const references = invoiceReferences(invoice);
          if (stripeId(stripeSub.customer) !== sub.stripe_customer_id || stripeId(invoice.customer) !== sub.stripe_customer_id
              || references.subscriptionId !== stripeSubId || invoice.livemode !== stripeSub.livemode
              || !stripeSub.items.data.some(item => item.price.id === sub.stripe_price_id)) {
            throw new Error('Stripe customer, subscription, price or mode does not match the existing record');
          }
          if (invoice.status !== 'paid') {
            results.push({ sub_id: sub.id, action: 'skipped', reason: 'latest invoice is not paid' });
            continue;
          }
          if (!Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid < 0 || invoice.currency !== sub.currency) throw new Error('Invalid invoice amount or currency');
          const amountPaid = invoice.amount_paid / 100;
          const invoiceStatus = 'succeeded';
          const period = invoiceServicePeriod(invoice, stripeSubId);
          const paidAt = unixTime(invoice.status_transitions?.paid_at);

          const { data: existingInvoicePmt, error: invoiceReadError } = await appSupabase.from('subscription_payments').select('id, subscription_id, user_id, status, amount, currency').eq('stripe_invoice_id', latestInvoiceId).maybeSingle();
          if (invoiceReadError) throw invoiceReadError;
          if (existingInvoicePmt && (existingInvoicePmt.subscription_id !== sub.id || existingInvoicePmt.user_id !== sub.user_id)) throw new Error('Invoice is linked to a different subscription or user');
          if (existingInvoicePmt && (existingInvoicePmt.status !== 'succeeded' || Number(existingInvoicePmt.amount) !== amountPaid || existingInvoicePmt.currency !== invoice.currency)) throw new Error('Existing invoice ledger conflicts with Stripe; review required');
          if (dryRun) { results.push({ sub_id: sub.id, action: 'preview', invoice_id: latestInvoiceId, amount: amountPaid, already_recorded: !!existingInvoicePmt, period_start: period.start, period_end: period.end, paid_at: paidAt, ...(sandboxPreview ? { livemode: false } : {}) }); continue; }

          let backfilled = false;
          if (!existingInvoicePmt && amountPaid > 0) {
            const paymentRecord = {
              subscription_id: sub.id,
              user_id: sub.user_id,
              stripe_payment_intent_id: references.paymentIntentId,
              stripe_invoice_id: latestInvoiceId,
              stripe_charge_id: references.chargeId,
              amount: amountPaid,
              currency: invoice.currency || 'gbp',
              status: invoiceStatus,
              billing_reason: invoice.billing_reason || 'subscription_create',
              period_start: period.start,
              period_end: period.end,
              paid_at: paidAt,
              invoice_url: invoice.hosted_invoice_url || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            const { error: insertError } = await appSupabase.from('subscription_payments').insert(paymentRecord);
            if (insertError) {
              if (insertError.code !== '23505') throw insertError;
              const { data: raced, error: raceError } = await appSupabase.from('subscription_payments').select('id, subscription_id, user_id, status, amount, currency').eq('stripe_invoice_id', latestInvoiceId).maybeSingle();
              if (raceError || !raced || raced.subscription_id !== sub.id || raced.user_id !== sub.user_id || raced.status !== 'succeeded' || Number(raced.amount) !== amountPaid || raced.currency !== invoice.currency) throw new Error('Concurrent invoice write was not confirmed');
            } else {
              backfilled = true;
            }

          }
          if (amountPaid > 0) {
            const summary = { payment_status: 'succeeded', updated_at: new Date().toISOString(),
              ...(paidAt && (!sub.last_payment_date || paidAt >= sub.last_payment_date) ? { last_payment_date: paidAt } : {}) };
            const { data: updated, error: updateError } = await appSupabase.from('subscriptions').update(summary)
              .eq('id', sub.id).eq('user_id', sub.user_id).eq('stripe_subscription_id', stripeSubId).select('id');
            if (updateError || !updated?.length) throw new Error('Subscription payment summary was not confirmed');
          }
          results.push({ sub_id: sub.id, user_id: sub.user_id, stripe_sub_id: stripeSubId,
            action: backfilled ? 'backfilled' : 'skipped', amount: amountPaid, invoice_status: invoiceStatus, invoice_id: latestInvoiceId,
            ...(!backfilled ? { reason: amountPaid === 0 ? 'invoice amount is 0 (trial/free)' : 'invoice already recorded' } : {}) });
        } else {
          results.push({ sub_id: sub.id, user_id: sub.user_id, stripe_sub_id: stripeSubId, action: 'skipped', reason: 'no latest_invoice on Stripe subscription' });
        }
      } catch (err: any) {
        console.error(`Error processing sub ${stripeSubId}:`, err.message);
        results.push({ sub_id: sub.id, user_id: sub.user_id, stripe_sub_id: stripeSubId, action: 'error', error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: !results.some(result => result.action === 'error'), results,
      ...(sandboxPreview ? { stripe_environment: 'sandbox' } : {}) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
