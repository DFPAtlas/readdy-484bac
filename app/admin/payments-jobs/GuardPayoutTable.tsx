'use client';

import { useState, useMemo } from 'react';
import { useAdminPaymentCentre } from '@/hooks/useAdminPaymentCentre';

export default function GuardPayoutTable() {
  const { guardPayouts, loading, exportGuardPayoutsCsv } = useAdminPaymentCentre();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    let rows = guardPayouts;
    if (statusFilter !== 'all') {
      rows = rows.filter(g => g.stripeAccountStatus === statusFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(g =>
        g.guardName.toLowerCase().includes(q) ||
        g.guardEmail.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [guardPayouts, statusFilter, searchTerm]);

  const counts = useMemo(() => ({
    all: guardPayouts.length,
    ready: guardPayouts.filter(g => g.stripeAccountStatus === 'ready').length,
    pending: guardPayouts.filter(g => g.stripeAccountStatus === 'pending').length,
    restricted: guardPayouts.filter(g => g.stripeAccountStatus === 'restricted').length,
    not_started: guardPayouts.filter(g => g.stripeAccountStatus === 'not_started' || !g.stripeAccountStatus).length,
  }), [guardPayouts]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      ready: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
      pending: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
      restricted: 'bg-red-500/10 text-red-400 ring-red-500/20',
      not_started: 'bg-slate-500/10 text-slate-400 ring-slate-500/20',
    };
    return map[status] || 'bg-slate-500/10 text-slate-400 ring-slate-500/20';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-white">Guard Payout Status</h3>
          <p className="text-sm text-slate-400">Stripe Express account status and payout readiness per guard</p>
        </div>
        <button onClick={exportGuardPayoutsCsv}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-500/10 text-teal-400 text-sm font-medium hover:bg-teal-500/20 transition-all whitespace-nowrap cursor-pointer">
          <div className="w-4 h-4 flex items-center justify-center"><i className="ri-download-line text-sm"></i></div>
          Export CSV
        </button>
      </div>

      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'ready', label: 'Ready', count: counts.ready },
          { key: 'pending', label: 'Pending', count: counts.pending },
          { key: 'restricted', label: 'Restricted', count: counts.restricted },
          { key: 'not_started', label: 'Not Started', count: counts.not_started },
        ].map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === f.key
                ? 'bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/20'
                : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
            }`}>
            {f.label} <span className="ml-1 opacity-60">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <div className="w-5 h-5 flex items-center justify-center absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          <i className="ri-search-line text-lg"></i>
        </div>
        <input
          type="text" placeholder="Search guard name or email..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#1e3048] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-medium text-slate-200 placeholder:text-slate-500 bg-[#1a2b4a]/50 transition-all"
        />
      </div>

      {loading ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-12 text-center">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-400">Loading guard payout data...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-12 text-center">
          <p className="text-sm text-slate-400">No guard payout data found</p>
        </div>
      ) : (
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1a2b4a] border-b border-[#1e3048]">
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Guard</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Stripe Status</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Payouts Enabled</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Req. Due</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-400 text-xs uppercase tracking-wider">Pending Payout</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-400 text-xs uppercase tracking-wider">Paid Out</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Last Sync</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-400 text-xs uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g.id} className="border-b border-[#1a2b4a]/50 hover:bg-[#1a2b4a]/50 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{g.guardName}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{g.guardEmail}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${statusBadge(g.stripeAccountStatus)}`}>
                        {g.stripeAccountStatus === 'ready' ? 'Ready' :
                         g.stripeAccountStatus === 'pending' ? 'Pending' :
                         g.stripeAccountStatus === 'restricted' ? 'Restricted' :
                         'Not Started'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        g.payoutsEnabled
                          ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20'
                      }`}>
                        <div className="w-2.5 h-2.5 flex items-center justify-center">
                          <i className={`${g.payoutsEnabled ? 'ri-check-line' : 'ri-close-line'} text-[8px]`}></i>
                        </div>
                        {g.payoutsEnabled ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${g.requirementsDueCount > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                        {g.requirementsDueCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-bold">
                      £{g.pendingPayoutAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                      £{g.paidOutAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {g.lastStripeSync
                        ? new Date(g.lastStripeSync).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {g.actionRequired ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
                          <div className="w-2.5 h-2.5 flex items-center justify-center"><i className="ri-error-warning-line text-[8px]"></i></div>
                          Action Required
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[#1a2b4a] text-xs text-slate-500 font-medium">
            {filtered.length} guard{filtered.length !== 1 ? 's' : ''} shown
          </div>
        </div>
      )}
    </div>
  );
}