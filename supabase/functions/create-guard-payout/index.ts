
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const CORS_ALLOWLIST = [
  'https://quickguard.uk',
  'https://www.quickguard.uk',
];

const IDEMPOTENCY_VERSION = 'v1';

function getAllowedOrigin(origin: string | null): string {
  if (origin && CORS_ALLOWLIST.includes(origin)) return origin;
  return 'https://quickguard.uk';
}

function corsResponse(origin: string | null, status: number, body: unknown) {
  const allowedOrigin = getAllowedOrigin(origin);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

function safeLog(...args: unknown[]) {
  console.error('[CreateGuardPayout]', ...args);
}

interface ValidatedRequest {
  assignmentId: string;
  jobId: string | null;
  adminUserId: string;
  adminRole: string;
  adminEmail: string;
}

interface AssignmentRecord {
  id: string;
  job_id: string;
  guard_id: string;
  status: string;
  payment_status: string | null;
  guard_net_payout: number | null;
  gross_guard_amount: number | null;
  guard_service_fee_amount: number | null;
  platform_fee_amount: number | null;
  client_total_amount: number | null;
  payout_released: boolean | null;
  stripe_transfer_id: string | null;
}

interface GuardRecord {
  id: string;
  stripe_account_id: string | null;
  stripe_account_status: string | null;
  stripe_payouts_enabled: boolean | null;
  stripe_charges_enabled: boolean | null;
  stripe_details_submitted: boolean | null;
  stripe_requirements_due: unknown;
  email: string | null;
  full_name: string | null;
}

interface JobRecord {
  id: string;
  status: string | null;
  completion_status: string | null;
  payment_status: string | null;
  disputed: boolean | null;
  is_deleted: boolean;
  job_title: string | null;
  client_id: string;
}

interface PayoutRecord {
  id: string;
  status: string;
  stripe_transfer_id: string | null;
  idempotency_key: string | null;
}

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': getAllowedOrigin(origin),
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (req.method !== 'POST') {
    return corsResponse(origin, 405, { error: 'Method not allowed' });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
    return corsResponse(origin, 500, { error: 'Unable to process payout' });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  let validated: ValidatedRequest;

  try {
    validated = await authenticateAndValidate(supabase, req);
  } catch (e: unknown) {
    const err = e as { status: number; message: string };
    return corsResponse(origin, err.status, { error: err.message });
  }

  try {
    const assignment = await loadAssignment(supabase, validated.assignmentId, validated.jobId);
    const guard = await loadGuard(supabase, assignment.guard_id);
    const job = await loadJob(supabase, assignment.job_id);

    await validatePayoutEligibility(assignment);
    await validateJobPayment(supabase, job.id, job.client_id);

    const existingPayout = await checkExistingPayout(supabase, validated.assignmentId);

    const { grossPence, feePence, netPence } = derivePayoutAmounts(assignment);

    await verifyStripeConnectAccount(stripe, supabase, guard, validated.assignmentId, job.id, netPence);

    const idempotencyKey = `guard-payout:${validated.assignmentId}:${IDEMPOTENCY_VERSION}`;
    const now = new Date().toISOString();

    let payoutRecord: PayoutRecord;
    let recovered = false;

    if (existingPayout) {
      payoutRecord = existingPayout;
      recovered = true;
      safeLog('recovering processing payout', payoutRecord.id, 'assignment', validated.assignmentId);

      if (existingPayout.stripe_transfer_id) {
        try {
          const existingTransfer = await stripe.transfers.retrieve(existingPayout.stripe_transfer_id);
          safeLog('found existing Stripe transfer', existingTransfer.id);
        } catch {
          safeLog('stored transfer not found in Stripe, will recreate via idempotency');
        }
      }
    } else {
      payoutRecord = await createPayoutRecord(supabase, {
        guardId: guard.id,
        assignmentId: validated.assignmentId,
        jobId: job.id,
        grossAmount: assignment.gross_guard_amount || 0,
        feeDeducted: assignment.guard_service_fee_amount || 0,
        netAmount: assignment.guard_net_payout || 0,
        idempotencyKey,
        adminUserId: validated.adminUserId,
        now,
      });
    }

    const transfer = await createStripeTransfer(stripe, supabase, {
      netAmountPence: netPence,
      destinationAccount: guard.stripe_account_id!,
      jobTitle: job.job_title || 'Job',
      guardName: guard.full_name || guard.id,
      guardId: guard.id,
      jobId: job.id,
      assignmentId: validated.assignmentId,
      idempotencyKey,
      payoutRecordId: payoutRecord.id,
    });

    await completePayout(supabase, {
      assignmentId: validated.assignmentId,
      jobId: job.id,
      payoutRecordId: payoutRecord.id,
      transferId: transfer.id,
      now,
      recovered,
    });

    await logAudit(supabase, {
      adminUserId: validated.adminUserId,
      adminRole: validated.adminRole,
      adminEmail: validated.adminEmail,
      assignmentId: validated.assignmentId,
      jobId: job.id,
      guardId: guard.id,
      netAmountPence: netPence,
      guardStripeAccount: guard.stripe_account_id!,
      transferId: transfer.id,
      idempotencyKey,
      jobTitle: job.job_title || '',
      guardName: guard.full_name || '',
      now,
      recovered,
    });

    let emailSent = false;
    let emailFailureReason: string | null = null;

    if (resendApiKey && guard.email) {
      try {
        const receiptHtml = buildPayoutReceiptHtml({
          guardName: guard.full_name || 'Guard',
          jobTitle: job.job_title || 'Job',
          grossAmount: grossPence / 100,
          feeAmount: feePence / 100,
          netAmount: netPence / 100,
          transferId: transfer.id,
          payoutDate: now,
        });

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'QuickGuard <payments@quickguard.uk>',
            to: [guard.email],
            subject: `Payout Receipt: \u00A3${(netPence / 100).toFixed(2)} for ${job.job_title || 'Job'}`,
            html: receiptHtml,
          }),
        });

        if (resendRes.ok) {
          emailSent = true;
        } else {
          const errText = await resendRes.text().catch(() => 'unknown');
          emailFailureReason = `Resend API responded with ${resendRes.status}`;
          safeLog('receipt email http error', resendRes.status, errText.slice(0, 200));
        }
      } catch (e: unknown) {
        emailFailureReason = e instanceof Error ? e.message : 'Unknown email error';
        safeLog('receipt email exception', emailFailureReason);
      }

      if (!emailSent) {
        await supabase.from('payment_audit_logs').insert({
          event_type: 'payout_receipt_email_failed',
          reference_type: 'guard_payout',
          reference_id: payoutRecord.id,
          details: {
            error: emailFailureReason,
            guard_id: guard.id,
            assignment_id: validated.assignmentId,
            job_id: job.id,
            transfer_id: transfer.id,
          },
          created_at: now,
        }).catch(() => {});
      }
    }

    const netDisplay = (netPence / 100).toFixed(2);
    const guardNameDisplay = guard.full_name || 'guard';
    let message = `Payout of \u00A3${netDisplay} released to ${guardNameDisplay}`;
    if (recovered) message += ' (recovered from processing state)';
    if (!emailSent && resendApiKey && guard.email) message += '. Receipt email could not be sent.';

    return corsResponse(origin, 200, {
      success: true,
      transferId: transfer.id,
      netAmount: netDisplay,
      recovered,
      emailSent,
      emailFailureReason,
      message,
    });
  } catch (e: unknown) {
    const err = e as { status: number; message: string };
    return corsResponse(origin, err.status, { error: err.message });
  }
});

