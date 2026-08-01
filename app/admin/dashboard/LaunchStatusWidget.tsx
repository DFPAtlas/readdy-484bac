'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ChecklistItem {
  id: string;
  checked: boolean;
}

export default function LaunchStatusWidget() {
  const [score, setScore] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [checked, setChecked] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('golive-checklist-items');
    if (saved) {
      try {
        const items: ChecklistItem[] = JSON.parse(saved);
        const done = items.filter(i => i.checked).length;
        const all = items.length;
        setTotal(all);
        setChecked(done);
        setScore(all > 0 ? Math.round((done / all) * 100) : 0);
      } catch {
        setScore(0);
      }
    } else {
      setScore(0);
    }
  }, []);

  const getStatus = (pct: number | null) => {
    if (pct === null) return { label: 'Loading...', color: 'bg-slate-500', badge: 'bg-slate-500/10 text-slate-400', icon: 'ri-loader-4-line animate-spin' };
    if (pct === 100) return { label: 'Live', color: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', icon: 'ri-rocket-2-line' };
    if (pct >= 75) return { label: 'Soft Launch Ready', color: 'bg-teal-500', badge: 'bg-teal-500/10 text-teal-400 border border-teal-500/20', icon: 'ri-rocket-line' };
    if (pct >= 50) return { label: 'UAT Ready', color: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', icon: 'ri-flask-line' };
    return { label: 'Not Ready', color: 'bg-slate-500', badge: 'bg-slate-500/10 text-slate-400 border border-slate-500/20', icon: 'ri-tools-line' };
  };

  const status = getStatus(score);
  const pct = score ?? 0;

  return (
    <Link
      href="/admin/go-live-checklist"
      className="block bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5 hover:border-teal-500/30 transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
            <i className={`${status.icon} text-lg`}></i>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Launch Status</h3>
            <p className="text-[11px] text-slate-500 font-medium">Go-live readiness</p>
          </div>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${status.badge}`}>
          {status.label}
        </span>
      </div>

      <div className="flex items-end justify-between mb-2">
        <span className="text-3xl font-extrabold text-white">{pct}%</span>
        <span className="text-xs text-slate-500 font-medium">{checked}/{total} items</span>
      </div>

      <div className="h-2 bg-[#0a1628] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${status.color}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {[
            { threshold: 100, color: 'bg-emerald-500', label: 'Live' },
            { threshold: 75, color: 'bg-teal-500', label: 'Soft' },
            { threshold: 50, color: 'bg-amber-500', label: 'UAT' },
          ].map(level => (
            <div key={level.label} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${pct >= level.threshold ? level.color : 'bg-[#1a2b4a]'}`}></div>
              <span className={`text-[10px] font-medium ${pct >= level.threshold ? 'text-slate-300' : 'text-slate-600'}`}>
                {level.label}
              </span>
            </div>
          ))}
        </div>
        <span className="text-[11px] text-teal-400 font-medium group-hover:underline whitespace-nowrap">
          View Checklist
        </span>
      </div>
    </Link>
  );
}