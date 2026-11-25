'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { allAdminRows } from '@/lib/adminData';
import { isCollected, paymentAmounts } from '@/lib/financeAmounts';
import { supabase } from '@/lib/supabase';
import {
  buildFinanceSnapshot,
  createUnavailableFinanceSnapshot,
  FINANCE_BASE_QUERY_KEYS as BASE_QUERY_KEYS,
  financeRows,
  settleFinanceResults,
  uniqueRowIds,
  type FinanceCost,
  type FinanceData,
  type FinanceFailure,
  type FinancePayment,
} from '@/lib/admin-finance-stats';
import { createLatestRequestTracker, createTimeoutScope } from '@/lib/admin-dashboard-stats';
import FinanceUnavailable from './FinanceUnavailable';
import FinanceOverviewCards from './FinanceOverviewCards';
import StripePaymentsTable from './StripePaymentsTable';
import RunningCostsTable from './RunningCostsTable';
import CostFormModal from './CostFormModal';
import TaxEstimatePanel from './TaxEstimatePanel';
import AdvancedExport from './AdvancedExport';
import DateFilterBar from './DateFilterBar';
import FinanceCharts from './FinanceCharts';
import KPIDashboard from './KPIDashboard';
import CustomerAnalytics from './CustomerAnalytics';
import FinancialHealthScore from './FinancialHealthScore';
import AlertsPanel from './AlertsPanel';
import MonthlySnapshots from './MonthlySnapshots';
import FinancialOperationsPanel from './FinancialOperationsPanel';
import ConnectPayoutsPanel from './ConnectPayoutsPanel';

const FINANCE_TIMEOUT_MS = 15000;

const ENRICHMENT_QUERY_KEYS = ['paymentClientsByUser', 'transactionClients'] as const;

const OWNER_CLIENT_QUERY_KEYS = ['paymentClients'] as const;

const EMPTY_FINANCE_DATA: FinanceData = {
  payments: [],
  costs: [],
  activeSubscriptionCount: 0,
  subscriptions: [],
  plans: [],
  snapshots: [],
  guardsThisMonth: 0,
  guardsLastMonth: 0,
  clientsThisMonth: 0,
  clientsLastMonth: 0,
  trialCount: 0,
  cancelledCount: 0,
};

const EMPTY_RESULT = { data: [] as unknown[], error: null };

function getDateRange(filter: string, customStart?: string, customEnd?: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();
  let start = '';
  switch (filter) {
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      break;
    case 'last_month': {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start = d.toISOString();
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { start, end: e.toISOString() };
    }
    case 'last_3_months':
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
      break;
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1).toISOString();
      break;
    case 'custom':
      return {
        start: customStart ? new Date(customStart).toISOString() : '',
        end: customEnd ? new Date(customEnd + 'T23:59:59').toISOString() : '',
      };
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  return { start, end };
}

interface MonthlyData {
  month: string;
  revenue: number;
  costs: number;
  profit: number;
  stripe_fees: number;
  vat: number;
  subscriptions: number;
  trials: number;
  paid: number;
  new_guards: number;
  new_clients: number;
  cancelled: number;
  conversionRate: number;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  action?: string;
  actionHref?: string;
}

function messageOf(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err.trim();
  return 'Finance data request failed';
}