async function authenticateAndValidate(
  supabase: ReturnType<typeof createClient>,
  req: Request,
): Promise<ValidatedRequest> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'Authentication required' };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw { status: 401, message: 'Authentication required' };
  }

  const { data: adminUser, error: adminErr } = await supabase
    .from('admin_users')
    .select('id, role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminErr) {
    safeLog('admin lookup error', adminErr.message);
    throw { status: 500, message: 'Unable to process payout' };
  }

  if (!adminUser || !adminUser.is_active) {
    throw { status: 403, message: 'Finance administrator access required' };
  }

  if (!['super_admin', 'finance_admin'].includes(adminUser.role)) {
    throw { status: 403, message: 'Finance administrator access required' };
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    throw { status: 400, message: 'Invalid request body' };
  }

  const assignmentId = typeof body.assignmentId === 'string' && body.assignmentId.trim()
    ? body.assignmentId.trim()
    : null;

  if (!assignmentId) {
    throw { status: 400, message: 'Assignment ID is required' };
  }

  const jobId = typeof body.jobId === 'string' && body.jobId.trim()
    ? body.jobId.trim()
    : null;

  return {
    assignmentId,
    jobId,
    adminUserId: adminUser.id,
    adminRole: adminUser.role,
    adminEmail: user.email || '',
  };
}

