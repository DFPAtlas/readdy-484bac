
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
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

function safeLog(...args: unknown[]) {
  console.error(LOG_PREFIX, ...args);
}

interface CompletionRequest {
  id: string;
  job_id: string;
  guard_id: string;
  client_id: string;
  status: string;
}

interface ClientRecord {
  id: string;
  user_id: string;
}

interface AdminRecord {
  id: string;
  role: string;
  is_active: boolean;
}

interface GuardRecord {
  id: string;
  user_id: string;
  full_name: string | null;
}

interface JobRecord {
  id: string;
  client_id: string;
  job_title: string | null;
}

interface AssignmentRecord {
  id: string;
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
  try {
    body = await req.json();
  } catch {
    return corsResponse(origin, 400, { error: 'Invalid request body' });
  }

  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  const disputeReasonRaw = typeof body.disputeReason === 'string' ? body.disputeReason.trim() : '';
  const review = body.review as Record<string, unknown> | undefined;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(requestId)) {
    return corsResponse(origin, 400, { error: 'Invalid request ID' });
  }

  const ALLOWED_ACTIONS = ['approve', 'dispute', 'admin_approve'];
  if (!ALLOWED_ACTIONS.includes(action)) {
    return corsResponse(origin, 400, { error: 'Invalid action' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return corsResponse(origin, 401, { error: 'Authentication required' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return corsResponse(origin, 401, { error: 'Authentication required' });
  }

  const { data: requestRecord, error: reqErr } = await supabase
    .from('job_completion_requests')
    .select('id, job_id, guard_id, client_id, status')
    .eq('id', requestId)
    .maybeSingle();

  if (reqErr) {
    safeLog('request load error', reqErr.message);
    return corsResponse(origin, 500, { error: 'Unable to process request' });
  }

  if (!requestRecord) {
    return corsResponse(origin, 404, { error: 'Request not found' });
  }

  const request = requestRecord as CompletionRequest;

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (clientErr) {
    safeLog('client load error', clientErr.message);
    return corsResponse(origin, 500, { error: 'Unable to process request' });
  }

  const { data: admin, error: adminErr } = await supabase
    .from('admin_users')
    .select('id, role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminErr) {
    safeLog('admin load error', adminErr.message);
    return corsResponse(origin, 500, { error: 'Unable to process request' });
  }

  const isClient = !!client;
  const isAdmin = !!(admin && admin.is_active);

  const clientActions: string[] = ['approve', 'dispute'];
  const isClientAction = clientActions.includes(action);
  const isAdminAction = action === 'admin_approve';

  if (isAdminAction && !isAdmin) {
    if (isClient) {
      return corsResponse(origin, 403, { error: 'You are not authorised to manage this completion request' });
    }
    return corsResponse(origin, 403, { error: 'Finance administrator access required' });
  }

  if (isClientAction && !isClient) {
    return corsResponse(origin, 403, { error: 'You are not authorised to manage this completion request' });
  }

  if (isClientAction) {
    const clientRec = client as ClientRecord;
    if (request.client_id !== clientRec.id) {
      return corsResponse(origin, 403, { error: 'You are not authorised to manage this completion request' });
    }
  }

  const { data: jobRecord, error: jobErr } = await supabase
    .from('jobs')
    .select('id, client_id, job_title')
    .eq('id', request.job_id)
    .maybeSingle();

  if (jobErr) {
    safeLog('job load error', jobErr.message);
    return corsResponse(origin, 500, { error: 'Unable to process request' });
  }

  if (!jobRecord) {
    return corsResponse(origin, 400, { error: 'Associated job not found' });
  }

  const job = jobRecord as JobRecord;

  if (isClientAction) {
    const clientRec = client as ClientRecord;
    if (job.client_id !== clientRec.id) {
      return corsResponse(origin, 403, { error: 'You are not authorised to manage this completion request' });
    }
  }

  const { data: assignmentRecord, error: assignErr } = await supabase
    .from('job_assignments')
    .select('id')
    .eq('job_id', request.job_id)
    .eq('guard_id', request.guard_id)
    .maybeSingle();

  if (assignErr) {
    safeLog('assignment load error', assignErr.message);
    return corsResponse(origin, 500, { error: 'Unable to process request' });
  }

  if (!assignmentRecord) {
    return corsResponse(origin, 404, { error: 'Assignment not found' });
  }

  const assignment = assignmentRecord as AssignmentRecord;

  const { data: guardRecord, error: guardErr } = await supabase
    .from('guards')
    .select('id, user_id, full_name')
    .eq('id', request.guard_id)
    .maybeSingle();

  if (guardErr) {
    safeLog('guard load error', guardErr.message);
    return corsResponse(origin, 500, { error: 'Unable to process request' });
  }

  if (!guardRecord) {
    return corsResponse(origin, 400, { error: 'Guard not found' });
  }

  const guard = guardRecord as GuardRecord;

  if (isAdminAction) {
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
    const expectedPrevStatus = 'pending';

    const { data: updatedReq, error: updateReqErr, count } = await supabase
      .from('job_completion_requests')
      .update(
        action === 'approve'
          ? { status: 'approved', client_approved_at: now, updated_at: now }
          : { status: 'disputed', client_disputed_at: now, dispute_reason: disputeReasonRaw || 'No reason provided', updated_at: now },
      )
      .eq('id', requestId)
      .eq('status', expectedPrevStatus)
      .select('id')
      .maybeSingle();

    if (updateReqErr) {
      safeLog('request update error', updateReqErr.message);
      return corsResponse(origin, 500, { error: 'Unable to process request' });
    }

    if (!updatedReq) {
      return corsResponse(origin, 409, { error: 'Completion request has already been processed' });
    }

    if (action === 'approve') {
      const { error: assignUpdErr } = await supabase
        .from('job_assignments')
        .update({ payment_status: 'client_released', updated_at: now })
        .eq('id', assignment.id);

      if (assignUpdErr) {
        safeLog('assignment update error', assignUpdErr.message);
        return corsResponse(origin, 500, { error: 'Unable to process request' });
      }

      const { error: jobUpdErr } = await supabase
        .from('jobs')
        .update({ completion_status: 'confirmed_by_client', updated_at: now })
        .eq('id', request.job_id);

      if (jobUpdErr) {
        safeLog('job update error', jobUpdErr.message);
      }

      const clientRec = client as ClientRecord;

      await supabase.from('payment_audit_logs').insert({
        event_type: 'client_approved_completion',
        job_id: request.job_id,
        guard_id: request.guard_id,
        client_id: request.client_id,
        from_status: 'pending',
        to_status: 'client_released',
        changed_by: user.id,
        changed_by_role: 'client',
        reason: 'Client approved completion — payout now eligible for finance release',
        created_at: now,
      }).catch((e: unknown) => { safeLog('approve audit log error', e instanceof Error ? e.message : 'unknown'); });

      if (guard.user_id) {
        await supabase.from('notifications').insert({
          user_id: guard.user_id,
          user_type: 'guard',
          title: 'Completion Approved',
          message: `Completion for "${jobTitle}" has been approved. Your payout is now ready for finance release.`,
          type: 'success',
          is_read: false,
          link: '/guard/dashboard#earnings',
          data: { job_id: request.job_id },
          created_at: now,
        }).catch((e: unknown) => { safeLog('approve notification error', e instanceof Error ? e.message : 'unknown'); });
      }

      if (review) {
        const ratingVal = typeof review.rating === 'number' ? Math.round(review.rating) : 0;
        const punctVal = typeof review.punctuality_rating === 'number' ? Math.round(review.punctuality_rating) : 0;
        const profVal = typeof review.professionalism_rating === 'number' ? Math.round(review.professionalism_rating) : 0;
        const commVal = typeof review.communication_rating === 'number' ? Math.round(review.communication_rating) : 0;
        const commentText = typeof review.comment === 'string' ? review.comment.trim().slice(0, 500) : '';

        const validRating = (v: number) => v >= 1 && v <= 5;

        if (validRating(ratingVal) || validRating(punctVal) || validRating(profVal) || validRating(commVal)) {
          const reviewInsert: Record<string, unknown> = {
            job_id: request.job_id,
            guard_id: request.guard_id,
            client_id: request.client_id,
            status: 'published',
            created_at: now,
          };

          if (validRating(ratingVal)) reviewInsert.rating = ratingVal;
          if (validRating(punctVal)) reviewInsert.punctuality = punctVal;
          if (validRating(profVal)) reviewInsert.professionalism = profVal;
          if (validRating(commVal)) reviewInsert.communication = commVal;
          if (commentText) reviewInsert.review_text = commentText;

          const { error: reviewErr } = await supabase.from('reviews').insert(reviewInsert);

          if (reviewErr) {
            if (reviewErr.code === '23505') {
              safeLog('duplicate review prevented', request.job_id, request.client_id);
            } else {
              safeLog('review insert error', reviewErr.message);
            }
          }
        }
      }

      return corsResponse(origin, 200, {
        success: true,
        message: 'Completion approved. Payout is now eligible for finance release.',
      });
    }

    if (action === 'dispute') {
      const reason = disputeReasonRaw || 'No reason provided';

      const { error: assignUpdErr } = await supabase
        .from('job_assignments')
        .update({ payment_status: 'disputed', updated_at: now })
        .eq('id', assignment.id);

      if (assignUpdErr) {
        safeLog('dispute assignment update error', assignUpdErr.message);
        return corsResponse(origin, 500, { error: 'Unable to process request' });
      }

      const { error: jobUpdErr } = await supabase
        .from('jobs')
        .update({
          payment_status: 'disputed',
          disputed: true,
          disputed_at: now,
          disputed_reason: reason,
          updated_at: now,
        })
        .eq('id', request.job_id);

      if (jobUpdErr) {
        safeLog('dispute job update error', jobUpdErr.message);
        return corsResponse(origin, 500, { error: 'Unable to process request' });
      }

      const clientRec = client as ClientRecord;

      await supabase.from('payment_audit_logs').insert({
        event_type: 'client_disputed_completion',
        job_id: request.job_id,
        guard_id: request.guard_id,
        client_id: request.client_id,
        from_status: 'pending',
        to_status: 'disputed',
        changed_by: user.id,
        changed_by_role: 'client',
        reason: reason,
        created_at: now,
      }).catch((e: unknown) => { safeLog('dispute audit log error', e instanceof Error ? e.message : 'unknown'); });

      if (guard.user_id) {
        await supabase.from('notifications').insert({
          user_id: guard.user_id,
          user_type: 'guard',
          title: 'Completion Disputed',
          message: `The client has disputed your completion for "${jobTitle}". Reason: ${reason}`,
          type: 'error',
          is_read: false,
          link: '/guard/dashboard',
          data: { job_id: request.job_id },
          created_at: now,
        }).catch((e: unknown) => { safeLog('dispute notification error', e instanceof Error ? e.message : 'unknown'); });
      }

      return corsResponse(origin, 200, { success: true, message: 'Completion disputed' });
    }
  }

  if (isAdminAction) {
    if (request.status !== 'disputed') {
      return corsResponse(origin, 409, { error: 'Completion request has already been processed' });
    }

    const adminRec = admin as AdminRecord;

    const { data: updatedReq, error: updateReqErr } = await supabase
      .from('job_completion_requests')
      .update({
        status: 'approved',
        admin_approved_at: now,
        admin_approved_by: adminRec.id,
        updated_at: now,
      })
      .eq('id', requestId)
      .eq('status', 'disputed')
      .select('id')
      .maybeSingle();

    if (updateReqErr) {
      safeLog('admin approve request update error', updateReqErr.message);
      return corsResponse(origin, 500, { error: 'Unable to process request' });
    }

    if (!updatedReq) {
      return corsResponse(origin, 409, { error: 'Completion request has already been processed' });
    }

    const { error: assignUpdErr } = await supabase
      .from('job_assignments')
      .update({ payment_status: 'client_released', updated_at: now })
      .eq('id', assignment.id);

    if (assignUpdErr) {
      safeLog('admin assign update error', assignUpdErr.message);
      return corsResponse(origin, 500, { error: 'Unable to process request' });
    }

    const { error: jobUpdErr } = await supabase
      .from('jobs')
      .update({ completion_status: 'confirmed_by_admin', updated_at: now })
      .eq('id', request.job_id);

    if (jobUpdErr) {
      safeLog('admin job update error', jobUpdErr.message);
    }

    await supabase.from('payment_audit_logs').insert({
      event_type: 'admin_approved_completion',
      job_id: request.job_id,
      guard_id: request.guard_id,
      client_id: request.client_id,
      from_status: 'disputed',
      to_status: 'client_released',
      changed_by: user.id,
      changed_by_role: adminRec.role,
      reason: 'Admin approved disputed completion and released payment',
      created_at: now,
    }).catch((e: unknown) => { safeLog('admin audit log error', e instanceof Error ? e.message : 'unknown'); });

    if (guard.user_id) {
      await supabase.from('notifications').insert({
        user_id: guard.user_id,
        user_type: 'guard',
        title: 'Payment Released by Admin',
        message: `An admin has approved completion for "${jobTitle}" and payment has been released.`,
        type: 'success',
        is_read: false,
        link: '/guard/dashboard#earnings',
        data: { job_id: request.job_id },
        created_at: now,
      }).catch((e: unknown) => { safeLog('admin notification error', e instanceof Error ? e.message : 'unknown'); });
    }

    let payoutSuccess = false;
    let payoutMessage: string | null = null;

    try {
      const payoutRes = await fetch(`${supabaseUrl}/functions/v1/create-guard-payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          assignmentId: assignment.id,
          jobId: request.job_id,
        }),
      });

      if (payoutRes.ok) {
        payoutSuccess = true;
      } else {
        const errText = await payoutRes.text().catch(() => 'unknown');
        safeLog('payout invocation failed', payoutRes.status, errText.slice(0, 300));
        payoutMessage = `Payout initiation returned HTTP ${payoutRes.status}. Completion approved but payout requires finance attention.`;

        await supabase.from('payment_audit_logs').insert({
          event_type: 'admin_approve_payout_invocation_failed',
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
          changed_by_role: adminRec.role,
          created_at: now,
        }).catch((e: unknown) => { safeLog('payout failure audit error', e instanceof Error ? e.message : 'unknown'); });
      }
    } catch (fetchErr: unknown) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : 'Unknown fetch error';
      safeLog('payout fetch exception', errMsg);
      payoutMessage = 'Unable to reach payout service. Completion approved but payout requires finance attention.';

      await supabase.from('payment_audit_logs').insert({
        event_type: 'admin_approve_payout_invocation_failed',
        reference_type: 'job_completion_request',
        reference_id: requestId,
        details: {
          assignment_id: assignment.id,
          job_id: request.job_id,
          guard_id: request.guard_id,
          error: errMsg,
        },
        changed_by: user.id,
        changed_by_role: adminRec.role,
        created_at: now,
      }).catch((e: unknown) => { safeLog('payout failure audit error', e instanceof Error ? e.message : 'unknown'); });
    }

    const response: Record<string, unknown> = {
      success: true,
      message: 'Completion approved and payment released',
      payoutInitiated: payoutSuccess,
    };

    if (payoutMessage) {
      response.payoutWarning = payoutMessage;
    }

    return corsResponse(origin, 200, response);
  }

  return corsResponse(origin, 400, { error: 'Invalid action' });
});
