'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { checkGuardApplicationLimit, GuardApplicationLimit } from '@/lib/guard-application-limits';

interface Props {
  guardId: string;
  refreshTrigger?: number;
}

export default function GuardUsageWidget({ guardId, refreshTrigger }: Props) {
  const [limitData, setLimitData] = useState<GuardApplicationLimit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLimitData(null);
    const loadUsage = async () => {
      try {
        const result = await checkGuardApplicationLimit(supabase, guardId);
        if (!cancelled) setLimitData(result);
      } catch {
        if (!cancelled) setLimitData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadUsage();
    return () => { cancelled = true; };
  }, [guardId, refreshTrigger]);

  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-[#1a2b4a] rounded w-1/3" />
          <div className="h-3 bg-[#1a2b4a] rounded w-2/3" />
          <div className="h-4 bg-[#1a2b4a] rounded w-full" />
          <div className="h-8 bg-[#1a2b4a] rounded w-full" />
        </div>
      </div>
    );
  }

  if (!limitData || limitData.used === undefined || limitData.limit === undefined || limitData.remaining === undefined || !limitData.planSlug) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm p-6">
        <p className="text-sm text-slate-400">Unable to load usage data.</p>
      </div>
    );
  }

  if (!limitData.allowed || limitData.limit !== null) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-6" role="status">
        <p className="text-sm text-slate-400">Application access could not be confirmed. Please refresh or contact support.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-sm p-6">
      <h3 className="text-base font-bold text-white">Free job applications</h3>
      <p className="mt-2 text-sm text-slate-300">{limitData.used} applications submitted this month.</p>
      <p className="mt-1 text-sm text-teal-400">No monthly application cap or paid job tiers.</p>
      <p className="mt-3 text-xs text-slate-400">Account approval and each job&apos;s licence requirements still apply.</p>
    </div>
  );
}