async function loadAssignment(
  supabase: ReturnType<typeof createClient>,
  assignmentId: string,
  jobId: string | null,
): Promise<AssignmentRecord> {
  const { data: assignment, error } = await supabase
    .from('job_assignments')
    .select('*')
    .eq('id', assignmentId)
    .maybeSingle();

  if (error) {
    safeLog('assignment load error', error.message);
    throw { status: 500, message: 'Unable to process payout' };
  }

  if (!assignment) {
    throw { status: 404, message: 'Assignment not found' };
  }

  if (jobId && assignment.job_id !== jobId) {
    throw { status: 400, message: 'Assignment does not belong to the specified job' };
  }

  const cancelledStatuses = ['cancelled', 'rejected', 'declined'];
  if (cancelledStatuses.includes(assignment.status)) {
    throw { status: 400, message: 'Assignment not eligible for payout' };
  }

  if (!assignment.guard_id) {
    throw { status: 400, message: 'Assignment has no guard' };
  }

  return assignment as AssignmentRecord;
}

async function loadGuard(
  supabase: ReturnType<typeof createClient>,
  guardId: string,
): Promise<GuardRecord> {
  const { data: guard, error } = await supabase
    .from('guards')
    .select(`
      id, stripe_account_id, stripe_account_status, stripe_payouts_enabled,
      stripe_charges_enabled, stripe_details_submitted, stripe_requirements_due,
      email, full_name
    `)
    .eq('id', guardId)
    .maybeSingle();

  if (error) {
    safeLog('guard load error', error.message);
    throw { status: 500, message: 'Unable to process payout' };
  }

  if (!guard) {
    throw { status: 400, message: 'Guard not found' };
  }

  return guard as GuardRecord;
}

async function loadJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
): Promise<JobRecord> {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, status, completion_status, payment_status, disputed, is_deleted, job_title, client_id')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    safeLog('job load error', error.message);
    throw { status: 500, message: 'Unable to process payout' };
  }

  if (!job) {
    throw { status: 400, message: 'Job not found' };
  }

  if (job.is_deleted) {
    throw { status: 400, message: 'Assignment not eligible for payout' };
  }

  if (job.status === 'cancelled') {
    throw { status: 400, message: 'Assignment not eligible for payout' };
  }

  const validCompletion = job.completion_status === 'confirmed_by_client'
    || job.completion_status === 'completed';

  if (!validCompletion) {
    throw { status: 400, message: 'Job completion has not been confirmed by the client' };
  }

  if (job.disputed) {
    throw { status: 400, message: 'Payout requires finance review' };
  }

  return job as JobRecord;
}

async function validatePayoutEligibility(assignment: AssignmentRecord): Promise<void> {
  const releaseReadyStatuses = ['client_released'];

  if (!assignment.payment_status) {
    throw { status: 400, message: 'Assignment not eligible for payout' };
  }

  if (releaseReadyStatuses.includes(assignment.payment_status)) {
    return;
  }

  if (assignment.payment_status === 'paid' || assignment.payment_status === 'paid_out' || assignment.payment_status === 'completed') {
    throw { status: 409, message: 'Payout already completed' };
  }

  if (assignment.payment_status === 'payout_processing') {
    throw { status: 409, message: 'Payout currently processing' };
  }

  const rejectedStatuses = [
    'payment_pending',
    'awaiting_client_release',
    'failed',
    'cancelled',
    'refunded',
  ];

  if (rejectedStatuses.includes(assignment.payment_status)) {
    throw { status: 400, message: 'Assignment not eligible for payout' };
  }

  throw { status: 400, message: 'Assignment not eligible for payout' };
}

async function validateJobPayment(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  clientId: string,
): Promise<void> {
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, status, transaction_type')
    .eq('job_id', jobId)
    .eq('client_id', clientId)
    .eq('transaction_type', 'job_payment')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    safeLog('transaction lookup error', error.message);
    throw { status: 500, message: 'Unable to process payout' };
  }

  if (!transactions || transactions.length === 0) {
    throw { status: 400, message: 'Client payment has not been completed for this job' };
  }
}

