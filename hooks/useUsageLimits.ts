'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface UsageLimit {
  allowed: boolean;
  reason: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  planSlug: string;
  planName: string;
  periodEnd: string;
  periodStart: string;
}

interface UseUsageLimitsResult {
  guardLimit: UsageLimit | null;
  clientLimit: UsageLimit | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useUsageLimits(userId: string | null): UseUsageLimitsResult {
  const [guardLimit, setGuardLimit] = useState<UsageLimit | null>(null);
  const [clientLimit, setClientLimit] = useState<UsageLimit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLimits = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const [guardRes, clientRes] = await Promise.all([
        supabase.rpc('check_monthly_usage', {
          p_user_id: userId,
          p_feature_key: 'guard_application',
          p_increment: false,
        }),
        supabase.rpc('check_monthly_usage', {
          p_user_id: userId,
          p_feature_key: 'client_job_post',
          p_increment: false,
        }),
      ]);

      if (guardRes.data) setGuardLimit(guardRes.data as UsageLimit);
      if (clientRes.data) setClientLimit(clientRes.data as UsageLimit);
    } catch {
      setError('Failed to load usage limits');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  return { guardLimit, clientLimit, loading, error, refresh: fetchLimits };
}