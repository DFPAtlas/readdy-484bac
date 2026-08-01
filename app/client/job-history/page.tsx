'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import UpgradePrompt from '@/components/UpgradePrompt';
import { useClientGuard } from '@/hooks/useClientGuard';
import { useRouteGuard } from '@/hooks/useRouteGuard';

interface HistoryGuard {
  id: string;
  assignment_id: string;
  full_name: string;
  profile_image_url: string | null;
  rating: number | null;
  status: string;
  payment_status: string | null;
  payment_amount: number | null;
  assigned_at: string | null;
  completed_at: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  attendance_status: string | null;
  late_minutes: number | null;
  issue_reported: boolean;
  payout_released: boolean;
  payout_released_at: string | null;
}

interface HistoryJob {
  job_id: string;
  job_title: string;
  venue_city: string;
  venue_postcode: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  hourly_rate: number | null;
  agreed_amount: number | null;
  number_of_guards: number;
  job_status: string;
  payment_status: string | null;
  stripe_payment_intent_id: string | null;
  platform_fee: number | null;
  guard_payout_amount: number | null;
  created_at: string;
  updated_at: string | null;
  applications_count: number;
  assigned_count: number;
  disputed: boolean;
  disputed_at: string | null;
  disputed_reason: string | null;
  cancelled_at: string | null;
  refund_amount: number | null;
  refunded_at: string | null;
  guards: HistoryGuard[];
  applications: {
    id: string;
    guard_id: string;
    full_name: string;
    profile_image_url: string | null;
    rating: number | null;
    status: string;
    applied_at: string;
  }[];
  completion_requests: {
    id: string;
    guard_id: string;
    status: string;
    requested_at: string;
    client_approved_at: string | null;
    client_disputed_at: string | null;
    dispute_reason: string | null;
    admin_approved_at: string | null;
    notes: string | null;
  }[];
  disputes: {
    id: string;
    guard_id: string;
    status: string;
    reason: string;
    details: string | null;
    resolution: string | null;
    refund_amount: number | null;
    admin_notes: string | null;
    stripe_refund_id: string | null;
    created_at: string;
    resolved_at: string | null;
  }[];
  reviews: {
    id: string;
    guard_id: string;
    guard_name: string;
    rating: number;
    punctuality_rating: number | null;
    professionalism_rating: number | null;
    communication_rating: number | null;
    comment: string | null;
    created_at: string;
  }[];
  client_reviews: {
    id: string;
    guard_id: string;
    guard_name: string;
    rating: number;
    comment: string | null;
    created_at: string;
  }[];
  audit_logs: {
    id: string;
    assignment_id: string | null;
    guard_id: string | null;
    from_status: string | null;
    to_status: string;
    changed_by_role: string | null;
    reason: string | null;
    stripe_event_id: string | null;
    created_at: string;
  }[];
  transactions: {
    id: string;
    amount: number;
    status: string;
    stripe_payment_intent_id: string | null;
    stripe_invoice_id: string | null;
    receipt_url: string | null;
    created_at: string;
  }[];
}