async function checkExistingPayout(
  supabase: ReturnType<typeof createClient>,
  assignmentId: string,
): Promise<PayoutRecord | null> {
  const { data: existing, error } = await supabase
    .from('guard_payouts')
    .select('id, status, stripe_transfer_id, idempotency_key')
    .eq('assignment_id', assignmentId)
    .in('status', ['completed', 'paid_out', 'processing', 'payout_processing'])
    .maybeSingle();

  if (error) {
    safeLog('existing payout check error', error.message);
    throw { status: 500, message: 'Unable to process payout' };
  }

  if (!existing) {
    return null;
  }

  if (existing.status === 'completed' || existing.status === 'paid_out') {
    throw { status: 409, message: 'Payout already completed' };
  }

  return existing as PayoutRecord;
}

function derivePayoutAmounts(assignment: AssignmentRecord): { grossPence: number; feePence: number; netPence: number } {
  const gross = Number(assignment.gross_guard_amount || 0);
  const fee = Number(assignment.guard_service_fee_amount || 0);
  const net = Number(assignment.guard_net_payout || 0);

  if (!Number.isFinite(gross) || !Number.isFinite(fee) || !Number.isFinite(net)) {
    throw { status: 400, message: 'Payout requires finance review' };
  }

  if (net <= 0) {
    throw { status: 400, message: 'Payout requires finance review' };
  }

  const grossPence = Math.round(gross * 100);
  const feePence = Math.round(fee * 100);
  const netPence = Math.round(net * 100);

  if (!Number.isFinite(grossPence) || !Number.isFinite(feePence) || !Number.isFinite(netPence)) {
    throw { status: 400, message: 'Payout requires finance review' };
  }

  if (netPence <= 0) {
    throw { status: 400, message: 'Payout requires finance review' };
  }

  if (Math.abs(grossPence - feePence - netPence) > 1) {
    throw { status: 409, message: 'Payout requires finance review' };
  }

  return { grossPence, feePence, netPence };
}

async function verifyStripeConnectAccount(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  guard: GuardRecord,
  assignmentId: string,
  jobId: string,
  netAmountPence: number,
): Promise<void> {
  if (!guard.stripe_account_id) {
    await supabase.from('payment_audit_logs').insert({
      event_type: 'payout_blocked_no_stripe_account',
      reference_type: 'guard_payout',
      reference_id: assignmentId,
      details: { guard_id: guard.id, job_id: jobId, net_amount_pence: netAmountPence },
      created_at: new Date().toISOString(),
    }).catch(() => {});

    throw { status: 400, message: 'Guard Stripe account is not ready' };
  }

  if (!guard.stripe_payouts_enabled || !guard.stripe_charges_enabled) {
    await supabase.from('payment_audit_logs').insert({
      event_type: 'payout_blocked_payouts_disabled',
      reference_type: 'guard_payout',
      reference_id: assignmentId,
      details: {
        guard_id: guard.id,
        job_id: jobId,
        stripe_account_status: guard.stripe_account_status,
        stripe_payouts_enabled: guard.stripe_payouts_enabled,
        stripe_charges_enabled: guard.stripe_charges_enabled,
      },
      created_at: new Date().toISOString(),
    }).catch(() => {});

    throw { status: 400, message: 'Guard Stripe account is not ready' };
  }

  if (guard.stripe_account_status !== 'ready') {
    await supabase.from('payment_audit_logs').insert({
      event_type: 'payout_blocked_status_not_ready',
      reference_type: 'guard_payout',
      reference_id: assignmentId,
      details: {
        guard_id: guard.id,
        job_id: jobId,
        stripe_account_status: guard.stripe_account_status,
      },
      created_at: new Date().toISOString(),
    }).catch(() => {});

    throw { status: 400, message: 'Guard Stripe account is not ready' };
  }

  try {
    const account = await stripe.accounts.retrieve(guard.stripe_account_id);

    if (!account.charges_enabled || !account.payouts_enabled) {
      await supabase.from('payment_audit_logs').insert({
        event_type: 'payout_blocked_stripe_verification_failed',
        reference_type: 'guard_payout',
        reference_id: assignmentId,
        details: {
          guard_id: guard.id,
          stripe_account_id: guard.stripe_account_id,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
          requirements_due: account.requirements?.currently_due || [],
        },
        created_at: new Date().toISOString(),
      }).catch(() => {});

      throw { status: 400, message: 'Guard Stripe account is not ready' };
    }
  } catch (e: unknown) {
    if ((e as { status?: number }).status) throw e;

    safeLog('stripe account retrieve failed', typeof e === 'object' && e !== null && 'message' in e ? (e as Error).message : 'unknown');
    throw { status: 500, message: 'Unable to process payout' };
  }
}

