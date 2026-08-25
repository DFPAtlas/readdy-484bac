'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import LiveIndicator from '@/components/LiveIndicator';
import { useClientPaymentCentre } from '@/hooks/useClientPaymentCentre';
import type { JobPayment } from '@/hooks/useClientPaymentCentre';
import { useClientGuard } from '@/hooks/useClientGuard';

type TabKey = 'overview' | 'history' | 'receipts';

export default function ClientPaymentCentrePage() {
  const { loading: authLoading, allowed } = useClientGuard();
  const {
    loading,
    spendingSummary,
    billingInfo,
    jobPayments,
    portalLoading,
    handleBillingPortal,
    exportCsv,
  } = useClientPaymentCentre();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companyName, setCompanyName] = useState('Client');
  const [initials, setInitials] = useState('CL');
  const [subscriptionTier, setSubscriptionTier] = useState('Free');
  const [selectedPayment, setSelectedPayment] = useState<JobPayment | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: client } = await supabase
        .from('clients')
        .select('company_name, subscription_tier')
        .eq('user_id', user.id)
        .maybeSingle();
      if (client) {
        setCompanyName(client.company_name || 'Client');
        setSubscriptionTier(client.subscription_tier || 'Free');
        const parts = (client.company_name || 'Client').trim().split(' ');
        if (parts.length >= 2) setInitials(`${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase());
        else setInitials((client.company_name || 'Client').slice(0, 2).toUpperCase());
      }
    }
    loadProfile();
  }, []);

  const filteredPayments = useMemo(() => {
    let filtered = jobPayments;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.jobTitle.toLowerCase().includes(q) ||
        p.guardName.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.paymentStatus === statusFilter);
    }
    return filtered;
  }, [jobPayments, searchTerm, statusFilter]);

  const handleOpenBillingPortal = useCallback(async () => {
    try {
      const url = await handleBillingPortal();
      if (url) window.open(url, '_blank');
    } catch (err: unknown) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to open billing portal', type: 'error' });
    }
  }, [handleBillingPortal]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
      succeeded: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
      pending: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
      pending_payment: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
      failed: 'bg-red-500/10 text-red-400 border-red-500/25',
      refunded: 'bg-violet-500/10 text-violet-400 border-violet-500/25',
      processing: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
    };
    return map[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/25';
  };

  const getTimeline = (payment: JobPayment) => {
    const steps = [
      { label: 'Job Posted', done: true, icon: 'ri-file-list-3-line' },
      { label: 'Guard Selected', done: payment.paymentStatus !== 'pending_payment', icon: 'ri-user-star-line' },
      { label: 'Client Paid', done: payment.paymentStatus === 'completed' || payment.paymentStatus === 'succeeded', icon: 'ri-money-pound-circle-line' },
      { label: 'Funds Held', done: payment.releaseStatus === 'funded' || payment.releaseStatus === 'completed' || payment.releaseStatus === 'released', icon: 'ri-safe-line' },
      { label: 'Guard Completed', done: payment.releaseStatus === 'completed' || payment.releaseStatus === 'released', icon: 'ri-check-double-line' },
      { label: 'Funds Released', done: payment.releaseStatus === 'released', icon: 'ri-send-plane-line' },
      { label: 'Transfer Paid', done: payment.releaseStatus === 'released', icon: 'ri-bank-card-line' },
    ];
    return steps;
  };

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { key: 'history', label: 'Payment History', icon: 'ri-receipt-line' },
    { key: 'receipts', label: 'Receipts & Invoices', icon: 'ri-file-text-line' },
  ];

  if (loading || authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName="Client" subtitle="Free" initials="CL" />
        <div className="flex-1 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading payment centre...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar role="client" displayName={companyName} subtitle={subscriptionTier} initials={initials} />
      <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
        <header className="bg-[#111d35] border-b border-[#1e2d4d] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Client Portal</p>
            <h1 className="text-xl font-bold text-white">Payment Centre</h1>
          </div>
          <div className="flex items-center gap-3">
            <LiveIndicator />
            <Link href="/client/dashboard" className="flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
              <i className="ri-dashboard-line"></i>Dashboard
            </Link>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">
          {toast && (
            <div className={`mb-6 border rounded-xl p-4 flex items-center gap-3 ${
              toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                toast.type === 'success' ? 'bg-emerald-500/15' : 'bg-red-500/15'
              }`}>
                <i className={`text-xl ${toast.type === 'success' ? 'ri-checkbox-circle-fill text-emerald-400' : 'ri-error-warning-fill text-red-400'}`} />
              </div>
              <p className={`font-semibold ${toast.type === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>{toast.message}</p>
              <button onClick={() => setToast(null)} className="ml-auto text-slate-400 hover:text-white cursor-pointer"><i className="ri-close-line" /></button>
            </div>
          )}

          <div className="flex gap-2 mb-6 bg-[#111d35] rounded-xl p-1.5 border border-[#1e2d4d] w-fit">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.key ? 'bg-teal-500 text-white' : 'text-slate-400 hover:bg-[#162036]'
                }`}>
                <div className="w-4 h-4 flex items-center justify-center"><i className={tab.icon}></i></div>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Spending Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-8 translate-x-8" />
                  <div className="relative">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">This Month</p>
                    <p className="text-2xl font-bold text-white">£{spendingSummary.thisMonthSpend.toFixed(2)}</p>
                    <p className="text-xs text-slate-500 mt-1">Job payments</p>
                  </div>
                </div>
                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -translate-y-8 translate-x-8" />
                  <div className="relative">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Spend</p>
                    <p className="text-2xl font-bold text-white">£{spendingSummary.totalSpend.toFixed(2)}</p>
                    <p className="text-xs text-slate-500 mt-1">All-time</p>
                  </div>
                </div>
                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-teal-500/10 rounded-full -translate-y-8 translate-x-8" />
                  <div className="relative">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Jobs Paid</p>
                    <p className="text-2xl font-bold text-white">{spendingSummary.jobsPaid}</p>
                    <p className="text-xs text-slate-500 mt-1">Completed payments</p>
                  </div>
                </div>
                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -translate-y-8 translate-x-8" />
                  <div className="relative">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Outstanding</p>
                    <p className="text-2xl font-bold text-white">£{spendingSummary.outstandingAmount.toFixed(2)}</p>
                    <p className="text-xs text-slate-500 mt-1">Awaiting payment</p>
                  </div>
                </div>
                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/10 rounded-full -translate-y-8 translate-x-8" />
                  <div className="relative">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Refunds</p>
                    <p className="text-2xl font-bold text-white">£{spendingSummary.refundsTotal.toFixed(2)}</p>
                    <p className="text-xs text-slate-500 mt-1">Total refunded</p>
                  </div>
                </div>
              </div>

              {/* Billing / Payment Method Card */}
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                      <div className="w-5 h-5 flex items-center justify-center"><i className="ri-bank-card-line text-indigo-400 text-lg"></i></div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Billing & Payment Method</h3>
                      <p className="text-sm text-slate-400">Manage your payment methods via Stripe</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                    billingInfo.stripeCustomerStatus === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                  }`}>
                    <div className="w-3 h-3 flex items-center justify-center"><i className={`${billingInfo.stripeCustomerStatus === 'active' ? 'ri-check-line' : 'ri-add-line'}`}></i></div>
                    {billingInfo.stripeCustomerStatus === 'active' ? 'Active' : 'Not Set Up'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-[#0B1933] rounded-lg p-3 border border-[#1e2d4d]">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Customer ID</p>
                    <p className="text-xs font-mono text-slate-300">
                      {billingInfo.stripeCustomerId
                        ? `${billingInfo.stripeCustomerId.slice(0, 8)}&bull;&bull;&bull;`
                        : '—'}
                    </p>
                  </div>
                  <div className="bg-[#0B1933] rounded-lg p-3 border border-[#1e2d4d]">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Payment Method</p>
                    <p className="text-xs text-slate-300">{billingInfo.defaultPaymentMethod || 'Not added'}</p>
                  </div>
                  <div className="bg-[#0B1933] rounded-lg p-3 border border-[#1e2d4d]">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Plan</p>
                    <p className="text-xs text-slate-300">{billingInfo.planName}</p>
                  </div>
                </div>

                <button onClick={handleOpenBillingPortal} disabled={portalLoading}
                  className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap">
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-bank-card-line"></i></div>
                  {portalLoading ? 'Loading...' : billingInfo.stripeCustomerId ? 'Manage Payment Method' : 'Add Payment Method'}
                </button>
                <p className="text-xs text-slate-500 mt-3">Opens the secure Stripe Billing Portal. No card data is stored on our servers.</p>
              </div>

              {/* Recent Payments */}
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
                <div className="p-5 border-b border-[#1e2d4d] flex items-center justify-between">
                  <h3 className="font-semibold text-white">Recent Job Payments</h3>
                  <button onClick={() => setActiveTab('history')} className="text-sm text-teal-400 hover:text-teal-300 cursor-pointer whitespace-nowrap">
                    View all <i className="ri-arrow-right-line ml-1"></i>
                  </button>
                </div>
                {jobPayments.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 bg-[#162036] rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="ri-receipt-line text-2xl text-slate-500"></i>
                    </div>
                    <p className="text-slate-400 font-medium">No payments yet</p>
                    <p className="text-sm text-slate-500 mt-1">Job payments and receipts will appear here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#162036]">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Job</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Guard</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Amount</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2d4d]">
                        {jobPayments.slice(0, 5).map(p => (
                          <tr key={p.id} className="hover:bg-[#162036]/50 cursor-pointer" onClick={() => { setSelectedPayment(p); setShowTimeline(true); }}>
                            <td className="px-5 py-3 text-sm text-white">{p.jobTitle}</td>
                            <td className="px-5 py-3 text-sm text-slate-400">{p.guardName}</td>
                            <td className="px-5 py-3 text-sm text-white text-right font-semibold">£{p.amountPaid.toFixed(2)}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(p.paymentStatus)}`}>
                                {p.paymentStatus === 'completed' || p.paymentStatus === 'succeeded' ? 'Paid' :
                                 p.paymentStatus === 'pending_payment' ? 'Pending' :
                                 p.paymentStatus.charAt(0).toUpperCase() + p.paymentStatus.slice(1)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                <div className="flex gap-1 bg-[#0B1933] rounded-lg p-1">
                  {['all', 'completed', 'pending', 'failed', 'refunded'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        statusFilter === s ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 w-full lg:w-auto">
                  <div className="relative flex-1 lg:w-64">
                    <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                    <input type="text" placeholder="Search jobs, guards..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
                  </div>
                  <button onClick={exportCsv}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-lg text-sm font-medium text-slate-300 hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-download-line"></i></div>
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
                {filteredPayments.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-slate-400">No payments match your filters</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#162036]">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Date</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Job Title</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Guard</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Amount</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Payment</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Release</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Refund</th>
                          <th className="px-5 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Timeline</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2d4d]">
                        {filteredPayments.map(p => (
                          <tr key={p.id} className="hover:bg-[#162036]/50">
                            <td className="px-5 py-3 text-sm text-slate-400 whitespace-nowrap">
                              {new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-5 py-3 text-sm text-white font-medium">{p.jobTitle}</td>
                            <td className="px-5 py-3 text-sm text-slate-400">{p.guardName}</td>
                            <td className="px-5 py-3 text-sm text-white text-right font-semibold">£{p.amountPaid.toFixed(2)}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(p.paymentStatus)}`}>
                                {p.paymentStatus === 'completed' || p.paymentStatus === 'succeeded' ? 'Paid' : p.paymentStatus}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(p.releaseStatus)}`}>
                                {p.releaseStatus === 'released' ? 'Released' : p.releaseStatus === 'funded' ? 'Held' : p.releaseStatus === 'completed' ? 'Awaiting Release' : p.releaseStatus}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(p.refundStatus === 'Refunded' ? 'refunded' : 'completed')}`}>
                                {p.refundStatus}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <button onClick={() => { setSelectedPayment(p); setShowTimeline(true); }}
                                className="text-teal-400 hover:text-teal-300 text-xs font-medium cursor-pointer whitespace-nowrap">View</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {filteredPayments.length > 0 && (
                  <div className="p-3 border-t border-[#1e2d4d] text-xs text-slate-500 text-center">
                    Showing {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'receipts' && (
            <div className="space-y-4">
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
                <div className="p-5 border-b border-[#1e2d4d]">
                  <h3 className="font-semibold text-white">Receipts & Invoices</h3>
                  <p className="text-sm text-slate-400 mt-1">Download receipts and invoices for your job payments</p>
                </div>
                {jobPayments.filter(p => p.receiptUrl || p.invoiceUrl).length === 0 && jobPayments.filter(p => p.paymentStatus === 'completed' || p.paymentStatus === 'succeeded').length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 bg-[#162036] rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="ri-file-text-line text-2xl text-slate-500"></i>
                    </div>
                    <p className="text-slate-400 font-medium">No receipts available</p>
                    <p className="text-sm text-slate-500 mt-1">Receipts and invoices will appear here after your first job payment.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#162036]">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Date</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Job</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Amount</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Documents</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2d4d]">
                        {jobPayments.filter(p => p.paymentStatus === 'completed' || p.paymentStatus === 'succeeded' || p.receiptUrl || p.invoiceUrl).map(p => (
                          <tr key={p.id} className="hover:bg-[#162036]/50">
                            <td className="px-5 py-3 text-sm text-slate-400 whitespace-nowrap">
                              {new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-5 py-3 text-sm text-white">{p.jobTitle}</td>
                            <td className="px-5 py-3 text-sm text-white text-right">£{p.amountPaid.toFixed(2)}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(p.paymentStatus)}`}>Paid</span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                {p.receiptUrl ? (
                                  <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer"
                                    className="text-teal-400 hover:text-teal-300 text-xs font-medium whitespace-nowrap flex items-center gap-1">
                                    <i className="ri-receipt-line"></i>Receipt
                                  </a>
                                ) : (
                                  <span className="text-slate-600 text-xs">Receipt pending</span>
                                )}
                                {p.invoiceUrl ? (
                                  <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer"
                                    className="text-teal-400 hover:text-teal-300 text-xs font-medium whitespace-nowrap flex items-center gap-1">
                                    <i className="ri-file-text-line"></i>Invoice
                                  </a>
                                ) : (
                                  <span className="text-slate-600 text-xs">Not available</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {showTimeline && selectedPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111d35] rounded-2xl max-w-md w-full border border-[#1e2d4d] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Payment Timeline</h3>
              <button onClick={() => setShowTimeline(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">{selectedPayment.jobTitle} — £{selectedPayment.amountPaid.toFixed(2)}</p>
            <div className="space-y-0">
              {getTimeline(selectedPayment).map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      step.done ? 'bg-emerald-500/15' : 'bg-slate-500/10'
                    }`}>
                      <i className={`${step.icon} ${step.done ? 'text-emerald-400' : 'text-slate-600'} text-sm`}></i>
                    </div>
                    {i < 6 && <div className={`w-0.5 h-6 ${step.done ? 'bg-emerald-500/30' : 'bg-slate-700'}`}></div>}
                  </div>
                  <div className="pb-4">
                    <p className={`text-sm font-medium ${step.done ? 'text-white' : 'text-slate-600'}`}>{step.label}</p>
                    <p className={`text-xs ${step.done ? 'text-emerald-400' : 'text-slate-700'}`}>
                      {step.done ? 'Complete' : 'Pending'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowTimeline(false)}
              className="w-full mt-4 py-3 bg-[#162036] text-slate-300 rounded-xl font-semibold hover:bg-[#1a2642] transition-colors cursor-pointer">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}