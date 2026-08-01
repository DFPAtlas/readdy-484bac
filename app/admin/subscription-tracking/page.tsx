'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Pagination from '@/components/Pagination';
import LiveIndicator from '@/components/LiveIndicator';

interface Subscription {
  id: string;
  user_id: string;
  plan_slug: string;
  plan_name: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  cancel_at_period_end: boolean;
  client_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  trial_end_date: string | null;
  last_payment_date: string | null;
  payment_status: string | null;
  payment_failure_count: number;
  amount_paid: number | null;
  billing_cycle: string | null;
  plan_amount: number | null;
}

interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  user_type: string;
}

interface ClientInfo {
  id: string;
  company_name: string;
  contact_name: string;
}

interface GuardInfo {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
}

interface PlanInfo {
  slug: string;
  name: string;
  job_limit_per_month: number | null;
}

interface UsageRow {
  entity_id: string;
  usage_count: number;
  entity_type: string;
}

interface EnrichedSub {
  subscription: Subscription;
  user: UserInfo | null;
  client: ClientInfo | null;
  guard: GuardInfo | null;
  plan: PlanInfo | null;
  planStatus: 'ok' | 'missing' | 'no-limit' | 'limited';
  usageThisMonth: number;
  usageLimit: number | null;
  isOverLimit: boolean;
  usagePercent: number;
  isGuard: boolean;
}