async function createPayoutRecord(
  supabase: ReturnType<typeof createClient>,
  params: {
    guardId: string;
    assignmentId: string;
    jobId: string;
    grossAmount: number;
    feeDeducted: number;
    netAmount: number;
    idempotencyKey: string;
    adminUserId: string;
    now: string;
  },
): Promise<PayoutRecord> {
  const { data: record, error } = await supabase
    .from('guard_payouts')
    .insert({
      guard_id: params.guardId,
      assignment_id: params.assignmentId,
      job_id: params.jobId,
      amount: params.grossAmount,
      fee_deducted: params.feeDeducted,
      net_amount: params.netAmount,
      status: 'processing',
      platform_fee: 0,
      idempotency_key: params.idempotencyKey,
      released_by: params.adminUserId,
      released_at: params.now,
      created_at: params.now,
      updated_at: params.now,
    })
    .select('id, status, stripe_transfer_id, idempotency_key')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      throw { status: 409, message: 'Payout already completed' };
    }
    safeLog('payout record insert error', error.message);
    throw { status: 500, message: 'Unable to process payout' };
  }

  if (!record) {
    throw { status: 500, message: 'Unable to process payout' };
  }

  return record as PayoutRecord;
}

async function createStripeTransfer(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  params: {
    netAmountPence: number;
    destinationAccount: string;
    jobTitle: string;
    guardName: string;
    guardId: string;
    jobId: string;
    assignmentId: string;
    idempotencyKey: string;
    payoutRecordId: string;
  },
): Promise<Stripe.Transfer> {
  try {
    const transfer = await stripe.transfers.create({
      amount: params.netAmountPence,
      currency: 'gbp',
      destination: params.destinationAccount,
      description: `QuickGuard payout: ${params.jobTitle} (Guard: ${params.guardName})`,
      metadata: {
        guardId: params.guardId,
        jobId: params.jobId,
        assignmentId: params.assignmentId,
        jobTitle: params.jobTitle,
        netAmountPence: String(params.netAmountPence),
      },
    }, { idempotencyKey: params.idempotencyKey });

    return transfer;
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : 'Unknown Stripe error';

    safeLog('stripe transfer creation failed', errMsg);

    await supabase.from('guard_payouts')
      .update({
        status: 'failed',
        failure_reason: errMsg,
        failure_category: 'stripe_transfer_failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.payoutRecordId)
      .catch(() => {});

    await supabase.from('payment_audit_logs').insert({
      event_type: 'payout_transfer_failed',
      reference_type: 'guard_payout',
      reference_id: params.payoutRecordId,
      details: {
        error: errMsg,
        guard_id: params.guardId,
        job_id: params.jobId,
        assignment_id: params.assignmentId,
        net_amount_pence: params.netAmountPence,
        idempotency_key: params.idempotencyKey,
      },
      created_at: new Date().toISOString(),
    }).catch(() => {});

    throw { status: 500, message: 'Unable to process payout' };
  }
}

async function completePayout(
  supabase: ReturnType<typeof createClient>,
  params: {
    assignmentId: string;
    jobId: string;
    payoutRecordId: string;
    transferId: string;
    now: string;
    recovered: boolean;
  },
): Promise<void> {
  const payoutUpdate: Record<string, unknown> = {
    status: 'completed',
    stripe_transfer_id: params.transferId,
    stripe_transfer_status: 'created',
    completed_date: params.now,
    updated_at: params.now,
  };

  if (params.recovered) {
    payoutUpdate.notes = 'Recovered from processing state via idempotent retry';
  }

  const { error: payoutErr } = await supabase
    .from('guard_payouts')
    .update(payoutUpdate)
    .eq('id', params.payoutRecordId);

  if (payoutErr) {
    safeLog('payout completion update error', payoutErr.message);

    await supabase.from('payment_audit_logs').insert({
      event_type: 'payout_completion_db_failed',
      reference_type: 'guard_payout',
      reference_id: params.payoutRecordId,
      details: {
        error: payoutErr.message,
        transfer_id: params.transferId,
        assignment_id: params.assignmentId,
        job_id: params.jobId,
        recovered: params.recovered,
      },
      created_at: params.now,
    }).catch(() => {});

    await supabase.from('guard_payouts')
      .update({
        status: 'manual_review',
        failure_category: 'post_transfer_db_update_failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.payoutRecordId)
      .catch(() => {});

    throw { status: 500, message: 'Unable to process payout' };
  }

  const { error: assignErr } = await supabase
    .from('job_assignments')
    .update({
      payment_status: 'paid',
      stripe_transfer_id: params.transferId,
      payout_released: true,
      payout_released_at: params.now,
      updated_at: params.now,
    })
    .eq('id', params.assignmentId);

  if (assignErr) {
    safeLog('assignment update error', assignErr.message);

    await supabase.from('payment_audit_logs').insert({
      event_type: 'payout_assignment_update_failed',
      reference_type: 'guard_payout',
      reference_id: params.payoutRecordId,
      details: {
        error: assignErr.message,
        transfer_id: params.transferId,
        assignment_id: params.assignmentId,
        job_id: params.jobId,
        recovered: params.recovered,
      },
      created_at: params.now,
    }).catch(() => {});

    throw { status: 500, message: 'Unable to process payout' };
  }

  const { data: allAssignments, error: allErr } = await supabase
    .from('job_assignments')
    .select('id, status, payment_status')
    .eq('job_id', params.jobId);

  if (allErr) {
    safeLog('job payment status query failed', allErr.message, 'job', params.jobId);

    await supabase.from('payment_audit_logs').insert({
      event_type: 'payout_job_status_query_failed',
      reference_type: 'guard_payout',
      reference_id: params.payoutRecordId,
      details: {
        error: allErr.message,
        transfer_id: params.transferId,
        assignment_id: params.assignmentId,
        job_id: params.jobId,
        recovered: params.recovered,
      },
      created_at: params.now,
    }).catch(() => {});
  } else if (allAssignments && allAssignments.length > 0) {
    const nonPayableStatuses = ['cancelled', 'rejected', 'declined', 'withdrawn'];
    const payableAssignments = allAssignments.filter(
      (a: { status: string | null }) => !!a.status && !nonPayableStatuses.includes(a.status)
    );

    if (payableAssignments.length > 0) {
      const finalPaidStatuses = ['paid', 'paid_out', 'completed'];
      const allPaid = payableAssignments.every(
        (a: { payment_status: string | null }) => a.payment_status && finalPaidStatuses.includes(a.payment_status)
      );

      if (allPaid) {
        const { error: jobErr } = await supabase
          .from('jobs')
          .update({ payment_status: 'paid', updated_at: params.now })
          .eq('id', params.jobId);

        if (jobErr) {
          safeLog('job paid status update error', jobErr.message);

          await supabase.from('payment_audit_logs').insert({
            event_type: 'payout_job_status_update_failed',
            reference_type: 'guard_payout',
            reference_id: params.payoutRecordId,
            details: {
              error: jobErr.message,
              transfer_id: params.transferId,
              assignment_id: params.assignmentId,
              job_id: params.jobId,
              recovered: params.recovered,
            },
            created_at: params.now,
          }).catch(() => {});
        }
      }
    }
  }
}

async function logAudit(
  supabase: ReturnType<typeof createClient>,
  params: {
    adminUserId: string;
    adminRole: string;
    adminEmail: string;
    assignmentId: string;
    jobId: string;
    guardId: string;
    netAmountPence: number;
    guardStripeAccount: string;
    transferId: string;
    idempotencyKey: string;
    jobTitle: string;
    guardName: string;
    now: string;
    recovered: boolean;
  },
): Promise<void> {
  await supabase.from('payment_audit_logs').insert({
    event_type: params.recovered ? 'guard_payout_recovered' : 'guard_payout_completed',
    reference_type: 'guard_payout',
    reference_id: params.assignmentId,
    changed_by: params.adminUserId,
    changed_by_role: params.adminRole,
    details: {
      admin_email: params.adminEmail,
      guard_id: params.guardId,
      guard_name: params.guardName,
      job_id: params.jobId,
      job_title: params.jobTitle,
      net_amount_pence: params.netAmountPence,
      stripe_transfer_id: params.transferId,
      idempotency_key: params.idempotencyKey,
      recovered: params.recovered,
    },
    created_at: params.now,
  }).catch((e: unknown) => {
    safeLog('audit log insert error', e instanceof Error ? e.message : 'unknown');
  });
}

function buildPayoutReceiptHtml(params: {
  guardName: string;
  jobTitle: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  transferId: string;
  payoutDate: string;
}): string {
  const dateStr = new Date(params.payoutDate).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const timeStr = new Date(params.payoutDate).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  });
  const feePercent = params.grossAmount > 0
    ? Math.round((params.feeAmount / params.grossAmount) * 100)
    : 0;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Payout Receipt</title></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#f3f4f6;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><tr><td style="background:linear-gradient(135deg,#10B981 0%,#059669 100%);padding:40px 30px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:28px;font-weight:bold;">QuickGuard</h1><p style="margin:10px 0 0;color:#D1FAE5;font-size:16px;">Payout Receipt</p></td></tr><tr><td style="padding:40px 30px;"><div style="background:linear-gradient(135deg,#ECFDF5 0%,#D1FAE5 100%);border:2px solid #10B981;border-radius:10px;padding:30px;text-align:center;margin-bottom:30px;"><p style="margin:0;color:#047857;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Net Payout</p><p style="margin:10px 0 0;color:#065F46;font-size:42px;font-weight:bold;">\u00A3${params.netAmount.toFixed(2)}</p></div><p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">Hi <strong>${params.guardName}</strong>,</p><p style="margin:0 0 30px;color:#374151;font-size:16px;line-height:1.6;">Your payment for <strong>${params.jobTitle}</strong> has been transferred to your connected account.</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;"><tr><td style="padding:14px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;"><strong style="color:#374151;">Job Title</strong></td><td style="padding:14px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;text-align:right;color:#6B7280;">${params.jobTitle}</td></tr><tr><td style="padding:14px;border-bottom:1px solid #E5E7EB;"><strong style="color:#374151;">Gross Amount</strong></td><td style="padding:14px;border-bottom:1px solid #E5E7EB;text-align:right;color:#6B7280;">\u00A3${params.grossAmount.toFixed(2)}</td></tr><tr><td style="padding:14px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;"><strong style="color:#374151;">Platform Fee (${feePercent}%)</strong></td><td style="padding:14px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;text-align:right;color:#6B7280;">\u00A3${params.feeAmount.toFixed(2)}</td></tr><tr><td style="padding:16px;background:#F0FDF4;"><strong style="color:#065F46;font-size:18px;">Net Payout</strong></td><td style="padding:16px;background:#F0FDF4;text-align:right;"><strong style="color:#10B981;font-size:22px;">\u00A3${params.netAmount.toFixed(2)}</strong></td></tr><tr><td style="padding:14px;border-bottom:1px solid #E5E7EB;"><strong style="color:#374151;">Transfer ID</strong></td><td style="padding:14px;border-bottom:1px solid #E5E7EB;text-align:right;color:#6B7280;font-family:monospace;font-size:12px;">${params.transferId}</td></tr><tr><td style="padding:14px;background:#F9FAFB;"><strong style="color:#374151;">Date &amp; Time</strong></td><td style="padding:14px;background:#F9FAFB;text-align:right;color:#6B7280;">${dateStr} at ${timeStr}</td></tr></table><div style="background:#DBEAFE;border-left:4px solid #2563EB;padding:16px;margin-bottom:30px;border-radius:4px;"><p style="margin:0;color:#1E40AF;font-size:14px;line-height:1.6;"><strong>Payment Timing:</strong> Funds typically arrive in your bank account within 1-3 business days depending on your bank.</p></div><p style="margin:30px 0 0;color:#6B7280;font-size:14px;text-align:center;">Questions? Contact us at <a href="mailto:support@quickguard.uk" style="color:#1a237e;">support@quickguard.uk</a></p></td></tr><tr><td style="background:#111827;padding:20px 30px;text-align:center;"><p style="margin:0;color:#9CA3AF;font-size:12px;">&copy; ${new Date().getFullYear()} QuickGuard. All rights reserved. This is an automated receipt.</p></td></tr></table></td></tr></table></body></html>`;
}
