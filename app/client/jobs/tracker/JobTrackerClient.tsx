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
import { TRACKER_FILTER_STATUSES, trackerAttendance } from '@/lib/client-job-tracker';
import { nextJobAction } from '@/lib/client-journey';

const PAGE_SIZE = 8;
const REALTIME_DEBOUNCE_MS = 500;

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

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
  const [totalCount, setTotalCount] = useState(0);
  const [liveStatus, setLiveStatus] = useState<'connected' | 'reconnecting' | 'disconnected' | 'error'>('connected');
  const [error, setError] = useState<string | null>(null);

  const filterRef = useRef(filter);
  const displayCountRef = useRef(displayCount);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelsRef = useRef<any[]>([]);
  const mountedRef = useRef(true);
  const requestSequence = useRef(0);
  const clientRef = useRef(clientId);
  const eligibleRef = useRef(false);
  clientRef.current = clientId;
  eligibleRef.current = !!clientId && allowed && !authLoading && !checking && !blocked;
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; requestSequence.current += 1; };
  }, []);
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
    if (!mountedRef.current || clientRef.current !== clientId || !eligibleRef.current || !clientId) return;
    const request = ++requestSequence.current;
    const isCurrent = () => mountedRef.current && eligibleRef.current && clientRef.current === clientId && requestSequence.current === request;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const currentDisplayCount = displayCountRef.current;
      const statuses = TRACKER_FILTER_STATUSES[filterRef.current] || [];
      let query = supabase
        .from('jobs')
        .select('*, job_applications(count)', { count: 'exact' })
        .eq('client_id', clientId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(0, currentDisplayCount - 1);
      if (statuses.length > 0) query = query.in('status', statuses);
      const { data, count, error: jobsError } = await query;
      if (!isCurrent()) return;
      if (jobsError || !Array.isArray(data) || typeof count !== 'number' || !Number.isInteger(count) || count < 0) throw new Error('Invalid jobs response');
      const jobIds = data.map(job => job.id);
      let assignmentsData: any[] = [];
      let replacementData: any[] = [];
      if (jobIds.length > 0) {
        const { data: assignments, error: assignmentsError } = await supabase
          .from('job_assignments')
          .select('job_id, status, attendance_status, check_in_time, check_out_time, issue_reported, replacement_requested')
          .in('job_id', jobIds);
        if (!isCurrent()) return;
        if (assignmentsError || !Array.isArray(assignments)) throw new Error('Invalid attendance response');
        assignmentsData = assignments;
        const { data: replacements, error: replacementsError } = await supabase
          .from('replacement_requests')
          .select('job_id, status')
          .eq('client_id', clientId)
          .in('job_id', jobIds)
          .in('status', ['requested', 'searching', 'replacement_offered', 'awaiting_client_approval']);
        if (!isCurrent()) return;
        if (replacementsError || !Array.isArray(replacements)) throw new Error('Invalid replacement response');
        replacementData = replacements;
      }
      const formatted = data.map(job => {
        const assignments = assignmentsData.filter(assignment => assignment.job_id === job.id);
        const attendance = trackerAttendance(assignments, job.status);
        return {
          ...job,
          applications_count: job.job_applications?.[0]?.count || 0,
          assigned_guards: assignments.filter(assignment => assignment.status !== 'cancelled').length,
          checked_in_count: attendance.checkedIn,
          late_count: attendance.late,
          no_show_count: attendance.noShow,
          issue_count: attendance.issues,
          replacement_needed_count: attendance.replacements,
          replacement_open_count: ['funded', 'confirmed', 'in_progress'].includes(job.status)
            ? replacementData.filter(replacement => replacement.job_id === job.id && ['requested', 'searching'].includes(replacement.status)).length : 0,
        };
      });
      setJobs(formatted);
      setTotalCount(count);
      setHasMore(count > currentDisplayCount);
      setLastUpdated(new Date());
    } catch {
      if (isCurrent()) {
        setJobs([]);
        setHasMore(false);
        setTotalCount(0);
        setError('Unable to load current job tracking and attendance. Please retry.');
      }
    } finally {
      if (isCurrent()) { setLoading(false); setRefreshing(false); }
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
    setJobs([]);
    setHasMore(false);
    setTotalCount(0);
    setError(null);
    setDisplayCount(PAGE_SIZE);
    displayCountRef.current = PAGE_SIZE;
    if (eligibleRef.current) void loadJobs();
    else { setLoading(false); setRefreshing(false); }
    return () => { requestSequence.current += 1; };
  }, [clientId, allowed, authLoading, checking, blocked, loadJobs]);

  useEffect(() => {
    if (!eligibleRef.current || !clientId) return;
    const refresh = () => {
      if (mountedRef.current && eligibleRef.current && clientRef.current === clientId) debouncedRealtimeRefresh();
    };

    const jobsChannel = supabase
      .channel(`tracker-jobs-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'app', table: 'jobs', filter: `client_id=eq.${clientId}` }, () => {
        refresh();
      })
      .subscribe((status) => {
        if (!mountedRef.current || clientRef.current !== clientId || !eligibleRef.current) return;
        if (status === 'SUBSCRIBED') setLiveStatus('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setLiveStatus('error');
        else if (status === 'CLOSED') setLiveStatus('disconnected');
      });

    const appsChannel = supabase
      .channel(`tracker-apps-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'app', table: 'job_applications' }, () => {
        refresh();
      })
      .subscribe((status) => {
        if (!mountedRef.current || clientRef.current !== clientId || !eligibleRef.current) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setLiveStatus('error');
      });

    const assignmentsChannel = supabase
      .channel(`tracker-assignments-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'app', table: 'job_assignments' }, () => {
        refresh();
      })
      .subscribe((status) => {
        if (!mountedRef.current || clientRef.current !== clientId || !eligibleRef.current) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setLiveStatus('error');
      });

    const replacementsChannel = supabase
      .channel(`tracker-replacements-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'app', table: 'replacement_requests', filter: `client_id=eq.${clientId}` }, refresh)
      .subscribe();
    channelsRef.current = [jobsChannel, appsChannel, assignmentsChannel, replacementsChannel];

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [clientId, allowed, authLoading, checking, blocked, debouncedRealtimeRefresh]);

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

  const needsActionCount = jobs.filter(job => nextJobAction(job).attention).length;

  const filters = [
    { key: 'active', label: 'Active Jobs', icon: 'ri-pulse-line' },
    { key: 'completed', label: 'Completed', icon: 'ri-checkbox-circle-line' },
    { key: 'cancelled', label: 'Cancelled', icon: 'ri-close-circle-line' },
    { key: 'all', label: 'All Jobs', icon: 'ri-list-check-2' },
  ];

  if (loading || authLoading || !allowed || checking || !clientId) {
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
            <div role="alert" className="mb-6 bg-red-500/10 border border-red-500/25 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
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

          {!error && <TrackerStatsBar jobs={jobs} />}

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

          {jobs.length === 0 && !loading && !error ? (
            <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-16 text-center">
              <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-radar-line text-3xl text-slate-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">No {filter === 'all' ? '' : filter + ' '}jobs to track</h3>
              <p className="text-slate-500 text-sm mb-6">{filter === 'active' ? 'Check Completed or All Jobs for finished, cancelled or draft bookings.' : 'No bookings match this tab.'}</p>
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
              {!error && <p className="text-sm text-slate-500 mb-4">Showing {jobs.length} of {totalCount} jobs in this tab</p>}
              <div className="space-y-5">
                {jobs.map(job => (
                  <JobTrackerCard key={job.id} job={job} onRefresh={() => loadJobs(true)} />
                ))}
              </div>

              {hasMore && (
                <div className="mt-6 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={refreshing}
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
