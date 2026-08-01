'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import SubscriptionTable from './SubscriptionTable';
import SubscriptionDetailModal from './SubscriptionDetailModal';

interface Subscription {
  id: string;
  user_id: string;
  plan_name: string;
  plan_slug: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: string;
  current_period_end: string;
  current_period_start: string;
  created_at: string;
  updated_at: string;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  last_payment_date: string | null;
  payment_status: string | null;
  payment_failure_count: number;
  last_payment_error: string | null;
  billing_cycle: string | null;
  amount_paid: number | null;
  trial_end_date: string | null;
  currency: string | null;
}

interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  user_type: string;
}

interface Plan {
  slug: string;
  name: string;
  audience: string;
  monthly_price_pence: number;
}

interface PageStats {
  total: number;
  active: number;
  pending: number;
  pastDue: number;
  cancelled: number;
  withStripe: number;
}

const PAGE_SIZE = 25;

function SubscriptionManagementInner() {
  const searchParams = useSearchParams();
  const openSubId = searchParams.get('open');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [users, setUsers] = useState<Record<string, UserInfo>>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'period_end' | 'created_at' | 'status'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<PageStats>({ total: 0, active: 0, pending: 0, pastDue: 0, cancelled: 0, withStripe: 0 });
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const [mountedRef] = useState({ current: true });

  const fetchData = useCallback(async (currentPage?: number) => {
    const p = currentPage ?? page;
    setLoading(true);
    setError(null);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;
      if (!accessToken) {
        if (mountedRef.current) {
          setError('Session expired. Please log in again.');
          setLoading(false);
        }
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-subscriptions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            page: p,
            pageSize: PAGE_SIZE,
            search: searchQuery,
            status: statusFilter,
            type: typeFilter,
            planSlug: planFilter,
            sortBy,
            sortDir,
          }),
        }
      );
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch subscriptions');
      }

      if (mountedRef.current) {
        setSubscriptions(data.subscriptions || []);
        setUsers(data.users || {});
        setPlans(data.plans || []);
        setTotalCount(data.totalCount || 0);
        setStats(data.stats || { total: 0, active: 0, pending: 0, pastDue: 0, cancelled: 0, withStripe: 0 });
        setPage(data.page || 1);
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to load subscriptions');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [page, searchQuery, statusFilter, typeFilter, planFilter, sortBy, sortDir, mountedRef]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    fetchData(1);
    setPage(1);
  }, [searchQuery, statusFilter, typeFilter, planFilter, sortBy, sortDir]);

  useEffect(() => {
    fetchData(page);
  }, [page]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (!loading && openSubId && !autoOpened && subscriptions.length > 0) {
      const target = subscriptions.find(s => s.id === openSubId);
      if (target) {
        setSelectedSub(target);
        setSelectedUser(users[target.user_id] || null);
        setShowDetailModal(true);
        setAutoOpened(true);
      }
    }
  }, [loading, openSubId, autoOpened, subscriptions, users]);

  const handleViewDetail = (sub: Subscription) => {
    setSelectedSub(sub);
    setSelectedUser(users[sub.user_id] || null);
    setShowDetailModal(true);
  };

  const refreshCurrentPage = () => fetchData(page);

  const handleCancelSub = async (stripeSubId: string, userId: string) => {
    if (!stripeSubId) return;
    setActionLoading(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;
      if (!accessToken) {
        setToast({ message: 'Session expired. Please log in again.', type: 'error' });
        setActionLoading(false);
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ stripeSubscriptionId: stripeSubId, userId }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setToast({ message: 'Subscription marked for cancellation', type: 'success' });
        setShowDetailModal(false);
        refreshCurrentPage();
      } else {
        setToast({ message: data.error || 'Cancel failed', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to cancel subscription', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeSub = async (stripeSubId: string, userId: string) => {
    if (!stripeSubId) return;
    setActionLoading(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;
      if (!accessToken) {
        setToast({ message: 'Session expired. Please log in again.', type: 'error' });
        setActionLoading(false);
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resume-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ stripeSubscriptionId: stripeSubId, userId }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setToast({ message: 'Subscription resumed', type: 'success' });
        setShowDetailModal(false);
        refreshCurrentPage();
      } else {
        setToast({ message: data.error || 'Resume failed', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to resume subscription', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;
      if (!accessToken) {
        setToast({ message: 'Session expired. Please log in again.', type: 'error' });
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-subscriptions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            page: 1,
            pageSize: 5000,
            search: searchQuery,
            status: statusFilter,
            type: typeFilter,
            planSlug: planFilter,
            sortBy,
            sortDir,
            exportMode: true,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);

      const subs = data.subscriptions || [];
      const usersMap = data.users || {};

      const headers = ['User Name','Email','User Type','Plan','Plan Slug','Status','Cancelling','Period Start','Period End','Created','Stripe Sub ID','Stripe Customer ID','Payment Status','Failed Payments','Amount Paid','Currency'];
      const rows = subs.map((s: any) => {
        const u = usersMap[s.user_id] || {};
        return [
          u.full_name || '',
          u.email || '',
          u.user_type || '',
          s.plan_name || '',
          s.plan_slug || '',
          s.status || '',
          s.cancel_at_period_end ? 'Yes' : 'No',
          s.current_period_start || '',
          s.current_period_end || '',
          s.created_at || '',
          s.stripe_subscription_id || '',
          s.stripe_customer_id || '',
          s.payment_status || '',
          s.payment_failure_count || 0,
          s.amount_paid || '',
          s.currency || '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      });

      const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `subscriptions-export-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setToast({ message: `Exported ${subs.length} subscriptions`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to export CSV', type: 'error' });
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const showingFrom = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, totalCount);

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'trialing', label: 'Trialing' },
    { value: 'pending', label: 'Pending' },
    { value: 'past_due', label: 'Past Due' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'incomplete', label: 'Incomplete' },
  ];

  const toggleSort = (field: 'period_end' | 'created_at' | 'status') => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="min-h-screen bg-[#0a0f1c]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1e2d4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-500/20">
                <i className="ri-bank-card-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Subscription Management</h1>
                <p className="text-xs text-slate-400">
                  {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Loading...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-file-download-line"></i>
                </div>
                Export CSV
              </button>
              <button
                onClick={refreshCurrentPage}
                className="flex items-center gap-2 px-4 py-2 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-refresh-line"></i>
                </div>
                Refresh
              </button>
              <Link
                href="/admin/stripe-sync"
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-exchange-dollar-line text-sm"></i>
                </div>
                Stripe Sync
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/admin/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
            Admin
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300">Subscription Management</span>
          <span className="text-slate-600 mx-1">|</span>
          <Link href="/admin/subscription-analytics" className="text-teal-400 hover:text-teal-300 text-xs transition-colors">
            Analytics
          </Link>
          <Link href="/admin/revenue-forecast" className="text-teal-400 hover:text-teal-300 text-xs transition-colors">
            Revenue Forecast
          </Link>
          <Link href="/admin/subscription-tracking" className="text-teal-400 hover:text-teal-300 text-xs transition-colors">
            Tracking
          </Link>
        </div>

        {error && (
          <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 flex items-center justify-center text-red-400">
                <i className="ri-error-warning-line text-lg"></i>
              </div>
              <p className="text-sm text-red-300">{error}</p>
            </div>
            <button
              onClick={refreshCurrentPage}
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-colors whitespace-nowrap cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total', value: stats.total, icon: 'ri-bank-card-line', color: 'bg-slate-500/15 text-slate-300' },
            { label: 'Active', value: stats.active, icon: 'ri-checkbox-circle-line', color: 'bg-emerald-500/15 text-emerald-400' },
            { label: 'Pending', value: stats.pending, icon: 'ri-time-line', color: 'bg-amber-500/15 text-amber-400' },
            { label: 'Past Due', value: stats.pastDue, icon: 'ri-error-warning-line', color: 'bg-red-500/15 text-red-400' },
            { label: 'Cancelled', value: stats.cancelled, icon: 'ri-close-circle-line', color: 'bg-slate-500/15 text-slate-400' },
            { label: 'With Stripe ID', value: stats.withStripe, icon: 'ri-exchange-dollar-line', color: 'bg-sky-500/15 text-sky-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#111d35] border border-[#1e2d4a] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.color}`}>
                  <i className={`${s.icon} text-base`}></i>
                </div>
                <span className="text-xs font-medium text-slate-400">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-white" suppressHydrationWarning={true}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="relative w-full lg:w-72">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-500">
              <i className="ri-search-line"></i>
            </div>
            <input
              type="text"
              placeholder="Search user, email, plan, Stripe ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 py-2.5 border border-[#1e2d4a] rounded-xl text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-transparent w-full bg-[#0a1628] text-slate-200 placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-300 bg-[#0a1628] focus:ring-2 focus:ring-teal-500/50 focus:border-transparent cursor-pointer pr-8"
            >
              {statusOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2.5 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-300 bg-[#0a1628] focus:ring-2 focus:ring-teal-500/50 focus:border-transparent cursor-pointer pr-8"
            >
              <option value="all">All Types</option>
              <option value="client">Clients</option>
              <option value="guard">Guards</option>
            </select>

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-4 py-2.5 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-300 bg-[#0a1628] focus:ring-2 focus:ring-teal-500/50 focus:border-transparent cursor-pointer pr-8"
            >
              <option value="all">All Plans</option>
              {plans.map(p => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>

            <button
              onClick={() => {
                setStatusFilter('all');
                setTypeFilter('all');
                setPlanFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2.5 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-white/5 transition-colors whitespace-nowrap cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-300">{showingFrom}\u2013{showingTo}</span> of{' '}
          <span className="font-semibold text-slate-300">{totalCount}</span> subscriptions
        </p>

        <div className="bg-[#111d35] border border-[#1e2d4a] rounded-2xl overflow-hidden shadow-sm">
          <SubscriptionTable
            subscriptions={subscriptions}
            users={users}
            plans={plans}
            sortBy={sortBy}
            sortDir={sortDir}
            onToggleSort={toggleSort}
            onViewDetail={handleViewDetail}
            loading={loading}
          />
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-9 h-9 rounded-lg border border-[#1e2d4a] flex items-center justify-center text-slate-400 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <i className="ri-arrow-left-s-line"></i>
              </button>
              {getPageNumbers().map((p, i) =>
                typeof p === 'string' ? (
                  <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-slate-600 text-sm">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      page === p
                        ? 'bg-teal-600 text-white'
                        : 'border border-[#1e2d4a] text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="w-9 h-9 rounded-lg border border-[#1e2d4a] flex items-center justify-center text-slate-400 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <i className="ri-arrow-right-s-line"></i>
              </button>
            </div>
          </div>
        )}
      </main>

      {showDetailModal && selectedSub && (
        <SubscriptionDetailModal
          subscription={selectedSub}
          user={selectedUser}
          plan={plans.find(p => p.slug === selectedSub.plan_slug) || null}
          onClose={() => setShowDetailModal(false)}
          onCancel={() => {
            if (selectedSub.stripe_subscription_id) {
              handleCancelSub(selectedSub.stripe_subscription_id, selectedSub.user_id);
            }
          }}
          onResume={() => {
            if (selectedSub.stripe_subscription_id) {
              handleResumeSub(selectedSub.stripe_subscription_id, selectedSub.user_id);
            }
          }}
          actionLoading={actionLoading}
        />
      )}

      {toast && (
        <div className={`fixed top-6 right-6 px-5 py-3 rounded-xl shadow-lg z-50 flex items-center gap-3 animate-fade-in ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
        }`}>
          <div className="w-6 h-6 flex items-center justify-center">
            <i className={`${toast.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'} text-lg`}></i>
          </div>
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default function SubscriptionManagementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading subscription data...</p>
        </div>
      </div>
    }>
      <SubscriptionManagementInner />
    </Suspense>
  );
}