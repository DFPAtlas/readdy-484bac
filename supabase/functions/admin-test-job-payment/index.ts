import { paymentFreezeResponse } from '../_shared/payment-freeze.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function isTestKey(key: string): boolean {
  return key.startsWith('sk_test_');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const paymentFreeze = await paymentFreezeResponse(req.method, corsHeaders);
  if (paymentFreeze) return paymentFreeze;
  if (req.method !== 'POST') return json(405, { success: false, error: 'Method not allowed' });

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!stripeSecretKey || !supabaseUrl || !serviceKey || !anonKey) {
    return json(500, { success: false, error: 'Server configuration error' });
  }

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json(401, { success: false, error: 'Authentication required' });
  const token = authHeader.replace('Bearer ', '');

  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: userError } = await authClient.auth.getUser(token);
  if (userError || !user) return json(401, { success: false, error: 'Invalid or expired token' });

  const db = createClient(supabaseUrl, serviceKey, { db: { schema: 'app' } });
  const { data: admin } = await db.from('admin_users').select('id, role, is_active').eq('user_id', user.id).maybeSingle();
  if (!admin?.is_active || !['super_admin', 'finance_admin'].includes(admin.role)) {
    return json(403, { success: false, error: 'Finance admin access required' });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const isTest = isTestKey(stripeSecretKey);
  const body = await req.json();
  const action = body.action;
  const now = new Date().toISOString();

  const audit = async (event_type: string, reference_type: string, reference_id: string, details: Record<string, unknown>) => {
    await db.from('payment_audit_logs').insert({ event_type, reference_type, reference_id, changed_by: user.id, changed_by_role: admin.role, details, created_at: now });
  };

  if (action === 'check_mode') {
    return json(200, { success: true, mode: isTest ? 'test' : 'live', isTestMode: isTest, isLiveMode: !isTest });
  }

  if (!isTest) return json(400, { success: false, error: 'LIVE_MODE_BLOCKED' });

  if (action === 'get_status_snapshot') {
    const { jobId, assignmentId } = body;
    if (!jobId) return json(400, { success: false, error: 'jobId is required' });
    const [{ data: job }, { data: assignment }, { data: tx }, { data: completion }, { data: payout }] = await Promise.all([
      db.from('jobs').select('*').eq('id', jobId).maybeSingle(),
      assignmentId ? db.from('job_assignments').select('*').eq('id', assignmentId).maybeSingle() : Promise.resolve({ data: null }),
      db.from('transactions').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('job_completion_requests').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      assignmentId ? db.from('guard_payouts').select('*').eq('assignment_id', assignmentId).order('created_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    return json(200, { success: true, data: { job, assignment, transaction: tx, completionRequest: completion, payout } });
  }

  if (action === 'create_checkout') {
    const { jobId, clientId, assignmentId } = body;
    if (!jobId || !clientId || !assignmentId) return json(400, { success: false, error: 'jobId, clientId and assignmentId are required' });

    const { data: job } = await db.from('jobs').select('id, job_title, client_id, status').eq('id', jobId).maybeSingle();
    const { data: assignment } = await db.from('job_assignments').select('id, job_id, status, payment_status, client_total_amount, gross_guard_amount').eq('id', assignmentId).eq('job_id', jobId).maybeSingle();
    const { data: client } = await db.from('clients').select('id, email, stripe_customer_id').eq('id', clientId).maybeSingle();
    if (!job || !assignment || !client) return json(404, { success: false, error: 'Test job, assignment or client not found' });
    if (job.client_id !== clientId) return json(403, { success: false, error: 'Client does not own this job' });
    if (!['selected', 'awaiting_payment'].includes(assignment.status)) return json(409, { success: false, error: 'Assignment is not awaiting payment' });

    const amount = Number(assignment.client_total_amount || assignment.gross_guard_amount || 0);
    if (!(amount > 0)) return json(400, { success: false, error: 'Assignment has no valid amount' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'gbp', product_data: { name: `[TEST] Security Job: ${job.job_title}` }, unit_amount: Math.round(amount * 100) }, quantity: 1 }],
      success_url: 'https://quickguard.uk/admin/payment-management?test_checkout=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://quickguard.uk/admin/payment-management?test_checkout=cancelled',
      client_reference_id: clientId,
      metadata: { jobId, clientId, assignmentId, paymentType: 'job_payment', adminTest: 'true' },
      ...(client.stripe_customer_id ? { customer: client.stripe_customer_id } : { customer_email: client.email }),
    }, { idempotencyKey: `admin-test-job-payment:${assignmentId}:v2` });

    await db.from('transactions').insert({
      job_id: jobId,
      client_id: clientId,
      assignment_id: assignmentId,
      amount,
      transaction_type: 'job_payment',
      payment_method: 'stripe',
      status: 'pending',
      stripe_session_id: session.id,
      description: `[TEST] Admin job payment for ${job.job_title}`,
      metadata: { admin_test: true, assignment_id: assignmentId },
      created_at: now,
      updated_at: now,
    });

    await db.from('job_assignments').update({ status: 'awaiting_payment', payment_status: 'processing', updated_at: now }).eq('id', assignmentId);
    await db.from('jobs').update({ status: 'awaiting_payment', payment_status: 'processing', stripe_session_id: session.id, updated_at: now }).eq('id', jobId);
    await audit('admin_test_checkout_created', 'job_assignment', assignmentId, { job_id: jobId, client_id: clientId, stripe_session_id: session.id, amount });

    return json(200, { success: true, action: 'create_checkout', data: { sessionId: session.id, url: session.url, amount } });
  }

  if (action === 'simulate_funded') {
    const { jobId, assignmentId, sessionId } = body;
    if (!jobId || !assignmentId) return json(400, { success: false, error: 'jobId and assignmentId are required' });
    const fakePi = `pi_test_admin_${Date.now()}`;
    if (sessionId) {
      await db.from('transactions').update({ status: 'completed', payment_status: 'completed', stripe_payment_intent: fakePi, completed_at: now, updated_at: now }).eq('stripe_session_id', sessionId);
    }
    await db.from('job_assignments').update({ payment_status: 'funded', status: 'confirmed', funded_at: now, confirmed_at: now, updated_at: now }).eq('id', assignmentId);
    await db.from('jobs').update({ payment_status: 'funded', status: 'confirmed', stripe_payment_intent_id: fakePi, updated_at: now }).eq('id', jobId);
    await audit('admin_test_payment_funded', 'job_assignment', assignmentId, { job_id: jobId, fake_payment_intent: fakePi, session_id: sessionId || null });
    return json(200, { success: true, action: 'simulate_funded', data: { fakePaymentIntent: fakePi } });
  }

  if (action === 'simulate_completion') {
    const { jobId, assignmentId, guardId, clientId } = body;
    if (!jobId || !assignmentId || !guardId || !clientId) return json(400, { success: false, error: 'jobId, assignmentId, guardId and clientId are required' });
    const { data: assignment } = await db.from('job_assignments').select('status, payment_status').eq('id', assignmentId).maybeSingle();
    if (!assignment || assignment.payment_status !== 'funded') return json(409, { success: false, error: 'Assignment must be funded' });

    const { data: existing } = await db.from('job_completion_requests').select('id').eq('job_id', jobId).eq('guard_id', guardId).maybeSingle();
    let requestId = existing?.id || null;
    if (requestId) {
      await db.from('job_completion_requests').update({ status: 'pending', requested_at: now, updated_at: now }).eq('id', requestId);
    } else {
      const { data: inserted } = await db.from('job_completion_requests').insert({ job_id: jobId, guard_id: guardId, client_id: clientId, status: 'pending', requested_at: now, created_at: now, updated_at: now }).select('id').single();
      requestId = inserted.id;
    }
    await db.from('job_assignments').update({ status: 'completed', completed_at: now, updated_at: now }).eq('id', assignmentId);
    await db.from('jobs').update({ status: 'awaiting_client_approval', updated_at: now }).eq('id', jobId);
    await audit('admin_test_completion_requested', 'job_completion_request', requestId!, { job_id: jobId, assignment_id: assignmentId, guard_id: guardId, client_id: clientId });
    return json(200, { success: true, action: 'simulate_completion', data: { completionRequestId: requestId } });
  }

  if (action === 'simulate_client_approval') {
    const { jobId, assignmentId, completionRequestId } = body;
    if (!jobId || !assignmentId || !completionRequestId) return json(400, { success: false, error: 'jobId, assignmentId and completionRequestId are required' });
    await db.from('job_completion_requests').update({ status: 'approved', client_approved_at: now, updated_at: now }).eq('id', completionRequestId).eq('status', 'pending');
    await db.from('job_assignments').update({ payment_status: 'payout_pending', updated_at: now }).eq('id', assignmentId);
    await db.from('jobs').update({ payment_status: 'payout_pending', updated_at: now }).eq('id', jobId);
    await audit('admin_test_client_approved', 'job_assignment', assignmentId, { job_id: jobId, completion_request_id: completionRequestId });
    return json(200, { success: true, action: 'simulate_client_approval' });
  }

  if (action === 'reset_test_flow') {
    const { jobId, assignmentId } = body;
    if (!jobId || !assignmentId) return json(400, { success: false, error: 'jobId and assignmentId are required' });
    await db.from('transactions').update({ status: 'cancelled', updated_at: now }).eq('job_id', jobId).in('status', ['pending', 'processing']);
    await db.from('job_completion_requests').delete().eq('job_id', jobId);
    await db.from('job_assignments').update({ status: 'selected', payment_status: 'pending', funded_at: null, confirmed_at: null, completed_at: null, stripe_transfer_id: null, payout_released: false, payout_released_at: null, updated_at: now }).eq('id', assignmentId);
    await db.from('jobs').update({ status: 'awaiting_payment', payment_status: 'pending', stripe_session_id: null, stripe_payment_intent_id: null, completion_status: null, updated_at: now }).eq('id', jobId);
    await audit('admin_test_flow_reset', 'job_assignment', assignmentId, { job_id: jobId });
    return json(200, { success: true, action: 'reset_test_flow' });
  }

  return json(400, { success: false, error: `Unknown action: ${action}` });
});