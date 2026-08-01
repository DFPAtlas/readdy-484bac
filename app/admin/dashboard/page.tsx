'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import DashboardStats from './DashboardStats';
import DashboardAlerts from './DashboardAlerts';
import DashboardActivity, { ActivityItem } from './DashboardActivity';
import DashboardQuickActions from './DashboardQuickActions';
import StripeConnectHealth from './StripeConnectHealth';
import LiveIndicator from '@/components/LiveIndicator';

interface DashboardStatsData {
  totalJobs: number;
  activeJobs: number;
  newJobsThisMonth: number;
  totalGuards: number;
  totalClients: number;
  pendingVerifications: number;
  pendingSiaVerifications: number;
  openComplaints: number;
  failedPayments: number;
  heldPayments: number;
  monthlyRevenue: number;
  avgMatchTimeMinutes: number | null;
  activeSubscriptions: number;
  trialAccounts: number;
  incompleteProfiles: number;
  openSupportTickets: number;
  newUsersThisMonth: number;
}

interface AlertItem {
  id: number;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  action: string;
  href: string;
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

export default function AdminDashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | null>(null);
  const [stats, setStats] = useState<DashboardStatsData>({
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
  });
  const [trends, setTrends] = useState({
    newJobsThisMonthTrend: null as number | null,
    monthlyRevenueTrend: null as number | null,
    avgMatchTimeTrend: null as number | null,
  });
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  // Use a ref to track the channel so we never create duplicates
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Use a ref for fetchStats so realtime callbacks always call the latest version
  const fetchStatsRef = useRef<(background?: boolean) => Promise<void>>(() => Promise.resolve());

