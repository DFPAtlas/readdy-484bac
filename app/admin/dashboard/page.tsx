'use client';
import { allAdminRows } from '@/lib/adminData';
import { collectedStatuses } from '@/lib/financeAmounts';
import {
  buildDashboardSnapshot,
  createLatestRequestTracker,
  createTimeoutScope,
  createUnavailableSnapshot,
  type DashboardAlert,
  type DashboardFailure,
  type DashboardStatsData,
} from '@/lib/admin-dashboard-stats';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import DashboardStats from './DashboardStats';
import DashboardAlerts from './DashboardAlerts';
import DashboardActivity, { ActivityItem } from './DashboardActivity';
import DashboardQuickActions from './DashboardQuickActions';
import StripeConnectHealth from './StripeConnectHealth';
import LiveIndicator from '@/components/LiveIndicator';
import AdminPageShell from '@/components/admin/AdminPageShell';
import DashboardControlCentre from './DashboardControlCentre';
import DashboardUnavailable from './DashboardUnavailable';

const STATS_TIMEOUT_MS = 15000;
const ACTIVITY_TIMEOUT_MS = 15000;
const EMPTY_STATS: DashboardStatsData = {
  totalJobs: 0,
  activeJobs: 0,
  newJobsThisMonth: 0,
  totalGuards: 0,
  totalClients: 0,
  pendingVerifications: 0,
  pendingSiaVerifications: 0,
  openComplaints: 0,
  failedPayments: 0,
  heldPayments: 0,
  monthlyRevenue: 0,
  avgMatchTimeMinutes: null,
  activeSubscriptions: 0,
  trialAccounts: 0,
  incompleteProfiles: 0,
  openSupportTickets: 0,
  newUsersThisMonth: 0,
};

interface JobActivityRow {
  id: string;
  job_title: string | null;
  venue_city: string | null;
  venue_name: string | null;
  created_at: string;
}

interface GuardActivityRow {
  id: string;
  full_name: string | null;
  verification_status: string | null;
  created_at: string;
}

interface ApplicationActivityRow {
  id: string;
  job_id: string | null;
  guard_id: string | null;
  created_at: string;
}

interface ComplaintActivityRow {
  id: string;
  category: string | null;
  severity: string | null;
  created_at: string;
}

interface ReviewActivityRow {
  id: string;
  guard_id: string | null;
  rating: number | null;
  created_at: string;
}

interface VerificationActivityRow {
  id: string;
  full_name: string | null;
  verified_at: string | null;
}