interface Stats {
  total_posted: number;
  total_with_applicants: number;
  total_hired: number;
  awaiting_payment: number;
  funded: number;
  in_progress: number;
  awaiting_approval: number;
  approved_and_paid: number;
  disputed: number;
  refunded: number;
  total_spent: number;
  completed: number;
  cancelled: number;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'posted', label: 'Posted / Open' },
  { value: 'awaiting_payment', label: 'Awaiting Payment' },
  { value: 'funded', label: 'Funded' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_approval', label: 'Awaiting Approval' },
  { value: 'completed', label: 'Completed' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_OPTIONS = [
  { value: 'all', label: 'All Payments' },
  { value: 'funded', label: 'Funded' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'failed', label: 'Failed' },
];

const STAT_CARDS = [
  { key: 'total_posted', label: 'Jobs Posted', icon: 'ri-briefcase-4-line', color: 'blue' },
  { key: 'total_hired', label: 'Guards Hired', icon: 'ri-shield-user-line', color: 'emerald' },
  { key: 'funded', label: 'Funded', icon: 'ri-money-pound-circle-line', color: 'teal' },
  { key: 'completed', label: 'Completed', icon: 'ri-checkbox-circle-line', color: 'violet' },
  { key: 'in_progress', label: 'In Progress', icon: 'ri-pulse-line', color: 'amber' },
  { key: 'awaiting_approval', label: 'Pending Approval', icon: 'ri-time-line', color: 'orange' },
  { key: 'disputed', label: 'Disputed', icon: 'ri-alarm-warning-line', color: 'red' },
  { key: 'refunded', label: 'Refunded', icon: 'ri-refund-line', color: 'slate' },
];

const colorMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  teal: { bg: 'bg-teal-500/10', text: 'text-teal-400' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  red: { bg: 'bg-red-500/10', text: 'text-red-400' },
  slate: { bg: 'bg-slate-500/10', text: 'text-slate-400' },
};

export default function ClientJobHistoryClient() {
  const router = useRouter();
  const { loading: authLoading, allowed, userId, clientData } = useClientGuard();
  const { checking, blocked } = useRouteGuard(userId);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [clientName, setClientName] = useState('Client');
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [guardFilter, setGuardFilter] = useState('');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const abortRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async (pageNum: number, isRefresh = false) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    if (!isRefresh) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? '';

      const body: Record<string, any> = {
        page: pageNum,
        pageSize,
      };
      if (searchQuery.trim()) body.search = searchQuery.trim();
      if (guardFilter.trim()) body.guardSearch = guardFilter.trim();
      if (statusFilter !== 'all') body.status = statusFilter;
      if (paymentFilter !== 'all') body.payment = paymentFilter;
      if (dateFrom) body.dateFrom = dateFrom;
      if (dateTo) body.dateTo = dateTo;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-client-job-history`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      if (controller.signal.aborted) return;

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setJobs(data.jobs || []);
      setStats(data.stats || null);
      setTotalCount(data.totalCount || 0);
      setClientName(data.client?.company_name || clientData?.company_name || 'Client');
      setLastRefreshed(new Date());
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to load history. Please try again.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [searchQuery, statusFilter, paymentFilter, dateFrom, dateTo, guardFilter, clientData]);

  useEffect(() => {
    if (allowed && !checking && !blocked) {
      loadHistory(currentPage);
    }
  }, [allowed, checking, blocked]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    loadHistory(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = () => {
    setCurrentPage(1);
    loadHistory(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setDateFrom('');
    setDateTo('');
    setGuardFilter('');
    setCurrentPage(1);
    loadHistory(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const getStatusBadge = (job: HistoryJob) => {
    if (job.disputed || job.disputes.some((d) => d.status === 'open' || d.status === 'under_review')) {
      return { label: 'Disputed', class: 'bg-red-500/15 text-red-400 border border-red-500/25' };
    }
    if (job.job_status === 'cancelled') {
      return { label: 'Cancelled', class: 'bg-slate-500/15 text-slate-400 border border-slate-500/25' };
    }
    if (job.job_status === 'completed') {
      return { label: 'Completed', class: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' };
    }
    if (job.job_status === 'in_progress' || job.job_status === 'active') {
      return { label: 'In Progress', class: 'bg-blue-500/15 text-blue-400 border border-blue-500/25' };
    }
    if (job.payment_status === 'funded' || job.payment_status === 'paid') {
      return { label: 'Funded', class: 'bg-teal-500/15 text-teal-400 border border-teal-500/25' };
    }
    if (job.payment_status === 'pending' || job.payment_status === 'awaiting_payment') {
      return { label: 'Awaiting Payment', class: 'bg-amber-500/15 text-amber-400 border border-amber-500/25' };
    }
    if (job.job_status === 'open') {
      return { label: 'Posted', class: 'bg-blue-500/15 text-blue-400 border border-blue-500/25' };
    }
    return { label: job.job_status || 'Unknown', class: 'bg-slate-500/15 text-slate-400 border border-slate-500/25' };
  };

  const getPaymentBadge = (job: HistoryJob) => {
    if (job.refund_amount || job.refunded_at || job.transactions.some((t) => t.status === 'refunded')) {
      return { label: 'Refunded', class: 'bg-red-500/15 text-red-400 border border-red-500/25' };
    }
    if (job.payment_status === 'funded') {
      return { label: 'Funded', class: 'bg-teal-500/15 text-teal-400 border border-teal-500/25' };
    }
    if (job.payment_status === 'paid') {
      return { label: 'Paid', class: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' };
    }
    if (job.payment_status === 'pending') {
      return { label: 'Pending', class: 'bg-amber-500/15 text-amber-400 border border-amber-500/25' };
    }
    return { label: 'Unpaid', class: 'bg-slate-500/15 text-slate-400 border border-slate-500/25' };
  };

  if (authLoading || !allowed || checking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex items-center justify-center px-6">
        <div className="w-full max-w-lg">
          <UpgradePrompt feature="client.job_history" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={clientName}
        subtitle="Client"
        initials={clientName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
        userId={userId}
      />
      <main className="flex-1 min-h-screen pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Job & Payment History</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                All your posted jobs, payments, and guard feedback in one place
                {lastRefreshed && (
                  <span className="ml-2 text-xs text-slate-400">
                    · Updated {lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCurrentPage(1); loadHistory(1, true); }}
                disabled={loading || refreshing}
                className="flex items-center gap-2 bg-[#162036] text-slate-400 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 border border-[#1e2d4d]"
              >
                <i className={`ri-refresh-line ${refreshing ? 'animate-spin' : ''}`}></i>
                Refresh
              </button>
              <Link
                href="/client/post-job"
                className="flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-circle-line"></i>
                Post Job
              </Link>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <i className="ri-error-warning-line text-red-400 text-lg"></i>
                <p className="text-sm text-red-400">{error}</p>
              </div>
              <button
                onClick={() => { setCurrentPage(1); loadHistory(1, true); }}
                className="px-4 py-2 bg-red-500/20 text-red-400 text-sm font-medium rounded-lg hover:bg-red-500/30 transition-colors cursor-pointer whitespace-nowrap"
              >
                Retry
              </button>
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
              {STAT_CARDS.map((card) => {
                const value = (stats as any)[card.key];
                const c = colorMap[card.color];
                return (
                  <div key={card.key} className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
                      <i className={`${card.icon} text-lg ${c.text}`}></i>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{card.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Spend Summary */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <i className="ri-money-pound-circle-line text-xl text-emerald-400"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Spent</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">£{Number(stats.total_spent).toFixed(2)}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-teal-500/10 rounded-lg flex items-center justify-center">
                  <i className="ri-wallet-3-line text-xl text-teal-400"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Funded Jobs</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.funded}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center">
                  <i className="ri-refund-line text-xl text-red-400"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Refunded</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.refunded}</p>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4 mb-6">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex-1 relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); }}
                  placeholder="Search by job title or location..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
              </div>
              <div className="relative">
                <i className="ri-shield-user-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="text"
                  value={guardFilter}
                  onChange={(e) => { setGuardFilter(e.target.value); }}
                  placeholder="Filter by guard name..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); }}
                  className="px-3 py-2.5 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 appearance-none cursor-pointer pr-8"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  value={paymentFilter}
                  onChange={(e) => { setPaymentFilter(e.target.value); }}
                  className="px-3 py-2.5 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 appearance-none cursor-pointer pr-8"
                >
                  {PAYMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); }}
                  className="px-3 py-2.5 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); }}
                  className="px-3 py-2.5 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
                <button
                  onClick={handleFilterChange}
                  className="px-4 py-2.5 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Apply
                </button>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-[#162036] text-slate-500 dark:text-slate-400 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Clear
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">{totalCount} result{totalCount !== 1 ? 's' : ''}</p>
          </div>

          {/* Job List */}
          {loading && jobs.length === 0 ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-6 animate-pulse">
                  <div className="h-5 bg-slate-200 dark:bg-[#162036] rounded w-1/3 mb-3"></div>
                  <div className="h-4 bg-slate-200 dark:bg-[#162036] rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-slate-200 dark:bg-[#162036] rounded w-1/4"></div>
                </div>
              ))}
            </div>
          ) : jobs.length === 0 && !loading ? (
            <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] p-16 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-history-line text-3xl text-slate-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' || dateFrom || dateTo || guardFilter
                  ? 'No jobs match your filters'
                  : 'No history found'}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' || dateFrom || dateTo || guardFilter
                  ? 'Try adjusting your search or filter criteria.'
                  : 'You have not posted any jobs yet.'}
              </p>
              {!searchQuery && statusFilter === 'all' && paymentFilter === 'all' && !dateFrom && !dateTo && !guardFilter ? (
                <Link href="/client/post-job" className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                  <i className="ri-add-circle-line"></i>
                  Post Your First Job
                </Link>
              ) : (
                <button onClick={clearFilters} className="inline-flex items-center gap-2 bg-slate-100 dark:bg-[#162036] text-slate-600 dark:text-slate-300 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap">
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {refreshing && (
                <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-3 h-3 border border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  Refreshing...
                </div>
              )}
              <div className="space-y-3">
                {jobs.map((job) => {
                  const statusBadge = getStatusBadge(job);
                  const paymentBadge = getPaymentBadge(job);
                  const isExpanded = expandedJobId === job.job_id;
                  return (
                    <div key={job.job_id} className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] overflow-hidden">
                      <div
                        className="p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#0B1933]/50 transition-colors"
                        onClick={() => setExpandedJobId(isExpanded ? null : job.job_id)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">{job.job_title}</h3>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.class}`}>{statusBadge.label}</span>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${paymentBadge.class}`}>{paymentBadge.label}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                              <span className="flex items-center gap-1"><i className="ri-map-pin-line"></i>{job.venue_city}{job.venue_postcode ? `, ${job.venue_postcode}` : ''}</span>
                              <span className="flex items-center gap-1"><i className="ri-calendar-line"></i>{job.start_date ? new Date(job.start_date).toLocaleDateString('en-GB') : 'N/A'}</span>
                              <span className="flex items-center gap-1"><i className="ri-time-line"></i>{job.start_time || ''} - {job.end_time || ''}</span>
                              {job.agreed_amount && (
                                <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                                  <i className="ri-money-pound-circle-line"></i>£{Number(job.agreed_amount).toFixed(2)}
                                </span>
                              )}
                              <span className="flex items-center gap-1"><i className="ri-shield-user-line"></i>{job.guards.length} / {job.number_of_guards} guards</span>
                              <span className="flex items-center gap-1"><i className="ri-user-received-line"></i>{job.applications.length} applicants</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Link
                              href={`/client/jobs/${job.job_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-1.5 border border-slate-200 dark:border-[#1e2d4d] text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-[#162036] transition-colors whitespace-nowrap"
                            >
                              View Job
                            </Link>
                            <i className={`ri-arrow-down-s-line text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-5 pb-5 border-t border-slate-200 dark:border-[#1e2d4d] pt-4">
                          {/* Guards Section */}
                          {job.guards.length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Assigned Guards</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {job.guards.map((guard) => (
                                  <div key={guard.assignment_id} className="bg-slate-50 dark:bg-[#0B1933] rounded-lg p-3 border border-slate-100 dark:border-[#1e2d4d]">
                                    <div className="flex items-center gap-3 mb-2">
                                      <div className="w-10 h-10 bg-slate-200 dark:bg-[#162036] rounded-full flex items-center justify-center text-sm font-bold text-slate-500">
                                        {guard.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{guard.full_name}</p>
                                        {guard.rating && <p className="text-xs text-slate-400">{guard.rating} <i className="ri-star-fill text-amber-400"></i></p>}
                                      </div>
                                    </div>
                                    <div className="space-y-1 text-xs text-slate-500">
                                      <p>Status: <span className="text-slate-700 dark:text-slate-300 capitalize">{guard.status}</span></p>
                                      <p>Payment: <span className="text-slate-700 dark:text-slate-300 capitalize">{guard.payment_status || 'N/A'}</span></p>
                                      {guard.payment_amount && <p>Amount: £{Number(guard.payment_amount).toFixed(2)}</p>}
                                      {guard.assigned_at && <p>Assigned: {new Date(guard.assigned_at).toLocaleDateString('en-GB')}</p>}
                                      {guard.completed_at && <p>Completed: {new Date(guard.completed_at).toLocaleDateString('en-GB')}</p>}
                                      {guard.payout_released && <p className="text-emerald-400">Payout released</p>}
                                      {guard.attendance_status && <p>Attendance: <span className="capitalize">{guard.attendance_status}</span></p>}
                                      {guard.late_minutes ? <p className="text-amber-400">{guard.late_minutes} min late</p> : null}
                                      {guard.issue_reported ? <p className="text-red-400">Issue reported</p> : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Applications */}
                          {job.applications.length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Applicants ({job.applications.length})</p>
                              <div className="flex flex-wrap gap-2">
                                {job.applications.slice(0, 6).map((app) => (
                                  <div key={app.id} className="flex items-center gap-2 bg-slate-50 dark:bg-[#0B1933] rounded-lg px-3 py-2 border border-slate-100 dark:border-[#1e2d4d]">
                                    <div className="w-7 h-7 bg-slate-200 dark:bg-[#162036] rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
                                      {app.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{app.full_name}</p>
                                      <p className="text-[10px] text-slate-400 capitalize">{app.status}</p>
                                    </div>
                                  </div>
                                ))}
                                {job.applications.length > 6 && (
                                  <span className="text-xs text-slate-500 self-center">+{job.applications.length - 6} more</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Completion Requests */}
                          {job.completion_requests.length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Completion Requests</p>
                              <div className="space-y-2">
                                {job.completion_requests.map((req) => (
                                  <div key={req.id} className="flex items-center gap-3 bg-slate-50 dark:bg-[#0B1933] rounded-lg p-3 border border-slate-100 dark:border-[#1e2d4d]">
                                    <i className={`ri-checkbox-circle-line ${req.status === 'approved' ? 'text-emerald-400' : req.status === 'pending' ? 'text-amber-400' : 'text-slate-400'}`}></i>
                                    <div className="flex-1">
                                      <p className="text-xs text-slate-700 dark:text-slate-300">Guard requested completion <span className="text-slate-400">{req.requested_at ? new Date(req.requested_at).toLocaleDateString('en-GB') : ''}</span></p>
                                      <p className="text-xs text-slate-500 capitalize">Status: {req.status}</p>
                                    </div>
                                    {req.status === 'pending' && (
                                      <Link href="/client/dashboard" className="px-3 py-1.5 bg-teal-500 text-white rounded-lg text-xs font-medium hover:bg-teal-600 transition-colors whitespace-nowrap">
                                        Approve
                                      </Link>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Disputes */}
                          {job.disputes.length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Disputes</p>
                              {job.disputes.map((d) => (
                                <div key={d.id} className="bg-red-50 dark:bg-red-500/5 rounded-lg p-4 border border-red-200 dark:border-red-500/20 mb-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <i className="ri-alarm-warning-line text-red-400"></i>
                                    <p className="text-sm font-semibold text-red-400">{d.status === 'open' ? 'Open Dispute' : 'Resolved Dispute'}</p>
                                  </div>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Reason: {d.reason}</p>
                                  {d.details && <p className="text-xs text-slate-500 mb-1">Details: {d.details}</p>}
                                  {d.resolution && <p className="text-xs text-slate-500 mb-1">Resolution: {d.resolution}</p>}
                                  {d.refund_amount && <p className="text-xs text-red-400">Refund: £{Number(d.refund_amount).toFixed(2)}</p>}
                                  {d.admin_notes && <p className="text-xs text-slate-500 mt-1">Admin notes: {d.admin_notes}</p>}
                                  <p className="text-xs text-slate-400 mt-2">{new Date(d.created_at).toLocaleDateString('en-GB')}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reviews Given */}
                          {job.reviews.length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Your Guard Reviews</p>
                              {job.reviews.map((r) => (
                                <div key={r.id} className="bg-emerald-50 dark:bg-emerald-500/5 rounded-lg p-4 border border-emerald-200 dark:border-emerald-500/20 mb-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <i className="ri-star-fill text-emerald-400"></i>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{r.guard_name}</p>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{r.rating}/5</span>
                                  </div>
                                  <div className="flex items-center gap-4 mb-2 text-xs text-slate-500">
                                    {r.punctuality_rating && <span>Punctuality: {r.punctuality_rating}/5</span>}
                                    {r.professionalism_rating && <span>Professional: {r.professionalism_rating}/5</span>}
                                    {r.communication_rating && <span>Communication: {r.communication_rating}/5</span>}
                                  </div>
                                  {r.comment && <p className="text-sm text-slate-600 dark:text-slate-400 italic">&ldquo;{r.comment}&rdquo;</p>}
                                  <p className="text-xs text-slate-400 mt-2">{new Date(r.created_at).toLocaleDateString('en-GB')}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reviews Received */}
                          {job.client_reviews.length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Reviews from Guards</p>
                              {job.client_reviews.map((r) => (
                                <div key={r.id} className="bg-blue-50 dark:bg-blue-500/5 rounded-lg p-4 border border-blue-200 dark:border-blue-500/20 mb-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <i className="ri-star-fill text-blue-400"></i>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{r.guard_name}</p>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{r.rating}/5</span>
                                  </div>
                                  {r.comment && <p className="text-sm text-slate-600 dark:text-slate-400 italic">&ldquo;{r.comment}&rdquo;</p>}
                                  <p className="text-xs text-slate-400 mt-2">{new Date(r.created_at).toLocaleDateString('en-GB')}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Transactions */}
                          {job.transactions.length > 0 && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Payments & Invoices</p>
                              <div className="space-y-2">
                                {job.transactions.map((t) => (
                                  <div key={t.id} className="flex items-center justify-between bg-slate-50 dark:bg-[#0B1933] rounded-lg p-3 border border-slate-100 dark:border-[#1e2d4d]">
                                    <div className="flex items-center gap-3">
                                      <i className={`ri-secure-payment-line ${t.status === 'succeeded' || t.status === 'paid' ? 'text-emerald-400' : t.status === 'refunded' ? 'text-red-400' : 'text-amber-400'}`}></i>
                                      <div>
                                        <p className="text-xs text-slate-700 dark:text-slate-300">£{Number(t.amount).toFixed(2)} <span className="text-slate-400 capitalize">{t.status}</span></p>
                                        {t.stripe_invoice_id && <p className="text-xs text-slate-400">Invoice: {t.stripe_invoice_id.slice(-12)}</p>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString('en-GB')}</span>
                                      {t.receipt_url && (
                                        <a href={t.receipt_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 border border-slate-200 dark:border-[#1e2d4d] text-slate-500 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-[#162036] transition-colors whitespace-nowrap">
                                          Receipt
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Audit Log */}
                          {job.audit_logs.length > 0 && (
                            <div className="bg-slate-50 dark:bg-[#0B1933] rounded-lg p-4 border border-slate-100 dark:border-[#1e2d4d]">
                              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Payment Audit Trail</p>
                              <div className="space-y-2">
                                {job.audit_logs.map((log) => (
                                  <div key={log.id} className="flex items-center gap-3 text-xs">
                                    <span className="text-slate-400">{new Date(log.created_at).toLocaleDateString('en-GB')}</span>
                                    <span className="text-slate-500">{log.from_status || '—'} <i className="ri-arrow-right-line text-slate-400"></i> {log.to_status}</span>
                                    <span className="text-slate-400">by {log.changed_by_role || 'system'}</span>
                                    {log.reason && <span className="text-slate-500 italic">&ldquo;{log.reason}&rdquo;</span>}
                                    {log.stripe_event_id && <span className="text-slate-400">Stripe: {log.stripe_event_id.slice(-12)}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1 || loading || refreshing}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#162036] disabled:opacity-40 cursor-pointer"
                  >
                    <i className="ri-arrow-left-s-line"></i>
                  </button>
                  <span className="text-sm text-slate-500">Page {currentPage} of {totalPages}</span>
                  <button
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages || loading || refreshing}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#162036] disabled:opacity-40 cursor-pointer"
                  >
                    <i className="ri-arrow-right-s-line"></i>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}