  const fetchActivities = useCallback(async () => {
    setActivityError(null);
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        jobsRes,
        guardsRes,
        applicationsRes,
        complaintsRes,
        reviewsRes,
        verificationsRes,
      ] = await Promise.all([
        supabase.from('jobs').select('id, job_title, venue_city, venue_name, status, created_at').eq('is_deleted', false).gte('created_at', since).order('created_at', { ascending: false }).limit(10),
        supabase.from('guards').select('id, full_name, email, verification_status, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(10),
        supabase.from('job_applications').select('id, job_id, guard_id, status, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(10),
        supabase.from('complaints').select('id, filed_by_id, category, severity, status, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(10),
        supabase.from('reviews').select('id, client_id, guard_id, rating, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(10),
        supabase.from('guards').select('id, full_name, verified_at, verification_status').eq('verification_status', 'approved').order('verified_at', { ascending: false }).limit(10),
      ]);

      if (jobsRes.error) throw new Error(`Jobs query failed: ${jobsRes.error.message}`);
      if (guardsRes.error) throw new Error(`Guards query failed: ${guardsRes.error.message}`);
      if (applicationsRes.error) throw new Error(`Applications query failed: ${applicationsRes.error.message}`);
      if (complaintsRes.error) throw new Error(`Complaints query failed: ${complaintsRes.error.message}`);
      if (reviewsRes.error) throw new Error(`Reviews query failed: ${reviewsRes.error.message}`);
      if (verificationsRes.error) throw new Error(`Verifications query failed: ${verificationsRes.error.message}`);

      const allEvents: ActivityItem[] = [];

      (jobsRes.data ?? []).forEach((j: any) => {
        allEvents.push({
          id: `job-${j.id}`,
          icon: 'ri-briefcase-line',
          color: 'bg-teal-100 text-teal-700',
          title: 'Job Posted',
          message: `${j.job_title} in ${j.venue_city || j.venue_name || 'unknown location'}`,
          time: timeAgo(j.created_at),
          timestamp: j.created_at,
        });
      });

      (guardsRes.data ?? []).forEach((g: any) => {
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

      (applicationsRes.data ?? []).forEach((a: any) => {
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

      (complaintsRes.data ?? []).forEach((c: any) => {
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

      (reviewsRes.data ?? []).forEach((r: any) => {
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

      (verificationsRes.data ?? []).forEach((v: any) => {
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
    } catch (err: any) {
      setActivityError(err?.message || 'Failed to load recent activity');
      setActivities([]);
    }
  }, []);

  const fetchStats = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthStartIso = monthStart.toISOString();

      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevMonthStart.setHours(0, 0, 0, 0);
      const prevMonthStartIso = prevMonthStart.toISOString();
      const prevMonthEndIso = monthStart.toISOString();

      const [
        // All-time totals and current snapshots
        totalJobsRes,
        activeJobsRes,
        newJobsThisMonthRes,
        totalGuardsRes,
        totalClientsRes,
        pendingVerificationsRes,
        pendingSiaRes,
        openComplaintsRes,
        failedSubPaymentsRes,
        failedTransRes,
        heldPayoutsRes,

        // Current month revenue (monthly metric)
        monthlyRevenueSubRes,
        monthlyRevenueTransRes,
        matchTimeRes,

        // Previous month data for month-over-month trends
        prevNewJobsRes,
        prevMonthlyRevenueSubRes,
        prevMonthlyRevenueTransRes,
        prevMatchTimeRes,

        activeSubscriptionsRes,
        trialAccountsRes,
        incompleteProfilesRes,
        openSupportTicketsRes,
        newGuardsThisMonthRes,
        newClientsThisMonthRes,
      ] = await Promise.all([
        // All-time totals
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_deleted', false).in('status', ['open', 'active', 'in_progress']),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', monthStartIso),
        supabase.from('guards').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('guards').select('*', { count: 'exact', head: true }).in('verification_status', ['manual_review', 'pending_sia_check']),
        supabase.from('sia_verifications').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase.from('complaints').select('*', { count: 'exact', head: true }).in('status', ['open', 'pending']),
        supabase.from('subscription_payments').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('guard_payouts').select('*', { count: 'exact', head: true }).eq('status', 'held'),

        // Monthly revenue — subscription_payments is the source of truth for subscription revenue
        // Only count succeeded payments that have not been refunded
        supabase.from('subscription_payments').select('amount').eq('status', 'succeeded').eq('refunded', false).gte('created_at', monthStartIso),

        // Monthly revenue — transactions is the source for non-subscription revenue (job payments, PAYG, etc.)
        // Only count completed transactions that have not been refunded
        // Exclude transaction_type = 'subscription' to prevent double-counting with subscription_payments
        supabase.from('transactions').select('amount').eq('status', 'completed').eq('refunded', false).or('transaction_type.neq.subscription,transaction_type.is.null').gte('created_at', monthStartIso),

        supabase.from('job_assignments').select('assigned_at, jobs!inner(created_at)').not('assigned_at', 'is', null).gte('assigned_at', monthStartIso),

        // Previous month — only for monthly metrics (new jobs, revenue, match time)
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', prevMonthStartIso).lt('created_at', prevMonthEndIso),
        supabase.from('subscription_payments').select('amount').eq('status', 'succeeded').eq('refunded', false).gte('created_at', prevMonthStartIso).lt('created_at', prevMonthEndIso),
        supabase.from('transactions').select('amount').eq('status', 'completed').eq('refunded', false).or('transaction_type.neq.subscription,transaction_type.is.null').gte('created_at', prevMonthStartIso).lt('created_at', prevMonthEndIso),
        supabase.from('job_assignments').select('assigned_at, jobs!inner(created_at)').not('assigned_at', 'is', null).gte('assigned_at', prevMonthStartIso).lt('assigned_at', prevMonthEndIso),

        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('clients').select('*', { count: 'exact', head: true }).gt('trial_end_date', now.toISOString()).not('trial_end_date', 'is', null),
        supabase.from('guards').select('*', { count: 'exact', head: true }).eq('profile_completed', false),
        supabase.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'pending']),
        supabase.from('guards').select('*', { count: 'exact', head: true }).gte('created_at', monthStartIso),
        supabase.from('clients').select('*', { count: 'exact', head: true }).gte('created_at', monthStartIso),
      ]);

      // Check for any query errors
      const results = [
        totalJobsRes, activeJobsRes, newJobsThisMonthRes, totalGuardsRes, totalClientsRes,
        pendingVerificationsRes, pendingSiaRes, openComplaintsRes, failedSubPaymentsRes, failedTransRes,
        heldPayoutsRes, monthlyRevenueSubRes, monthlyRevenueTransRes, matchTimeRes,
        prevNewJobsRes, prevMonthlyRevenueSubRes, prevMonthlyRevenueTransRes, prevMatchTimeRes,
        activeSubscriptionsRes, trialAccountsRes, incompleteProfilesRes, openSupportTicketsRes,
        newGuardsThisMonthRes, newClientsThisMonthRes,
      ];
      const firstError = results.find((r) => r.error);
      if (firstError?.error) {
        throw new Error(`Database query failed: ${firstError.error.message}`);
      }

      const totalJobs = totalJobsRes.count ?? 0;
      const activeJobs = activeJobsRes.count ?? 0;
      const newJobsThisMonth = newJobsThisMonthRes.count ?? 0;
      const totalGuards = totalGuardsRes.count ?? 0;
      const totalClients = totalClientsRes.count ?? 0;
      const pendingVerifications = pendingVerificationsRes.count ?? 0;
      const pendingSiaVerifications = pendingSiaRes.count ?? 0;
      const openComplaints = openComplaintsRes.count ?? 0;
      const failedPayments = (failedSubPaymentsRes.count ?? 0) + (failedTransRes.count ?? 0);
      const heldPayments = heldPayoutsRes.count ?? 0;

      // Revenue calculation — two sources, one total
      // 1. subscription_payments: source of truth for all subscription revenue
      // 2. transactions: source for non-subscription revenue (job payments, PAYG, service fees)
      // We exclude subscription-type transactions to prevent double-counting.
      const subPayments = monthlyRevenueSubRes.data ?? [];
      const subscriptionRevenue = subPayments.reduce((sum, r: any) => sum + (Number(r.amount) || 0), 0);

      const transPayments = monthlyRevenueTransRes.data ?? [];
      const transactionRevenue = transPayments.reduce((sum, r: any) => sum + (Number(r.amount) || 0), 0);

      const monthlyRevenue = subscriptionRevenue + transactionRevenue;

      // Month-over-month trend calculation
      const calcTrend = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : null;
        return Math.round(((current - previous) / previous) * 100);
      };

      const prevNewJobs = prevNewJobsRes.count ?? 0;
      const prevSubPayments = prevMonthlyRevenueSubRes.data ?? [];
      const prevTransPayments = prevMonthlyRevenueTransRes.data ?? [];
      const prevMonthlyRevenue =
        prevSubPayments.reduce((sum, r: any) => sum + (Number(r.amount) || 0), 0) +
        prevTransPayments.reduce((sum, r: any) => sum + (Number(r.amount) || 0), 0);

      const calcMatchTime = (rows: any[]) => {
        if (rows.length === 0) return null;
        let totalMinutes = 0;
        let validCount = 0;
        for (const row of rows) {
          const assignedAt = row.assigned_at ? new Date(row.assigned_at).getTime() : 0;
          const jobCreatedAt = row.jobs?.created_at ? new Date(row.jobs.created_at).getTime() : 0;
          if (assignedAt && jobCreatedAt && assignedAt > jobCreatedAt) {
            totalMinutes += (assignedAt - jobCreatedAt) / (1000 * 60);
            validCount++;
          }
        }
        if (validCount === 0) return null;
        return Math.round(totalMinutes / validCount);
      };

      const avgMatchTimeMinutes = calcMatchTime(matchTimeRes.data ?? []);
      const prevAvgMatchTimeMinutes = calcMatchTime(prevMatchTimeRes.data ?? []);

      const matchTimeTrend = (avgMatchTimeMinutes != null && prevAvgMatchTimeMinutes != null)
        ? avgMatchTimeMinutes - prevAvgMatchTimeMinutes
        : null;

      // Only set trends for monthly metrics (month-over-month comparison)
      // All-time totals and current snapshots do not show trends
      setTrends({
        newJobsThisMonthTrend: calcTrend(newJobsThisMonth, prevNewJobs),
        monthlyRevenueTrend: calcTrend(monthlyRevenue, prevMonthlyRevenue),
        avgMatchTimeTrend: matchTimeTrend,
      });

      const activeSubscriptions = activeSubscriptionsRes.count ?? 0;
      const trialAccounts = trialAccountsRes.count ?? 0;
      const incompleteProfiles = incompleteProfilesRes.count ?? 0;
      const openSupportTickets = openSupportTicketsRes.count ?? 0;
      const newUsersThisMonth = (newGuardsThisMonthRes.count ?? 0) + (newClientsThisMonthRes.count ?? 0);

      setStats({
        totalJobs,
        activeJobs,
        newJobsThisMonth,
        totalGuards,
        totalClients,
        pendingVerifications,
        pendingSiaVerifications,
        openComplaints,
        failedPayments,
        heldPayments,
        monthlyRevenue,
        avgMatchTimeMinutes,
        activeSubscriptions,
        trialAccounts,
        incompleteProfiles,
        openSupportTickets,
        newUsersThisMonth,
      });

      const realAlerts: AlertItem[] = [];
      if (pendingVerifications > 0) {
        realAlerts.push({
          id: 1,
          type: 'warning',
          title: `${pendingVerifications} Guard${pendingVerifications > 1 ? 's' : ''} Awaiting Verification`,
          message: 'Pending profile checks require admin review to unblock guard availability.',
          action: 'Review Now',
          href: '/admin/guard-verifications',
        });
      }
      if (pendingSiaVerifications > 0) {
        realAlerts.push({
          id: 2,
          type: 'warning',
          title: `${pendingSiaVerifications} SIA Licence${pendingSiaVerifications > 1 ? 's' : ''} Pending`,
          message: 'SIA licence verifications need admin approval.',
          action: 'Verify',
          href: '/admin/sia-verifications',
        });
      }
      if (openComplaints > 0) {
        realAlerts.push({
          id: 3,
          type: 'critical',
          title: `${openComplaints} Open Complaint${openComplaints > 1 ? 's' : ''}`,
          message: 'Unresolved complaints need admin attention.',
          action: 'Investigate',
          href: '/admin/complaints',
        });
      }
      if (failedPayments > 0) {
        realAlerts.push({
          id: 4,
          type: 'critical',
          title: `${failedPayments} Failed Payment${failedPayments > 1 ? 's' : ''}`,
          message: 'Recent payment failures require review and retry.',
          action: 'Review',
          href: '/admin/failed-payments',
        });
      }
      if (heldPayments > 0) {
        realAlerts.push({
          id: 5,
          type: 'warning',
          title: `${heldPayments} Held Payout${heldPayments > 1 ? 's' : ''}`,
          message: 'Guard payouts are on hold and need admin release.',
          action: 'Release',
          href: '/admin/held-payments',
        });
      }
      if (realAlerts.length === 0) {
        realAlerts.push({
          id: 1,
          type: 'info',
          title: 'All Systems Normal',
          message: 'No pending verifications, complaints, or payment issues. Dashboard is clear.',
          action: 'View Activity',
          href: '/admin/activity-log',
        });
      }
      setAlerts(realAlerts);

      await fetchActivities();
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [fetchActivities]);

  // Keep the ref in sync with the latest fetchStats
  fetchStatsRef.current = fetchStats;

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Realtime subscriptions — only run once on mount to avoid duplicate channels
  useEffect(() => {
    // Clean up any existing channel first
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
  }, []); // intentionally empty — only mount/unmount

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchStats().finally(() => {
      setIsRefreshing(false);
    });
  };

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-900/50">
                <i className="ri-dashboard-3-line text-xl"></i>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg font-bold text-white leading-tight tracking-tight">Dashboard</h1>
                  <LiveIndicator />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-slate-500 font-medium">
                    {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Updating...'}
                  </p>
                  {realtimeStatus === 'SUBSCRIBED' && (
                    <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Live
                    </span>
                  )}
                  {realtimeStatus && realtimeStatus !== 'SUBSCRIBED' && (
                    <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      Realtime unavailable
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || loading}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                aria-label="Refresh dashboard"
              >
                <div className={`w-4 h-4 flex items-center justify-center ${isRefreshing ? 'animate-spin' : ''}`}>
                  <i className="ri-refresh-line text-base"></i>
                </div>
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <Link
                href="/admin/jobs"
                className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-teal-900/50 whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-briefcase-line text-sm"></i>
                </div>
                Manage Jobs
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-8">
        {error && (
          <div className="rounded-2xl border-l-[5px] border-l-red-500 p-5 shadow-sm bg-[#111d35] flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-500/10 text-red-400">
              <i className="ri-error-warning-line text-lg"></i>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white">Failed to load dashboard</h3>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">{error}</p>
            </div>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0 shadow-sm bg-red-600 hover:bg-red-500 text-white cursor-pointer"
            >
              Retry
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-refresh-line text-sm"></i>
              </div>
            </button>
          </div>
        )}

        <DashboardAlerts alerts={alerts} loading={loading} />
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
          error={error}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <DashboardActivity activities={activities} loading={loading} error={activityError} />
          </div>
          <DashboardQuickActions />
        </div>
        <div className="mb-8">
          <StripeConnectHealth />
        </div>
      </main>
    </div>
  );
}