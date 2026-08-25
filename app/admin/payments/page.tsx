'use client';


import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface UnifiedPayment {
  id: string;
  type: 'job' | 'subscription';
  amount: number;
  status: string;
  created_at: string;
  description: string;
  payer: string;
  job_title?: string;
  guard_name?: string;
  client_name?: string;
  gateway?: string;
  metadata?: unknown;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<UnifiedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<UnifiedPayment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [missingCount, setMissingCount] = useState(0);

  useEffect(() => {
    fetchPayments();
    checkMissing();
  }, []);

  const checkMissing = async () => {
    const { data: subs } = await supabase.from('subscriptions').select('id, user_id').not('stripe_subscription_id', 'is', null);
    const { data: pmts } = await supabase.from('subscription_payments').select('user_id');
    if (!subs) return;
    const pmtUserIds = new Set((pmts ?? []).map((p: any) => p.user_id));
    const missing = subs.filter((s: any) => !pmtUserIds.has(s.user_id));
    setMissingCount(missing.length);
  };

  const runBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await fetch('https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/backfill-subscription-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      const backfilled = data.results?.filter((r: any) => r.action === 'backfilled').length || 0;
      showToast(`Backfill complete: ${backfilled} payment(s) created`, 'success');
      await fetchPayments();
      await checkMissing();
    } catch (err: unknown) {
      showToast('Backfill failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setBackfilling(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);

      const [transRes, subRes] = await Promise.all([
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('subscription_payments').select('*').order('created_at', { ascending: false }).limit(200),
      ]);

      const transactions = transRes.data ?? [];
      const subscriptions = subRes.data ?? [];

      const assignmentIds = [...new Set(transactions.map((t: any) => t.assignment_id).filter(Boolean))];
      const transClientIds = [...new Set(transactions.map((t: any) => t.client_id).filter(Boolean))];
      const transGuardIds = [...new Set(transactions.map((t: any) => t.guard_id).filter(Boolean))];
      const subUserIds = [...new Set(subscriptions.map((s: any) => s.user_id).filter(Boolean))];

      const [assignRes, clientsForTransRes, guardsRes, clientsForSubRes] = await Promise.all([
        assignmentIds.length > 0
          ? supabase.from('job_assignments').select('id, jobs(job_title, client_id), guards(full_name)').in('id', assignmentIds)
          : Promise.resolve({ data: [] }),
        transClientIds.length > 0
          ? supabase.from('clients').select('id, company_name').in('id', transClientIds)
          : Promise.resolve({ data: [] }),
        transGuardIds.length > 0
          ? supabase.from('guards').select('id, full_name').in('id', transGuardIds)
          : Promise.resolve({ data: [] }),
        subUserIds.length > 0
          ? supabase.from('clients').select('user_id, company_name, contact_name').in('user_id', subUserIds)
          : Promise.resolve({ data: [] }),
      ]);

      const assignMap = new Map((assignRes.data ?? []).map((a: any) => [a.id, a]));
      const transClientMap = new Map((clientsForTransRes.data ?? []).map((c: any) => [c.id, c]));
      const guardMap = new Map((guardsRes.data ?? []).map((g: any) => [g.id, g]));
      const subClientMap = new Map((clientsForSubRes.data ?? []).map((c: any) => [c.user_id, c]));

      const unified: UnifiedPayment[] = [
        ...transactions.map((t: any) => {
          const assign = t.assignment_id ? assignMap.get(t.assignment_id) : null;
          const job = assign?.jobs;
          const guardFromAssign = assign?.guards;
          const client = t.client_id ? transClientMap.get(t.client_id) : null;
          const guard = t.guard_id ? guardMap.get(t.guard_id) : null;

          return {
            id: t.id,
            type: 'job' as const,
            amount: Number(t.amount) || 0,
            status: t.status,
            created_at: t.created_at,
            description: job?.job_title || 'Job Payment',
            payer: client?.company_name || 'Platform',
            job_title: job?.job_title,
            guard_name: guardFromAssign?.full_name || guard?.full_name,
            client_name: client?.company_name,
            gateway: t.gateway_name || 'Stripe',
            metadata: t,
          };
        }),
        ...subscriptions.map((s: any) => {
          const client = subClientMap.get(s.user_id);
          return {
            id: s.id,
            type: 'subscription' as const,
            amount: Number(s.amount) || 0,
            status: s.status,
            created_at: s.created_at,
            description: s.billing_reason || 'Subscription',
            payer: client?.company_name || client?.contact_name || 'Unknown',
            job_title: null,
            guard_name: null,
            client_name: client?.company_name || client?.contact_name,
            gateway: 'Stripe',
            metadata: s,
          };
        }),
      ];

      unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPayments(unified);
    } catch (error) {
      console.error('Error fetching payments:', error);
      showToast('Failed to load payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'succeeded':
      case 'paid': return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
      case 'pending': return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
      case 'processing': return 'bg-sky-50 text-sky-700 ring-1 ring-sky-100';
      case 'failed': return 'bg-red-50 text-red-700 ring-1 ring-red-100';
      case 'refunded': return 'bg-orange-50 text-orange-700 ring-1 ring-orange-100';
      default: return 'bg-slate-50 text-slate-600 ring-1 ring-slate-100';
    }
  };

  const formatCurrency = (n: number) => '\u00a3' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalVolume = payments.reduce((s, p) => s + p.amount, 0);
  const jobTotal = payments.filter(p => p.type === 'job').reduce((s, p) => s + p.amount, 0);
  const subTotal = payments.filter(p => p.type === 'subscription').reduce((s, p) => s + p.amount, 0);
  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const failedCount = payments.filter(p => p.status === 'failed').length;

  const filteredPayments = payments.filter(p => {
    const matchesFilter = filter === 'all'
      || (filter === 'job' && p.type === 'job')
      || (filter === 'subscription' && p.type === 'subscription')
      || (filter === 'completed' && ['completed', 'succeeded', 'paid'].includes(p.status.toLowerCase()))
      || (filter === 'pending' && p.status.toLowerCase() === 'pending')
      || (filter === 'failed' && p.status.toLowerCase() === 'failed');
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q
      || p.description.toLowerCase().includes(q)
      || p.payer.toLowerCase().includes(q)
      || p.guard_name?.toLowerCase().includes(q)
      || p.client_name?.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const statCards = [
    { label: 'Total Volume', value: formatCurrency(totalVolume), icon: 'ri-money-pound-circle-line', bg: 'bg-teal-100 text-teal-600' },
    { label: 'Job Payments', value: formatCurrency(jobTotal), icon: 'ri-briefcase-line', bg: 'bg-sky-100 text-sky-600' },
    { label: 'Subscriptions', value: formatCurrency(subTotal), icon: 'ri-vip-crown-line', bg: 'bg-indigo-100 text-indigo-600' },
    { label: 'Pending / Failed', value: `${pendingCount} / ${failedCount}`, icon: 'ri-error-warning-line', bg: 'bg-amber-100 text-amber-600' },
  ];

  const filterTabs = [
    { key: 'all', label: 'All', count: payments.length },
    { key: 'job', label: 'Job Payments', count: payments.filter(p => p.type === 'job').length },
    { key: 'subscription', label: 'Subscriptions', count: payments.filter(p => p.type === 'subscription').length },
    { key: 'completed', label: 'Completed', count: payments.filter(p => ['completed','succeeded','paid'].includes(p.status.toLowerCase())).length },
    { key: 'pending', label: 'Pending', count: payments.filter(p => p.status.toLowerCase() === 'pending').length },
    { key: 'failed', label: 'Failed', count: payments.filter(p => p.status.toLowerCase() === 'failed').length },
  ];

  const openDetail = (p: UnifiedPayment) => {
    setSelectedPayment(p);
    setShowDetailModal(true);
  };

  const closeDetail = () => {
    setShowDetailModal(false);
    setSelectedPayment(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium">Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933]">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-red-600 text-white border-red-500'
        }`}>
          <div className="flex items-center gap-2">
            <i className={`${toast.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} text-lg`}></i>
            {toast.message}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-900/50">
                <i className="ri-money-pound-circle-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Payments</h1>
                <p className="text-xs text-slate-400">All transactions & subscription revenue</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {missingCount > 0 && (
                <button
                  onClick={runBackfill}
                  disabled={backfilling}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 border border-amber-500 rounded-xl text-sm font-medium text-white hover:bg-amber-500 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className={`${backfilling ? 'ri-loader-4-line animate-spin' : 'ri-tools-line'}`}></i>
                  </div>
                  {backfilling ? 'Backfilling...' : `Backfill Missing (${missingCount})`}
                </button>
              )}
              <button
                onClick={fetchPayments}
                className="flex items-center gap-2 px-4 py-2 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <div className="w-5 h-5 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {statCards.map((card, i) => (
            <div key={i} className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-6 hover:border-teal-500/30 transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${card.bg}`}>
                  <i className={`${card.icon} text-xl`}></i>
                </div>
                <span className="text-sm font-medium text-slate-400">{card.label}</span>
              </div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <div className="w-5 h-5 flex items-center justify-center absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <i className="ri-search-line text-lg"></i>
              </div>
              <input
                type="text"
                placeholder="Search by description, payer, or guard..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 border border-[#1a2b4a] rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-[#0a1628] text-white placeholder-slate-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filterTabs.map((tab) => {
                const isActive = filter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all border cursor-pointer ${
                      isActive
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:border-teal-500/30 hover:bg-[#1a2b4a] hover:text-white'
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-[#1a2b4a] text-slate-400'}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0a1628] border-b border-[#1a2b4a]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Payer / Recipient</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Gateway</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2b4a]">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-[#0a1628] transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-300 whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${
                        p.type === 'job' ? 'bg-sky-500/10 text-sky-400 ring-sky-500/20' : 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/20'
                      }`}>
                        <div className="w-3 h-3 flex items-center justify-center"><i className={`${p.type === 'job' ? 'ri-briefcase-line' : 'ri-vip-crown-line'} text-xs`}></i></div>
                        {p.type === 'job' ? 'Job' : 'Subscription'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-white font-medium">{p.description}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{p.payer}</td>
                    <td className="px-6 py-4 text-sm font-bold text-white">{formatCurrency(p.amount)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(p.status)}`}>{p.status.toUpperCase()}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">{p.gateway}</td>
                    <td className="px-6 py-4">
                      <button onClick={() => openDetail(p)} className="text-teal-400 hover:text-teal-300 font-medium text-sm whitespace-nowrap hover:bg-teal-500/10 px-3 py-1.5 rounded-lg transition-all cursor-pointer">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPayments.length === 0 && (
            <div className="p-16 text-center">
              <div className="w-16 h-16 flex items-center justify-center bg-[#1a2b4a] rounded-2xl mx-auto mb-4">
                <i className="ri-money-pound-circle-line text-3xl text-slate-500"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No payments found</h3>
              <p className="text-slate-400 text-sm">Try adjusting your filters or search terms</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#111d35] rounded-2xl max-w-lg w-full shadow-xl border border-[#1a2b4a] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1a2b4a] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Payment Details</h2>
                <p className="text-xs text-slate-400 mt-0.5">{selectedPayment.id.slice(0, 8)}</p>
              </div>
              <button onClick={closeDetail} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#1a2b4a] cursor-pointer text-slate-400 transition-colors">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-gradient-to-br from-teal-500/10 to-sky-500/10 rounded-2xl p-5 border border-teal-500/20">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Amount</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(selectedPayment.amount)}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(selectedPayment.status)}`}>{selectedPayment.status.toUpperCase()}</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${selectedPayment.type === 'job' ? 'bg-sky-500/10 text-sky-400 ring-sky-500/20' : 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/20'}`}>{selectedPayment.type === 'job' ? 'Job Payment' : 'Subscription'}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-sm text-slate-400">Date</span><span className="text-sm font-medium text-white">{new Date(selectedPayment.created_at).toLocaleString('en-GB')}</span></div>
                <div className="flex justify-between"><span className="text-sm text-slate-400">Description</span><span className="text-sm font-medium text-white text-right">{selectedPayment.description}</span></div>
                <div className="flex justify-between"><span className="text-sm text-slate-400">Payer</span><span className="text-sm font-medium text-white">{selectedPayment.payer}</span></div>
                {selectedPayment.guard_name && (<div className="flex justify-between"><span className="text-sm text-slate-400">Guard</span><span className="text-sm font-medium text-white">{selectedPayment.guard_name}</span></div>)}
                <div className="flex justify-between"><span className="text-sm text-slate-400">Gateway</span><span className="text-sm font-medium text-white">{selectedPayment.gateway}</span></div>
              </div>
              <button onClick={closeDetail} className="w-full bg-[#1a2b4a] text-slate-400 py-3 rounded-xl font-semibold hover:bg-[#1e2d4d] hover:text-white transition-colors whitespace-nowrap cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}