interface StatsData {
  total: number;
  active: number;
  trialing: number;
  past_due: number;
  cancelled: number;
  with_stripe: number;
  guard_count: number;
  client_count: number;
  over_limit: number;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function getPlanColor(slug: string) {
  if (slug.includes('elite')) return 'bg-purple-500/15 text-purple-400';
  if (slug.includes('pro')) return 'bg-blue-500/15 text-blue-400';
  if (slug.includes('enterprise')) return 'bg-teal-500/15 text-teal-400';
  if (slug.includes('basic')) return 'bg-emerald-500/15 text-emerald-400';
  if (slug.includes('starter')) return 'bg-slate-500/15 text-slate-400';
  return 'bg-slate-500/15 text-slate-400';
}

function getStatusColor(status: string, cancelAtEnd: boolean) {
  if (cancelAtEnd) return 'bg-amber-500/15 text-amber-400';
  switch (status) {
    case 'active':
    case 'trialing': return 'bg-emerald-500/15 text-emerald-400';
    case 'past_due': return 'bg-red-500/15 text-red-400';
    case 'cancelled':
    case 'canceled': return 'bg-slate-500/15 text-slate-400';
    case 'pending': return 'bg-sky-500/15 text-sky-400';
    case 'incomplete': return 'bg-orange-500/15 text-orange-400';
    default: return 'bg-slate-500/15 text-slate-400';
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusLabel(status: string, cancelAtEnd: boolean) {
  if (cancelAtEnd) return 'Cancelling';
  if (status === 'active') return 'Active';
  if (status === 'trialing') return 'Trial';
  if (status === 'past_due') return 'Past Due';
  if (status === 'cancelled' || status === 'canceled') return 'Cancelled';
  if (status === 'pending') return 'Pending';
  if (status === 'incomplete') return 'Incomplete';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export default function SubscriptionTrackingPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [users, setUsers] = useState<Record<string, UserInfo>>({});
  const [clients, setClients] = useState<Record<string, ClientInfo>>({});
  const [guards, setGuards] = useState<Record<string, GuardInfo>>({});
  const [plans, setPlans] = useState<Record<string, PlanInfo>>({});
  const [usageData, setUsageData] = useState<UsageRow[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPlan, setFilterPlan] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSub, setSelectedSub] = useState<EnrichedSub | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [staleNotification, setStaleNotification] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error: statsErr } = await supabase
        .rpc('get_subscription_stats');
      if (statsErr) throw statsErr;
      if (data) {
        setStats(data as unknown as StatsData);
      }
    } catch (err: any) {
      console.error('Stats fetch failed:', err);
    }
  }, []);

  const fetchPage = useCallback(async (pageNum: number, currentPageSize: number) => {
    setLoading(true);
    setError(null);
    try {
      const from = (pageNum - 1) * currentPageSize;
      const to = from + currentPageSize - 1;

      const [countRes, subsRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('subscriptions')
          .select('id, user_id, plan_slug, plan_name, status, current_period_start, current_period_end, created_at, cancel_at_period_end, client_id, stripe_subscription_id, stripe_customer_id, trial_end_date, last_payment_date, payment_status, payment_failure_count, amount_paid, billing_cycle, plan_amount')
          .order('created_at', { ascending: false })
          .range(from, to),
      ]);

      if (countRes.error) throw countRes.error;
      if (subsRes.error) throw subsRes.error;

      setTotalCount(countRes.count || 0);
      const subs = (subsRes.data || []) as Subscription[];
      setSubscriptions(subs);

      const userIds = [...new Set(subs.map(s => s.user_id).filter(Boolean))];
      const clientIds = [...new Set(subs.map(s => s.client_id).filter(Boolean))];
      const planSlugs = [...new Set(subs.map(s => s.plan_slug).filter(Boolean))];

      const [userRes, clientRes, guardRes, planRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from('users').select('id, email, full_name, user_type').in('id', userIds)
          : Promise.resolve({ data: [] }),
        clientIds.length > 0
          ? supabase.from('clients').select('id, company_name, contact_name').in('id', clientIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabase.from('guards').select('id, user_id, full_name, email').in('user_id', userIds)
          : Promise.resolve({ data: [] }),
        planSlugs.length > 0
          ? supabase.from('plans').select('slug, name, job_limit_per_month').in('slug', planSlugs)
          : Promise.resolve({ data: [] }),
      ]);

      const userMap: Record<string, UserInfo> = {};
      (userRes.data || []).forEach((u: any) => { userMap[u.id] = u; });
      setUsers(userMap);

      const clientMap: Record<string, ClientInfo> = {};
      (clientRes.data || []).forEach((c: any) => { clientMap[c.id] = c; });
      setClients(clientMap);

      const guardMap: Record<string, GuardInfo> = {};
      (guardRes.data || []).forEach((g: any) => { guardMap[g.user_id] = g; });
      setGuards(guardMap);

      const planMap: Record<string, PlanInfo> = {};
      (planRes.data || []).forEach((p: any) => { planMap[p.slug] = { slug: p.slug, name: p.name, job_limit_per_month: p.job_limit_per_month }; });
      setPlans(planMap);

      const guardIds = Object.values(guardMap).map(g => g.id);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      if ((clientIds.length > 0 || guardIds.length > 0)) {
        const { data: usageRows, error: usageErr } = await supabase
          .rpc('get_subscription_usage', {
            p_client_ids: clientIds.length > 0 ? clientIds : [],
            p_guard_ids: guardIds.length > 0 ? guardIds : [],
            p_month_start: monthStart.toISOString(),
          });
        if (!usageErr && usageRows) {
          setUsageData(usageRows as UsageRow[]);
        }
      } else {
        setUsageData([]);
      }
    } catch (err: any) {
      console.error('Error fetching subscriptions:', err);
      setError(err.message || 'Failed to load subscription data');
      showToast('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchAll = useCallback((pageNum: number, pageSz: number) => {
    fetchPage(pageNum, pageSz);
    fetchStats();
  }, [fetchPage, fetchStats]);

  useEffect(() => {
    fetchAll(page, pageSize);
  }, [page, pageSize]);

  useEffect(() => {
    const channel = supabase
      .channel('subscription-tracking-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'app', table: 'subscriptions' },
        () => {
          setStaleNotification(true);
          setIsLive(true);
          setTimeout(() => setStaleNotification(false), 6000);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'app', table: 'subscriptions' },
        () => {
          setStaleNotification(true);
          setIsLive(true);
          setTimeout(() => setStaleNotification(false), 6000);
        },
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setStaleNotification(false);
    fetchAll(page, pageSize);
  }, [fetchAll, page, pageSize]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { data: allSubs, error: expErr } = await supabase
        .from('subscriptions')
        .select('id, user_id, plan_slug, plan_name, status, current_period_start, current_period_end, created_at, cancel_at_period_end, client_id, stripe_subscription_id, stripe_customer_id, trial_end_date, last_payment_date, payment_status, payment_failure_count, amount_paid, billing_cycle, plan_amount')
        .order('created_at', { ascending: false });

      if (expErr) throw expErr;
      const subs = (allSubs || []) as Subscription[];

      const userIds = [...new Set(subs.map(s => s.user_id).filter(Boolean))];
      const clientIds = [...new Set(subs.map(s => s.client_id).filter(Boolean))];
      const planSlugs = [...new Set(subs.map(s => s.plan_slug).filter(Boolean))];

      const [userRes, clientRes, planRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from('users').select('id, email, full_name, user_type').in('id', userIds)
          : Promise.resolve({ data: [] }),
        clientIds.length > 0
          ? supabase.from('clients').select('id, company_name, contact_name').in('id', clientIds)
          : Promise.resolve({ data: [] }),
        planSlugs.length > 0
          ? supabase.from('plans').select('slug, name, job_limit_per_month').in('slug', planSlugs)
          : Promise.resolve({ data: [] }),
      ]);

      const userMap: Record<string, UserInfo> = {};
      (userRes.data || []).forEach((u: any) => { userMap[u.id] = u; });
      const clientMap: Record<string, ClientInfo> = {};
      (clientRes.data || []).forEach((c: any) => { clientMap[c.id] = c; });
      const planMap: Record<string, PlanInfo> = {};
      (planRes.data || []).forEach((p: any) => { planMap[p.slug] = { slug: p.slug, name: p.name, job_limit_per_month: p.job_limit_per_month }; });

      const headers = [
        'Account Name', 'Email', 'Type', 'Plan Name', 'Plan Slug',
        'Status', 'Usage Limit', 'Billing Cycle', 'Plan Amount',
        'Period Start', 'Period End', 'Created Date',
        'Payment Status', 'Amount Paid', 'Payment Failures',
        'Stripe Customer ID', 'Stripe Subscription ID', 'Cancels At Period End',
      ];

      const rows = subs.map(sub => {
        const user = userMap[sub.user_id];
        const client = sub.client_id ? clientMap[sub.client_id] : null;
        const plan = sub.plan_slug ? planMap[sub.plan_slug] : null;
        const isGuard = user?.user_type === 'guard';
        const accountName = isGuard
          ? (user?.full_name || 'Unknown')
          : (client?.company_name || user?.full_name || 'Unknown');
        const email = user?.email || '';
        const type = isGuard ? 'guard' : 'client';
        const planName = plan?.name || sub.plan_name || '';
        const usageLimit = plan?.job_limit_per_month != null ? String(plan.job_limit_per_month) : (plan ? 'Unlimited' : 'N/A');

        return [
          accountName, email, type, planName, sub.plan_slug || '',
          sub.status, usageLimit, sub.billing_cycle || '', sub.plan_amount != null ? String(sub.plan_amount) : '',
          formatDate(sub.current_period_start), formatDate(sub.current_period_end), formatDate(sub.created_at),
          sub.payment_status || '', sub.amount_paid != null ? String(sub.amount_paid) : '',
          String(sub.payment_failure_count),
          sub.stripe_customer_id || '', sub.stripe_subscription_id || '',
          sub.cancel_at_period_end ? 'Yes' : 'No',
        ].map(escapeCSV).join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `subscription-tracking-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('CSV exported successfully');
    } catch (err: any) {
      console.error('Export failed:', err);
      showToast('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  }, [showToast]);

  const enriched: EnrichedSub[] = useMemo(() => {
    const usageByEntity: Record<string, number> = {};
    usageData.forEach(row => {
      usageByEntity[row.entity_id] = row.usage_count;
    });

    return subscriptions.map(sub => {
      const user = users[sub.user_id] || null;
      const client = sub.client_id ? clients[sub.client_id] || null : null;
      const guard = guards[sub.user_id] || null;
      const plan = sub.plan_slug ? plans[sub.plan_slug] : undefined;
      const isGuard = !!guard;

      let planStatus: EnrichedSub['planStatus'] = 'ok';
      if (!plan) {
        planStatus = 'missing';
      } else if (plan.job_limit_per_month == null) {
        planStatus = 'no-limit';
      } else {
        planStatus = 'limited';
      }

      let usageThisMonth = 0;
      if (isGuard && guard) {
        usageThisMonth = usageByEntity[guard.id] || 0;
      } else if (client && sub.client_id) {
        usageThisMonth = usageByEntity[sub.client_id] || 0;
      }

      const usageLimit = plan?.job_limit_per_month ?? null;
      const isOverLimit = usageLimit != null && usageThisMonth > usageLimit;
      const usagePercent = usageLimit == null ? 0 : Math.min((usageThisMonth / usageLimit) * 100, 100);

      return {
        subscription: sub,
        user,
        client,
        guard,
        plan: plan || null,
        planStatus,
        usageThisMonth,
        usageLimit,
        isOverLimit,
        usagePercent,
        isGuard,
      };
    });
  }, [subscriptions, users, clients, guards, plans, usageData]);

  const planOptions = useMemo(() => {
    const slugs = [...new Set(enriched.map(e => e.subscription.plan_slug).filter(Boolean))];
    return slugs.map(slug => {
      const plan = plans[slug];
      return { value: slug, label: plan?.name || slug };
    });
  }, [enriched, plans]);

  const filtered = useMemo(() => {
    return enriched.filter(item => {
      const matchesPlan = filterPlan === 'all' || item.subscription.plan_slug === filterPlan;
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        item.client?.company_name?.toLowerCase().includes(q) ||
        item.client?.contact_name?.toLowerCase().includes(q) ||
        item.guard?.full_name?.toLowerCase().includes(q) ||
        item.guard?.email?.toLowerCase().includes(q) ||
        item.user?.email?.toLowerCase().includes(q) ||
        item.user?.full_name?.toLowerCase().includes(q) ||
        item.subscription.plan_name?.toLowerCase().includes(q);
      return matchesPlan && matchesSearch;
    });
  }, [enriched, filterPlan, searchTerm]);

  const computedStats = useMemo(() => {
    if (!stats) return null;
    const overLimit = enriched.filter(e => planOptions.some(p => p.value === e.subscription.plan_slug) && e.isOverLimit).length;
    return { ...stats, over_limit: overLimit };
  }, [stats, enriched, planOptions]);

  if (loading && subscriptions.length === 0 && !error) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading subscription data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-white">Subscription Tracking</h1>
                {isLive && (
                  <LiveIndicator label="Live" />
                )}
              </div>
              <p className="text-slate-400 mt-2">Monitor client and guard subscriptions and usage limits from the same live data as Subscription Management</p>
            </div>
            <div className="flex items-center gap-3">
              {staleNotification && (
                <button
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-refresh-line"></i>
                  New data available — Refresh
                </button>
              )}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#0a1628] text-slate-300 border border-[#1e2d4a] hover:bg-[#162544] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
                Refresh
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-500 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <i className={`${exporting ? 'ri-loader-4-line animate-spin' : 'ri-download-line'}`}></i>
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-5 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-500/15 flex-shrink-0">
                <i className="ri-error-warning-line text-xl text-red-400"></i>
              </div>
              <div>
                <p className="font-semibold text-red-300 mb-1">Failed to load subscription data</p>
                <p className="text-sm text-red-400/80">{error}</p>
              </div>
            </div>
            <button
              onClick={() => fetchAll(page, pageSize)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-restart-line"></i>
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-4 mb-8">
          {[
            { label: 'Total Subs', value: computedStats?.total, icon: 'ri-bank-card-line', color: 'bg-slate-500/15 text-slate-300' },
            { label: 'Active', value: computedStats?.active, icon: 'ri-checkbox-circle-line', color: 'bg-emerald-500/15 text-emerald-400' },
            { label: 'Trialing', value: computedStats?.trialing, icon: 'ri-time-line', color: 'bg-amber-500/15 text-amber-400' },
            { label: 'Past Due', value: computedStats?.past_due, icon: 'ri-error-warning-line', color: 'bg-red-500/15 text-red-400' },
            { label: 'Cancelled', value: computedStats?.cancelled, icon: 'ri-close-circle-line', color: 'bg-slate-500/15 text-slate-400' },
            { label: 'Over Limit', value: computedStats?.over_limit, icon: 'ri-alert-line', color: 'bg-red-500/15 text-red-400' },
            { label: 'With Stripe', value: computedStats?.with_stripe, icon: 'ri-exchange-dollar-line', color: 'bg-sky-500/15 text-sky-400' },
            { label: 'Guards', value: computedStats?.guard_count, icon: 'ri-shield-user-line', color: 'bg-blue-500/15 text-blue-400' },
            { label: 'Clients', value: computedStats?.client_count, icon: 'ri-building-line', color: 'bg-teal-500/15 text-teal-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#111d35] rounded-xl p-4 border border-[#1e2d4a]">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.color}`}>
                  <i className={`${s.icon} text-base`}></i>
                </div>
                <span className="text-xs font-medium text-slate-400">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{s.value ?? '—'}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#111d35] rounded-xl border border-[#1e2d4a] p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xl"></i>
                <input
                  type="text"
                  placeholder="Search by name, company, email, or plan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-[#0a1628] border border-[#1e2d4a] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white placeholder-slate-500"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterPlan('all')}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors cursor-pointer ${
                  filterPlan === 'all' ? 'bg-teal-600 text-white' : 'bg-[#0a1628] text-slate-400 hover:bg-[#162544]'
                }`}
              >
                All Plans
              </button>
              {planOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilterPlan(opt.value)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors cursor-pointer ${
                    filterPlan === opt.value ? 'bg-teal-600 text-white' : 'bg-[#0a1628] text-slate-400 hover:bg-[#162544]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#111d35] rounded-xl border border-[#1e2d4a] overflow-hidden">
          {error && subscriptions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 flex items-center justify-center bg-red-500/10 rounded-full mx-auto mb-4">
                <i className="ri-error-warning-line text-3xl text-red-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Unable to load subscriptions</h3>
              <p className="text-slate-400 mb-4">Check your connection and try again</p>
              <button
                onClick={() => fetchAll(page, pageSize)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-500 transition-colors cursor-pointer"
              >
                <i className="ri-restart-line"></i>
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0d1b33] border-b border-[#1e2d4a]">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Account</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Plan</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Monthly Usage</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Period</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Payment</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2d4a]">
                    {filtered.map((item) => {
                      const { subscription: sub, client, guard, user, plan, planStatus, usageThisMonth, usageLimit, isOverLimit, usagePercent, isGuard } = item;
                      const limitDisplay = planStatus === 'no-limit' ? 'Unlimited' : (usageLimit != null ? String(usageLimit) : 'N/A');

                      const displayName = isGuard
                        ? (guard?.full_name || user?.full_name || 'Unknown Guard')
                        : (client?.company_name || user?.full_name || 'Unknown');
                      const displayEmail = isGuard
                        ? (guard?.email || user?.email || '—')
                        : (client?.contact_name || user?.email || sub.user_id.slice(0, 8));
                      const displayType = isGuard ? 'guard' : 'client';
                      const typeColor = isGuard
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : 'bg-teal-500/15 text-teal-400 border border-teal-500/30';
                      const typeIcon = isGuard ? 'ri-shield-user-line' : 'ri-building-line';
                      const typeIconColor = isGuard ? 'text-blue-400' : 'text-teal-400';
                      const typeBgColor = isGuard ? 'bg-blue-500/15' : 'bg-teal-500/15';
                      const usageLabel = isGuard ? 'applications' : 'jobs';
                      const showUsageBar = planStatus === 'limited';

                      return (
                        <tr key={sub.id} className={`hover:bg-[#162544] transition-colors ${isOverLimit ? 'bg-red-500/5' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${typeBgColor}`}>
                                <i className={`${typeIcon} ${typeIconColor} text-xs`}></i>
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-white truncate">{displayName}</div>
                                <div className="text-sm text-slate-400 truncate">{displayEmail}</div>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-block ${typeColor}`}>
                                  {displayType}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPlanColor(sub.plan_slug)}`}>
                                {plan?.name || sub.plan_name || sub.plan_slug || '—'}
                              </span>
                              {planStatus === 'missing' && (
                                <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                  Plan not in registry
                                </span>
                              )}
                              {planStatus === 'no-limit' && (
                                <span className="text-[10px] font-semibold text-slate-400 bg-slate-500/10 px-1.5 py-0.5 rounded">
                                  No monthly limit
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(sub.status, sub.cancel_at_period_end)}`}>
                              {statusLabel(sub.status, sub.cancel_at_period_end).toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className={`font-medium ${isOverLimit ? 'text-red-400' : 'text-slate-300'}`}>
                                  {planStatus === 'missing' ? (
                                    <span className="text-amber-400">Plan not found</span>
                                  ) : (
                                    <>{usageThisMonth} / {limitDisplay} {usageLabel}</>
                                  )}
                                </span>
                                {isOverLimit && (
                                  <span className="text-xs font-medium text-red-400 bg-red-500/15 px-2 py-1 rounded whitespace-nowrap">
                                    OVER LIMIT
                                  </span>
                                )}
                              </div>
                              {showUsageBar && (
                                <div className="w-full bg-[#0a1628] rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all ${
                                      isOverLimit ? 'bg-red-500' : usagePercent > 80 ? 'bg-orange-500' : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${usagePercent}%` }}
                                  ></div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-300 whitespace-nowrap">
                              {formatDate(sub.current_period_start)}
                            </div>
                            <div className="text-sm text-slate-500 whitespace-nowrap">
                              to {formatDate(sub.current_period_end)}
                            </div>
                            {sub.cancel_at_period_end && (
                              <div className="text-xs text-amber-400 font-medium mt-1">Cancels at end</div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-300">
                              {sub.amount_paid ? `£${Number(sub.amount_paid).toFixed(2)}` : '—'}
                            </div>
                            <div className="text-xs text-slate-500 capitalize">{sub.payment_status || '—'}</div>
                            {sub.payment_failure_count > 0 && (
                              <div className="text-xs text-red-400 mt-1">{sub.payment_failure_count} failed</div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => {
                                setSelectedSub(item);
                                setShowDetailModal(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <i className="ri-eye-line"></i>
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!error && filtered.length === 0 && (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 flex items-center justify-center bg-[#0a1628] rounded-full mx-auto mb-4">
                    <i className="ri-building-line text-3xl text-slate-500"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">No subscriptions found</h3>
                  <p className="text-slate-400">Try adjusting your filters or search terms</p>
                </div>
              )}
            </>
          )}
        </div>

        <Pagination
          currentPage={page}
          totalItems={totalCount}
          itemsPerPage={pageSize}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handlePageSizeChange}
        />
      </div>

      {showDetailModal && selectedSub && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-[#111d35] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-[#1e2d4a]">
            <div className="sticky top-0 bg-[#0d1b33] border-b border-[#1e2d4a] px-8 py-6 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="text-2xl font-bold text-white">Subscription Details</h2>
                <p className="text-sm text-slate-400 mt-1">
                  {selectedSub.isGuard
                    ? (selectedSub.guard?.full_name || selectedSub.user?.full_name || 'Unknown')
                    : (selectedSub.client?.company_name || selectedSub.user?.full_name || 'Unknown')}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#162544] transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-2xl text-slate-400"></i>
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="rounded-xl p-6 bg-[#0a1628] border border-[#1e2d4a]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Current Plan</p>
                    <p className="text-3xl font-bold text-white">{selectedSub.plan?.name || selectedSub.subscription.plan_name || 'Needs review'}</p>
                  </div>
                  <div className="w-16 h-16 flex items-center justify-center bg-[#111d35] rounded-full">
                    <i className={`${selectedSub.isGuard ? 'ri-shield-user-line' : 'ri-vip-crown-line'} text-3xl ${selectedSub.isOverLimit ? 'text-red-400' : 'text-teal-400'}`}></i>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPlanColor(selectedSub.subscription.plan_slug)}`}>
                    {selectedSub.subscription.plan_slug?.toUpperCase() || '—'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedSub.subscription.status, selectedSub.subscription.cancel_at_period_end)}`}>
                    {statusLabel(selectedSub.subscription.status, selectedSub.subscription.cancel_at_period_end).toUpperCase()}
                  </span>
                  {selectedSub.isOverLimit && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400">
                      OVER LIMIT
                    </span>
                  )}
                </div>
                {selectedSub.planStatus === 'missing' && (
                  <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
                    <p className="text-xs text-amber-400">
                      <i className="ri-information-line mr-1"></i>
                      This plan slug is not registered in the plans table. Usage limits and plan name may be inaccurate.
                    </p>
                  </div>
                )}
                {selectedSub.planStatus === 'no-limit' && (
                  <div className="mt-3 bg-slate-500/10 border border-slate-500/20 rounded-lg px-4 py-2">
                    <p className="text-xs text-slate-400">
                      <i className="ri-information-line mr-1"></i>
                      This plan has no monthly usage limit configured.
                    </p>
                  </div>
                )}
              </div>

              {selectedSub.isGuard ? (
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <i className="ri-shield-user-line text-blue-400"></i>
                    Guard Information
                  </h3>
                  <div className="bg-[#0a1628] rounded-lg p-6 space-y-3 border border-[#1e2d4a]">
                    <div>
                      <p className="text-sm text-slate-400">Guard Name</p>
                      <p className="font-semibold text-white">{selectedSub.guard?.full_name || selectedSub.user?.full_name || '—'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#1e2d4a]">
                      <div>
                        <p className="text-sm text-slate-400">Email</p>
                        <p className="font-medium text-slate-300">{selectedSub.guard?.email || selectedSub.user?.email || '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">User Type</p>
                        <p className="font-medium text-slate-300 capitalize">Guard</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <i className="ri-building-line text-teal-400"></i>
                    Client Information
                  </h3>
                  <div className="bg-[#0a1628] rounded-lg p-6 space-y-3 border border-[#1e2d4a]">
                    <div>
                      <p className="text-sm text-slate-400">Company Name</p>
                      <p className="font-semibold text-white">{selectedSub.client?.company_name || '—'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#1e2d4a]">
                      <div>
                        <p className="text-sm text-slate-400">Contact Name</p>
                        <p className="font-medium text-slate-300">{selectedSub.client?.contact_name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Email</p>
                        <p className="font-medium text-slate-300">{selectedSub.user?.email || '—'}</p>
                      </div>
                    </div>
                    {selectedSub.user?.user_type && (
                      <div className="pt-3 border-t border-[#1e2d4a]">
                        <p className="text-sm text-slate-400">User Type</p>
                        <p className="font-medium text-slate-300 capitalize">{selectedSub.user.user_type}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <i className="ri-bar-chart-line text-teal-400"></i>
                  Usage Statistics
                </h3>
                <div className="bg-[#0a1628] rounded-lg p-6 space-y-4 border border-[#1e2d4a]">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-slate-400">
                        {selectedSub.isGuard ? 'Applications This Month' : 'Jobs Posted This Month'}
                      </p>
                      <p className={`text-2xl font-bold ${selectedSub.isOverLimit ? 'text-red-400' : 'text-white'}`}>
                        {selectedSub.planStatus === 'no-limit'
                          ? `${selectedSub.usageThisMonth} / Unlimited`
                          : selectedSub.planStatus === 'missing'
                          ? `${selectedSub.usageThisMonth} / Unknown`
                          : `${selectedSub.usageThisMonth} / ${selectedSub.usageLimit}`}
                      </p>
                    </div>
                    {selectedSub.planStatus === 'limited' && selectedSub.usageLimit != null && (
                      <div className="w-full bg-[#111d35] rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            selectedSub.isOverLimit ? 'bg-red-500' : selectedSub.usagePercent > 80 ? 'bg-orange-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${selectedSub.usagePercent}%` }}
                        ></div>
                      </div>
                    )}
                    {selectedSub.planStatus === 'limited' && selectedSub.usageLimit != null && (
                      <div className="flex justify-between mt-2 text-xs text-slate-500">
                        <span>{selectedSub.isGuard ? 'Applications remaining:' : 'Jobs remaining:'} {Math.max(selectedSub.usageLimit - selectedSub.usageThisMonth, 0)}</span>
                        <span>{selectedSub.isGuard ? 'Monthly application limit:' : 'Monthly job limit:'} {selectedSub.usageLimit}</span>
                      </div>
                    )}
                  </div>
                  {selectedSub.isOverLimit && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <i className="ri-alert-line text-xl text-red-400 mt-0.5"></i>
                        <div>
                          <p className="font-semibold text-red-300 mb-1">Usage Limit Exceeded</p>
                          <p className="text-sm text-red-400/80">
                            {selectedSub.isGuard
                              ? 'This guard has exceeded their monthly application limit. Consider upgrading their plan.'
                              : 'This client has exceeded their monthly job posting limit. Consider upgrading their plan or contacting them.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <i className="ri-calendar-line text-teal-400"></i>
                  Subscription Period
                </h3>
                <div className="bg-[#0a1628] rounded-lg p-6 space-y-3 border border-[#1e2d4a]">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-400">Period Start</p>
                      <p className="font-medium text-slate-300">{formatDate(selectedSub.subscription.current_period_start)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Period End</p>
                      <p className="font-medium text-slate-300">{formatDate(selectedSub.subscription.current_period_end)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#1e2d4a]">
                    <div>
                      <p className="text-sm text-slate-400">Created</p>
                      <p className="font-medium text-slate-300">{formatDate(selectedSub.subscription.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Last Payment</p>
                      <p className="font-medium text-slate-300">{formatDate(selectedSub.subscription.last_payment_date)}</p>
                    </div>
                  </div>
                  {selectedSub.subscription.billing_cycle && (
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#1e2d4a]">
                      <div>
                        <p className="text-sm text-slate-400">Billing Cycle</p>
                        <p className="font-medium text-slate-300 capitalize">{selectedSub.subscription.billing_cycle}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Plan Amount</p>
                        <p className="font-medium text-slate-300">
                          {selectedSub.subscription.plan_amount != null
                            ? `£${Number(selectedSub.subscription.plan_amount).toFixed(2)}`
                            : '—'}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedSub.subscription.trial_end_date && (
                    <div className="pt-3 border-t border-[#1e2d4a]">
                      <p className="text-sm text-slate-400">Trial Ends</p>
                      <p className="font-medium text-slate-300">{formatDate(selectedSub.subscription.trial_end_date)}</p>
                    </div>
                  )}
                  {selectedSub.subscription.cancel_at_period_end && (
                    <div className="pt-3 border-t border-[#1e2d4a]">
                      <p className="text-sm text-slate-400">Status</p>
                      <p className="font-medium text-amber-400">Cancels at end of current period</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <i className="ri-exchange-dollar-line text-teal-400"></i>
                  Payment & Stripe Details
                </h3>
                <div className="bg-[#0a1628] rounded-lg p-6 space-y-3 border border-[#1e2d4a]">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-400">Amount Paid</p>
                      <p className="font-medium text-slate-300">{selectedSub.subscription.amount_paid ? `£${Number(selectedSub.subscription.amount_paid).toFixed(2)}` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Payment Status</p>
                      <p className="font-medium text-slate-300 capitalize">{selectedSub.subscription.payment_status || '—'}</p>
                    </div>
                  </div>
                  {selectedSub.subscription.payment_failure_count > 0 && (
                    <div className="pt-3 border-t border-[#1e2d4a]">
                      <p className="text-sm text-slate-400">Failed Payments</p>
                      <p className="font-medium text-red-400">{selectedSub.subscription.payment_failure_count}</p>
                    </div>
                  )}
                  <div className="pt-3 border-t border-[#1e2d4a]">
                    <p className="text-sm text-slate-400">Stripe Customer ID</p>
                    <p className="font-mono text-xs text-slate-500 bg-[#111d35] px-2 py-1 rounded truncate">
                      {selectedSub.subscription.stripe_customer_id || '—'}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-[#1e2d4a]">
                    <p className="text-sm text-slate-400">Stripe Subscription ID</p>
                    <p className="font-mono text-xs text-slate-500 bg-[#111d35] px-2 py-1 rounded truncate">
                      {selectedSub.subscription.stripe_subscription_id || '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 bg-[#0a1628] text-slate-300 py-3 rounded-lg font-semibold hover:bg-[#162544] transition-colors whitespace-nowrap cursor-pointer border border-[#1e2d4a]"
                >
                  Close
                </button>
                <Link
                  href={`/admin/subscription-management?open=${selectedSub.subscription.id}`}
                  className="flex-1 bg-teal-600 text-white py-3 rounded-lg font-semibold hover:bg-teal-500 transition-colors text-center whitespace-nowrap"
                >
                  Manage in Sub Mgmt
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-6 right-6 px-5 py-3 rounded-xl shadow-lg z-50 bg-emerald-500 text-white flex items-center gap-3">
          <i className="ri-check-line text-lg"></i>
          <span className="font-medium text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}