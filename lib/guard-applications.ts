import { supabase } from '@/lib/supabase';

// Every guard application entry point (job detail, dedicated apply page, saved
// jobs, dashboards and invitation acceptance) submits through apply-to-job, which
// calls app.submit_job_application. Never insert into job_applications directly.

export interface ApplyResult {
  ok: boolean;
  applicationId?: string;
  replayed?: boolean;
  alreadyApplied?: boolean;
  limitReached?: boolean;
  tierLocked?: boolean;
  code?: string;
  error?: string;
  warnings?: string[];
}

export async function submitGuardApplication(params: { guardId: string; jobId: string; coverMessage?: string; inviteId?: string }): Promise<ApplyResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, code: 'unauthorized', error: 'Your session has expired. Please sign in again.' };
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/apply-to-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({ guardId: params.guardId, jobId: params.jobId, coverMessage: params.coverMessage || '', inviteId: params.inviteId }),
    });
    let body: any = {};
    try { body = await res.json(); } catch { body = {}; }
    if (!res.ok || !body.success || !body.applicationId) {
      return {
        ok: false,
        code: body.code || (body.alreadyApplied ? 'already_applied' : 'server_error'),
        alreadyApplied: !!body.alreadyApplied,
        limitReached: !!body.limitReached,
        tierLocked: !!body.tierLocked,
        error: body.error || 'Unable to submit application. Please try again.',
      };
    }
    return { ok: true, applicationId: body.applicationId, replayed: !!body.replayed, warnings: body.warnings || [] };
  } catch {
    return { ok: false, code: 'network', error: 'Network error. Please check your connection and try again.' };
  }
}
