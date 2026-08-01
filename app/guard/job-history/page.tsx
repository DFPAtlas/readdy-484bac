'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import { useGuardGuard } from '@/hooks/useGuardGuard';
import MessageClientModal from '@/app/guard/components/MessageClientModal';

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
  client_name: string;
  job_status: string;
  payment_status: string | null;
  stripe_payment_intent_id: string | null;
  platform_fee: number | null;
  guard_payout_amount: number | null;
  application_status: string | null;
  applied_at: string | null;
  assignment_status: string | null;
  assigned_at: string | null;
  completed_at: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  attendance_status: string | null;
  late_minutes: number | null;
  issue_reported: boolean;
  payout_released: boolean;
  payout_released_at: string | null;
  completion_request_status: string | null;
  completion_requested_at: string | null;
  client_approved_at: string | null;
  dispute_status: string | null;
  dispute_reason: string | null;
  dispute_created_at: string | null;
  review: {
    id: string;
    rating: number;
    punctuality_rating: number | null;
    professionalism_rating: number | null;
    communication_rating: number | null;
    comment: string | null;
    created_at: string;
    client_name: string;
  } | null;
  client_review: {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
  } | null;
  audit_logs: any[];
  payout: {
    id: string;
    amount: number;
    status: string;
    stripe_transfer_id: string | null;
    created_at: string;
    paid_at: string | null;
  } | null;
}

interface Stats {
  total_applied: number;
  total_accepted: number;
  total_funded: number;
  total_completed: number;
  total_pending_approval: number;
  total_paid_out: number;
  total_disputed: number;
  total_cancelled: number;
  total_earned: number;
  pending_payout: number;
  released_payout: number;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'applied', label: 'Applied' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'disputed', label: 'Disputed' },
];

const PAYMENT_OPTIONS = [
  { value: 'all', label: 'All Payments' },
  { value: 'funded', label: 'Funded' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'released', label: 'Payout Released' },
  { value: 'unpaid', label: 'Unpaid' },
];

const STAT_CARDS = [
  { key: 'total_applied', label: 'Jobs Applied', icon: 'ri-send-plane-line', color: 'blue' },
  { key: 'total_accepted', label: 'Accepted', icon: 'ri-checkbox-circle-line', color: 'emerald' },
  { key: 'total_funded', label: 'Funded', icon: 'ri-money-pound-circle-line', color: 'teal' },
  { key: 'total_completed', label: 'Completed', icon: 'ri-flag-line', color: 'violet' },
  { key: 'total_pending_approval', label: 'Pending Approval', icon: 'ri-time-line', color: 'amber' },
  { key: 'total_paid_out', label: 'Paid Out', icon: 'ri-check-double-line', color: 'emerald' },
  { key: 'total_disputed', label: 'Disputed', icon: 'ri-alarm-warning-line', color: 'red' },
  { key: 'total_cancelled', label: 'Cancelled', icon: 'ri-close-circle-line', color: 'slate' },
];

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  slate: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' },
};

