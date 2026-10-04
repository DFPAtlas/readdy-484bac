import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const LOG_PREFIX = '[ApproveJobCompletion]';

const CORS_ORIGINS = [
  'https://quickguard.uk',
  'https://www.quickguard.uk',
];

function getAllowedOrigin(origin: string | null): string {
  if (origin && CORS_ORIGINS.includes(origin)) return origin;
  return 'https://quickguard.uk';
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(origin),
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

function corsResponse(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } });
}

function safeLog(...args: unknown[]) {
  console.error(LOG_PREFIX, ...args);
}

function getAal(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(base64 + pad)).aal || null;
  } catch {
    return null;
  }
}

interface CompletionRequest {
  id: string;
  job_id: string;
  guard_id: string;
  client_id: string;
  status: string;
}
interface ClientRecord { id: string; user_id: string; }
interface AdminRecord { id: string; role: string; is_active: boolean; }
interface GuardRecord { id: string; user_id: string; full_name: string | null; }
interface JobRecord { id: string; client_id: string; job_title: string | null; status: string | null; payment_status: string | null; disputed: boolean | null; }
interface AssignmentRecord { id: string; status: string | null; payment_status: string | null; }

async function optionalWrite(label: string, write: PromiseLike<{error: any}>) {
  try { const result = await write; if (result.error) safeLog(label, result.error.message); }
  catch (error) { safeLog(label, error instanceof Error ? error.message : 'unknown'); }
}

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return corsResponse(origin, 405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return corsResponse(origin, 400, { error: 'Invalid request body' }); }

  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  const disputeReasonRaw = typeof body.disputeReason === 'string' ? body.disputeReason.trim() : '';

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(requestId)) return corsResponse(origin, 400, { error: 'Invalid request ID' });

  const ALLOWED_ACTIONS = ['approve', 'dispute', 'admin_approve'];
  if (!ALLOWED_ACTIONS.includes(action)) return corsResponse(origin, 400, { error: 'Invalid action' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return corsResponse(origin, 401, { error: 'Authentication required' });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return corsResponse(origin, 401, { error: 'Authentication required' });

  const { data: requestRecord, error: reqErr } = await supabase
    .from('job_completion_requests')
    .select('id, job_id, guard_id, client_id, status')
    .eq('id', requestId)
    .maybeSingle();

  if (reqErr) { safeLog('request load error', reqErr.message); return corsResponse(origin, 500, { error: 'Unable to process request' }); }
  if (!requestRecord) return corsResponse(origin, 404, { error: 'Request not found' });

  const request = requestRecord as CompletionRequest;

  const { data: client, error: clientErr } = await supabase
    .from('clients').select('id, user_id').eq('user_id', user.id).maybeSingle();
  if (clientErr) { safeLog('client load error', clientErr.message); return corsResponse(origin, 500, { error: 'Unable to process request' }); }

  const { data: admin, error: adminErr } = await supabase
    .from('admin_users').select('id, role, is_active').eq('user_id', user.id).maybeSingle();
  if (adminErr) { safeLog('admin load error', adminErr.message); return corsResponse(origin, 500, { error: 'Unable to process request' }); }

  const isClient = !!client;
  const isAdmin = !!(admin && admin.is_active);

  const clientActions: string[] = ['approve', 'dispute'];
  const isClientAction = clientActions.includes(action);
  const isAdminAction = action === 'admin_approve';

  if (isAdminAction && !isAdmin) {
    if (isClient) return corsResponse(origin, 403, { error: 'You are not authorised to manage this completion request' });
    return corsResponse(origin, 403, { error: 'Finance administrator access required' });
  }

  if (isClientAction && !isClient) {
    return corsResponse(origin, 403, { error: 'You are not authorised to manage this completion request' });
  }

  if (isClientAction) {
    const clientRec = client as ClientRecord;
    if (request.client_id !== clientRec.id) return corsResponse(origin, 403, { error: 'You are not authorised to manage this completion request' });
  }

  const { data: jobRecord, error: jobErr } = await supabase
    .from('jobs').select('id, client_id, job_title, status, payment_status, disputed').eq('id', request.job_id).maybeSingle();
  if (jobErr) { safeLog('job load error', jobErr.message); return corsResponse(origin, 500, { error: 'Unable to process request' }); }
  if (!jobRecord) return corsResponse(origin, 400, { error: 'Associated job not found' });

  const job = jobRecord as JobRecord;

  if (isClientAction) {
    const clientRec = client as ClientRecord;
    if (job.client_id !== clientRec.id) return corsResponse(origin, 403, { error: 'You are not authorised to manage this completion request' });
  }

  const { data: assignmentRecord, error: assignErr } = await supabase
    .from('job_assignments').select('id, status, payment_status').eq('job_id', request.job_id).eq('guard_id', request.guard_id).maybeSingle();
  if (assignErr) { safeLog('assignment load error', assignErr.message); return corsResponse(origin, 500, { error: 'Unable to process request' }); }
  if (!assignmentRecord) return corsResponse(origin, 404, { error: 'Assignment not found' });

  const assignment = assignmentRecord as AssignmentRecord;

  const { data: guardRecord, error: guardErr } = await supabase
    .from('guards').select('id, user_id, full_name').eq('id', request.guard_id).maybeSingle();
  if (guardErr) { safeLog('guard load error', guardErr.message); return corsResponse(origin, 500, { error: 'Unable to process request' }); }
  if (!guardRecord) return corsResponse(origin, 400, { error: 'Guard not found' });

  const guard = guardRecord as GuardRecord;

  if (isAdminAction) {
    if (getAal(token) !== 'aal2') {
      return corsResponse(origin, 403, { error: 'Multi-factor authentication required' });
    }
    const adminRec = admin as AdminRecord;
    if (!['super_admin', 'finance_admin'].includes(adminRec.role)) {
      return corsResponse(origin, 403, { error: 'Finance administrator access required' });
    }
    if (!adminRec.is_active) {
      return corsResponse(origin, 403, { error: 'Finance administrator access required' });
    }
  }

  const now = new Date().toISOString();
  const guardName = guard.full_name || 'Guard';
  const jobTitle = job.job_title || 'the job';

  if (isClientAction) {
    const {error: decisionError} = await supabase.rpc('record_completion_payment_decision', {
      p_user_id: user.id, p_request_id: requestId, p_action: action,
      p_reason: action === 'dispute' ? disputeReasonRaw || 'No reason provided' : 'Client approved completion',
    });
    if (decisionError) return corsResponse(origin, 409, {error: decisionError.message});
    if (action === 'approve') {
      let payoutInitiated = false;
      let payoutWarning: string | null = null;
      try {
        const payoutRes = await fetch(`${supabaseUrl}/functions/v1/create-guard-payout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            assignmentId: assignment.id,
            jobId: request.job_id,
            internalApprovalSource: 'client_completion_approved',
            approvedByUserId: user.id,
          }),
        });

        if (payoutRes.ok) {
          payoutInitiated = true;
        } else {
          const errText = await payoutRes.text().catch(() => 'unknown');
          safeLog('client-approved payout invocation failed', payoutRes.status, errText.slice(0, 300));
          payoutWarning = 'Completion approved, but payout could not be initiated automatically and requires finance attention.';
          await optionalWrite('client payout failure audit error', supabase.from('payment_audit_logs').insert({
            event_type: 'client_approve_payout_invocation_failed',
            to_status: 'payout_pending', job_id: request.job_id, assignment_id: assignment.id,
            reference_type: 'job_completion_request',
            reference_id: requestId,
            details: {
              assignment_id: assignment.id,
              job_id: request.job_id,
              guard_id: request.guard_id,
              payout_status_code: payoutRes.status,
              error_preview: errText.slice(0, 500),
            },
            changed_by: user.id,
            changed_by_role: 'client',
            created_at: now,
          }));
        }
      } catch (fetchErr: unknown) {
        const errMsg = fetchErr instanceof Error ? fetchErr.message : 'Unknown fetch error';
        safeLog('client-approved payout fetch exception', errMsg);
        payoutWarning = 'Completion approved, but payout service could not be reached and requires finance attention.';
      }

      if (guard.user_id) {
        await optionalWrite('approve notification error', supabase.from('notifications').insert({
          user_id: guard.user_id, user_type: 'guard', title: 'Client Approved',
          message: payoutInitiated
            ? `Client approved — payout initiated for "${jobTitle}".`
            : `Client approved — payout pending for "${jobTitle}".`,
          type: 'success', is_read: false, link: '/guard/dashboard#earnings', data: { job_id: request.job_id }, created_at: now,
        }));
      }

      const response: Record<string, unknown> = {
        success: true,
        message: payoutInitiated ? 'Completion approved — payout initiated' : 'Completion approved — payout pending',
        payoutInitiated,
      };
      if (payoutWarning) response.payoutWarning = payoutWarning;

      return corsResponse(origin, 200, response);
    }

    if (action === 'dispute') {
      const reason = disputeReasonRaw || 'No reason provided';

      if (guard.user_id) {
        await optionalWrite('dispute notification error', supabase.from('notifications').insert({
          user_id: guard.user_id, user_type: 'guard', title: 'Completion Disputed',
          message: `The client has disputed your completion for "${jobTitle}". Reason: ${reason}`,
          type: 'error', is_read: false, link: '/guard/dashboard', data: { job_id: request.job_id }, created_at: now,
        }));
      }

      return corsResponse(origin, 200, { success: true, message: 'Completion disputed' });
    }
  }

  if (isAdminAction) {
    if (request.status !== 'disputed') {
      return corsResponse(origin, 409, { error: 'Completion request has already been processed' });
    }

    const adminRec = admin as AdminRecord;

    const {error: decisionError} = await supabase.rpc('record_completion_payment_decision', {
      p_user_id: user.id, p_request_id: requestId, p_action: 'admin_approve',
      p_reason: 'Admin approved disputed completion',
    });
    if (decisionError) return corsResponse(origin, 409, {error: decisionError.message});

    if (guard.user_id) {
      await optionalWrite('admin notification error', supabase.from('notifications').insert({
        user_id: guard.user_id, user_type: 'guard', title: 'Completion Approved by Admin',
        message: `An admin approved completion for this job. Your payout is now pending.`,
        type: 'success', is_read: false, link: '/guard/dashboard#earnings', data: { job_id: request.job_id }, created_at: now,
      }));
    }

    let payoutSuccess = false;
    let payoutMessage: string | null = null;

    try {
      const payoutRes = await fetch(`${supabaseUrl}/functions/v1/create-guard-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ assignmentId: assignment.id, jobId: request.job_id }),
      });
      if (payoutRes.ok) {
        payoutSuccess = true;
      } else {
        const errText = await payoutRes.text().catch(() => 'unknown');
        safeLog('payout invocation failed', payoutRes.status, errText.slice(0, 300));
        payoutMessage = `Payout initiation returned HTTP ${payoutRes.status}. Completion approved but payout requires finance attention.`;
        await optionalWrite('payout failure audit error', supabase.from('payment_audit_logs').insert({
          event_type: 'admin_approve_payout_invocation_failed', to_status: 'payout_pending', job_id: request.job_id, assignment_id: assignment.id, reference_type: 'job_completion_request', reference_id: requestId,
          details: { assignment_id: assignment.id, job_id: request.job_id, guard_id: request.guard_id, payout_status_code: payoutRes.status, error_preview: errText.slice(0, 500) },
          changed_by: user.id, changed_by_role: adminRec.role, created_at: now,
        }));
      }
    } catch (fetchErr: unknown) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : 'Unknown fetch error';
      safeLog('payout fetch exception', errMsg);
      payoutMessage = 'Unable to reach payout service. Completion approved but payout requires finance attention.';
      await optionalWrite('payout failure audit error', supabase.from('payment_audit_logs').insert({
        event_type: 'admin_approve_payout_invocation_failed', to_status: 'payout_pending', job_id: request.job_id, assignment_id: assignment.id, reference_type: 'job_completion_request', reference_id: requestId,
        details: { assignment_id: assignment.id, job_id: request.job_id, guard_id: request.guard_id, error: errMsg },
        changed_by: user.id, changed_by_role: adminRec.role, created_at: now,
      }));
    }

    const response: Record<string, unknown> = {
      success: true,
      message: 'Completion approved — payout pending',
      payoutInitiated: payoutSuccess,
    };
    if (payoutMessage) response.payoutWarning = payoutMessage;

    return corsResponse(origin, 200, response);
  }

  return corsResponse(origin, 400, { error: 'Invalid action' });
});
