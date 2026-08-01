import { SupabaseClient } from '@supabase/supabase-js';

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

export async function checkGuardApplicationLimit(
  supabase: SupabaseClient,
  guardId: string
): Promise<GuardApplicationLimit> {
  try {
    const { data: guardData } = await supabase
      .from('guards')
      .select('user_id')
      .eq('id', guardId)
      .maybeSingle();

    if (!guardData) {
      return { allowed: false, reason: 'plan_verification_failed' };
    }

    const { data: result, error } = await supabase.rpc('check_monthly_usage', {
      p_user_id: guardData.user_id,
      p_feature_key: 'guard_application',
      p_increment: false,
    });

    if (error || !result) {
      return { allowed: false, reason: 'plan_verification_failed' };
    }

    return {
      allowed: result.allowed,
      reason: result.allowed ? undefined : 'limit_reached',
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

export async function recordGuardApplication(
  supabase: SupabaseClient,
  userId: string
): Promise<GuardApplicationLimit> {
  try {
    const { data: result, error } = await supabase.rpc('check_monthly_usage', {
      p_user_id: userId,
      p_feature_key: 'guard_application',
      p_increment: true,
    });

    if (error || !result) {
      return { allowed: false, reason: 'plan_verification_failed' };
    }

    return {
      allowed: result.allowed,
      reason: result.allowed ? undefined : 'limit_reached',
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

export async function checkClientJobLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  allowed: boolean;
  reason?: string;
  limit?: number | null;
  used?: number;
  remaining?: number | null;
  planSlug?: string;
  planName?: string;
  periodEnd?: string;
  periodStart?: string;
}> {
  try {
    const { data: result, error } = await supabase.rpc('check_monthly_usage', {
      p_user_id: userId,
      p_feature_key: 'client_job_post',
      p_increment: false,
    });

    if (error || !result) {
      return { allowed: false, reason: 'plan_verification_failed' };
    }

    return {
      allowed: result.allowed,
      reason: result.allowed ? undefined : 'limit_reached',
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

export async function recordClientJobPost(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  allowed: boolean;
  reason?: string;
  limit?: number | null;
  used?: number;
  remaining?: number | null;
  planSlug?: string;
  planName?: string;
  periodEnd?: string;
  periodStart?: string;
}> {
  try {
    const { data: result, error } = await supabase.rpc('check_monthly_usage', {
      p_user_id: userId,
      p_feature_key: 'client_job_post',
      p_increment: true,
    });

    if (error || !result) {
      return { allowed: false, reason: 'plan_verification_failed' };
    }

    return {
      allowed: result.allowed,
      reason: result.allowed ? undefined : 'limit_reached',
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