export default function GuardJobHistoryClient() {
  const router = useRouter();
  const { loading: authLoading, allowed } = useGuardGuard();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [guardName, setGuardName] = useState('Guard');
  const [guardUserId, setGuardUserId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageJob, setMessageJob] = useState<HistoryJob | null>(null);
  const [messageClientUserId, setMessageClientUserId] = useState<string | null>(null);
  const pageSize = 10;

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user?.id) setGuardUserId(sessionData.session.user.id);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-guard-job-history`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token ?? ''}`,
          },
        }
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setError(null);
      setJobs(data.jobs || []);
      setStats(data.stats || null);
      setGuardName(data.guard?.full_name || 'Guard');
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (j) =>
          j.job_title.toLowerCase().includes(q) ||
          j.client_name.toLowerCase().includes(q) ||
          j.venue_city.toLowerCase().includes(q) ||
          j.venue_postcode.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'applied') {
        result = result.filter((j) => j.application_status && !j.assignment_status);
      } else if (statusFilter === 'accepted') {
        result = result.filter((j) => j.application_status === 'accepted' || j.application_status === 'confirmed');
      } else if (statusFilter === 'confirmed') {
        result = result.filter((j) => j.assignment_status === 'confirmed');
      } else if (statusFilter === 'in_progress') {
        result = result.filter((j) => j.assignment_status === 'in_progress');
      } else if (statusFilter === 'completed') {
        result = result.filter((j) => j.assignment_status === 'completed');
      } else if (statusFilter === 'cancelled') {
        result = result.filter((j) => j.job_status === 'cancelled');
      } else if (statusFilter === 'disputed') {
        result = result.filter((j) => j.dispute_status === 'open' || j.dispute_status === 'under_review');
      }
    }

    if (paymentFilter !== 'all') {
      if (paymentFilter === 'funded') {
        result = result.filter((j) => j.payment_status === 'funded');
      } else if (paymentFilter === 'paid') {
        result = result.filter((j) => j.payment_status === 'paid');
      } else if (paymentFilter === 'pending') {
        result = result.filter((j) => j.payment_status === 'pending');
      } else if (paymentFilter === 'released') {
        result = result.filter((j) => j.payout_released || j.payout?.status === 'paid');
      } else if (paymentFilter === 'unpaid') {
        result = result.filter((j) => !j.payment_status || j.payment_status === 'unpaid');
      }
    }

    if (dateFrom) {
      result = result.filter((j) => (j.start_date || '') >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((j) => (j.start_date || '') <= dateTo);
    }

    return result;
  }, [jobs, searchQuery, statusFilter, paymentFilter, dateFrom, dateTo]);

  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredJobs.slice(start, start + pageSize);
  }, [filteredJobs, currentPage]);

  const totalPages = Math.ceil(filteredJobs.length / pageSize);

  const getStatusBadge = (job: HistoryJob) => {
    if (job.dispute_status === 'open' || job.dispute_status === 'under_review') {
      return { label: 'Disputed', class: 'bg-red-500/15 text-red-400 border border-red-500/25' };
    }
    if (job.job_status === 'cancelled') {
      return { label: 'Cancelled', class: 'bg-slate-500/15 text-slate-400 border border-slate-500/25' };
    }
    if (job.assignment_status === 'completed') {
      return { label: 'Completed', class: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' };
    }
    if (job.assignment_status === 'in_progress') {
      return { label: 'In Progress', class: 'bg-blue-500/15 text-blue-400 border border-blue-500/25' };
    }
    if (job.assignment_status === 'confirmed') {
      return { label: 'Confirmed', class: 'bg-teal-500/15 text-teal-400 border border-teal-500/25' };
    }
    if (job.application_status === 'accepted' || job.application_status === 'confirmed') {
      return { label: 'Accepted', class: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' };
    }
    if (job.application_status === 'pending') {
      return { label: 'Applied', class: 'bg-amber-500/15 text-amber-400 border border-amber-500/25' };
    }
    return { label: job.job_status || 'Unknown', class: 'bg-slate-500/15 text-slate-400 border border-slate-500/25' };
  };

  const getPaymentBadge = (job: HistoryJob) => {
    if (job.payout_released || job.payout?.status === 'paid') {
      return { label: 'Released', class: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' };
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

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const openMessageModal = async (job: HistoryJob) => {
    const { data: jobRow } = await supabase
      .from('jobs')
      .select('client_id')
      .eq('id', job.job_id)
      .maybeSingle();
    if (!jobRow?.client_id) return;
    const { data: clientRow } = await supabase
      .from('clients')
      .select('user_id')
      .eq('id', jobRow.client_id)
      .maybeSingle();
    if (clientRow?.user_id) {
      setMessageClientUserId(clientRow.user_id);
      setMessageJob(job);
      setShowMessageModal(true);
    }
  };

  const canMessageJob = (job: HistoryJob) => {
    return !!job.application_status || !!job.assignment_status;
  };

  if (authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex">
      <PortalSidebar role="guard" displayName={guardName} subtitle="Guard" initials={guardName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()} accentColor="emerald" />
      <div className="flex-1 min-h-screen pt-16 lg:pt-8 pb-24 px-4 lg:pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Job & Payment History</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">All your jobs, payments, and feedback in one place</p>
            </div>
            <button
              onClick={() => loadHistory()}
              disabled={loading}
              className="flex items-center gap-2 bg-[#162036] text-slate-400 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 border border-[#1e2d4d]"
            >
              <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
              Refresh
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
              {STAT_CARDS.map((card) => {
                const value = (stats as any)[card.key];
                const c = colorMap[card.color];
                return (
                  <div key={card.key} className={`bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-3 flex items-center gap-3`}>
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

          {/* Earnings Summary */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <i className="ri-money-pound-circle-line text-xl text-emerald-400"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Earned</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">£{Number(stats.total_earned).toFixed(2)}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <i className="ri-time-line text-xl text-amber-400"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Pending Payout</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">£{Number(stats.pending_payout).toFixed(2)}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-teal-500/10 rounded-lg flex items-center justify-center">
                  <i className="ri-check-double-line text-xl text-teal-400"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Released Payout</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">£{Number(stats.released_payout).toFixed(2)}</p>
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
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Search by job, client, or location..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="relative">
                  <i className="ri-filter-3-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    className="pl-10 pr-8 py-2.5 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 appearance-none cursor-pointer"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <i className="ri-wallet-3-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <select
                    value={paymentFilter}
                    onChange={(e) => { setPaymentFilter(e.target.value); setCurrentPage(1); }}
                    className="pl-10 pr-8 py-2.5 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 appearance-none cursor-pointer"
                  >
                    {PAYMENT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  className="px-3 py-2.5 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                  className="px-3 py-2.5 bg-slate-50 dark:bg-[#0B1933] border border-slate-200 dark:border-[#1e2d4d] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
                <button
                  onClick={clearFilters}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-[#162036] text-slate-500 dark:text-slate-400 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Clear
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">{filteredJobs.length} result{filteredJobs.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Job List */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-6 animate-pulse">
                  <div className="h-5 bg-slate-200 dark:bg-[#162036] rounded w-1/3 mb-3"></div>
                  <div className="h-4 bg-slate-200 dark:bg-[#162036] rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-slate-200 dark:bg-[#162036] rounded w-1/4"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-red-200 dark:border-red-500/25 p-16 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-error-warning-line text-3xl text-red-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Something went wrong</h3>
              <p className="text-slate-500 text-sm mb-6">{error}</p>
              <button
                onClick={() => loadHistory()}
                className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-refresh-line"></i>
                Try Again
              </button>
            </div>
          ) : paginatedJobs.length === 0 ? (
            <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] p-16 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-history-line text-3xl text-slate-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No history found</h3>
              <p className="text-slate-500 text-sm mb-6">You have not applied to or worked any jobs yet.</p>
              <Link href="/jobs" className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-briefcase-line"></i>
                Browse Jobs
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedJobs.map((job) => {
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
                            <span className="flex items-center gap-1"><i className="ri-building-line"></i>{job.client_name}</span>
                            <span className="flex items-center gap-1"><i className="ri-map-pin-line"></i>{job.venue_city}{job.venue_postcode ? `, ${job.venue_postcode}` : ''}</span>
                            <span className="flex items-center gap-1"><i className="ri-calendar-line"></i>{job.start_date ? new Date(job.start_date).toLocaleDateString('en-GB') : 'N/A'}</span>
                            <span className="flex items-center gap-1"><i className="ri-time-line"></i>{job.start_time || ''} - {job.end_time || ''}</span>
                            {job.agreed_amount && (
                              <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                                <i className="ri-money-pound-circle-line"></i>£{Number(job.agreed_amount).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {canMessageJob(job) && (
                            <button
                              onClick={() => openMessageModal(job)}
                              className="px-3 py-1.5 border border-slate-200 dark:border-[#1e2d4d] text-teal-500 dark:text-teal-400 rounded-lg text-xs font-medium hover:bg-slate-50 dark:hover:bg-[#162036] transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                            >
                              <i className="ri-message-3-line"></i>Message
                            </button>
                          )}
                          <Link
                            href={`/jobs/${job.job_id}`}
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                          <div className="bg-slate-50 dark:bg-[#0B1933] rounded-lg p-3 border border-slate-100 dark:border-[#1e2d4d]">
                            <p className="text-xs text-slate-500 mb-1">Application</p>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 capitalize">{job.application_status || 'N/A'}</p>
                            {job.applied_at && <p className="text-xs text-slate-400 mt-1">Applied {new Date(job.applied_at).toLocaleDateString('en-GB')}</p>}
                          </div>
                          <div className="bg-slate-50 dark:bg-[#0B1933] rounded-lg p-3 border border-slate-100 dark:border-[#1e2d4d]">
                            <p className="text-xs text-slate-500 mb-1">Assignment</p>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 capitalize">{job.assignment_status || 'N/A'}</p>
                            {job.assigned_at && <p className="text-xs text-slate-400 mt-1">Assigned {new Date(job.assigned_at).toLocaleDateString('en-GB')}</p>}
                          </div>
                          <div className="bg-slate-50 dark:bg-[#0B1933] rounded-lg p-3 border border-slate-100 dark:border-[#1e2d4d]">
                            <p className="text-xs text-slate-500 mb-1">Attendance</p>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 capitalize">{job.attendance_status || 'N/A'}</p>
                            {job.check_in_time && <p className="text-xs text-slate-400 mt-1">Checked in {new Date(job.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>}
                            {job.check_out_time && <p className="text-xs text-slate-400 mt-1">Checked out {new Date(job.check_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>}
                            {job.late_minutes ? <p className="text-xs text-amber-400 mt-1">{job.late_minutes} min late</p> : null}
                            {job.issue_reported ? <p className="text-xs text-red-400 mt-1">Issue reported</p> : null}
                          </div>
                          <div className="bg-slate-50 dark:bg-[#0B1933] rounded-lg p-3 border border-slate-100 dark:border-[#1e2d4d]">
                            <p className="text-xs text-slate-500 mb-1">Payment</p>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 capitalize">{job.payment_status || 'N/A'}</p>
                            {job.guard_payout_amount && <p className="text-xs text-slate-400 mt-1">Payout: £{Number(job.guard_payout_amount).toFixed(2)}</p>}
                            {job.platform_fee && <p className="text-xs text-slate-400 mt-1">Platform fee: £{Number(job.platform_fee).toFixed(2)}</p>}
                            {job.stripe_payment_intent_id && <p className="text-xs text-slate-400 mt-1 truncate">PI: {job.stripe_payment_intent_id.slice(-12)}</p>}
                          </div>
                          <div className="bg-slate-50 dark:bg-[#0B1933] rounded-lg p-3 border border-slate-100 dark:border-[#1e2d4d]">
                            <p className="text-xs text-slate-500 mb-1">Completion</p>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 capitalize">{job.completion_request_status || 'N/A'}</p>
                            {job.completion_requested_at && <p className="text-xs text-slate-400 mt-1">Requested {new Date(job.completion_requested_at).toLocaleDateString('en-GB')}</p>}
                            {job.client_approved_at && <p className="text-xs text-emerald-400 mt-1">Approved {new Date(job.client_approved_at).toLocaleDateString('en-GB')}</p>}
                            {job.dispute_reason && <p className="text-xs text-red-400 mt-1">Dispute: {job.dispute_reason}</p>}
                          </div>
                          <div className="bg-slate-50 dark:bg-[#0B1933] rounded-lg p-3 border border-slate-100 dark:border-[#1e2d4d]">
                            <p className="text-xs text-slate-500 mb-1">Payout</p>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{job.payout?.status || (job.payout_released ? 'Released' : 'Pending')}</p>
                            {job.payout?.amount && <p className="text-xs text-slate-400 mt-1">Amount: £{Number(job.payout.amount).toFixed(2)}</p>}
                            {job.payout_released_at && <p className="text-xs text-emerald-400 mt-1">Released {new Date(job.payout_released_at).toLocaleDateString('en-GB')}</p>}
                            {job.payout?.stripe_transfer_id && <p className="text-xs text-slate-400 mt-1 truncate">Transfer: {job.payout.stripe_transfer_id.slice(-12)}</p>}
                          </div>
                        </div>

                        {/* Review from Client */}
                        {job.review && (
                          <div className="bg-emerald-50 dark:bg-emerald-500/5 rounded-lg p-4 border border-emerald-200 dark:border-emerald-500/20 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <i className="ri-star-fill text-emerald-400"></i>
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Client Feedback from {job.review.client_name}</p>
                            </div>
                            <div className="flex items-center gap-4 mb-2">
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">{job.review.rating}</span>
                                <span className="text-xs text-slate-400">/5 overall</span>
                              </div>
                              {job.review.punctuality_rating && (
                                <span className="text-xs text-slate-500">Punctuality: {job.review.punctuality_rating}/5</span>
                              )}
                              {job.review.professionalism_rating && (
                                <span className="text-xs text-slate-500">Professional: {job.review.professionalism_rating}/5</span>
                              )}
                              {job.review.communication_rating && (
                                <span className="text-xs text-slate-500">Communication: {job.review.communication_rating}/5</span>
                              )}
                            </div>
                            {job.review.comment && (
                              <p className="text-sm text-slate-600 dark:text-slate-400 italic">&ldquo;{job.review.comment}&rdquo;</p>
                            )}
                            <p className="text-xs text-slate-400 mt-2">{new Date(job.review.created_at).toLocaleDateString('en-GB')}</p>
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#162036] disabled:opacity-40 cursor-pointer"
                  >
                    <i className="ri-arrow-left-s-line"></i>
                  </button>
                  <span className="text-sm text-slate-500">{currentPage} / {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#162036] disabled:opacity-40 cursor-pointer"
                  >
                    <i className="ri-arrow-right-s-line"></i>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {showMessageModal && guardUserId && messageClientUserId && messageJob && (
        <MessageClientModal
          isOpen={showMessageModal}
          onClose={() => { setShowMessageModal(false); setMessageJob(null); setMessageClientUserId(null); }}
          jobId={messageJob.job_id}
          clientUserId={messageClientUserId}
          clientName={messageJob.client_name || 'Client'}
          jobTitle={messageJob.job_title}
          guardUserId={guardUserId}
        />
      )}
    </div>
  );
}