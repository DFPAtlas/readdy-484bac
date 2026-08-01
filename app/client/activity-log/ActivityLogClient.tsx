'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import { useClientGuard } from '@/hooks/useClientGuard';
import ActivityFilters from './ActivityFilters';
import ActivityExportModal from './ActivityExportModal';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface ActivityEntry {
  id: string;
  action_type: string;
  action_description: string;
  category: string;
  related_job_id: string | null;
  related_payment_id: string | null;
  related_ticket_id: string | null;
  related_guard_id: string | null;
  related_site_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
  job_title?: string | null;
  ticket_subject?: string | null;
  guard_name?: string | null;
  site_name?: string | null;
}

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  account: { icon: 'ri-user-settings-line', color: 'text-blue-400', bg: 'bg-blue-500/15', label: 'Account' },
  job: { icon: 'ri-briefcase-line', color: 'text-teal-400', bg: 'bg-teal-500/15', label: 'Job' },
  applicant: { icon: 'ri-user-search-line', color: 'text-violet-400', bg: 'bg-violet-500/15', label: 'Applicant' },
  guard: { icon: 'ri-shield-user-line', color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'Guard' },
  payment: { icon: 'ri-money-pound-circle-line', color: 'text-amber-400', bg: 'bg-amber-500/15', label: 'Payment' },
  message: { icon: 'ri-message-3-line', color: 'text-sky-400', bg: 'bg-sky-500/15', label: 'Message' },
  support: { icon: 'ri-customer-service-2-line', color: 'text-orange-400', bg: 'bg-orange-500/15', label: 'Support' },
  cancellation: { icon: 'ri-close-circle-line', color: 'text-red-400', bg: 'bg-red-500/15', label: 'Cancellation' },
  refund: { icon: 'ri-refund-line', color: 'text-rose-400', bg: 'bg-rose-500/15', label: 'Refund' },
  document: { icon: 'ri-file-list-line', color: 'text-indigo-400', bg: 'bg-indigo-500/15', label: 'Document' },
  site: { icon: 'ri-building-line', color: 'text-cyan-400', bg: 'bg-cyan-500/15', label: 'Site' },
  review: { icon: 'ri-star-line', color: 'text-yellow-400', bg: 'bg-yellow-500/15', label: 'Review' },
};