export default function PlatformFinancesClient() {
  const [section, setSection] = useState('payments');
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<FinanceData>(EMPTY_FINANCE_DATA);
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [failures, setFailures] = useState<FinanceFailure[] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<FinanceCost | null>(null);
  const [isSavingCost, setIsSavingCost] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const mountedRef = useRef(true);
  const trackerRef = useRef(createLatestRequestTracker());
  const timeoutScopeRef = useRef(createTimeoutScope());
  const fetchDataRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const {
    payments: allPayments,
    costs,
    activeSubscriptionCount,
    subscriptions: allSubscriptions,
    plans,
    snapshots,
    guardsThisMonth,
    guardsLastMonth,
    clientsThisMonth,
    clientsLastMonth,
    trialCount,
    cancelledCount,
  } = data;

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchData = useCallback(async () => {
    const requestId = trackerRef.current.begin();
    setLoading(true);

    const isStale = () => !mountedRef.current || !trackerRef.current.isCurrent(requestId);

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

      const baseSettlements = await timeoutScopeRef.current.run(
        Promise.allSettled([
          allAdminRows(() =>
            supabase.from('subscription_payments').select('*').order('created_at', { ascending: false }).order('id')
          ),
          allAdminRows(() =>
            supabase.from('transactions').select('*').order('created_at', { ascending: false }).order('id')
          ),
          supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          allAdminRows(() =>
            supabase
              .from('subscriptions')
              .select(
                'id, client_id, plan_name, status, plan_amount, stripe_price_id, billing_interval, created_at, cancelled_at, trial_end_date, current_period_end, next_payment_date'
              )
              .order('created_at', { ascending: false })
              .order('id')
          ),
          supabase.from('plans').select('slug, name, monthly_price_pence, stripe_price_id'),
          allAdminRows(() =>
            supabase.from('platform_costs').select('*').order('created_at', { ascending: false }).order('id')
          ),
          supabase
            .schema('app')
            .from('finance_snapshots')
            .select('*')
            .order('snapshot_month', { ascending: false })
            .limit(24),
          supabase.from('guards').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
          supabase
            .from('guards')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', lastMonthStart)
            .lte('created_at', lastMonthEnd),
          supabase.from('clients').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
          supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', lastMonthStart)
            .lte('created_at', lastMonthEnd),
          supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'trialing'),
          supabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'cancelled')
            .gte('cancelled_at', yearStart),
        ]),
        FINANCE_TIMEOUT_MS,
        'Finance data request timed out'
      );

      if (isStale()) return;

      const base = settleFinanceResults(
        baseSettlements.map((settlement, index) => ({ key: BASE_QUERY_KEYS[index], settlement }))
      );

      if (base.failures.length > 0) {
        setFailures(base.failures);
        return;
      }

      const paymentRows = financeRows(base.values, 'subscriptionPayments');
      const transactionRows = financeRows(base.values, 'transactions');
      const subscriptionRows = financeRows(base.values, 'subscriptions');
      const payerUserIds = uniqueRowIds(paymentRows, ['user_id']);
      const transactionClientIds = uniqueRowIds(transactionRows, ['client_id']);

      const enrichmentSettlements = await timeoutScopeRef.current.run(
        Promise.allSettled([
          payerUserIds.length > 0
            ? supabase
                .from('clients')
                .select('id, user_id, company_name, email, contact_name')
                .in('user_id', payerUserIds)
            : Promise.resolve(EMPTY_RESULT),
          transactionClientIds.length > 0
            ? supabase
                .from('clients')
                .select('id, company_name, email, contact_name')
                .in('id', transactionClientIds)
            : Promise.resolve(EMPTY_RESULT),
        ]),
        FINANCE_TIMEOUT_MS,
        'Finance customer lookup timed out'
      );

      if (isStale()) return;

      const enrichment = settleFinanceResults(
        enrichmentSettlements.map((settlement, index) => ({ key: ENRICHMENT_QUERY_KEYS[index], settlement }))
      );

      if (enrichment.failures.length > 0) {
        setFailures(enrichment.failures);
        return;
      }

      const ownerClientIds = uniqueRowIds(subscriptionRows, ['client_id']);

      const ownerClientSettlements = await timeoutScopeRef.current.run(
        Promise.allSettled([
          ownerClientIds.length > 0
            ? supabase
                .from('clients')
                .select('id, company_name, email, contact_name')
                .in('id', ownerClientIds)
            : Promise.resolve(EMPTY_RESULT),
        ]),
        FINANCE_TIMEOUT_MS,
        'Finance customer lookup timed out'
      );

      if (isStale()) return;

      const ownerClients = settleFinanceResults(
        ownerClientSettlements.map((settlement, index) => ({ key: OWNER_CLIENT_QUERY_KEYS[index], settlement }))
      );

      if (ownerClients.failures.length > 0) {
        setFailures(ownerClients.failures);
        return;
      }

      const snapshot = buildFinanceSnapshot(base.values, {
        ...enrichment.values,
        ...ownerClients.values,
        paymentSubscriptions: { data: subscriptionRows, error: null },
      });

      if (isStale()) return;

      if (!snapshot.available) {
        setFailures(snapshot.failures);
        return;
      }

      setData(snapshot.data);
      setFailures(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (isStale()) return;
      setFailures(createUnavailableFinanceSnapshot(messageOf(err)).failures);
    } finally {
      if (trackerRef.current.isCurrent(requestId) && mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  fetchDataRef.current = fetchData;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      trackerRef.current.invalidate();
      timeoutScopeRef.current.clear();
    };
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const { start, end } = getDateRange(dateFilter, customStart, customEnd);
    if (!start || !end) {
      setPayments(allPayments);
      return;
    }
    const filtered = allPayments.filter((p) => {
      const d = new Date(p.date).getTime();
      return d >= new Date(start).getTime() && d <= new Date(end).getTime();
    });
    setPayments(filtered);
  }, [allPayments, dateFilter, customStart, customEnd]);

  const collected = payments.reduce((sum, p) => sum + paymentAmounts(p).collected, 0);
  const monthlyRevenue = payments
    .filter((p) => p.plan !== 'job_payment' && isCollected(p.status))
    .reduce((sum, p) => sum + p.remaining_amount, 0);
  const monthlyCosts = costs.reduce((sum, c) => sum + Number(c.monthly_cost), 0);
  const stripeFees = payments
    .filter((p) => p.plan !== 'job_payment' && isCollected(p.status))
    .reduce((sum, p) => sum + p.stripe_fee, 0);
  const refunds = payments.reduce((sum, p) => sum + p.refund_amount, 0);
  const remaining = collected - refunds;
  const failedPayments = payments.filter((p) => p.status === 'failed').reduce((sum, p) => sum + p.amount, 0);
  const profitLoss = monthlyRevenue - monthlyCosts - stripeFees;
  const vatEstimate = monthlyRevenue * 0.2;
  const estimatedProfit = monthlyRevenue - stripeFees - vatEstimate - monthlyCosts;

  const kpiData = useMemo(() => {
    const mrr = allSubscriptions
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => sum + s.plan_amount / 100, 0);
    const arr = mrr * 12;
    const activeCount = allSubscriptions.filter((s) => s.status === 'active').length;
    const arpu = activeCount > 0 ? mrr / activeCount : 0;
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const cancelledLast30 = allSubscriptions.filter(
      (s) => s.cancelled_at && new Date(s.cancelled_at) >= monthAgo
    ).length;
    const activeMonthAgo = allSubscriptions.filter(
      (s) =>
        s.created_at &&
        new Date(s.created_at) <= monthAgo &&
        (s.status === 'active' || (s.cancelled_at && new Date(s.cancelled_at) > monthAgo))
    ).length;
    const churnRate = activeMonthAgo > 0 ? cancelledLast30 / activeMonthAgo : 0;
    const totalPayments = allPayments.length;
    const failedPaymentCount = allPayments.filter((p) => p.status === 'failed').length;
    const failedPaymentRate = totalPayments > 0 ? failedPaymentCount / totalPayments : 0;
    const prevMonthRevenue = allPayments
      .filter((p) => {
        const d = new Date(p.date);
        return (
          d >= new Date(now.getFullYear(), now.getMonth() - 1, 1) &&
          d <= new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
        );
      })
      .filter((p) => isCollected(p.status))
      .reduce((sum, p) => sum + p.amount, 0);
    const mrrGrowth = prevMonthRevenue > 0 ? (monthlyRevenue - prevMonthRevenue) / prevMonthRevenue : 0;

    const trialSubs = allSubscriptions.filter((s) => s.status === 'trialing');
    const trialPipelineMrr = trialSubs.reduce((sum, s) => {
      if (!s.stripe_price_id) return sum;
      const plan = plans.find((p) => p.stripe_price_id === s.stripe_price_id);
      if (!plan) return sum;
      const monthlyPence = plan.monthly_price_pence;
      const interval = s.billing_interval || 'month';
      if (interval === 'year') return sum + monthlyPence / 12 / 100;
      if (interval === 'week') return sum + (monthlyPence * 4.33) / 100;
      if (interval === 'day') return sum + (monthlyPence * 30) / 100;
      return sum + monthlyPence / 100;
    }, 0);

    return {
      mrr,
      arr,
      clv: 0,
      arpu,
      churnRate,
      failedPaymentRate,
      mrrGrowth,
      activeSubscriptions: activeCount,
      trialCount: trialSubs.length,
      trialPipelineMrr,
    };
  }, [allSubscriptions, allPayments, monthlyRevenue, plans]);

  const customerAnalyticsData = useMemo(() => {
    return {
      newGuards: guardsThisMonth,
      newClients: clientsThisMonth,
      cancelledAccounts: cancelledCount,
      trialAccounts: trialCount,
      activeAccounts: activeSubscriptionCount,
      guardGrowth: guardsThisMonth - guardsLastMonth,
      clientGrowth: clientsThisMonth - clientsLastMonth,
    };
  }, [
    guardsThisMonth,
    guardsLastMonth,
    clientsThisMonth,
    clientsLastMonth,
    cancelledCount,
    trialCount,
    activeSubscriptionCount,
  ]);

  const healthMetrics = useMemo(() => {
    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const prevRevenue = allPayments
      .filter((p) => {
        const d = new Date(p.date);
        return d >= prevMonthStart && d <= prevMonthEnd && isCollected(p.status);
      })
      .reduce((sum, p) => sum + p.amount, 0);
    const revenueGrowth = prevRevenue > 0 ? (monthlyRevenue - prevRevenue) / prevRevenue : 0;
    const prevNewUsers = guardsLastMonth + clientsLastMonth;
    const currentNewUsers = guardsThisMonth + clientsThisMonth;
    const customerGrowth = prevNewUsers > 0 ? (currentNewUsers - prevNewUsers) / prevNewUsers : 0;
    const totalPayments = allPayments.length;
    const successfulPayments = allPayments.filter((p) => isCollected(p.status)).length;
    const paymentSuccessRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0;
    const activeSubs = allSubscriptions.filter((s) => s.status === 'active').length;
    const totalSubs = allSubscriptions.length;
    const subscriptionRetention = totalSubs > 0 ? (activeSubs / totalSubs) * 100 : 0;
    return {
      revenueGrowth,
      customerGrowth,
      paymentSuccessRate,
      subscriptionRetention,
      sufficientHistory: prevRevenue > 0 && prevNewUsers > 0 && totalSubs > 0 && totalPayments > 0,
    };
  }, [
    allPayments,
    monthlyRevenue,
    guardsThisMonth,
    guardsLastMonth,
    clientsThisMonth,
    clientsLastMonth,
    allSubscriptions,
  ]);

  const alerts = useMemo(() => {
    const list: AlertItem[] = [];
    const totalSucceeded = allPayments.filter((p) => isCollected(p.status)).length;
    const failedCount = allPayments.filter((p) => p.status === 'failed').length;
    const totalFees = allPayments.filter((p) => isCollected(p.status)).reduce((sum, p) => sum + p.stripe_fee, 0);
    const totalRevenue = allPayments.filter((p) => isCollected(p.status)).reduce((sum, p) => sum + p.amount, 0);

    if (totalRevenue > 0 && totalFees / totalRevenue > 0.03) {
      list.push({
        id: 'high-fees',
        type: 'warning',
        title: 'High Stripe Fees',
        message: `Stripe fees are ${((totalFees / totalRevenue) * 100).toFixed(1)}% of revenue. Consider reviewing pricing or payment mix.`,
        action: 'Review Payments',
        actionHref: '/admin/payments',
      });
    }
    if (failedCount > 5 && totalSucceeded > 0 && failedCount / totalSucceeded > 0.05) {
      list.push({
        id: 'failed-payments',
        type: 'danger',
        title: 'Failed Payments Spike',
        message: `${failedCount} failed payments recently. Check dunning and retry settings.`,
        action: 'Failed Payments',
        actionHref: '/admin/failed-payments',
      });
    }
    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const prevRevenue = allPayments
      .filter((p) => {
        const d = new Date(p.date);
        return d >= prevMonthStart && d <= prevMonthEnd && isCollected(p.status);
      })
      .reduce((sum, p) => sum + p.amount, 0);
    if (prevRevenue > 0 && monthlyRevenue < prevRevenue * 0.9) {
      list.push({
        id: 'declining-revenue',
        type: 'warning',
        title: 'Declining Revenue',
        message: `Revenue is down ${((1 - monthlyRevenue / prevRevenue) * 100).toFixed(1)}% vs last month.`,
        action: 'View Analytics',
        actionHref: '/admin/subscription-analytics',
      });
    }
    const expiringSoon = allSubscriptions.filter((s) => {
      if (!s.current_period_end) return false;
      const end = new Date(s.current_period_end);
      const days = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return days > 0 && days <= 14 && s.status === 'active';
    }).length;
    if (expiringSoon > 0) {
      list.push({
        id: 'expiring',
        type: 'info',
        title: 'Expiring Subscriptions',
        message: `${expiringSoon} subscription${expiringSoon > 1 ? 's' : ''} expires in the next 14 days.`,
        action: 'Manage',
        actionHref: '/admin/subscription-management',
      });
    }
    return list;
  }, [allPayments, monthlyRevenue, allSubscriptions]);

  const monthlyChartData = useMemo(() => {
    const months: Record<string, MonthlyData> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      months[key] = {
        month: key,
        revenue: 0,
        costs: 0,
        profit: 0,
        stripe_fees: 0,
        vat: 0,
        subscriptions: 0,
        trials: 0,
        paid: 0,
        new_guards: 0,
        new_clients: 0,
        cancelled: 0,
        conversionRate: 0,
      };
    }

    allPayments.forEach((p) => {
      const d = new Date(p.date);
      const key = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      if (months[key] && isCollected(p.status)) {
        if (p.plan !== 'job_payment') months[key].revenue += p.remaining_amount;
        months[key].stripe_fees += p.stripe_fee;
      }
    });

    costs.forEach((c) => {
      const d = new Date(c.billing_date);
      const key = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      if (months[key]) {
        months[key].costs += Number(c.monthly_cost);
      }
    });

    allSubscriptions.forEach((s) => {
      const d = new Date(s.created_at);
      const key = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      if (months[key]) {
        months[key].subscriptions += 1;
        if (s.status === 'trialing') {
          months[key].trials += 1;
        } else if (s.status === 'active') {
          months[key].paid += 1;
        }
      }
    });

    Object.keys(months).forEach((k) => {
      months[k].profit = months[k].revenue - months[k].costs - months[k].stripe_fees;
      months[k].vat = months[k].revenue * 0.2;
      const total = months[k].trials + months[k].paid;
      months[k].conversionRate = total > 0 ? Number(((months[k].paid / total) * 100).toFixed(1)) : 0;
    });

    return Object.values(months);
  }, [allPayments, costs, allSubscriptions]);

  const handleAddCost = () => {
    setEditingCost(null);
    setCostModalOpen(true);
  };

  const handleEditCost = (cost: FinanceCost) => {
    setEditingCost(cost);
    setCostModalOpen(true);
  };

  const handleDeleteCost = async (id: string) => {
    if (!confirm('Delete this cost entry?')) return;
    const { error } = await supabase.from('platform_costs').delete().eq('id', id);
    if (error) {
      setToast({ message: 'Failed to delete cost', type: 'error' });
      return;
    }
    setData((prev) => ({ ...prev, costs: prev.costs.filter((c) => c.id !== id) }));
    setToast({ message: 'Cost deleted', type: 'success' });
  };

  const handleSaveCost = async (form: Omit<FinanceCost, 'id'> & { id?: string }) => {
    setIsSavingCost(true);
    try {
      if (editingCost) {
        const { data: saved, error } = await supabase
          .from('platform_costs')
          .update(form)
          .eq('id', editingCost.id)
          .select()
          .single();
        if (error) throw error;
        setData((prev) => ({
          ...prev,
          costs: prev.costs.map((c) => (c.id === editingCost.id ? { ...c, ...saved } : c)),
        }));
        setToast({ message: 'Cost updated', type: 'success' });
      } else {
        const { data: saved, error } = await supabase.from('platform_costs').insert(form).select().single();
        if (error) throw error;
        setData((prev) => ({ ...prev, costs: [{ ...form, ...saved }, ...prev.costs] }));
        setToast({ message: 'Cost added', type: 'success' });
      }
      setCostModalOpen(false);
    } catch {
      setToast({ message: 'Failed to save cost', type: 'error' });
    } finally {
      setIsSavingCost(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1c] print:bg-white">
      <header className="sticky top-0 z-30 bg-[#0d1425]/80 backdrop-blur-md border-b border-[#1e2d4a] print:hidden">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500 text-white flex items-center justify-center shadow-sm shadow-teal-500/20">
                <i className="ri-bar-chart-grouped-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Platform Finances</h1>
                <p className="text-xs text-slate-400">
                  {failures
                    ? 'Finance figures unavailable'
                    : lastUpdated
                    ? `Payments, refunds and platform finances · updated ${lastUpdated.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : 'Payments, refunds and platform finances'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!failures && (
                <AdvancedExport
                  payments={payments}
                  costs={costs}
                  monthlyData={monthlyChartData}
                  dateRange={dateFilter}
                />
              )}
              <button
                onClick={() => {
                  void fetchDataRef.current();
                }}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
                </div>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-8 print:space-y-6">
        {failures ? (
          <FinanceUnavailable
            failures={failures}
            lastSuccessAt={lastUpdated}
            retrying={loading}
            onRetry={() => {
              void fetchDataRef.current();
            }}
          />
        ) : (
          <>
            <div className="print:hidden">
              <DateFilterBar
                active={dateFilter}
                onChange={setDateFilter}
                customStart={customStart}
                customEnd={customEnd}
                onCustomStartChange={setCustomStart}
                onCustomEndChange={setCustomEnd}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                ['Payments collected', collected],
                ['Refunded', refunds],
                ['Remaining before fees / payouts', remaining],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-[#1e2d4a] bg-[#111d35] p-6">
                  <p className="text-sm text-slate-300">{label}</p>
                  <p className="mt-2 text-3xl font-bold text-white">
                    {loading
                      ? '…'
                      : Number(value).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-300">
              For payments created in the selected period, including their refunds to date. Remaining funds include
              guard money and are not platform profit or the Stripe balance. Stripe fees below are estimates.
            </p>
            <nav aria-label="Finance sections" className="flex flex-wrap gap-3">
              {[
                ['payments', 'Payments & refunds'],
                ['analytics', 'Analytics & history'],
                ['costs', 'Costs & estimates'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSection(key)}
                  aria-pressed={section === key}
                  className={`rounded-xl px-5 py-3 text-sm font-semibold cursor-pointer whitespace-nowrap ${
                    section === key ? 'bg-teal-600 text-white' : 'bg-[#111d35] text-slate-300 border border-[#1e2d4a]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
            {section === 'payments' && (
              <div className="space-y-6">
                <StripePaymentsTable payments={payments} loading={loading} />
                <FinancialOperationsPanel />
                <ConnectPayoutsPanel key={`${dateFilter}:${loading}`} />
              </div>
            )}
            {section === 'analytics' && (
              <div className="space-y-8">
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Business KPIs</h2>
                  <KPIDashboard data={kpiData} loading={loading} />
                </div>

                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Customer Analytics</h2>
                  <CustomerAnalytics data={customerAnalyticsData} loading={loading} />
                </div>

                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Charts</h2>
                  <FinanceCharts monthlyData={monthlyChartData} loading={loading} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1">
                    <FinancialHealthScore metrics={healthMetrics} loading={loading} />
                  </div>
                  <div className="lg:col-span-2">
                    <AlertsPanel alerts={alerts} loading={loading} />
                  </div>
                </div>

                <MonthlySnapshots
                  snapshots={snapshots}
                  loading={loading}
                  onRefresh={() => {
                    void fetchDataRef.current();
                  }}
                />
              </div>
            )}
            {section === 'costs' && (
              <div className="space-y-6">
                <FinanceOverviewCards
                  monthlyRevenue={monthlyRevenue}
                  monthlyCosts={monthlyCosts}
                  profitLoss={profitLoss}
                  stripeFees={stripeFees}
                  estimatedVat={vatEstimate}
                  refunds={refunds}
                  failedPayments={failedPayments}
                  activeSubscriptions={activeSubscriptionCount}
                  loading={loading}
                />
                <TaxEstimatePanel
                  grossRevenue={monthlyRevenue}
                  netRevenue={monthlyRevenue - stripeFees}
                  vatEstimate={vatEstimate}
                  runningCosts={monthlyCosts}
                  estimatedProfit={estimatedProfit}
                />
                <RunningCostsTable
                  costs={costs}
                  loading={loading}
                  onAdd={handleAddCost}
                  onEdit={handleEditCost}
                  onDelete={handleDeleteCost}
                />
              </div>
            )}
          </>
        )}

        <CostFormModal
          open={costModalOpen}
          cost={editingCost}
          onClose={() => setCostModalOpen(false)}
          onSave={handleSaveCost}
          isSaving={isSavingCost}
        />
      </main>

      {toast && (
        <div
          className={`fixed top-6 right-6 px-5 py-3 rounded-xl shadow-lg z-50 flex items-center gap-3 animate-fade-in print:hidden ${
            toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <i
              className={`${toast.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'} text-lg`}
            ></i>
          </div>
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}