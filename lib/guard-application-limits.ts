import { SupabaseClient } from '@supabase/supabase-js';

// Usage is always read for the signed-in account (app.get_my_feature_usage uses
// auth.uid()). Browser code never passes an id, so a guards.id can no longer be
// confused with an auth user id, and browser roles cannot read or consume another
// account's allowance. Usage is CONSUMED only on the server, atomically with the
// write it pays for (app.submit_job_application, trg_enforce_client_job_post_limit).

export interface GuardApplicationLimit {
  allowed: boolean;
  reason?: 'limit_reached' | 'plan_verification_failed';
  limit?: number | null;
  used?: number;
  remaining?: number | null;
  planSlug?: string;
  planName?: string;
  periodEnd?: string;
  periodStart?: string;
}

type AnyClient = SupabaseClient<any, any, any, any, any>;

async function readMyUsage(supabase: AnyClient, featureKey: 'guard_application' | 'client_job_post'): Promise<GuardApplicationLimit> {
  try {
    const { data: result, error } = await supabase.rpc('get_my_feature_usage', { p_feature_key: featureKey });
    if (error || !result) return { allowed: false, reason: 'plan_verification_failed' };
    return {
      allowed: result.allowed,
      reason: result.allowed ? undefined : (result.reason === 'no_entitlement' ? 'plan_verification_failed' : 'limit_reached'),
      limit: result.limit,
      used: result.used,
      remaining: result.remaining,
      planSlug: result.plan_slug,
      planName: result.plan_name,
      periodEnd: result.period_end,
      periodStart: result.period_start,
    };
  } catch {
    return { allowed: false, reason: 'plan_verification_failed' };
  }
}

/**
 * Pre-flight check for the signed-in guard. `_guardId` (guards.id) is accepted for
 * call-site compatibility only; the server resolves the account from the session.
 * apply-to-job re-checks and consumes usage atomically, so this is advisory.
 */
export async function checkGuardApplicationLimit(supabase: AnyClient, _guardId?: string | null): Promise<GuardApplicationLimit> {
  return readMyUsage(supabase, 'guard_application');
}

/** Pre-flight check for the signed-in client. `_userId` is accepted for compatibility only. */
export async function checkClientJobLimit(supabase: AnyClient, _userId?: string | null): Promise<GuardApplicationLimit & { reason?: string }> {
  return readMyUsage(supabase, 'client_job_post');
}