const ACTION_TYPES = [
  { value: 'all', label: 'All Activity' },
  { value: 'account_created', label: 'Account Created' },
  { value: 'profile_updated', label: 'Profile Updated' },
  { value: 'job_created', label: 'Job Created' },
  { value: 'job_edited', label: 'Job Edited' },
  { value: 'job_posted', label: 'Job Posted' },
  { value: 'applicant_reviewed', label: 'Applicant Reviewed' },
  { value: 'guard_selected', label: 'Guard Selected' },
  { value: 'guard_confirmed', label: 'Guard Confirmed' },
  { value: 'payment_made', label: 'Payment Made' },
  { value: 'payment_failed', label: 'Payment Failed' },
  { value: 'payment_refunded', label: 'Payment Refunded' },
  { value: 'message_sent', label: 'Message Sent' },
  { value: 'ticket_created', label: 'Ticket Created' },
  { value: 'ticket_updated', label: 'Ticket Updated' },
  { value: 'cancellation_requested', label: 'Cancellation Requested' },
  { value: 'job_cancelled', label: 'Job Cancelled' },
  { value: 'refund_requested', label: 'Refund Requested' },
  { value: 'document_uploaded', label: 'Document Uploaded' },
  { value: 'site_created', label: 'Site Created' },
  { value: 'site_updated', label: 'Site Updated' },
  { value: 'review_submitted', label: 'Review Submitted' },
  { value: 'check_in', label: 'Check In' },
  { value: 'check_out', label: 'Check Out' },
  { value: 'booking_confirmed', label: 'Booking Confirmed' },
  { value: 'job_completed', label: 'Job Completed' },
  { value: 'terms_accepted', label: 'Terms Accepted' },
  { value: 'complaint_raised', label: 'Complaint Raised' },
  { value: 'replacement_requested', label: 'Replacement Requested' },
];

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'account', label: 'Account' },
  { value: 'job', label: 'Job' },
  { value: 'applicant', label: 'Applicant' },
  { value: 'guard', label: 'Guard' },
  { value: 'payment', label: 'Payment' },
  { value: 'message', label: 'Message' },
  { value: 'support', label: 'Support' },
  { value: 'cancellation', label: 'Cancellation' },
  { value: 'refund', label: 'Refund' },
  { value: 'document', label: 'Document' },
  { value: 'site', label: 'Site' },
  { value: 'review', label: 'Review' },
];

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ActivityLogContent() {
  const router = useRouter();
  const { loading: authLoading, allowed } = useClientGuard();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityEntry[]>([]);
  const [companyName, setCompanyName] = useState('Client');
  const [initials, setInitials] = useState('CL');
  const [clientId, setClientId] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    thisWeek: 0,
    jobsUpdated: 0,
    paymentsUpdated: 0,
    supportUpdates: 0,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'all');
  const [actionFilter, setActionFilter] = useState(searchParams.get('action') || 'all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [relatedJobFilter, setRelatedJobFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [jobs, setJobs] = useState<{id: string; job_title: string}[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 25;

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const fetchActivities = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setPage(0);
        setLoading(true);
      }
      const currentPage = reset ? 0 : page;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: client } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!client) return;
      setClientId(client.id);
      setCompanyName(client.company_name || 'Client');
      setInitials(getInitials(client.company_name || 'Client'));

      let query = supabase
        .from('client_activity_log')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }
      if (actionFilter !== 'all') {
        query = query.eq('action_type', actionFilter);
      }
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo + 'T23:59:59');
      }
      if (relatedJobFilter) {
        query = query.eq('related_job_id', relatedJobFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const results = (data || []) as ActivityEntry[];
      setHasMore(results.length === PAGE_SIZE);

      if (reset) {
        setActivities(results);
      } else {
        setActivities(prev => [...prev, ...results]);
      }

      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, job_title')
        .eq('client_id', client.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);
      setJobs((jobData || []) as {id: string; job_title: string}[]);

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: allActivity } = await supabase
        .from('client_activity_log')
        .select('created_at, category, action_type')
        .eq('client_id', client.id)
        .gte('created_at', startOfWeek);

      const all = allActivity || [];
      const today = all.filter(a => a.created_at >= startOfDay);
      const week = all.filter(a => a.created_at >= startOfWeek);
      const jobsUpdated = all.filter(a => a.category === 'job' && a.created_at >= startOfDay).length;
      const paymentsUpdated = all.filter(a => a.category === 'payment' && a.created_at >= startOfDay).length;
      const supportUpdates = all.filter(a => a.category === 'support' && (a.action_type === 'ticket_created' || a.action_type === 'ticket_updated') && a.created_at >= startOfDay).length;

      setStats({
        total: all.length,
        today: today.length,
        thisWeek: week.length,
        jobsUpdated,
        paymentsUpdated,
        supportUpdates,
      });
    } catch (err) {
      console.error('Error fetching activity:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, actionFilter, dateFrom, dateTo, relatedJobFilter, page]);

  useEffect(() => {
    fetchActivities(true);
  }, [fetchActivities]);

  useEffect(() => {
    let filtered = activities;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.action_description.toLowerCase().includes(q) ||
        (a.job_title || '').toLowerCase().includes(q) ||
        (a.ticket_subject || '').toLowerCase().includes(q) ||
        (a.guard_name || '').toLowerCase().includes(q)
      );
    }
    setFilteredActivities(filtered);
  }, [searchQuery, activities]);

  const loadMore = () => {
    setPage(prev => prev + 1);
    fetchActivities(false);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setActionFilter('all');
    setDateFrom('');
    setDateTo('');
    setRelatedJobFilter('');
    setPage(0);
    fetchActivities(true);
  };

  const activeFiltersCount = [
    categoryFilter !== 'all',
    actionFilter !== 'all',
    dateFrom,
    dateTo,
    relatedJobFilter,
  ].filter(Boolean).length;

  const getConfig = (category: string) => CATEGORY_CONFIG[category] || CATEGORY_CONFIG.account;

  const getRelatedLink = (activity: ActivityEntry) => {
    if (activity.related_job_id) return `/client/jobs/${activity.related_job_id}`;
    if (activity.related_ticket_id) return `/client/support`;
    if (activity.related_payment_id) return `/client/payment-history`;
    if (activity.related_guard_id) return `/client/jobs`;
    if (activity.related_site_id) return `/client/sites`;
    return null;
  };

  const getRelatedLabel = (activity: ActivityEntry) => {
    if (activity.job_title) return activity.job_title;
    if (activity.ticket_subject) return activity.ticket_subject;
    if (activity.guard_name) return activity.guard_name;
    if (activity.site_name) return activity.site_name;
    return null;
  };

  if (authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName={companyName} subtitle="Activity" initials={initials} />
        <div className="flex-1 min-h-screen pb-20 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {/* Header skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4 animate-pulse">
              <div className="space-y-2">
                <div className="h-7 sm:h-8 bg-[#162036] rounded w-40 sm:w-48" />
                <div className="h-3 sm:h-4 bg-[#162036] rounded w-56 sm:w-64" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 sm:h-10 bg-[#162036] rounded-xl w-24 sm:w-28" />
                <div className="h-9 sm:h-10 bg-[#162036] rounded-xl w-20 sm:w-24" />
              </div>
            </div>

            {/* Stats bar skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-3 sm:p-4 space-y-1.5 sm:space-y-2 animate-pulse">
                  <div className="h-6 sm:h-7 bg-[#162036] rounded w-10 sm:w-12 mx-auto" />
                  <div className="h-3 bg-[#162036] rounded w-16 sm:w-20 mx-auto" />
                </div>
              ))}
            </div>

            {/* Activity list skeleton */}
            <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl overflow-hidden">
              <div className="divide-y divide-[#1e2d4d]">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-4 sm:px-6 py-3 sm:py-4 animate-pulse flex items-start gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#162036] rounded-lg flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5 sm:space-y-2 min-w-0">
                      <div className="h-3.5 sm:h-4 bg-[#162036] rounded w-full sm:w-3/4" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="h-5 bg-[#162036] rounded-full w-14 sm:w-16" />
                        <div className="h-3 bg-[#162036] rounded w-20 sm:w-24" />
                      </div>
                    </div>
                    <div className="h-3 bg-[#162036] rounded w-12 sm:w-16 flex-shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar role="client" displayName={companyName} subtitle="Activity" initials={initials} />
      <div className="flex-1 min-h-screen pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Activity Log</h1>
              <p className="text-sm text-slate-400 mt-1">Track all actions across your account</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowExport(true)}
                disabled={filteredActivities.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#162036] border border-[#1e2d4d] text-teal-400 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-download-2-line"></i>
                Export
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-teal-500 text-slate-900'
                    : 'bg-[#162036] border border-[#1e2d4d] text-slate-300 hover:bg-[#1a2642]'
                }`}
              >
                <i className="ri-filter-3-line"></i>
                Filters
                {activeFiltersCount > 0 && (
                  <span className="bg-slate-900 text-teal-400 text-xs font-bold px-2 py-0.5 rounded-full">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <div className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-slate-400">Total Events</p>
            </div>
            <div className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-teal-400">{stats.today}</p>
              <p className="text-xs text-slate-400">Today</p>
            </div>
            <div className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-sky-400">{stats.thisWeek}</p>
              <p className="text-xs text-slate-400">This Week</p>
            </div>
            <div className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{stats.jobsUpdated}</p>
              <p className="text-xs text-slate-400">Job Updates</p>
            </div>
            <div className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{stats.paymentsUpdated}</p>
              <p className="text-xs text-slate-400">Payment Updates</p>
            </div>
            <div className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-orange-400">{stats.supportUpdates}</p>
              <p className="text-xs text-slate-400">Support Updates</p>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <ActivityFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              actionFilter={actionFilter}
              onActionChange={setActionFilter}
              dateFrom={dateFrom}
              onDateFromChange={setDateFrom}
              dateTo={dateTo}
              onDateToChange={setDateTo}
              relatedJobFilter={relatedJobFilter}
              onRelatedJobChange={setRelatedJobFilter}
              jobs={jobs}
              onClear={clearFilters}
              onApply={() => { setPage(0); fetchActivities(true); }}
            />
          )}

          {/* Active filter chips */}
          {activeFiltersCount > 0 && !showFilters && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {categoryFilter !== 'all' && (
                <button onClick={() => { setCategoryFilter('all'); setPage(0); fetchActivities(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-teal-500/15 border border-teal-500/25 text-teal-400 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap">
                  {CATEGORIES.find(c => c.value === categoryFilter)?.label}
                  <i className="ri-close-line"></i>
                </button>
              )}
              {actionFilter !== 'all' && (
                <button onClick={() => { setActionFilter('all'); setPage(0); fetchActivities(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-teal-500/15 border border-teal-500/25 text-teal-400 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap">
                  {ACTION_TYPES.find(a => a.value === actionFilter)?.label}
                  <i className="ri-close-line"></i>
                </button>
              )}
              {dateFrom && (
                <button onClick={() => { setDateFrom(''); setPage(0); fetchActivities(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-teal-500/15 border border-teal-500/25 text-teal-400 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap">
                  From {dateFrom}
                  <i className="ri-close-line"></i>
                </button>
              )}
              {dateTo && (
                <button onClick={() => { setDateTo(''); setPage(0); fetchActivities(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-teal-500/15 border border-teal-500/25 text-teal-400 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap">
                  To {dateTo}
                  <i className="ri-close-line"></i>
                </button>
              )}
              {relatedJobFilter && (
                <button onClick={() => { setRelatedJobFilter(''); setPage(0); fetchActivities(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-teal-500/15 border border-teal-500/25 text-teal-400 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap">
                  Job: {jobs.find(j => j.id === relatedJobFilter)?.job_title || 'Selected'}
                  <i className="ri-close-line"></i>
                </button>
              )}
              <button onClick={clearFilters}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer whitespace-nowrap">
                Clear all
              </button>
            </div>
          )}

          {/* Activity List */}
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl overflow-hidden">
            {filteredActivities.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <i className="ri-history-line text-3xl text-slate-600"></i>
                </div>
                <p className="text-slate-300 font-medium mb-1">No activity found</p>
                <p className="text-sm text-slate-500">
                  {activeFiltersCount > 0
                    ? 'Try adjusting your filters'
                    : 'Actions will appear here as you use QuickGuard'}
                </p>
                {activeFiltersCount > 0 && (
                  <button onClick={clearFilters}
                    className="mt-4 px-4 py-2 bg-teal-500 text-slate-900 rounded-xl text-sm font-medium hover:bg-teal-400 transition-colors cursor-pointer whitespace-nowrap">
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#1e2d4d]">
                {filteredActivities.map((activity) => {
                  const config = getConfig(activity.category);
                  const relatedLink = getRelatedLink(activity);
                  const relatedLabel = getRelatedLabel(activity);
                  return (
                    <div key={activity.id} className="px-6 py-4 hover:bg-[#162036] transition-colors">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 flex items-center justify-center ${config.bg} rounded-lg flex-shrink-0 mt-0.5`}>
                          <i className={`${config.icon} text-lg ${config.color}`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium text-slate-200">{activity.action_description}</p>
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.color}`}>
                                  {config.label}
                                </span>
                                {relatedLink && relatedLabel && (
                                  <Link href={relatedLink}
                                    className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer">
                                    <i className="ri-link"></i>
                                    {relatedLabel}
                                  </Link>
                                )}
                                {activity.ip_address && (
                                  <span className="text-xs text-slate-600 font-mono">
                                    IP: {activity.ip_address}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0" suppressHydrationWarning>
                              {formatTime(activity.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {hasMore && filteredActivities.length > 0 && !searchQuery && (
              <div className="px-6 py-4 border-t border-[#1e2d4d] text-center">
                <button onClick={loadMore}
                  className="px-6 py-2.5 text-sm font-medium text-teal-400 hover:bg-teal-500/10 rounded-xl transition-colors cursor-pointer whitespace-nowrap">
                  Load More
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showExport && (
        <ActivityExportModal
          activities={filteredActivities}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

export default function ActivityLogClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ActivityLogContent />
    </Suspense>
  );
}