import { supabase } from '@/lib/supabase';
import { getBookingPolicy, applyClientPromotion } from '@/lib/booking-policy';

// Single client entry point for posting a job. Desktop and mobile both call the
// create-job Edge Function, which enforces ownership, validation and the plan
// limit; the database trigger trg_enforce_client_job_post_limit makes the limit
// atomic. Never insert into app.jobs directly from a posting screen.

export interface PostJobResult {
  ok: boolean;
  jobId?: string;
  warnings?: string[];
  error?: string;
  code?: string;
  idempotent?: boolean;
}

export interface SubmitClientJobOptions {
  submissionId?: string | null;
  bookingMode?: 'immediate';
}

const ERROR_MESSAGES: Record<string, string> = {
  entitlement_failed: 'We could not verify your subscription plan. Please refresh or contact support.',
  unauthorized: 'Authentication failed. Please refresh the page.',
  usage_check_failed: 'Could not verify job posting limits. Please try again.',
};

export async function submitClientJob(
  formData: Record<string, unknown>,
  clientId: string,
  options: SubmitClientJobOptions = {},
): Promise<PostJobResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { ok: false, code: 'unauthorized', error: 'Authentication expired. Please refresh the page.' };

  let res: Response;
  try {
    res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({
        formData,
        clientId,
        submissionId: options.submissionId || undefined,
        bookingMode: options.bookingMode,
      }),
    });
  } catch {
    return { ok: false, code: 'network', error: 'Network error. Please check your connection and try again.' };
  }

  let result: any = {};
  try { result = await res.json(); } catch { result = {}; }
  if (!res.ok || !result.success || !result.jobId) {
    const details = Array.isArray(result.details) ? result.details.filter((d: unknown) => typeof d === 'string').join('. ') : '';
    const message = result.error === 'limit_reached'
      ? (result.message || 'You have reached your monthly job posting limit. Upgrade to post more jobs.')
      : details || ERROR_MESSAGES[result.error] || result.message || 'Failed to post job.';
    return { ok: false, code: result.error || 'server_error', error: message };
  }
  return { ok: true, jobId: result.jobId, warnings: result.warnings || [], idempotent: Boolean(result.idempotent) };
}

/** Client booking fee for previews: same plan + promotion rules as checkout. */
export async function loadClientBookingFee(userId: string, clientId: string): Promise<{ feePercent: number; feeFixedPence: number }> {
  const policy = await getBookingPolicy(supabase, userId);
  const { data: client, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
  if (error || !client) throw new Error('Unable to verify booking promotion');
  const effective = applyClientPromotion(policy, client);
  return { feePercent: effective.feePercent, feeFixedPence: effective.feeFixedPence };
}
