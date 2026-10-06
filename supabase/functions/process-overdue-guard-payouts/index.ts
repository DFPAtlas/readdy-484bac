import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const MAX_CANDIDATES = 100;
const PAYOUT_SOURCE = 'automatic_completion_timeout';

type DecisionResult = {
  eligible?: boolean;
  requestId?: string;
};

type ClaimResult = {
  claimed?: boolean;
  requestId?: string;
  assignmentId?: string;
  jobId?: string;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : 'Unknown error';
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const workerToken = req.headers.get('x-qg-payout-worker-token') || '';

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: 'Payout worker configuration is incomplete' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, { db: { schema: 'app' } });
  const { data: tokenValid, error: tokenError } = await db.rpc('validate_payout_worker_token', {
    p_token: workerToken,
  });

  if (tokenError) {
    console.error('[OverduePayoutWorker] Worker-token validation failed');
    return json(500, { error: 'Worker authentication could not be verified' });
  }
  if (tokenValid !== true) return json(401, { error: 'Unauthorized' });

  const summary = {
    scanned: 0,
    autoApproved: 0,
    claimed: 0,
    payoutInitiated: 0,
    payoutAlreadyComplete: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    // The database RPC rechecks funding, disputes and the frozen timeout while
    // holding the same rows used by manual client approval.
    const { data: pendingRequests, error: pendingError } = await db
      .rpc('list_overdue_completion_payment_requests', { p_limit: MAX_CANDIDATES });

    if (pendingError) throw new Error('Unable to load pending completion requests');

    for (const pending of pendingRequests || []) {
      summary.scanned++;
      const { data, error } = await db.rpc('record_overdue_completion_payment_decision', {
        p_request_id: pending.requestId,
      });
      if (error) {
        summary.failed++;
        console.error('[OverduePayoutWorker] Auto-approval decision failed', pending.requestId);
        continue;
      }
      const decision = data as DecisionResult | null;
      if (decision?.eligible) summary.autoApproved++;
      else summary.skipped++;
    }

    // Include prior automatic approvals whose first payout call failed or whose
    // worker invocation stopped after the database decision committed.
    const { data: payoutRequests, error: payoutRequestError } = await db
      .from('job_completion_requests')
      .select('id')
      .eq('status', 'approved')
      .not('auto_approved_at', 'is', null)
      .is('auto_payout_completed_at', null)
      .order('auto_approved_at', { ascending: true })
      .limit(MAX_CANDIDATES);

    if (payoutRequestError) throw new Error('Unable to load automatic payout requests');

    for (const payoutRequest of payoutRequests || []) {
      const { data, error } = await db.rpc('claim_auto_payout_attempt', {
        p_request_id: payoutRequest.id,
      });

      if (error) {
        summary.failed++;
        console.error('[OverduePayoutWorker] Payout claim failed', payoutRequest.id);
        continue;
      }

      const claim = data as ClaimResult | null;
      if (!claim?.claimed || !claim.assignmentId || !claim.jobId || !claim.requestId) {
        summary.skipped++;
        continue;
      }

      summary.claimed++;

      let payoutResponse: Response;
      let payoutBody: Record<string, unknown> = {};
      try {
        payoutResponse = await fetch(`${supabaseUrl}/functions/v1/create-guard-payout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
          },
          body: JSON.stringify({
            assignmentId: claim.assignmentId,
            jobId: claim.jobId,
            internalApprovalSource: PAYOUT_SOURCE,
          }),
        });
        payoutBody = await payoutResponse.json().catch(() => ({}));
      } catch (error) {
        summary.failed++;
        await db.from('payment_audit_logs').insert({
          job_id: claim.jobId,
          assignment_id: claim.assignmentId,
          to_status: 'payout_pending',
          event_type: 'automatic_payout_invocation_failed',
          reference_type: 'job_completion_request',
          reference_id: claim.requestId,
          details: { error: safeError(error), retry_scheduled: true },
          created_at: new Date().toISOString(),
        }).then(() => undefined, () => undefined);
        continue;
      }

      const alreadyComplete = payoutResponse.status === 409
        && payoutBody.error === 'Payout already completed';

      if (payoutResponse.ok || alreadyComplete) {
        const { error: completionError } = await db
          .from('job_completion_requests')
          .update({
            auto_payout_completed_at: new Date().toISOString(),
            auto_payout_next_attempt_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', claim.requestId)
          .not('auto_approved_at', 'is', null);

        if (completionError) {
          summary.failed++;
          console.error('[OverduePayoutWorker] Payout completion marker failed', claim.requestId);
        } else if (alreadyComplete) {
          summary.payoutAlreadyComplete++;
        } else {
          summary.payoutInitiated++;
        }
        continue;
      }

      summary.failed++;
      await db.from('payment_audit_logs').insert({
        job_id: claim.jobId,
        assignment_id: claim.assignmentId,
        to_status: 'payout_pending',
        event_type: 'automatic_payout_attempt_failed',
        reference_type: 'job_completion_request',
        reference_id: claim.requestId,
        details: {
          payout_status_code: payoutResponse.status,
          error: typeof payoutBody.error === 'string' ? payoutBody.error.slice(0, 300) : 'Payout request failed',
          retry_scheduled: true,
        },
        created_at: new Date().toISOString(),
      }).then(() => undefined, () => undefined);
    }

    return json(200, { success: true, ...summary });
  } catch (error) {
    console.error('[OverduePayoutWorker]', safeError(error));
    return json(500, { error: 'Overdue payout processing failed', ...summary });
  }
});
