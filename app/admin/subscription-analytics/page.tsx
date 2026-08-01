'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimePostgresInsertPayload } from '@supabase/supabase-js';

interface PaymentAnalytics {
  totalRevenue: number;
  monthlyRevenue: number;
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  refundedAmount: number;
  averagePaymentValue: number;
  revenueByPlan: { [key: string]: number };
  monthlyTrend: { month: string; revenue: number; count: number }[];
  refundedCount: number;
}

interface SubInfo {
  plan_slug: string;
  plan_name: string;
  plan_amount: number;
  billing_cycle: string;
  status: string;
  stripe_subscription_id: string;
}

interface ClientInfo {
  company_name: string;
  email: string;
}

interface EnrichedPayment {
  id: string;
  user_id: string;
  subscription_id: string;
  stripe_payment_intent_id: string;
  stripe_invoice_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  billing_reason: string;
  period_start: string;
  period_end: string;
  paid_at: string;
  failed_at: string;
  failure_reason: string;
  refunded: boolean;
  refund_amount: number;
  invoice_url: string;
  receipt_url: string;
  created_at: string;
  subscription: SubInfo | null;
  client: ClientInfo | null;
}

interface AnalyticsRow {
  id: string;
  amount: number;
  status: string;
  refunded: boolean;
  refund_amount: number;
  created_at: string;
  subscription_id: string;
  user_id: string;
}

const PAGE_SIZE = 25;
const ANALYTICS_LIMIT = 5000;

const PLAN_COLORS: Record<string, string> = {
  'client_free': 'bg-slate-500/15 text-slate-400 border-slate-400/20',
  'client-starter': 'bg-blue-500/15 text-blue-400 border-blue-400/20',
  'client-pro': 'bg-teal-500/15 text-teal-400 border-teal-400/20',
  'client-enterprise': 'bg-purple-500/15 text-purple-400 border-purple-400/20',
  'guard_starter': 'bg-amber-500/15 text-amber-400 border-amber-400/20',
  'guard-basic': 'bg-sky-500/15 text-sky-400 border-sky-400/20',
  'guard-pro': 'bg-emerald-500/15 text-emerald-400 border-emerald-400/20',
  'guard-elite': 'bg-rose-500/15 text-rose-400 border-rose-400/20',
  'professional': 'bg-teal-500/15 text-teal-400 border-teal-400/20',
  'basic': 'bg-blue-500/15 text-blue-400 border-blue-400/20',
  'free': 'bg-slate-500/15 text-slate-400 border-slate-400/20',
};

function getPlanColor(plan: string): string {
  return PLAN_COLORS[plan] || 'bg-slate-500/15 text-slate-400 border-slate-400/20';
}

function getPlanLabel(plan: string): string {
  return plan.replace(/_/g, ' ').replace(/-/g, ' ').toUpperCase();
}

function getStatusColor(status: string) {
  switch (status) {
    case 'succeeded': return 'bg-emerald-500/15 text-emerald-400';
    case 'pending': return 'bg-amber-500/15 text-amber-400';
    case 'failed': return 'bg-red-500/15 text-red-400';
    case 'refunded': return 'bg-purple-500/15 text-purple-400';
    default: return 'bg-slate-500/15 text-slate-400';
  }
}

