
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecretKey || !supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Missing config' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
    const appSupabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'app' } });

    const { data: subs } = await appSupabase.from('subscriptions').select('*').not('stripe_subscription_id', 'is', null).order('created_at', { ascending: false });

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ message: 'No subscriptions found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: any[] = [];

    for (const sub of subs) {
      const stripeSubId = sub.stripe_subscription_id;

      const { data: existingPmt } = await appSupabase.from('subscription_payments').select('id').eq('user_id', sub.user_id).limit(1);
      if (existingPmt && existingPmt.length > 0) {
        results.push({ sub_id: sub.id, user_id: sub.user_id, stripe_sub_id: stripeSubId, action: 'skipped', reason: 'already has payment records' });
        continue;
      }

      try {
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
        console.log(`Fetched Stripe sub ${stripeSubId}, status=${stripeSub.status}, latest_invoice=${stripeSub.latest_invoice}`);

        const latestInvoiceId = stripeSub.latest_invoice as string;

        if (latestInvoiceId) {
          const invoice = await stripe.invoices.retrieve(latestInvoiceId);
          console.log(`Invoice ${latestInvoiceId}: amount_paid=${invoice.amount_paid}, status=${invoice.status}`);

          const amountPaid = (invoice.amount_paid || 0) / 100;
          const invoiceStatus = invoice.status === 'paid' ? 'succeeded' : (invoice.status === 'open' ? 'pending' : 'failed');

          const { data: existingInvoicePmt } = await appSupabase.from('subscription_payments').select('id').eq('stripe_invoice_id', latestInvoiceId).maybeSingle();

          if (!existingInvoicePmt && amountPaid > 0) {
            const paymentRecord = {
              subscription_id: sub.id,
              user_id: sub.user_id,
              stripe_payment_intent_id: invoice.payment_intent as string || null,
              stripe_invoice_id: latestInvoiceId,
              stripe_charge_id: invoice.charge as string || null,
              amount: amountPaid,
              currency: invoice.currency || 'gbp',
              status: invoiceStatus,
              billing_reason: invoice.billing_reason || 'subscription_create',
              period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : sub.current_period_start,
              period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : sub.current_period_end,
              paid_at: invoice.status === 'paid' ? new Date(invoice.created * 1000).toISOString() : null,
              invoice_url: invoice.hosted_invoice_url || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            await appSupabase.from('subscription_payments').insert(paymentRecord);

            if (invoice.status === 'paid') {
              await appSupabase.from('subscriptions').update({
                payment_status: 'succeeded',
                last_payment_date: new Date(invoice.created * 1000).toISOString(),
                updated_at: new Date().toISOString(),
              }).eq('id', sub.id);
            }

            results.push({ sub_id: sub.id, user_id: sub.user_id, stripe_sub_id: stripeSubId, action: 'backfilled', amount: amountPaid, invoice_status: invoiceStatus, invoice_id: latestInvoiceId });
          } else if (existingInvoicePmt) {
            results.push({ sub_id: sub.id, user_id: sub.user_id, stripe_sub_id: stripeSubId, action: 'skipped', reason: 'invoice already recorded' });
          } else if (amountPaid === 0) {
            results.push({ sub_id: sub.id, user_id: sub.user_id, stripe_sub_id: stripeSubId, action: 'skipped', reason: 'invoice amount is 0 (trial/free)' });
          }
        } else {
          results.push({ sub_id: sub.id, user_id: sub.user_id, stripe_sub_id: stripeSubId, action: 'skipped', reason: 'no latest_invoice on Stripe subscription' });
        }
      } catch (err: any) {
        console.error(`Error processing sub ${stripeSubId}:`, err.message);
        results.push({ sub_id: sub.id, user_id: sub.user_id, stripe_sub_id: stripeSubId, action: 'error', error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
