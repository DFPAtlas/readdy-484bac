'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
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
import ConnectPayoutsPanel from './ConnectPayoutsPanel';

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

function estimateStripeFee(amount: number): number {
  return Math.max(amount * 0.015 + 0.20, 0.20);
}

interface Payment {
  id: string;
  date: string;
  customer: string;
  email: string;
  plan: string;
  amount: number;
  stripe_fee: number;
  net_amount: number;
  status: string;
  invoice_id: string;
  refunded: boolean;
}

interface Cost {
  id: string;
  service_name: string;
  category: string;
  monthly_cost: number;
  supplier: string;
  billing_date: string;
  notes: string;
}

interface Subscription {
  id: string;
  status: string;
  plan_amount: number;
  stripe_price_id: string | null;
  billing_interval: string | null;
  created_at: string;
  cancelled_at: string | null;
  trial_end_date: string | null;
  current_period_end: string | null;
  next_payment_date: string | null;
}

interface Plan {
  slug: string;
  name: string;
  monthly_price_pence: number;
  stripe_price_id: string;
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

interface Snapshot {
  id: string;
  snapshot_month: string;
  gross_revenue: number;
  net_revenue: number;
  stripe_fees: number;
  running_costs: number;
  vat_estimate: number;
  estimated_profit: number;
  refunds: number;
  failed_payments: number;
  active_subscriptions: number;
  new_guards: number;
  new_clients: number;
  cancelled_accounts: number;
  trial_accounts: number;
  mrr: number;
  arr: number;
  arpu: number;
  churn_rate: number;
  failed_payment_rate: number;
  created_at: string;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  action?: string;
  actionHref?: string;
}

export default function PlatformFinancesClient() {
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<Cost | null>(null);
  const [isSavingCost, setIsSavingCost] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [guardsCount, setGuardsCount] = useState({ thisMonth: 0, lastMonth: 0 });
  const [clientsCount, setClientsCount] = useState({ thisMonth: 0, lastMonth: 0 });
  const [trialCount, setTrialCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

      const { data: subPayments } = await supabase
        .from('subscription_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      const { count: activeSubCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { data: allSubs } = await supabase
        .from('subscriptions')
        .select('id, status, plan_amount, stripe_price_id, billing_interval, created_at, cancelled_at, trial_end_date, current_period_end, next_payment_date')
        .order('created_at', { ascending: false })
        .limit(500);

      const { data: plansData } = await supabase
        .from('plans')
        .select('slug, name, monthly_price_pence, stripe_price_id');

      const { data: platformCosts } = await supabase
        .from('platform_costs')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: snapshotData } = await supabase
        .from('finance_snapshots')
        .select('*')
        .order('snapshot_month', { ascending: false })
        .limit(24);

      const { count: guardsThisMonth } = await supabase
        .from('guards')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthStart);

      const { count: guardsLastMonth } = await supabase
        .from('guards')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', lastMonthStart)
        .lte('created_at', lastMonthEnd);

      const { count: clientsThisMonth } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthStart);

      const { count: clientsLastMonth } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', lastMonthStart)
        .lte('created_at', lastMonthEnd);

      const { count: trialCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'trialing');

      const { count: cancelledCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelled')
        .gte('cancelled_at', yearStart);

      const subIds = (subPayments || []).map((p: any) => p.subscription_id).filter(Boolean);
      let subMap: Record<string, any> = {};
      let clientMap: Record<string, any> = {};

      if (subIds.length > 0) {
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('id, client_id, plan_name')
          .in('id', subIds);
        (subs || []).forEach((s: any) => {
          subMap[s.id] = s;
        });
        const clientIds = (subs || []).map((s: any) => s.client_id).filter(Boolean);
        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from('clients')
            .select('id, company_name, email, contact_name')
            .in('id', clientIds);
          (clients || []).forEach((c: any) => {
            clientMap[c.id] = c;
          });
        }
      }

      const userIds = (subPayments || []).map((p: any) => p.user_id).filter(Boolean);
      if (userIds.length > 0) {
        const { data: clientsByUser } = await supabase
          .from('clients')
          .select('id, user_id, company_name, email, contact_name')
          .in('user_id', userIds);
        (clientsByUser || []).forEach((c: any) => {
          clientMap[c.user_id] = c;
        });
      }

      const transClientIds = (transactions || []).map((t: any) => t.client_id).filter(Boolean);
      if (transClientIds.length > 0) {
        const { data: transClients } = await supabase
          .from('clients')
          .select('id, company_name, email, contact_name')
          .in('id', transClientIds);
        (transClients || []).forEach((c: any) => {
          clientMap[c.id] = c;
        });
      }

      const subRows: Payment[] = (subPayments || []).map((p: any) => {
        const sub = subMap[p.subscription_id];
        const client = sub?.client_id ? clientMap[sub.client_id] : clientMap[p.user_id];
        const fee = estimateStripeFee(Number(p.amount));
        return {
          id: p.id,
          date: p.created_at,
          customer: client?.company_name || client?.contact_name || 'Unknown',
          email: client?.email || '-',
          plan: sub?.plan_name || 'Subscription',
          amount: Number(p.amount),
          stripe_fee: fee,
          net_amount: Number(p.amount) - fee,
          status: p.status,
          invoice_id: p.stripe_invoice_id || '',
          refunded: p.refunded || false,
        };
      });