export default function SubscriptionAnalyticsPage() {
  const [payments, setPayments] = useState<EnrichedPayment[]>([]);
  const [analytics, setAnalytics] = useState<PaymentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupWarning, setLookupWarning] = useState<string | null>(null);
  const [analyticsCapped, setAnalyticsCapped] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<EnrichedPayment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [dateRange, setDateRange] = useState('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const buildDateFilter = () => {
    if (dateRange === 'all') return null;
    const now = new Date();
    const startDate = new Date();
    switch (dateRange) {
      case '7days': startDate.setDate(now.getDate() - 7); break;
      case '30days': startDate.setDate(now.getDate() - 30); break;
      case '90days': startDate.setDate(now.getDate() - 90); break;
      case 'year': startDate.setFullYear(now.getFullYear() - 1); break;
    }
    return startDate.toISOString();
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLookupWarning(null);

    try {
      const dateFilter = buildDateFilter();

      const countQuery = supabase
        .from('subscription_payments')
        .select('*', { count: 'exact', head: true });

      if (dateFilter) {
        countQuery.gte('created_at', dateFilter);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw new Error('Failed to count payments: ' + countError.message);
      setTotalCount(count || 0);

      const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
      const safePage = Math.min(page, totalPages);
      if (safePage !== page) setPage(safePage);

      const from = (safePage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const tableQuery = supabase
        .from('subscription_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (dateFilter) {
        tableQuery.gte('created_at', dateFilter);
      }

      const { data: tableData, error: tableError } = await tableQuery;
      if (tableError) throw new Error('Failed to load payments: ' + tableError.message);

      const analyticsQuery = supabase
        .from('subscription_payments')
        .select('id, amount, status, refunded, refund_amount, created_at, subscription_id, user_id')
        .order('created_at', { ascending: false })
        .limit(ANALYTICS_LIMIT);

      if (dateFilter) {
        analyticsQuery.gte('created_at', dateFilter);
      }

      const { data: analyticsRaw, error: analyticsError } = await analyticsQuery;
      if (analyticsError) {
        console.error('Analytics fetch failed:', analyticsError);
      }

      const analyticsData = (analyticsRaw || []) as AnalyticsRow[];
      if (analyticsData.length >= ANALYTICS_LIMIT) {
        setAnalyticsCapped(true);
      } else {
        setAnalyticsCapped(false);
      }

      const paymentsPage = (tableData || []) as any[];
      const warnings: string[] = [];

      const subscriptionIds = [...new Set(
        [...paymentsPage.map((p: any) => p.subscription_id), ...analyticsData.map(a => a.subscription_id)]
          .filter(Boolean)
      )] as string[];

      const userIds = [...new Set(
        [...paymentsPage.map((p: any) => p.user_id), ...analyticsData.map(a => a.user_id)]
          .filter(Boolean)
      )] as string[];

      let subsMap: Record<string, SubInfo> = {};
      if (subscriptionIds.length > 0) {
        const { data: subsData, error: subsError } = await supabase
          .from('subscriptions')
          .select('id, plan_slug, plan_name, plan_amount, billing_cycle, status, stripe_subscription_id')
          .in('id', subscriptionIds);

        if (subsError) {
          warnings.push('Could not load subscription plan data');
          console.error('Subscriptions lookup failed:', subsError);
        }

        (subsData || []).forEach((s: any) => {
          subsMap[s.id] = {
            plan_slug: s.plan_slug || 'unknown',
            plan_name: s.plan_name || 'Unknown',
            plan_amount: s.plan_amount || 0,
            billing_cycle: s.billing_cycle || '',
            status: s.status || '',
            stripe_subscription_id: s.stripe_subscription_id || '',
          };
        });
      }

      let clientsMap: Record<string, ClientInfo> = {};
      if (userIds.length > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('user_id, company_name, email')
          .in('user_id', userIds);

        if (clientsError) {
          warnings.push('Could not load customer data');
          console.error('Clients lookup failed:', clientsError);
        }

        (clientsData || []).forEach((c: any) => {
          clientsMap[c.user_id] = {
            company_name: c.company_name || '',
            email: c.email || '',
          };
        });
      }

      if (warnings.length > 0) {
        setLookupWarning(warnings.join('. '));
      }

      const enriched: EnrichedPayment[] = paymentsPage.map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        subscription_id: p.subscription_id,
        stripe_payment_intent_id: p.stripe_payment_intent_id,
        stripe_invoice_id: p.stripe_invoice_id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        payment_method: p.payment_method,
        billing_reason: p.billing_reason,
        period_start: p.period_start,
        period_end: p.period_end,
        paid_at: p.paid_at,
        failed_at: p.failed_at,
        failure_reason: p.failure_reason,
        refunded: p.refunded,
        refund_amount: p.refund_amount,
        invoice_url: p.invoice_url,
        receipt_url: p.receipt_url,
        created_at: p.created_at,
        subscription: subsMap[p.subscription_id] || null,
        client: clientsMap[p.user_id] || null,
      }));

      setPayments(enriched);
      calculateAnalytics(analyticsData, subsMap);
    } catch (err: any) {
      console.error('Error fetching payments:', err);
      setError(err?.message || 'Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [dateRange, page]);

  useEffect(() => {
    setPage(1);
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel('subscription_payments_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'app',
          table: 'subscription_payments',
        },
        async (payload: RealtimePostgresInsertPayload<Record<string, any>>) => {
          const newPayment = payload.new;
          if (!newPayment) return;

          const dateFilter = buildDateFilter();
          if (dateFilter && newPayment.created_at && newPayment.created_at < dateFilter) return;

          try {
            let subInfo: SubInfo | null = null;
            if (newPayment.subscription_id) {
              const { data: subData } = await supabase
                .from('subscriptions')
                .select('id, plan_slug, plan_name, plan_amount, billing_cycle, status, stripe_subscription_id')
                .eq('id', newPayment.subscription_id)
                .maybeSingle();

              if (subData) {
                subInfo = {
                  plan_slug: subData.plan_slug || 'unknown',
                  plan_name: subData.plan_name || 'Unknown',
                  plan_amount: subData.plan_amount || 0,
                  billing_cycle: subData.billing_cycle || '',
                  status: subData.status || '',
                  stripe_subscription_id: subData.stripe_subscription_id || '',
                };
              }
            }

            let clientInfo: ClientInfo | null = null;
            if (newPayment.user_id) {
              const { data: clientData } = await supabase
                .from('clients')
                .select('user_id, company_name, email')
                .eq('user_id', newPayment.user_id)
                .maybeSingle();

              if (clientData) {
                clientInfo = {
                  company_name: clientData.company_name || '',
                  email: clientData.email || '',
                };
              }
            }

            const enriched: EnrichedPayment = {
              id: newPayment.id,
              user_id: newPayment.user_id,
              subscription_id: newPayment.subscription_id,
              stripe_payment_intent_id: newPayment.stripe_payment_intent_id,
              stripe_invoice_id: newPayment.stripe_invoice_id,
              amount: newPayment.amount,
              currency: newPayment.currency,
              status: newPayment.status,
              payment_method: newPayment.payment_method,
              billing_reason: newPayment.billing_reason,
              period_start: newPayment.period_start,
              period_end: newPayment.period_end,
              paid_at: newPayment.paid_at,
              failed_at: newPayment.failed_at,
              failure_reason: newPayment.failure_reason,
              refunded: newPayment.refunded,
              refund_amount: newPayment.refund_amount,
              invoice_url: newPayment.invoice_url,
              receipt_url: newPayment.receipt_url,
              created_at: newPayment.created_at,
              subscription: subInfo,
              client: clientInfo,
            };

            setPayments(prev => [enriched, ...prev].slice(0, PAGE_SIZE));
            setTotalCount(prev => prev + 1);
          } catch (realtimeErr) {
            console.error('Realtime enrichment failed:', realtimeErr);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsLive(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          setIsLive(false);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      setIsLive(false);
    };
  }, [dateRange]);

  const calculateAnalytics = (analyticsData: AnalyticsRow[], subsMap: Record<string, SubInfo>) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const totalRevenue = analyticsData
      .filter(p => p.status === 'succeeded' && !p.refunded)
      .reduce((sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0);

    const monthlyRevenue = analyticsData
      .filter(p => {
        const d = new Date(p.created_at);
        return p.status === 'succeeded' && !p.refunded &&
          d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0);

    const successfulPayments = analyticsData.filter(p => p.status === 'succeeded').length;
    const failedPayments = analyticsData.filter(p => p.status === 'failed').length;

    const refundedPayments = analyticsData.filter(p => p.refunded);
    const refundedAmount = refundedPayments.reduce((sum, p) => sum + parseFloat((p.refund_amount || 0).toString()), 0);

    const averagePaymentValue = successfulPayments > 0 ? totalRevenue / successfulPayments : 0;

    const revenueByPlan: { [key: string]: number } = {};
    analyticsData
      .filter(p => p.status === 'succeeded' && !p.refunded)
      .forEach(p => {
        const sub = subsMap[p.subscription_id];
        const plan = sub?.plan_slug || 'unknown';
        revenueByPlan[plan] = (revenueByPlan[plan] || 0) + parseFloat(p.amount?.toString() || '0');
      });

    const monthlyTrend: { [key: string]: { revenue: number; count: number } } = {};
    analyticsData
      .filter(p => p.status === 'succeeded' && !p.refunded)
      .forEach(p => {
        const d = new Date(p.created_at);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyTrend[monthKey]) monthlyTrend[monthKey] = { revenue: 0, count: 0 };
        monthlyTrend[monthKey].revenue += parseFloat(p.amount?.toString() || '0');
        monthlyTrend[monthKey].count += 1;
      });

    const monthlyTrendArray = Object.entries(monthlyTrend)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    setAnalytics({
      totalRevenue,
      monthlyRevenue,
      totalPayments: analyticsData.length,
      successfulPayments,
      failedPayments,
      refundedAmount,
      averagePaymentValue,
      revenueByPlan,
      monthlyTrend: monthlyTrendArray,
      refundedCount: refundedPayments.length,
    });
  };

  const filteredPayments = payments.filter(payment => {
    const matchesStatus = filterStatus === 'all' || payment.status === filterStatus;
    const planName = payment.subscription?.plan_name || '';
    const slug = payment.subscription?.plan_slug || '';
    const matchesSearch =
      payment.client?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.client?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.stripe_invoice_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      planName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slug.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const escapeCSV = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) return `"${val.replace(/"/g, '""')}"`;
    return val;
  };

  const exportCSV = () => {
    const headers = ['Customer', 'Email', 'Plan', 'Amount', 'Status', 'Invoice ID', 'Payment ID', 'Created Date', 'Failed Date', 'Refund Amount', 'Invoice URL', 'Receipt URL'];
    const rows = filteredPayments.map(p => [
      p.client?.company_name || '',
      p.client?.email || '',
      p.subscription?.plan_slug || 'unknown',
      parseFloat((p.amount || 0).toString()).toFixed(2),
      p.status,
      p.stripe_invoice_id || '',
      p.id,
      p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB') : '',
      p.failed_at ? new Date(p.failed_at).toLocaleDateString('en-GB') : '',
      p.refunded ? parseFloat((p.refund_amount || 0).toString()).toFixed(2) : '0.00',
      p.invoice_url || '',
      p.receipt_url || '',
    ]);
    const csv = [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscription-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">Subscription Payment Analytics</h1>
              {isLive && (
                <span className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-400/20 rounded-full text-xs font-medium text-emerald-400">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  Live
                </span>
              )}
            </div>
            <p className="text-slate-400">Monitor revenue, payments, and subscription performance</p>
          </div>
          <button
            onClick={exportCSV}
            disabled={filteredPayments.length === 0}
            className={`flex items-center gap-2 px-4 py-2.5 border border-[#1e2d4a] rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              filteredPayments.length === 0 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-download-2-line"></i>
            </div>
            Export CSV
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-400/20 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 flex-shrink-0">
                <i className="ri-error-warning-line text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-red-400">Failed to load analytics</p>
                <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-red-500/20 border border-red-400/20 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors whitespace-nowrap cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {lookupWarning && !error && (
          <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
              <i className="ri-alert-line text-lg"></i>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-400">Data may be incomplete</p>
              <p className="text-xs text-amber-400/70 mt-0.5">{lookupWarning}</p>
            </div>
          </div>
        )}

        {analyticsCapped && !error && (
          <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
              <i className="ri-information-line text-lg"></i>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-400">Analytics data capped at {ANALYTICS_LIMIT.toLocaleString()} records</p>
              <p className="text-xs text-blue-400/70 mt-0.5">Refine the date range for more precise analytics.</p>
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center text-slate-400">
              <i className="ri-calendar-line"></i>
            </div>
            <span className="text-sm font-medium text-slate-300">Date Range:</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'all', label: 'All Time' },
              { value: '7days', label: 'Last 7 Days' },
              { value: '30days', label: 'Last 30 Days' },
              { value: '90days', label: 'Last 90 Days' },
              { value: 'year', label: 'Last Year' }
            ].map(range => (
              <button
                key={range.value}
                onClick={() => setDateRange(range.value)}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors cursor-pointer ${
                  dateRange === range.value ? 'bg-teal-600 text-white' : 'bg-[#111d35] text-slate-400 hover:bg-[#162544] border border-[#1e2d4a]'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {analytics && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-white/15 rounded-lg">
                    <i className="ri-money-pound-circle-line text-xl"></i>
                  </div>
                  <span className="text-sm font-medium opacity-90">Total Revenue</span>
                </div>
                <div className="text-3xl font-bold">£{analytics.totalRevenue.toFixed(2)}</div>
                <p className="text-sm opacity-75 mt-2">{analytics.successfulPayments} successful payments</p>
              </div>

              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-white/15 rounded-lg">
                    <i className="ri-calendar-check-line text-xl"></i>
                  </div>
                  <span className="text-sm font-medium opacity-90">This Month</span>
                </div>
                <div className="text-3xl font-bold">£{analytics.monthlyRevenue.toFixed(2)}</div>
                <p className="text-sm opacity-75 mt-2">Current month revenue</p>
              </div>

              <div className="bg-gradient-to-br from-purple-600 to-pink-700 rounded-xl p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-white/15 rounded-lg">
                    <i className="ri-line-chart-line text-xl"></i>
                  </div>
                  <span className="text-sm font-medium opacity-90">Average Payment</span>
                </div>
                <div className="text-3xl font-bold">£{analytics.averagePaymentValue.toFixed(2)}</div>
                <p className="text-sm opacity-75 mt-2">Per transaction</p>
              </div>

              <div className="bg-gradient-to-br from-orange-600 to-red-700 rounded-xl p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-white/15 rounded-lg">
                    <i className="ri-error-warning-line text-xl"></i>
                  </div>
                  <span className="text-sm font-medium opacity-90">Failed Payments</span>
                </div>
                <div className="text-3xl font-bold">{analytics.failedPayments}</div>
                <p className="text-sm opacity-75 mt-2">
                  {analytics.totalPayments > 0
                    ? `${((analytics.failedPayments / analytics.totalPayments) * 100).toFixed(1)}% failure rate`
                    : 'No payments yet'
                  }
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4a] p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <i className="ri-pie-chart-line text-teal-400"></i>
                  Revenue by Plan
                </h3>
                <div className="space-y-4">
                  {Object.keys(analytics.revenueByPlan).length === 0 ? (
                    <p className="text-sm text-slate-500 py-4">No revenue data available</p>
                  ) : (
                    Object.entries(analytics.revenueByPlan).map(([plan, revenue]) => {
                      const percentage = analytics.totalRevenue > 0 ? (revenue / analytics.totalRevenue) * 100 : 0;
                      return (
                        <div key={plan}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPlanColor(plan)}`}>
                                {getPlanLabel(plan)}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-white">£{revenue.toFixed(2)}</p>
                              <p className="text-sm text-slate-500">{percentage.toFixed(1)}%</p>
                            </div>
                          </div>
                          <div className="w-full bg-[#0a1628] rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-teal-500 to-blue-500"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-[#111d35] rounded-xl border border-[#1e2d4a] p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <i className="ri-bar-chart-line text-teal-400"></i>
                  Monthly Trend
                </h3>
                <div className="space-y-3">
                  {analytics.monthlyTrend.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4">No trend data available</p>
                  ) : (
                    analytics.monthlyTrend.slice(-6).map((item) => {
                      const maxRevenue = Math.max(...analytics.monthlyTrend.map(m => m.revenue), 1);
                      const percentage = (item.revenue / maxRevenue) * 100;
                      const date = new Date(item.month + '-01');
                      const monthName = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
                      return (
                        <div key={item.month}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-300">{monthName}</span>
                            <div className="text-right">
                              <p className="font-bold text-white">£{item.revenue.toFixed(2)}</p>
                              <p className="text-xs text-slate-500">{item.count} payments</p>
                            </div>
                          </div>
                          <div className="w-full bg-[#0a1628] rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-teal-500"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4a]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-emerald-500/15 rounded-lg">
                    <i className="ri-checkbox-circle-line text-xl text-emerald-400"></i>
                  </div>
                  <span className="text-sm font-medium text-slate-400">Success Rate</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {analytics.totalPayments > 0
                    ? `${((analytics.successfulPayments / analytics.totalPayments) * 100).toFixed(1)}%`
                    : '0%'
                  }
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {analytics.successfulPayments} of {analytics.totalPayments} payments
                </p>
              </div>

              <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4a]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-purple-500/15 rounded-lg">
                    <i className="ri-refund-line text-xl text-purple-400"></i>
                  </div>
                  <span className="text-sm font-medium text-slate-400">Total Refunded</span>
                </div>
                <div className="text-2xl font-bold text-white">£{analytics.refundedAmount.toFixed(2)}</div>
                <p className="text-sm text-slate-500 mt-1">
                  {analytics.refundedCount} refunds issued
                </p>
              </div>

              <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4a]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-blue-500/15 rounded-lg">
                    <i className="ri-file-list-line text-xl text-blue-400"></i>
                  </div>
                  <span className="text-sm font-medium text-slate-400">Total Payments</span>
                </div>
                <div className="text-2xl font-bold text-white">{analytics.totalPayments}</div>
                <p className="text-sm text-slate-500 mt-1">All time transactions</p>
              </div>
            </div>
          </>
        )}

        <div className="bg-[#111d35] rounded-xl border border-[#1e2d4a] p-6 mb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-500">
                  <i className="ri-search-line text-lg"></i>
                </div>
                <input
                  type="text"
                  placeholder="Search by company, email, plan, invoice ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-[#0a1628] border border-[#1e2d4a] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-white placeholder-slate-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors cursor-pointer ${
                  filterStatus === 'all' ? 'bg-teal-600 text-white' : 'bg-[#0a1628] text-slate-400 hover:bg-[#162544]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('succeeded')}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors cursor-pointer ${
                  filterStatus === 'succeeded' ? 'bg-emerald-600 text-white' : 'bg-[#0a1628] text-slate-400 hover:bg-[#162544]'
                }`}
              >
                Succeeded
              </button>
              <button
                onClick={() => setFilterStatus('failed')}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors cursor-pointer ${
                  filterStatus === 'failed' ? 'bg-red-600 text-white' : 'bg-[#0a1628] text-slate-400 hover:bg-[#162544]'
                }`}
              >
                Failed
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">
            Page <span className="font-semibold text-slate-300">{page}</span> of{' '}
            <span className="font-semibold text-slate-300">{totalPages}</span>
            {' '}· Showing <span className="font-semibold text-slate-300">{filteredPayments.length}</span> on this page
            {' '}· Total: <span className="font-semibold text-slate-300">{totalCount}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`px-3 py-2 border border-[#1e2d4a] rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-1 ${
                page <= 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-left-s-line"></i>
              </div>
              Prev
            </button>
            <span className="px-3 py-2 text-sm text-slate-400">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`px-3 py-2 border border-[#1e2d4a] rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-1 ${
                page >= totalPages ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              Next
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-right-s-line"></i>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-[#111d35] rounded-xl border border-[#1e2d4a] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0d1b33] border-b border-[#1e2d4a]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Customer</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Plan</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Invoice</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d4a]">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-[#162544]">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{payment.client?.company_name || 'Unknown'}</div>
                      <div className="text-sm text-slate-400">{payment.client?.email || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPlanColor(payment.subscription?.plan_slug || 'unknown')}`}>
                        {getPlanLabel(payment.subscription?.plan_slug || 'unknown')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">£{parseFloat((payment.amount || 0).toString()).toFixed(2)}</div>
                      <div className="text-sm text-slate-500">{payment.currency?.toUpperCase() || 'GBP'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                        {payment.status?.toUpperCase()}
                      </span>
                      {payment.refunded && (
                        <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400">
                          REFUNDED
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-300">
                        {new Date(payment.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="text-sm text-slate-500">
                        {new Date(payment.created_at).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {payment.invoice_url ? (
                        <a
                          href={payment.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-400 hover:text-teal-300 text-sm font-medium whitespace-nowrap flex items-center gap-1"
                        >
                          <i className="ri-file-text-line"></i>
                          View Invoice
                        </a>
                      ) : (
                        <span className="text-slate-500 text-sm">No invoice</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          setSelectedPayment(payment);
                          setShowDetailModal(true);
                        }}
                        className="text-teal-400 hover:text-teal-300 font-medium text-sm whitespace-nowrap cursor-pointer"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPayments.length === 0 && !error && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 flex items-center justify-center bg-[#0a1628] rounded-full mx-auto mb-4">
                <i className="ri-file-list-line text-3xl text-slate-500"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No payments found</h3>
              <p className="text-slate-400">Try adjusting your filters or search terms</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end mt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`px-3 py-2 border border-[#1e2d4a] rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-1 ${
                page <= 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-left-s-line"></i>
              </div>
              Prev
            </button>
            <span className="px-3 py-2 text-sm text-slate-400">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`px-3 py-2 border border-[#1e2d4a] rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-1 ${
                page >= totalPages ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              Next
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-right-s-line"></i>
              </div>
            </button>
          </div>
        </div>
      </div>

      {showDetailModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-[#111d35] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-[#1e2d4a]">
            <div className="sticky top-0 bg-[#0d1b33] border-b border-[#1e2d4a] px-8 py-6 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="text-2xl font-bold text-white">Payment Details</h2>
                <p className="text-sm text-slate-400 mt-1 font-mono">ID: {selectedPayment.id.slice(0, 16)}...</p>
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
                    <p className="text-sm text-slate-400 mb-1">Payment Amount</p>
                    <p className="text-4xl font-bold text-white">£{parseFloat((selectedPayment.amount || 0).toString()).toFixed(2)}</p>
                  </div>
                  <div className="w-16 h-16 flex items-center justify-center bg-[#111d35] rounded-full">
                    <i className={`ri-money-pound-circle-line text-3xl ${
                      selectedPayment.status === 'succeeded' ? 'text-emerald-400' :
                      selectedPayment.status === 'failed' ? 'text-red-400' : 'text-blue-400'
                    }`}></i>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedPayment.status)}`}>
                    {selectedPayment.status?.toUpperCase()}
                  </span>
                  {selectedPayment.refunded && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400">
                      REFUNDED: £{parseFloat((selectedPayment.refund_amount || 0).toString()).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <i className="ri-building-line text-teal-400"></i>
                  Customer Information
                </h3>
                <div className="bg-[#0a1628] rounded-lg p-6 space-y-3 border border-[#1e2d4a]">
                  <div>
                    <p className="text-sm text-slate-400">Company Name</p>
                    <p className="font-semibold text-white">{selectedPayment.client?.company_name || 'N/A'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#1e2d4a]">
                    <div>
                      <p className="text-sm text-slate-400">Email</p>
                      <p className="font-medium text-slate-300">{selectedPayment.client?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Subscription Plan</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPlanColor(selectedPayment.subscription?.plan_slug || 'unknown')}`}>
                        {getPlanLabel(selectedPayment.subscription?.plan_slug || 'unknown')}
                      </span>
                    </div>
                  </div>
                  {selectedPayment.subscription && (
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#1e2d4a]">
                      <div>
                        <p className="text-sm text-slate-400">Billing Cycle</p>
                        <p className="font-medium text-slate-300 capitalize">{selectedPayment.subscription.billing_cycle || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Plan Amount</p>
                        <p className="font-medium text-slate-300">£{parseFloat((selectedPayment.subscription.plan_amount || 0).toString()).toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <i className="ri-information-line text-teal-400"></i>
                  Payment Information
                </h3>
                <div className="bg-[#0a1628] rounded-lg p-6 space-y-3 border border-[#1e2d4a]">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-400">Payment Method</p>
                      <p className="font-medium text-slate-300">{selectedPayment.payment_method || 'Card'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Billing Reason</p>
                      <p className="font-medium text-slate-300">{selectedPayment.billing_reason || 'subscription_create'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#1e2d4a]">
                    <div>
                      <p className="text-sm text-slate-400">Period Start</p>
                      <p className="font-medium text-slate-300">
                        {selectedPayment.period_start
                          ? new Date(selectedPayment.period_start).toLocaleDateString('en-GB')
                          : 'N/A'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Period End</p>
                      <p className="font-medium text-slate-300">
                        {selectedPayment.period_end
                          ? new Date(selectedPayment.period_end).toLocaleDateString('en-GB')
                          : 'N/A'
                        }
                      </p>
                    </div>
                  </div>
                  {selectedPayment.subscription?.stripe_subscription_id && (
                    <div className="pt-3 border-t border-[#1e2d4a]">
                      <p className="text-sm text-slate-400">Stripe Subscription ID</p>
                      <p className="font-mono text-sm text-slate-300 break-all">{selectedPayment.subscription.stripe_subscription_id}</p>
                    </div>
                  )}
                  {selectedPayment.stripe_invoice_id && (
                    <div className="pt-3 border-t border-[#1e2d4a]">
                      <p className="text-sm text-slate-400">Stripe Invoice ID</p>
                      <p className="font-mono text-sm text-slate-300 break-all">{selectedPayment.stripe_invoice_id}</p>
                    </div>
                  )}
                  {selectedPayment.failure_reason && (
                    <div className="pt-3 border-t border-[#1e2d4a]">
                      <p className="text-sm text-slate-400">Failure Reason</p>
                      <p className="font-medium text-red-400">{selectedPayment.failure_reason}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                {selectedPayment.invoice_url && (
                  <a
                    href={selectedPayment.invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-teal-600 text-white py-3 rounded-lg font-semibold hover:bg-teal-500 transition-colors whitespace-nowrap text-center"
                  >
                    View Invoice
                  </a>
                )}
                {selectedPayment.receipt_url && (
                  <a
                    href={selectedPayment.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-500 transition-colors whitespace-nowrap text-center"
                  >
                    View Receipt
                  </a>
                )}
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 bg-[#0a1628] text-slate-300 py-3 rounded-lg font-semibold hover:bg-[#162544] transition-colors whitespace-nowrap cursor-pointer border border-[#1e2d4a]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}