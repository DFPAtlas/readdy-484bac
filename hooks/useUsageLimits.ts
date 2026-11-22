'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

function parseUsageLimit(value: unknown): UsageLimit {
  if (!value || typeof value !== 'object') throw new Error('Invalid usage response');
  const row = value as Record<string, unknown>;
  const count = (item: unknown) => typeof item === 'number' && Number.isSafeInteger(item) && item >= 0;
  if (typeof row.allowed !== 'boolean' || typeof row.reason !== 'string' || !count(row.used)
    || !(row.limit === null || count(row.limit)) || !(row.remaining === null || count(row.remaining))) {
    throw new Error('Invalid usage response');
  }
  return {
    allowed: row.allowed, reason: row.reason, used: Number(row.used),
    limit: row.limit === null ? null : Number(row.limit),
    remaining: row.remaining === null ? null : Number(row.remaining),
    planSlug: typeof row.plan_slug === 'string' ? row.plan_slug : '',
    planName: typeof row.plan_name === 'string' ? row.plan_name : '',
    periodStart: typeof row.period_start === 'string' ? row.period_start : '',
    periodEnd: typeof row.period_end === 'string' ? row.period_end : '',
  };
}

export function useUsageLimits(userId: string | null): UseUsageLimitsResult {
  const [guardLimit, setGuardLimit] = useState<UsageLimit | null>(null);
  const [clientLimit, setClientLimit] = useState<UsageLimit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataOwner, setDataOwner] = useState<string | null>(null);
  const requestEpoch = useRef(0);
  const retireRequests = useCallback(() => { ++requestEpoch.current; }, []);

  const fetchLimits = useCallback(async () => {
    const epoch = ++requestEpoch.current;
    setGuardLimit(null);
    setClientLimit(null);
    if (!userId) { setLoading(false); setError(null); return; }
    setLoading(true);
    setError(null);
    try {
      const before = await supabase.auth.getSession();
      if (epoch !== requestEpoch.current) return;
      if (before.error || !before.data.session?.access_token || before.data.session.user.id !== userId) {
        throw new Error('Account changed');
      }

      const [guardRes, clientRes] = await Promise.all([
        // Signed-in account only (auth.uid()); userId just gates loading.
        supabase.rpc('get_my_feature_usage', { p_feature_key: 'guard_application' }),
        supabase.rpc('get_my_feature_usage', { p_feature_key: 'client_job_post' }),
      ]);

      const after = await supabase.auth.getSession();
      if (epoch !== requestEpoch.current) return;
      if (after.error || !after.data.session?.access_token || after.data.session.user.id !== userId) {
        throw new Error('Account changed');
      }
      if (guardRes.error || clientRes.error) throw new Error('Usage unavailable');
      const guardUsage = parseUsageLimit(guardRes.data);
      const clientUsage = parseUsageLimit(clientRes.data);
      setGuardLimit(guardUsage);
      setClientLimit(clientUsage);
      setDataOwner(userId);
    } catch {
      if (epoch === requestEpoch.current) setError('Failed to load usage limits');
    } finally {
      if (epoch === requestEpoch.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchLimits();
    return retireRequests;
  }, [fetchLimits, retireRequests]);

  return { guardLimit: dataOwner === userId ? guardLimit : null,
    clientLimit: dataOwner === userId ? clientLimit : null, loading, error, refresh: fetchLimits };
}
