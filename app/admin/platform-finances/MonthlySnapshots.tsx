'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Snapshot {
  id: string;
  snapshot_month: string;
  gross_revenue: number;
  net_revenue: number;
  stripe_fees: number;
  running_costs: number;
  vat_estimate: number;
  estimated_profit: number;
  refunds: number;
  failed_payments: number;
  active_subscriptions: number;
  new_guards: number;
  new_clients: number;
  cancelled_accounts: number;
  trial_accounts: number;
  mrr: number;
  arr: number;
  arpu: number;
  churn_rate: number;
  failed_payment_rate: number;
  created_at: string;
}

interface Props {
  snapshots: Snapshot[];
  loading: boolean;
  onRefresh?: () => void;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPercent(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

export default function MonthlySnapshots({ snapshots, loading, onRefresh }: Props) {
  const [page, setPage] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(snapshots.length / perPage));
  const paged = snapshots.slice((page - 1) * perPage, page * perPage);

  async function handleGenerate() {
    setGenerating(true);
    setGenMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('monthly-finance-snapshot');
      if (error) throw error;
      setGenMessage(data?.message || 'Snapshot generated');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setGenMessage(err.message || 'Failed to generate snapshot');
    } finally {
      setGenerating(false);
      setTimeout(() => setGenMessage(null), 4000);
    }
  }

  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4a] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e2d4a]">
          <div className="w-40 h-4 bg-[#1a2b4a] rounded animate-pulse"></div>
        </div>
        <div className="px-6 py-4">
          <div className="w-full h-48 bg-[#0d1b33] rounded-xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4a] shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e2d4a] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Monthly Snapshots</h3>
          <p className="text-xs text-slate-400 mt-0.5">Historical financial records</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{snapshots.length} records</span>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className={`ri-${generating ? 'loader-4-line animate-spin' : 'flashlight-line'}`}></i>
            </div>
            {generating ? 'Generating...' : 'Generate Snapshot'}
          </button>
        </div>
      </div>
      {genMessage && (
        <div className="px-6 py-2 bg-[#0d1b33] border-b border-[#1e2d4a]">
          <p className="text-xs text-slate-300">{genMessage}</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#0d1b33]">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Month</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Revenue</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Costs</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Profit</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">MRR</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Active</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Churn</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">New Guards</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">New Clients</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2d4a]">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                  No snapshots recorded yet. Data builds automatically over time.
                </td>
              </tr>
            ) : (
              paged.map((s) => (
                <tr key={s.id} className="hover:bg-[#162544]">
                  <td className="px-4 py-3 text-sm font-medium text-white">
                    {new Date(s.snapshot_month).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">{formatCurrency(s.gross_revenue)}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{formatCurrency(s.running_costs)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{formatCurrency(s.estimated_profit)}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{formatCurrency(s.mrr)}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{s.active_subscriptions}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`text-xs font-bold ${s.churn_rate > 0.1 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {formatPercent(s.churn_rate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">{s.new_guards}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{s.new_clients}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-[#1e2d4a] flex items-center justify-between">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm border border-[#1e2d4a] text-slate-400 hover:bg-[#1a2b4a] hover:text-white disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>
          <span className="text-sm text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-sm border border-[#1e2d4a] text-slate-400 hover:bg-[#1a2b4a] hover:text-white disabled:opacity-40 cursor-pointer"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}