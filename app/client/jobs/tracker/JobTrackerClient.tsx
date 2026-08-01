'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import PortalSidebar from '@/components/PortalSidebar';
import JobTrackerCard from './JobTrackerCard';
import TrackerStatsBar from './TrackerStatsBar';
import LiveIndicator from '@/components/LiveIndicator';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import { useClientGuard } from '@/hooks/useClientGuard';
import { useClientAuth } from '@/lib/ClientAuthContext';
import UpgradePrompt from '@/components/UpgradePrompt';
import ContextualHelpCard from '@/app/client/help/ContextualHelpCard';

const PAGE_SIZE = 8;
const REALTIME_DEBOUNCE_MS = 500;

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const FILTER_STATUSES: Record<string, string[]> = {
  active: ['pending', 'awaiting_guard_selection', 'awaiting_payment', 'in_progress'],
  completed: ['completed'],
  cancelled: ['cancelled'],
  all: [],
};

export default function JobTrackerClient() {
  const { checking, blocked } = useRouteGuard();
  const { loading: authLoading, allowed } = useClientGuard();
  const { userId, clientId, companyName: contextCompanyName, subscriptionTier: contextSubscriptionTier } = useClientAuth();

  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [companyName, setCompanyName] = useState('Client');
  const [subscriptionTier, setSubscriptionTier] = useState('Free');
  const [initials, setInitials] = useState('CL');
  const [filter, setFilter] = useState('active');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'connected' | 'reconnecting' | 'disconnected' | 'error'>('connected');
  const [error, setError] = useState<string | null>(null);

  const filterRef = useRef(filter);
  const displayCountRef = useRef(displayCount);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelsRef = useRef<any[]>([]);
  const mountedRef = useRef(true);
  const loadJobsRef = useRef<(silent?: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  useEffect(() => {
    displayCountRef.current = displayCount;
  }, [displayCount]);

  useEffect(() => {
    setCompanyName(contextCompanyName || 'Client');
    setSubscriptionTier(contextSubscriptionTier || 'Free');
    setInitials(getInitials(contextCompanyName || 'Client'));
  }, [contextCompanyName, contextSubscriptionTier]);

  const loadJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const resolvedClientId = clientId;
      if (!resolvedClientId) {
        if (!silent) setLoading(false);
        setRefreshing(false);
        return;
      }

      const currentFilter = filterRef.current;
      const currentDisplayCount = displayCountRef.current;
      const statuses = FILTER_STATUSES[currentFilter] || [];

      let query = supabase
        .from('jobs')
        .select('*, job_applications(count), job_assignments(count)', { count: 'exact' })
        .eq('client_id', resolvedClientId)
        .order('created_at', { ascending: false })
        .range(0, currentDisplayCount - 1);

      if (statuses.length > 0) {
        query = query.in('status', statuses);
      }

      const { data, count, error: jobsError } = await query;

      if (jobsError) {
        setError('Failed to load jobs. Please try refreshing.');
        if (!silent) setLoading(false);
        setRefreshing(false);
        return;
      }

      const totalCount = count || 0;
      setHasMore(totalCount > currentDisplayCount);

      const jobIds = (data || []).map(j => j.id);

      let assignmentsData: any[] = [];
      if (jobIds.length > 0) {
        const { data: aData } = await supabase
          .from('job_assignments')
          .select('job_id, attendance_status, check_in_time, issue_reported, replacement_requested')
          .in('job_id', jobIds);
        assignmentsData = aData || [];
      }

      let replacementData: any[] = [];
      if (jobIds.length > 0) {
        try {
          const { data: rData } = await supabase
            .from('replacement_requests')
            .select('job_id, status')
            .in('job_id', jobIds)
            .in('status', ['requested', 'searching', 'replacement_offered', 'awaiting_client_approval']);
          replacementData = rData || [];
        } catch {
          replacementData = [];
        }
      }

      const attendanceMap: Record<string, { checkedIn: number; late: number; noShow: number; issues: number; replacements: number }> = {};
      assignmentsData.filter(a => a && a.job_id).forEach(a => {
        if (!attendanceMap[a.job_id]) attendanceMap[a.job_id] = { checkedIn: 0, late: 0, noShow: 0, issues: 0, replacements: 0 };
        if (a.attendance_status === 'checked_in' || a.attendance_status === 'checked_out' || a.attendance_status === 'completed') attendanceMap[a.job_id].checkedIn++;
        if (a.attendance_status === 'late') attendanceMap[a.job_id].late++;
        if (a.attendance_status === 'no_show') attendanceMap[a.job_id].noShow++;
        if (a.issue_reported) attendanceMap[a.job_id].issues++;
        if (a.replacement_requested) attendanceMap[a.job_id].replacements++;
      });

      const replacementMap: Record<string, { needed: number; open: number }> = {};
      replacementData.forEach(r => {
        if (!replacementMap[r.job_id]) replacementMap[r.job_id] = { needed: 0, open: 0 };
        replacementMap[r.job_id].needed++;
        if (['requested', 'searching'].includes(r.status)) replacementMap[r.job_id].open++;
      });

      const formatted = (data || []).map(job => ({
        ...job,
        applications_count: (job.job_applications?.[0] as any)?.count || 0,
        assigned_guards: (job.job_assignments?.[0] as any)?.count || 0,
        checked_in_count: attendanceMap[job.id]?.checkedIn || 0,
        late_count: attendanceMap[job.id]?.late || 0,
        no_show_count: attendanceMap[job.id]?.noShow || 0,
        issue_count: attendanceMap[job.id]?.issues || 0,
        replacement_needed_count: attendanceMap[job.id]?.replacements || 0,
        replacement_open_count: replacementMap[job.id]?.open || 0,
      }));

      setJobs(formatted);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong loading jobs. Please try refreshing.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  loadJobsRef.current = loadJobs;

  const debouncedRealtimeRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (mountedRef.current) {
        loadJobsRef.current(true);
      }
    }, REALTIME_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!clientId) return;
    loadJobs();
  }, [clientId, loadJobs]);

  useEffect(() => {
    mountedRef.current = true;

    const jobsChannel = supabase
      .channel('tracker-jobs')
      .on('postgres_changes', { event: '*', schema: 'app', table: 'jobs' }, () => {
        debouncedRealtimeRefresh();
      })
      .subscribe((status) => {
        if (!mountedRef.current) return;
        if (status === 'SUBSCRIBED') setLiveStatus('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setLiveStatus('error');
        else if (status === 'CLOSED') setLiveStatus('disconnected');
      });

    const appsChannel = supabase
      .channel('tracker-apps')
      .on('postgres_changes', { event: '*', schema: 'app', table: 'job_applications' }, () => {
        debouncedRealtimeRefresh();
      })
      .subscribe((status) => {
        if (!mountedRef.current) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setLiveStatus('error');
      });

    const assignmentsChannel = supabase
      .channel('tracker-assignments')
      .on('postgres_changes', { event: '*', schema: 'app', table: 'job_assignments' }, () => {
        debouncedRealtimeRefresh();
      })
      .subscribe((status) => {
        if (!mountedRef.current) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setLiveStatus('error');
      });

    channelsRef.current = [jobsChannel, appsChannel, assignmentsChannel];

    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [debouncedRealtimeRefresh]);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setDisplayCount(PAGE_SIZE);
    setError(null);
    filterRef.current = newFilter;
    displayCountRef.current = PAGE_SIZE;
    loadJobs();
  };

  const handleLoadMore = () => {
    const next = displayCount + PAGE_SIZE;
    setDisplayCount(next);
    displayCountRef.current = next;
    loadJobs(true);
  };

  const activeCount = jobs.filter(j => ['pending', 'awaiting_guard_selection', 'awaiting_payment', 'in_progress'].includes(j.status)).length;
  const needsActionCount = jobs.filter(j => ['awaiting_guard_selection', 'awaiting_payment'].includes(j.status)).length;

  const filters = [
    { key: 'active', label: 'Active Jobs', icon: 'ri-pulse-line' },
    { key: 'completed', label: 'Completed', icon: 'ri-checkbox-circle-line' },
    { key: 'cancelled', label: 'Cancelled', icon: 'ri-close-circle-line' },
    { key: 'all', label: 'All Jobs', icon: 'ri-list-check-2' },
  ];

  if (loading || authLoading || !allowed || checking) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar
          role="client"
          displayName={companyName || 'Client'}
          subtitle={subscriptionTier || 'Free'}
          initials={initials}
        />
        <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
          <div className="bg-[#111d35] border-b border-[#1e2d4d] px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 sticky top-0 z-20 animate-pulse">
            <div className="space-y-2">
              <div className="h-3 bg-[#162036] rounded w-24" />
              <div className="h-6 bg-[#162036] rounded w-40 sm:w-48" />
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="h-8 bg-[#162036] rounded-xl w-16 sm:w-20" />
              <div className="h-8 bg-[#162036] rounded-xl w-20 sm:w-24" />
              <div className="h-8 bg-[#162036] rounded-xl w-20 sm:w-24" />
            </div>
          </div>

          <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-3 sm:p-4 flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#162036] rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 bg-[#162036] rounded w-10 sm:w-12" />
                    <div className="h-3 bg-[#162036] rounded w-16 sm:w-20" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-6 animate-pulse flex-wrap">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 sm:h-9 bg-[#162036] rounded-xl w-24 sm:w-28" />
              ))}
            </div>

            <div className="space-y-4 sm:space-y-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-4 sm:p-6 animate-pulse space-y-3 sm:space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="h-5 bg-[#162036] rounded w-full sm:w-2/3" />
                      <div className="h-3 bg-[#162036] rounded w-1/2 sm:w-1/3" />
                    </div>
                    <div className="h-6 bg-[#162036] rounded-full w-20 sm:w-24 flex-shrink-0" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="bg-[#162036] rounded-lg p-2.5 sm:p-3 space-y-1">
                        <div className="h-3 bg-[#1e2d4d] rounded w-14 sm:w-16" />
                        <div className="h-4 bg-[#1e2d4d] rounded w-6 sm:w-8" />
                      </div>
                    ))}
                  </div>
                  <div className="h-2 bg-[#162036] rounded-full w-full" />
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <div className="h-7 sm:h-8 bg-[#162036] rounded-lg w-20 sm:w-24" />
                    <div className="h-7 sm:h-8 bg-[#162036] rounded-lg w-20 sm:w-24" />
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6">
        <div className="w-full max-w-lg">
          <UpgradePrompt feature="client.job_tracker" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={companyName || 'Client'}
        subtitle={subscriptionTier || 'Free'}
        initials={initials}
        userId={userId}
      />

      <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
        <header className="bg-[#111d35] border-b border-[#1e2d4d] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Client Portal</p>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span>Job Status Tracker</span>
              {needsActionCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                  {needsActionCount} action{needsActionCount > 1 ? 's' : ''} needed
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <LiveIndicator status={liveStatus} />
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className={`w-2 h-2 rounded-full ${refreshing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
              {lastUpdated && (
                <span suppressHydrationWarning>
                  Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <button
              onClick={() => loadJobs(true)}
              disabled={refreshing}
              className="flex items-center gap-2 bg-[#162036] text-slate-400 text-sm font-semibold px-3 py-2 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 border border-[#1e2d4d]"
            >
              <i className={`ri-refresh-line ${refreshing ? 'animate-spin' : ''}`}></i>
              Refresh
            </button>
            <Link
              href="/client/post-job"
              className="flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line"></i>
              Post a Job
            </Link>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/25 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <i className="ri-error-warning-line text-red-400 text-lg"></i>
                </div>
                <p className="text-sm text-red-300 font-medium">{error}</p>
              </div>
              <button
                onClick={() => loadJobs()}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-refresh-line"></i>
                Retry
              </button>
            </div>
          )}

          <TrackerStatsBar jobs={jobs} />

          <div className="flex items-center gap-2 mb-6 mt-6">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => handleFilterChange(f.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  filter === f.key
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'bg-[#111d35] text-slate-400 border border-[#1e2d4d] hover:border-teal-500/30 hover:text-slate-200'
                }`}
              >
                <i className={f.icon}></i>
                {f.label}
              </button>
            ))}
          </div>

          {filter === 'active' && jobs.length > 0 && (
            <div className="mb-4">
              <ContextualHelpCard
                title="Tracking check-in and attendance"
                tip="Guards check in via the mobile app when they arrive on site. You will see real-time status here — Checked In, Late, or No Show. Report issues immediately from each job card."
                learnMoreHref="/client/help#attendance-checkin"
                learnMoreLabel="Attendance guide"
                icon="ri-calendar-check-line"
                variant="compact"
              />
            </div>
          )}

          {jobs.length === 0 && !loading ? (
            <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-16 text-center">
              <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-radar-line text-3xl text-slate-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">No jobs to track</h3>
              <p className="text-slate-500 text-sm mb-6">Post a job to start tracking its progress in real time</p>
              <Link
                href="/client/post-job"
                className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line"></i>
                Post a Job
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-5">
                {jobs.map(job => (
                  <JobTrackerCard key={job.id} job={job} onRefresh={() => loadJobs(true)} />
                ))}
              </div>

              {hasMore && (
                <div className="mt-6 text-center">
                  <button
                    onClick={handleLoadMore}
                    className="inline-flex items-center gap-2 bg-[#162036] text-slate-300 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]"
                  >
                    <i className="ri-arrow-down-line"></i>
                    Load More Jobs
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}