      const transRows: Payment[] = (transactions || []).map((t: any) => {
        const client = t.client_id ? clientMap[t.client_id] : null;
        const fee = estimateStripeFee(Number(t.amount));
        return {
          id: t.id,
          date: t.created_at,
          customer: client?.company_name || client?.contact_name || 'Unknown',
          email: client?.email || '-',
          plan: t.transaction_type || 'Job Payment',
          amount: Number(t.amount),
          stripe_fee: fee,
          net_amount: Number(t.amount) - fee,
          status: t.status,
          invoice_id: t.stripe_invoice_id || '',
          refunded: t.refunded || false,
        };
      });

      const all = [...subRows, ...transRows].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setAllPayments(all);
      setCosts(platformCosts || []);
      setActiveSubscriptions(activeSubCount ?? 0);
      setAllSubscriptions((allSubs || []).map((s: any) => ({
        id: s.id,
        status: s.status,
        plan_amount: Number(s.plan_amount) || 0,
        stripe_price_id: s.stripe_price_id || null,
        billing_interval: s.billing_interval || 'month',
        created_at: s.created_at,
        cancelled_at: s.cancelled_at,
        trial_end_date: s.trial_end_date,
        current_period_end: s.current_period_end,
        next_payment_date: s.next_payment_date,
      })));
      setPlans((plansData || []).map((p: any) => ({
        slug: p.slug,
        name: p.name,
        monthly_price_pence: Number(p.monthly_price_pence) || 0,
        stripe_price_id: p.stripe_price_id || '',
      })));
      setSnapshots(snapshotData || []);
      setGuardsCount({ thisMonth: guardsThisMonth ?? 0, lastMonth: guardsLastMonth ?? 0 });
      setClientsCount({ thisMonth: clientsThisMonth ?? 0, lastMonth: clientsLastMonth ?? 0 });
      setTrialCount(trialCount ?? 0);
      setCancelledCount(cancelledCount ?? 0);
    } catch (err) {
      console.error('Error fetching finance data:', err);
      setToast({ message: 'Failed to load finance data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
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

  const monthlyRevenue = payments
    .filter((p) => p.status === 'succeeded' || p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);
  const monthlyCosts = costs.reduce((sum, c) => sum + Number(c.monthly_cost), 0);
  const stripeFees = payments
    .filter((p) => p.status === 'succeeded' || p.status === 'completed')
    .reduce((sum, p) => sum + p.stripe_fee, 0);
  const refunds = payments
    .filter((p) => p.refunded)
    .reduce((sum, p) => sum + p.amount, 0);
  const failedPayments = payments
    .filter((p) => p.status === 'failed')
    .reduce((sum, p) => sum + p.amount, 0);
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
      (s) => s.created_at && new Date(s.created_at) <= monthAgo && (s.status === 'active' || (s.cancelled_at && new Date(s.cancelled_at) > monthAgo))
    ).length;
    const churnRate = activeMonthAgo > 0 ? cancelledLast30 / activeMonthAgo : 0;
    const totalPayments = allPayments.length;
    const failedPaymentCount = allPayments.filter((p) => p.status === 'failed').length;
    const failedPaymentRate = totalPayments > 0 ? failedPaymentCount / totalPayments : 0;
    const prevMonthRevenue = allPayments
      .filter((p) => {
        const d = new Date(p.date);
        return d >= new Date(now.getFullYear(), now.getMonth() - 1, 1) && d <= new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      })
      .filter((p) => p.status === 'succeeded' || p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    const mrrGrowth = prevMonthRevenue > 0 ? (monthlyRevenue - prevMonthRevenue) / prevMonthRevenue : 0;

    const trialSubs = allSubscriptions.filter((s) => s.status === 'trialing');
    const trialCount = trialSubs.length;
    const trialPipelineMrr = trialSubs.reduce((sum, s) => {
      if (!s.stripe_price_id) return sum;
      const plan = plans.find((p) => p.stripe_price_id === s.stripe_price_id);
      if (!plan) return sum;
      const monthlyPence = plan.monthly_price_pence;
      const interval = s.billing_interval || 'month';
      if (interval === 'year') return sum + (monthlyPence / 12 / 100);
      if (interval === 'week') return sum + (monthlyPence * 4.33 / 100);
      if (interval === 'day') return sum + (monthlyPence * 30 / 100);
      return sum + (monthlyPence / 100);
    }, 0);

    return { mrr, arr, clv: 0, arpu, churnRate, failedPaymentRate, mrrGrowth, activeSubscriptions: activeCount, trialCount, trialPipelineMrr };
  }, [allSubscriptions, allPayments, monthlyRevenue, plans]);

  const customerAnalyticsData = useMemo(() => {
    return {
      newGuards: guardsCount.thisMonth,
      newClients: clientsCount.thisMonth,
      cancelledAccounts: cancelledCount,
      trialAccounts: trialCount,
      activeAccounts: activeSubscriptions,
      guardGrowth: guardsCount.thisMonth - guardsCount.lastMonth,
      clientGrowth: clientsCount.thisMonth - clientsCount.lastMonth,
    };
  }, [guardsCount, clientsCount, cancelledCount, trialCount, activeSubscriptions]);

  const healthMetrics = useMemo(() => {
    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const prevRevenue = allPayments
      .filter((p) => {
        const d = new Date(p.date);
        return d >= prevMonthStart && d <= prevMonthEnd && (p.status === 'succeeded' || p.status === 'completed');
      })
      .reduce((sum, p) => sum + p.amount, 0);
    const revenueGrowth = prevRevenue > 0 ? (monthlyRevenue - prevRevenue) / prevRevenue : 0;
    const prevNewUsers = (guardsCount.lastMonth || 0) + (clientsCount.lastMonth || 0);
    const currentNewUsers = (guardsCount.thisMonth || 0) + (clientsCount.thisMonth || 0);
    const customerGrowth = prevNewUsers > 0 ? (currentNewUsers - prevNewUsers) / prevNewUsers : 0;
    const totalPayments = allPayments.length;
    const successfulPayments = allPayments.filter((p) => p.status === 'succeeded' || p.status === 'completed').length;
    const paymentSuccessRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0;
    const activeSubs = allSubscriptions.filter((s) => s.status === 'active').length;
    const totalSubs = allSubscriptions.length;
    const subscriptionRetention = totalSubs > 0 ? (activeSubs / totalSubs) * 100 : 0;
    return { revenueGrowth, customerGrowth, paymentSuccessRate, subscriptionRetention };
  }, [allPayments, monthlyRevenue, guardsCount, clientsCount, allSubscriptions]);

  const alerts = useMemo(() => {
    const list: AlertItem[] = [];
    const totalSucceeded = allPayments.filter((p) => p.status === 'succeeded' || p.status === 'completed').length;
    const failedCount = allPayments.filter((p) => p.status === 'failed').length;
    const totalFees = allPayments
      .filter((p) => p.status === 'succeeded' || p.status === 'completed')
      .reduce((sum, p) => sum + p.stripe_fee, 0);
    const totalRevenue = allPayments
      .filter((p) => p.status === 'succeeded' || p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

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
        return d >= prevMonthStart && d <= prevMonthEnd && (p.status === 'succeeded' || p.status === 'completed');
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
      if (months[key]) {
        if (p.status === 'succeeded' || p.status === 'completed') {
          months[key].revenue += p.amount;
          months[key].stripe_fees += p.stripe_fee;
        }
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

  const handleEditCost = (cost: Cost) => {
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
    setCosts(costs.filter((c) => c.id !== id));
    setToast({ message: 'Cost deleted', type: 'success' });
  };

  const handleSaveCost = async (form: Cost) => {
    setIsSavingCost(true);
    try {
      if (editingCost) {
        const { data, error } = await supabase
          .from('platform_costs')
          .update(form)
          .eq('id', editingCost.id)
          .select()
          .single();
        if (error) throw error;
        setCosts(costs.map((c) => (c.id === editingCost.id ? data : c)));
        setToast({ message: 'Cost updated', type: 'success' });
      } else {
        const { data, error } = await supabase.from('platform_costs').insert(form).select().single();
        if (error) throw error;
        setCosts([data, ...costs]);
        setToast({ message: 'Cost added', type: 'success' });
      }
      setCostModalOpen(false);
    } catch (err) {
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
                <p className="text-xs text-slate-400">Monitor revenue, costs, and tax estimates</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AdvancedExport payments={payments} costs={costs} monthlyData={monthlyChartData} dateRange={dateFilter} />
              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-4 py-2 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-refresh-line"></i>
                </div>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-8 print:space-y-6">
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

        <FinanceOverviewCards
          monthlyRevenue={monthlyRevenue}
          monthlyCosts={monthlyCosts}
          profitLoss={profitLoss}
          stripeFees={stripeFees}
          estimatedVat={vatEstimate}
          refunds={refunds}
          failedPayments={failedPayments}
          activeSubscriptions={activeSubscriptions}
          loading={loading}
        />

        <ConnectPayoutsPanel />

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <StripePaymentsTable payments={payments} loading={loading} />
          </div>
          <div>
            <TaxEstimatePanel
              grossRevenue={monthlyRevenue}
              netRevenue={monthlyRevenue - stripeFees}
              vatEstimate={vatEstimate}
              runningCosts={monthlyCosts}
              estimatedProfit={estimatedProfit}
            />
          </div>
        </div>

        <RunningCostsTable
          costs={costs}
          loading={loading}
          onAdd={handleAddCost}
          onEdit={handleEditCost}
          onDelete={handleDeleteCost}
        />

        <div className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Historical Data</h2>
          <MonthlySnapshots snapshots={snapshots} loading={loading} onRefresh={fetchData} />
        </div>

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
              className={`${
                toast.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'
              } text-lg`}
            ></i>
          </div>
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}