function timeAgo(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function messageOf(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return 'Request failed';
}

export default function AdminDashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | null>(null);
  const [stats, setStats] = useState<DashboardStatsData>(EMPTY_STATS);
  const [, setTrends] = useState({
    newJobsThisMonthTrend: null as number | null,
    monthlyRevenueTrend: null as number | null,
    avgMatchTimeTrend: null as number | null,
  });
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [statsUnavailable, setStatsUnavailable] = useState<DashboardFailure[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountedRef = useRef(true);
  const statsTrackerRef = useRef(createLatestRequestTracker());
  const activityTrackerRef = useRef(createLatestRequestTracker());
  const timeoutScopeRef = useRef(createTimeoutScope());
  const fetchStatsRef = useRef<(background?: boolean) => Promise<void>>(() => Promise.resolve());

  const fetchActivities = useCallback(async () => {
    const requestId = activityTrackerRef.current.begin();
    setActivityError(null);
    setActivityLoading(true);
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [jobsRes, guardsRes, applicationsRes, complaintsRes, reviewsRes, verificationsRes] = await timeoutScopeRef.current.run(
        Promise.all([
          supabase.from('jobs').select('id, job_title, venue_city, venue_name, status, created_at').eq('is_deleted', false).gte('created_at', since).order('created_at', { ascending: false }).limit(10),
          supabase.from('guards').select('id, full_name, email, verification_status, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(10),
          supabase.from('job_applications').select('id, job_id, guard_id, status, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(10),
          supabase.from('complaints').select('id, filed_by_id, category, severity, status, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(10),
          supabase.from('reviews').select('id, client_id, guard_id, rating, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(10),
          supabase.from('guards').select('id, full_name, verified_at, verification_status').eq('verification_status', 'approved').order('verified_at', { ascending: false }).limit(10),
        ]),
        ACTIVITY_TIMEOUT_MS,
        'Recent activity request timed out'
      );

      if (!activityTrackerRef.current.isCurrent(requestId) || !mountedRef.current) return;

      if (jobsRes.error) throw new Error(`Jobs query failed: ${jobsRes.error.message}`);
      if (guardsRes.error) throw new Error(`Guards query failed: ${guardsRes.error.message}`);
      if (applicationsRes.error) throw new Error(`Applications query failed: ${applicationsRes.error.message}`);
      if (complaintsRes.error) throw new Error(`Complaints query failed: ${complaintsRes.error.message}`);
      if (reviewsRes.error) throw new Error(`Reviews query failed: ${reviewsRes.error.message}`);
      if (verificationsRes.error) throw new Error(`Verifications query failed: ${verificationsRes.error.message}`);

      const allEvents: ActivityItem[] = [];

      ((jobsRes.data ?? []) as JobActivityRow[]).forEach((j) => {
        allEvents.push({
          id: `job-${j.id}`,
          icon: 'ri-briefcase-line',
          color: 'bg-teal-100 text-teal-700',
          title: 'Job Posted',
          message: `${j.job_title ?? 'Job'} in ${j.venue_city || j.venue_name || 'unknown location'}`,
          time: timeAgo(j.created_at),
          timestamp: j.created_at,
        });
      });

      ((guardsRes.data ?? []) as GuardActivityRow[]).forEach((g) => {
        const name = g.full_name || 'A new guard';
        allEvents.push({
          id: `guard-${g.id}`,
          icon: 'ri-user-add-line',
          color: 'bg-sky-100 text-sky-700',
          title: 'New Guard Registered',
          message: `${name} completed registration`,
          time: timeAgo(g.created_at),
          timestamp: g.created_at,
        });
      });

      ((applicationsRes.data ?? []) as ApplicationActivityRow[]).forEach((a) => {
        allEvents.push({
          id: `app-${a.id}`,
          icon: 'ri-file-list-line',
          color: 'bg-indigo-100 text-indigo-700',
          title: 'Job Application',
          message: `Guard applied to job ${a.job_id?.slice(0, 8) || ''}`,
          time: timeAgo(a.created_at),
          timestamp: a.created_at,
        });
      });

      ((complaintsRes.data ?? []) as ComplaintActivityRow[]).forEach((c) => {
        allEvents.push({
          id: `complaint-${c.id}`,
          icon: 'ri-alert-line',
          color: 'bg-amber-100 text-amber-700',
          title: 'Complaint Filed',
          message: `${c.category || 'General'} complaint — ${c.severity || 'unknown severity'}`,
          time: timeAgo(c.created_at),
          timestamp: c.created_at,
        });
      });

      ((reviewsRes.data ?? []) as ReviewActivityRow[]).forEach((r) => {
        allEvents.push({
          id: `review-${r.id}`,
          icon: 'ri-star-fill',
          color: 'bg-yellow-100 text-yellow-700',
          title: `${r.rating}-Star Review`,
          message: `New review submitted for guard ${r.guard_id?.slice(0, 8) || ''}`,
          time: timeAgo(r.created_at),
          timestamp: r.created_at,
        });
      });

      ((verificationsRes.data ?? []) as VerificationActivityRow[]).forEach((v) => {
        const name = v.full_name || 'A guard';
        if (v.verified_at) {
          allEvents.push({
            id: `verify-${v.id}`,
            icon: 'ri-shield-check-line',
            color: 'bg-emerald-100 text-emerald-700',
            title: 'Guard Verified',
            message: `${name} SIA licence approved`,
            time: timeAgo(v.verified_at),
            timestamp: v.verified_at,
          });
        }
      });

      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(allEvents.slice(0, 8));
    } catch (err) {
      if (!activityTrackerRef.current.isCurrent(requestId) || !mountedRef.current) return;
      setActivityError(messageOf(err));
      setActivities([]);
    } finally {
      if (activityTrackerRef.current.isCurrent(requestId) && mountedRef.current) {
        setActivityLoading(false);
      }
    }
  }, []);

  const fetchStats = useCallback(async (isBackground = false) => {
    const requestId = statsTrackerRef.current.begin();
    if (!isBackground) setLoading(true);

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthStartIso = monthStart.toISOString();

      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevMonthStart.setHours(0, 0, 0, 0);
      const prevMonthStartIso = prevMonthStart.toISOString();
      const prevMonthEndIso = monthStart.toISOString();

      const settlements = await timeoutScopeRef.current.run(
        Promise.allSettled([
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_deleted', false).in('status', ['open', 'active', 'in_progress']),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', monthStartIso),
          supabase.from('guards').select('*', { count: 'exact', head: true }),
          supabase.from('clients').select('*', { count: 'exact', head: true }),
          supabase.from('guards').select('*', { count: 'exact', head: true }).in('verification_status', ['pending', 'manual_review', 'pending_sia_check']),
          supabase.from('sia_verifications').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
          supabase.from('complaints').select('*', { count: 'exact', head: true }).in('status', ['open', 'pending']),
          supabase.from('subscription_payments').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
          supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
          supabase.from('guard_payouts').select('*', { count: 'exact', head: true }).eq('status', 'held'),

          allAdminRows(() => supabase.from('subscription_payments').select('amount, status, refunded, refund_amount').in('status', collectedStatuses).gte('created_at', monthStartIso).order('id')),
          allAdminRows(() => supabase.from('transactions').select('amount, status, refunded, refund_amount').in('status', collectedStatuses).or('transaction_type.neq.subscription,transaction_type.is.null').gte('created_at', monthStartIso).order('id')),
          supabase.from('job_assignments').select('assigned_at, job_id').not('assigned_at', 'is', null).gte('assigned_at', monthStartIso),

          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', prevMonthStartIso).lt('created_at', prevMonthEndIso),
          allAdminRows(() => supabase.from('subscription_payments').select('amount, status, refunded, refund_amount').in('status', collectedStatuses).gte('created_at', prevMonthStartIso).lt('created_at', prevMonthEndIso).order('id')),
          allAdminRows(() => supabase.from('transactions').select('amount, status, refunded, refund_amount').in('status', collectedStatuses).or('transaction_type.neq.subscription,transaction_type.is.null').gte('created_at', prevMonthStartIso).lt('created_at', prevMonthEndIso).order('id')),
          supabase.from('job_assignments').select('assigned_at, job_id').not('assigned_at', 'is', null).gte('assigned_at', prevMonthStartIso).lt('assigned_at', prevMonthEndIso),

          supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('clients').select('*', { count: 'exact', head: true }).gt('trial_end_date', now.toISOString()).not('trial_end_date', 'is', null),
          supabase.from('guards').select('*', { count: 'exact', head: true }).eq('profile_completed', false),
          supabase.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'pending']),
          supabase.from('guards').select('*', { count: 'exact', head: true }).gte('created_at', monthStartIso),
          supabase.from('clients').select('*', { count: 'exact', head: true }).gte('created_at', monthStartIso),
          supabase.from('jobs').select('id, created_at').gte('created_at', prevMonthStartIso).order('id'),
        ]),
        STATS_TIMEOUT_MS,
        'Dashboard metrics request timed out'
      );

      if (!mountedRef.current || !statsTrackerRef.current.isCurrent(requestId)) return;

      const snapshot = buildDashboardSnapshot(settlements);

      if (!snapshot.available) {
        setStatsUnavailable(snapshot.failures);
        return;
      }

      setStats(snapshot.stats);
      setTrends(snapshot.trends);
      setAlerts(snapshot.alerts);
      setStatsUnavailable(null);
      setLastUpdated(new Date());
      void fetchActivities();
    } catch (err) {
      if (!mountedRef.current || !statsTrackerRef.current.isCurrent(requestId)) return;
      setStatsUnavailable(createUnavailableSnapshot(messageOf(err)).failures);
    } finally {
      if (statsTrackerRef.current.isCurrent(requestId) && mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchActivities]);

  fetchStatsRef.current = fetchStats;

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      statsTrackerRef.current.invalidate();
      activityTrackerRef.current.invalidate();
      timeoutScopeRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'app', table: 'jobs' }, () => {
        fetchStatsRef.current(true);
      })
      .on('postgres_changes', { event: '*', schema: 'app', table: 'guards' }, () => {
        fetchStatsRef.current(true);
      })
      .on('postgres_changes', { event: '*', schema: 'app', table: 'clients' }, () => {
        fetchStatsRef.current(true);
      })
      .on('postgres_changes', { event: '*', schema: 'app', table: 'subscription_payments' }, () => {
        fetchStatsRef.current(true);
      })
      .on('postgres_changes', { event: '*', schema: 'app', table: 'transactions' }, () => {
        fetchStatsRef.current(true);
      })
      .on('postgres_changes', { event: '*', schema: 'app', table: 'complaints' }, () => {
        fetchStatsRef.current(true);
      })
      .on('postgres_changes', { event: '*', schema: 'app', table: 'job_assignments' }, () => {
        fetchStatsRef.current(true);
      })
      .on('postgres_changes', { event: '*', schema: 'app', table: 'guard_payouts' }, () => {
        fetchStatsRef.current(true);
      })
      .on('postgres_changes', { event: '*', schema: 'app', table: 'sia_verifications' }, () => {
        fetchStatsRef.current(true);
      })
      .subscribe((status) => {
        setRealtimeStatus(status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchStats().finally(() => {
      if (mountedRef.current) setIsRefreshing(false);
    });
  }, [fetchStats]);

  return (
    <AdminPageShell
      eyebrow="QuickGuard operations"
      title="Admin control centre"
      description={
        statsUnavailable
          ? 'Live operational view · metrics unavailable'
          : lastUpdated
          ? `Live operational view · updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : 'Live operational view · updating now'
      }
      status={
        <div className="flex items-center gap-2">
          <LiveIndicator />
          {realtimeStatus === 'SUBSCRIBED' && (
            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live
            </span>
          )}
          {realtimeStatus && realtimeStatus !== 'SUBSCRIBED' && (
            <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
              Realtime unavailable
            </span>
          )}
        </div>
      }
      actions={
        <>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
            aria-label="Refresh dashboard"
          >
            <div className={`w-4 h-4 flex items-center justify-center ${isRefreshing ? 'animate-spin' : ''}`}>
              <i className="ri-refresh-line text-base"></i>
            </div>
            <span>Refresh</span>
          </button>
          <Link
            href="/admin/jobs"
            prefetch={false}
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
          >
            <i className="ri-briefcase-line text-sm"></i>
            Manage Jobs
          </Link>
        </>
      }
    >
      {statsUnavailable && (
        <DashboardUnavailable
          failures={statsUnavailable}
          lastSuccessAt={lastUpdated}
          retrying={loading || isRefreshing}
          onRetry={handleRefresh}
        />
      )}

      {!statsUnavailable && (
        <>
          <DashboardAlerts alerts={alerts} loading={loading} />

          {lastUpdated && (
            <DashboardControlCentre
              activeJobs={stats.activeJobs}
              totalJobs={stats.totalJobs}
              pendingVerifications={stats.pendingVerifications}
              pendingSiaVerifications={stats.pendingSiaVerifications}
              openComplaints={stats.openComplaints}
              failedPayments={stats.failedPayments}
              heldPayments={stats.heldPayments}
              openSupportTickets={stats.openSupportTickets}
              activeSubscriptions={stats.activeSubscriptions}
              monthlyRevenue={stats.monthlyRevenue}
            />
          )}

          <DashboardStats
            pendingVerifications={stats.pendingVerifications}
            failedPayments={stats.failedPayments}
            activeSubscriptions={stats.activeSubscriptions}
            trialAccounts={stats.trialAccounts}
            incompleteProfiles={stats.incompleteProfiles}
            openSupportTickets={stats.openSupportTickets}
            newUsersThisMonth={stats.newUsersThisMonth}
            monthlyRevenue={stats.monthlyRevenue}
            loading={loading}
            error={null}
          />
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DashboardActivity activities={activities} loading={activityLoading} error={activityError} />
        </div>
        <DashboardQuickActions />
      </div>

      <StripeConnectHealth />
    </AdminPageShell>
  );
}