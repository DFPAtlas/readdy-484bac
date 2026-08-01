'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import LiveIndicator from '@/components/LiveIndicator';
import { useGuardPaymentCentre } from '@/hooks/useGuardPaymentCentre';
import { useGuardGuard } from '@/hooks/useGuardGuard';

type TabKey = 'overview' | 'history' | 'statements';

export default function GuardPaymentCentrePage() {
  const { loading: authLoading, allowed } = useGuardGuard();
  const {
    loading,
    earningsSummary,
    stripeStatus,
    stripeLoading,
    jobPayments,
    payouts,
    refreshStripeStatus,
    handleConnectStripe,
    handleOnboardingLink,
    handleDashboardLink,
    exportCsv,
  } = useGuardPaymentCentre();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('Guard');
  const [initials, setInitials] = useState('G');
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: guard } = await supabase
        .from('guards')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (guard) {
        setDisplayName(guard.full_name || 'Guard');
        setInitials((guard.full_name || 'Guard').split(' ').map((n: string) => n[0]).join('').toUpperCase());
      }
    }
    loadProfile();

    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_onboarding') === 'return') {
      setToast({ message: 'Stripe setup complete! Your account is being verified.', type: 'success' });
      refreshStripeStatus();
    }
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const filteredPayments = useMemo(() => {
    let filtered = jobPayments;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.jobTitle.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.transferStatus === statusFilter);
    }
    return filtered;
  }, [jobPayments, searchTerm, statusFilter]);

  const handleStripeAction = useCallback(async (action: string) => {
    setActionLoading(action);
    try {
      let url: string | null = null;
      if (action === 'connect') url = await handleConnectStripe();
      else if (action === 'onboarding') url = await handleOnboardingLink();
      else if (action === 'dashboard') url = await handleDashboardLink();

      if (url) {
        if (action === 'dashboard') window.open(url, '_blank');
        else window.location.href = url;
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Action failed', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  }, [handleConnectStripe, handleOnboardingLink, handleDashboardLink]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
      completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
      pending: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
      processing: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
      initiated: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
      held: 'bg-red-500/10 text-red-400 border-red-500/25',
      failed: 'bg-red-500/10 text-red-400 border-red-500/25',
    };
    return map[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/25';
  };

  const getTimeline = (payment: any) => {
    const status = payment.transferStatus;
    const steps = [
      { label: 'Client Paid', done: payment.paymentStatus !== 'unpaid', icon: 'ri-money-pound-circle-line' },
      { label: 'Funds Held', done: payment.paymentStatus === 'funded' || payment.paymentStatus === 'completed' || status === 'paid' || status === 'completed', icon: 'ri-safe-line' },
      { label: 'Job Completed', done: payment.paymentStatus === 'completed' || status === 'paid' || status === 'completed', icon: 'ri-check-double-line' },
      { label: 'Transfer Created', done: status === 'processing' || status === 'initiated' || status === 'paid' || status === 'completed', icon: 'ri-send-plane-line' },
      { label: 'Transfer Paid', done: status === 'paid' || status === 'completed', icon: 'ri-bank-card-line' },
      { label: 'Payout Complete', done: status === 'paid' || status === 'completed', icon: 'ri-checkbox-circle-line' },
    ];
    return steps;
  };

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { key: 'history', label: 'Payment History', icon: 'ri-receipt-line' },
    { key: 'statements', label: 'Statements', icon: 'ri-file-list-3-line' },
  ];

  if (loading || authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex">
        <PortalSidebar role="guard" displayName="Guard" subtitle="Guard" initials="G" />
        <main className="flex-1 ml-72 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading payment centre...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex">
      <PortalSidebar role="guard" displayName={displayName} subtitle="Guard" initials={initials} accentColor="emerald" />
      <main className="flex-1 ml-72 pt-8 pb-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <Link
                href="/guard/dashboard"
                className="text-teal-400 hover:text-teal-300 font-medium mb-3 inline-flex items-center cursor-pointer whitespace-nowrap"
              >
                <i className="ri-arrow-left-line mr-2"></i>Back to Dashboard
              </Link>
              <h1 className="text-3xl font-bold text-white mt-2">Payment Centre</h1>
              <p className="text-slate-400 mt-1">Track earnings, manage payouts, and view payment history</p>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <LiveIndicator />
              <Link
                href="/guard/bank-settings"
                className="flex items-center gap-2 px-4 py-2.5 bg-[#111d35] border border-[#1e2d4d] rounded-lg text-sm font-medium text-slate-300 hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-bank-line"></i>Bank Settings
              </Link>
              <Link
                href="/guard/earnings"
                className="flex items-center gap-2 px-4 py-2.5 bg-[#111d35] border border-[#1e2d4d] rounded-lg text-sm font-medium text-slate-300 hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-funds-line"></i>Earnings
              </Link>
            </div>
          </div>

          {toast && (
            <div className={`mb-6 border rounded-xl p-4 flex items-center gap-3 animate-fade-in ${
              toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20' :
              toast.type === 'error' ? 'bg-red-500/10 border-red-500/20' :
              'bg-amber-500/10 border-amber-500/20'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                toast.type === 'success' ? 'bg-emerald-500/15' : toast.type === 'error' ? 'bg-red-500/15' : 'bg-amber-500/15'
              }`}>
                <i className={`text-xl ${toast.type === 'success' ? 'ri-checkbox-circle-fill text-emerald-400' : toast.type === 'error' ? 'ri-error-warning-fill text-red-400' : 'ri-alert-fill text-amber-400'}`} />
              </div>
              <p className={`font-semibold ${toast.type === 'success' ? 'text-emerald-300' : toast.type === 'error' ? 'text-red-300' : 'text-amber-300'}`}>{toast.message}</p>
              <button onClick={() => setToast(null)} className="ml-auto text-slate-400 hover:text-white cursor-pointer"><i className="ri-close-line" /></button>
            </div>
          )}

          <div className="flex gap-2 mb-6 bg-[#111d35] rounded-xl p-1.5 border border-[#1e2d4d] w-fit">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.key ? 'bg-teal-500 text-white' : 'text-slate-400 hover:bg-[#162036]'
                }`}
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className={tab.icon}></i></div>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Earnings Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -translate-y-8 translate-x-8" />
                  <div className="relative">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Available Balance</p>
                    <p className="text-2xl font-bold text-white">£{earningsSummary.availableBalance.toFixed(2)}</p>
                    <p className="text-xs text-slate-500 mt-1">Ready to withdraw</p>
                  </div>
                </div>
                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full -translate-y-8 translate-x-8" />
                  <div className="relative">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pending Balance</p>
                    <p className="text-2xl font-bold text-white">£{earningsSummary.pendingBalance.toFixed(2)}</p>
                    <p className="text-xs text-slate-500 mt-1">Awaiting release</p>
                  </div>
                </div>
                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-8 translate-x-8" />
                  <div className="relative">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">This Month</p>
                    <p className="text-2xl font-bold text-white">£{earningsSummary.thisMonthEarnings.toFixed(2)}</p>
                    <p className="text-xs text-slate-500 mt-1">Gross earnings</p>
                  </div>
                </div>
                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/10 rounded-full -translate-y-8 translate-x-8" />
                  <div className="relative">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Lifetime Earnings</p>
                    <p className="text-2xl font-bold text-white">£{earningsSummary.lifetimeEarnings.toFixed(2)}</p>
                    <p className="text-xs text-slate-500 mt-1">All-time gross</p>
                  </div>
                </div>
                <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-teal-500/10 rounded-full -translate-y-8 translate-x-8" />
                  <div className="relative">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Next Estimated Payout</p>
                    <p className="text-lg font-bold text-white mt-1">{earningsSummary.nextEstimatedPayout}</p>
                    <p className="text-xs text-slate-500 mt-1">Typical payout day</p>
                  </div>
                </div>
              </div>

              {/* Stripe Express Status Card */}
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center">
                      <div className="w-5 h-5 flex items-center justify-center"><i className="ri-bank-card-line text-violet-400 text-lg"></i></div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Stripe Payout Account</h3>
                      <p className="text-sm text-slate-400">Stripe Express status for receiving job payouts</p>
                    </div>
                  </div>
                  <button onClick={refreshStripeStatus} disabled={stripeLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-[#162036] rounded-lg border border-[#1e2d4d] hover:border-teal-500/30 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">
                    <div className={`w-3 h-3 flex items-center justify-center ${stripeLoading ? 'animate-spin' : ''}`}><i className="ri-refresh-line"></i></div>
                    Refresh
                  </button>
                </div>

                {!stripeStatus?.connected ? (
                  <div>
                    <div className="flex items-center gap-3 mb-4 p-4 bg-slate-500/5 rounded-xl border border-slate-500/15">
                      <div className="w-10 h-10 rounded-full bg-slate-500/15 flex items-center justify-center flex-shrink-0">
                        <i className="ri-error-warning-line text-slate-400 text-lg"></i>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-300">Not Started</p>
                        <p className="text-xs text-slate-500">Set up your Stripe Express account to start receiving payouts</p>
                      </div>
                    </div>
                    <button onClick={() => handleStripeAction('connect')} disabled={actionLoading === 'connect'}
                      className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors">
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-bank-card-line"></i></div>
                      {actionLoading === 'connect' ? 'Redirecting...' : 'Set Up Payouts'}
                    </button>
                  </div>
                ) : stripeStatus.status === 'ready' ? (
                  <div>
                    <div className="flex items-start gap-3 mb-4 p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/15">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                        <i className="ri-check-line text-emerald-400 text-lg"></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-emerald-300">Ready for Payouts</p>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-lg text-xs font-medium whitespace-nowrap">Ready</span>
                        </div>
                        <p className="text-xs text-emerald-400/80">Your Stripe account is fully set up and ready to receive payouts.</p>
                      </div>
                    </div>
                    <button onClick={() => handleStripeAction('dashboard')} disabled={actionLoading === 'dashboard'}
                      className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors">
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-bank-card-line"></i></div>
                      {actionLoading === 'dashboard' ? 'Loading...' : 'Update Bank Details'}
                    </button>
                  </div>
                ) : stripeStatus.status === 'pending' ? (
                  <div>
                    <div className="flex items-start gap-3 mb-4 p-4 bg-amber-500/5 rounded-xl border border-amber-500/15">
                      <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                        <i className="ri-time-line text-amber-400 text-lg"></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-amber-300">Pending Verification</p>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-lg text-xs font-medium whitespace-nowrap">Pending</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleStripeAction('onboarding')} disabled={actionLoading === 'onboarding'}
                      className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors">
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-play-circle-line"></i></div>
                      {actionLoading === 'onboarding' ? 'Redirecting...' : 'Continue Onboarding'}
                    </button>
                  </div>
                ) : stripeStatus.status === 'restricted' ? (
                  <div>
                    <div className="flex items-start gap-3 mb-4 p-4 bg-red-500/5 rounded-xl border border-red-500/15">
                      <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                        <i className="ri-error-warning-line text-red-400 text-lg"></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-red-300">Restricted / Action Required</p>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/25 rounded-lg text-xs font-medium whitespace-nowrap">Restricted</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleStripeAction('onboarding')} disabled={actionLoading === 'onboarding'}
                      className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-500 disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors">
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-tools-line"></i></div>
                      {actionLoading === 'onboarding' ? 'Redirecting...' : 'Fix Account'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-3 mb-4 p-4 bg-slate-500/5 rounded-xl border border-slate-500/15">
                      <div className="w-10 h-10 rounded-full bg-slate-500/15 flex items-center justify-center flex-shrink-0">
                        <i className="ri-time-line text-slate-400 text-lg"></i>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-300">Setup Incomplete</p>
                        <p className="text-xs text-slate-500">Complete your Stripe Express onboarding to receive payouts.</p>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-500/15 text-slate-400 border border-slate-500/25 rounded-lg text-xs font-medium whitespace-nowrap">Not Started</span>
                    </div>
                    <button onClick={() => handleStripeAction('onboarding')} disabled={actionLoading === 'onboarding'}
                      className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 cursor-pointer whitespace-nowrap transition-colors">
                      <div className="w-4 h-4 flex items-center justify-center"><i className="ri-play-circle-line"></i></div>
                      {actionLoading === 'onboarding' ? 'Redirecting...' : 'Continue Onboarding'}
                    </button>
                  </div>
                )}

                {stripeStatus?.connected && (
                  <div className="mt-5 pt-4 border-t border-[#1e2d4d]">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Account Details</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {stripeStatus.stripeAccountId && (
                        <div className="bg-[#0B1933] rounded-lg p-3 border border-[#1e2d4d]">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Account ID</p>
                          <p className="text-xs font-mono text-slate-300">{stripeStatus.stripeAccountId.slice(0, 4)}&bull;&bull;&bull;{stripeStatus.stripeAccountId.slice(-4)}</p>
                        </div>
                      )}
                      <div className="bg-[#0B1933] rounded-lg p-3 border border-[#1e2d4d]">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Payouts Enabled</p>
                        <p className={`text-xs font-semibold ${stripeStatus.payoutsEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {stripeStatus.payoutsEnabled ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div className="bg-[#0B1933] rounded-lg p-3 border border-[#1e2d4d]">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Details Submitted</p>
                        <p className={`text-xs font-semibold ${stripeStatus.detailsSubmitted ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {stripeStatus.detailsSubmitted ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div className="bg-[#0B1933] rounded-lg p-3 border border-[#1e2d4d]">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Charges Enabled</p>
                        <p className={`text-xs font-semibold ${stripeStatus.chargesEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {stripeStatus.chargesEnabled ? 'Yes' : 'No'}
                        </p>
                      </div>
                      {stripeStatus.lastCheckedAt && (
                        <div className="bg-[#0B1933] rounded-lg p-3 border border-[#1e2d4d]">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Last Synced</p>
                          <p className="text-xs text-slate-400">{new Date(stripeStatus.lastCheckedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Payments */}
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
                <div className="p-5 border-b border-[#1e2d4d] flex items-center justify-between">
                  <h3 className="font-semibold text-white">Recent Payments</h3>
                  <Link href="#" onClick={(e) => { e.preventDefault(); setActiveTab('history'); }} className="text-sm text-teal-400 hover:text-teal-300 cursor-pointer whitespace-nowrap">
                    View all <i className="ri-arrow-right-line ml-1"></i>
                  </Link>
                </div>
                {jobPayments.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 bg-[#162036] rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="ri-wallet-3-line text-2xl text-slate-500"></i>
                    </div>
                    <p className="text-slate-400 font-medium">No paid jobs yet</p>
                    <p className="text-sm text-slate-500 mt-1">Once clients pay for jobs, your earnings will appear here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#162036]">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Job</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Client</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Gross</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Fee</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Net</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2d4d]">
                        {jobPayments.slice(0, 5).map(p => (
                          <tr key={p.id} className="hover:bg-[#162036]/50 cursor-pointer" onClick={() => { setSelectedPayment(p); setShowTimeline(true); }}>
                            <td className="px-5 py-3 text-sm text-white">{p.jobTitle}</td>
                            <td className="px-5 py-3 text-sm text-slate-400">{p.clientName}</td>
                            <td className="px-5 py-3 text-sm text-white text-right">£{p.grossAmount.toFixed(2)}</td>
                            <td className="px-5 py-3 text-sm text-red-400 text-right">£{p.platformFee.toFixed(2)}</td>
                            <td className="px-5 py-3 text-sm text-emerald-400 text-right font-semibold">£{p.netPayout.toFixed(2)}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(p.transferStatus)}`}>
                                {p.transferStatus.charAt(0).toUpperCase() + p.transferStatus.slice(1)}
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
                  {['all', 'paid', 'pending', 'processing', 'held', 'failed'].map(s => (
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
                    <input
                      type="text" placeholder="Search jobs, clients..."
                      value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
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
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Client</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Gross</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Fee</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase">Net Payout</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Payment</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Transfer</th>
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
                            <td className="px-5 py-3 text-sm text-slate-400">{p.clientName}</td>
                            <td className="px-5 py-3 text-sm text-white text-right">£{p.grossAmount.toFixed(2)}</td>
                            <td className="px-5 py-3 text-sm text-red-400 text-right">£{p.platformFee.toFixed(2)}</td>
                            <td className="px-5 py-3 text-sm text-emerald-400 text-right font-semibold">£{p.netPayout.toFixed(2)}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(p.paymentStatus)}`}>
                                {p.paymentStatus.charAt(0).toUpperCase() + p.paymentStatus.slice(1)}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(p.transferStatus)}`}>
                                {p.transferStatus.charAt(0).toUpperCase() + p.transferStatus.slice(1)}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <button onClick={() => { setSelectedPayment(p); setShowTimeline(true); }}
                                className="text-teal-400 hover:text-teal-300 text-xs font-medium cursor-pointer whitespace-nowrap">
                                View
                              </button>
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

          {activeTab === 'statements' && (
            <div className="space-y-6">
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6">
                <h3 className="text-lg font-semibold text-white mb-1">Export Statements</h3>
                <p className="text-sm text-slate-400 mb-6">Download your payment history for tax and record-keeping purposes.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={exportCsv}
                    className="flex items-center gap-3 p-4 bg-[#162036] rounded-xl border border-[#1e2d4d] hover:border-teal-500/30 transition-all cursor-pointer group">
                    <div className="w-12 h-12 rounded-xl bg-teal-500/15 flex items-center justify-center group-hover:bg-teal-500/25 transition-colors">
                      <div className="w-6 h-6 flex items-center justify-center"><i className="ri-file-excel-2-line text-teal-400 text-xl"></i></div>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-white text-sm">CSV Export</p>
                      <p className="text-xs text-slate-500">Download all payment history as a CSV spreadsheet — includes all columns shown in history</p>
                    </div>
                    <div className="ml-auto w-8 h-8 flex items-center justify-center"><i className="ri-download-line text-slate-500 group-hover:text-teal-400 text-lg"></i></div>
                  </button>
                  <div className="flex items-center gap-3 p-4 bg-[#162036] rounded-xl border border-[#1e2d4d] opacity-50">
                    <div className="w-12 h-12 rounded-xl bg-slate-500/15 flex items-center justify-center">
                      <div className="w-6 h-6 flex items-center justify-center"><i className="ri-file-pdf-2-line text-slate-500 text-xl"></i></div>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-slate-400 text-sm">PDF Statement</p>
                      <p className="text-xs text-slate-600">Coming soon — formatted monthly payment statements</p>
                    </div>
                    <span className="ml-auto px-2.5 py-1 bg-slate-500/15 text-slate-500 text-xs rounded-full border border-slate-500/20 whitespace-nowrap">Soon</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-amber-500/15 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-error-warning-line text-xl text-amber-400"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-300 mb-1">Tax Responsibility Reminder</h3>
                    <p className="text-sm text-amber-200/80">You are an independent contractor. Keep these payment records for your HMRC self-assessment. QuickGuard does not deduct income tax or National Insurance from your payouts.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showTimeline && selectedPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111d35] rounded-2xl max-w-md w-full border border-[#1e2d4d] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Payment Timeline</h3>
              <button onClick={() => setShowTimeline(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">{selectedPayment.jobTitle} — {selectedPayment.clientName}</p>
            <div className="space-y-0">
              {getTimeline(selectedPayment).map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      step.done ? 'bg-emerald-500/15' : 'bg-slate-500/10'
                    }`}>
                      <i className={`${step.icon} ${step.done ? 'text-emerald-400' : 'text-slate-600'} text-sm`}></i>
                    </div>
                    {i < 5 && <div className={`w-0.5 h-6 ${step.done ? 'bg-emerald-500/30' : 'bg-slate-700'}`}></div>}
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
              className="w-full mt-4 py-3 bg-[#162036] text-slate-300 rounded-xl font-semibold hover:bg-[#1a2642] transition-colors cursor-pointer">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}