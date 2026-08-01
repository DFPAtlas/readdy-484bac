'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  statusFilter: string;
  severityFilter: string;
  categoryFilter: string;
  search: string;
}

export default function ComplaintsStatsBar({ statusFilter, severityFilter, categoryFilter, search }: Props) {
  const [stats, setStats] = useState({ total: 0, open: 0, underReview: 0, resolved: 0, critical: 0 });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const buildCount = (filters: Record<string, string>) => {
        let q = supabase.from('complaints').select('*', { count: 'exact', head: true });
        Object.entries(filters).forEach(([k, v]) => {
          if (v && v !== 'all') q = q.eq(k, v);
        });
        if (severityFilter !== 'all' && !('severity' in filters)) q = q.eq('severity', severityFilter);
        if (categoryFilter !== 'all' && !('category' in filters)) q = q.eq('category', categoryFilter);
        if (search.trim()) {
          q = q.or(
            `complaint_id.ilike.%${search.trim()}%,category.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`
          );
        }
        return q;
      };

      const [totalR, openR, reviewR, resolvedR, criticalR] = await Promise.all([
        buildCount({}),
        buildCount({ status: 'open' }),
        buildCount({ status: 'under_review' }),
        buildCount({ status: 'resolved' }),
        buildCount({ severity: 'critical' }),
      ]);

      if (cancelled) return;
      setStats({
        total: totalR.count ?? 0,
        open: openR.count ?? 0,
        underReview: reviewR.count ?? 0,
        resolved: resolvedR.count ?? 0,
        critical: criticalR.count ?? 0,
      });
    };
    load();
    return () => { cancelled = true; };
  }, [statusFilter, severityFilter, categoryFilter, search]);

  const items = [
    { label: 'Total', value: stats.total, icon: 'ri-file-list-3-line', color: 'text-slate-300', bg: 'bg-slate-500/10' },
    { label: 'Open', value: stats.open, icon: 'ri-error-warning-line', color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Under Review', value: stats.underReview, icon: 'ri-eye-line', color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Resolved', value: stats.resolved, icon: 'ri-checkbox-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Critical', value: stats.critical, icon: 'ri-alarm-warning-line', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {items.map(s => (
        <div key={s.label} className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5 flex items-center gap-3 hover:border-[#2a3d5c] transition-colors">
          <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${s.bg} flex-shrink-0`}>
            <i className={`${s.icon} text-lg ${s.color}`}></i>
          </div>
          <div>
            <p className="text-2xl font-bold text-white" suppressHydrationWarning>{s.value}</p>
            <p className="text-xs text-slate-400 font-medium">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}