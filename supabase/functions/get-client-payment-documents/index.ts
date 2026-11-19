import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { paymentDocumentLink } from '../_shared/payment-document-links.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const idOf = (v: any): string | null => typeof v === 'string' ? v : v?.id || null;
const missing = (e: any) => e?.code === 'resource_missing' && e?.statusCode === 404;
const collected = new Set(['completed', 'succeeded', 'paid', 'refunded', 'partially_refunded']);

// Strictly read-only: no invoice creation, email, payment, billing relink or ledger
// update. Only a server-owned transaction ID is accepted, never provider IDs.
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
    const profile = await db.from('clients').select('id, is_active').eq('user_id', user.id).maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data || profile.data.is_active === false) return json(403, { error: 'Active client account required' });
    let body;
    try { body = await req.json(); } catch { return json(400, { error: 'Transaction ID required' }); }
    if (!body || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.transaction_id || '')) return json(400, { error: 'Transaction ID required' });
    const client = profile.data;
    const { data: tx, error: txError } = await db.from('transactions')
      .select('id, client_id, job_id, amount, currency, status, stripe_session_id, stripe_payment_intent, stripe_charge_id, stripe_invoice_id')
      .eq('id', body.transaction_id).eq('client_id', client.id).maybeSingle();
    if (txError) throw txError;
    if (!tx || tx.client_id !== client.id) return json(404, { error: 'Payment not found' });
    const result = (status: string, mode: 'live' | 'test' | 'unknown' = 'unknown', receipt: string | null = null, invoice: string | null = null, pdf: string | null = null) => json(200, {
      transaction_id: tx.id, status, mode, receipt_url: receipt, invoice_url: invoice, invoice_pdf: pdf, checked_at: new Date().toISOString(),
    });
    if (!collected.has(tx.status)) return result('not_paid');
    const sessionId = tx.stripe_session_id;
    const sessionMode = typeof sessionId === 'string' && /^cs_(live|test)_[A-Za-z0-9]+$/.exec(sessionId)?.[1];
    const mode = sessionMode === 'live' || sessionMode === 'test' ? sessionMode : 'unknown';
    if (!sessionId && !tx.stripe_payment_intent) return result('not_linked');
    if ((sessionId && !sessionMode) || (tx.stripe_payment_intent && !/^pi_[A-Za-z0-9]+$/.test(tx.stripe_payment_intent))) return result('needs_review', mode);
    const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
    if (!/^(?:sk|rk)_(?:live|test)_/.test(key)) throw new Error('Provider configuration unavailable');
    const live = /^(?:sk|rk)_live_/.test(key);
    if (sessionMode && (sessionMode === 'live') !== live) return result('different_mode', mode);
    const stripe = new Stripe(key, { apiVersion: '2023-10-16', timeout: 10000, maxNetworkRetries: 1 });
    const amount = Number(tx.amount);
    if (tx.amount == null || tx.amount === '' || !Number.isFinite(amount) || amount < 0 || (tx.currency || 'gbp').toLowerCase() !== 'gbp') return result('needs_review', mode);
    const pence = Math.round(amount * 100);
    const ownedMetadata = (o: any) => o?.metadata?.clientId === client.id && o.metadata.jobId === tx.job_id && o.metadata.paymentType === 'job_payment';
    const consistent = (o: any) => o && o.livemode === live && o.currency === 'gbp' && o.amount === pence;
    let session: any = null, pi: any;
    try {
      if (sessionId) {
        session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent.latest_charge', 'invoice'] });
        if (session.id !== sessionId || session.livemode !== live || session.mode !== 'payment' || session.payment_status !== 'paid' ||
          !ownedMetadata(session) || (session.client_reference_id && session.client_reference_id !== client.id) ||
          session.amount_total !== pence || session.currency !== 'gbp') return result('needs_review', mode);
        pi = session.payment_intent;
      } else pi = await stripe.paymentIntents.retrieve(tx.stripe_payment_intent, { expand: ['latest_charge'] });
      if (typeof pi === 'string') pi = await stripe.paymentIntents.retrieve(pi, { expand: ['latest_charge'] });
      if (!consistent(pi) || pi.status !== 'succeeded' || (tx.stripe_payment_intent && pi.id !== tx.stripe_payment_intent) ||
        (!session && !ownedMetadata(pi)) || (session && idOf(session.customer) !== idOf(pi.customer))) return result('needs_review', mode);
      let charge = pi.latest_charge;
      if (typeof charge === 'string') charge = await stripe.charges.retrieve(charge);
      if (!consistent(charge) || !charge.paid || !charge.captured || charge.status !== 'succeeded' || charge.amount_captured !== pence ||
        idOf(charge.payment_intent) !== pi.id || idOf(charge.customer) !== idOf(pi.customer) ||
        (tx.stripe_charge_id && tx.stripe_charge_id !== charge.id)) return result('needs_review', mode);
      const invoiceId = idOf(session?.invoice) || idOf(charge.invoice);
      if (tx.stripe_invoice_id && tx.stripe_invoice_id !== invoiceId) return result('needs_review', mode);
      let invoice: any = null;
      if (invoiceId) {
        invoice = typeof session?.invoice === 'object' && session.invoice ? session.invoice : await stripe.invoices.retrieve(invoiceId);
        if (invoice.id !== invoiceId || invoice.livemode !== live || invoice.currency !== 'gbp' || invoice.total !== pence ||
          invoice.status !== 'paid' || idOf(invoice.customer) !== idOf(pi.customer) ||
          (idOf(invoice.payment_intent) !== pi.id && idOf(invoice.charge) !== charge.id)) return result('needs_review', mode);
      }
      const receipt = paymentDocumentLink(charge.receipt_url, 'receipt');
      const hosted = paymentDocumentLink(invoice?.hosted_invoice_url, 'invoice');
      const pdf = paymentDocumentLink(invoice?.invoice_pdf, 'invoice');
      if ((charge.receipt_url && !receipt) || (invoice?.hosted_invoice_url && !hosted) || (invoice?.invoice_pdf && !pdf)) return result('needs_review', live ? 'live' : 'test');
      return result(invoiceId ? 'checked' : 'not_issued', live ? 'live' : 'test', receipt, hosted, pdf);
    } catch (e) {
      if (missing(e)) return result('not_found', mode);
      throw e;
    }
  } catch {
    return json(503, { error: 'Payment documents could not be checked. Please try again.' });
  }
});
