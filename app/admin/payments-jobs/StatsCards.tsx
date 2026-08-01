'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface StatsData {
  totalJobPayments: number;
  fundedJobs: number;
  unpaidJobs: number;
  pendingApproval: number;
  readyToRelease: number;
  releasedPayouts: number;
  disputedPayments: number;
  refundedPayments: number;
  platformFees: number;
  stripeFees: number;
  netRevenue: number;
  vatEstimate: number;
  totalGuardsAssigned: number;
  totalAgreedAmount: number;
}

interface StatsCardsProps {
  onRefresh?: () => void;
  lastUpdated?: Date | null;
}

export default function StatsCards({ onRefresh, lastUpdated }: StatsCardsProps) {
  const [stats, setStats] = useState<StatsData>({
    totalJobPayments: 0,
    fundedJobs: 0,
    unpaidJobs: 0,
    pendingApproval: 0,
    readyToRelease: 0,
    releasedPayouts: 0,
    disputedPayments: 0,
    refundedPayments: 0,
    platformFees: 0,
    stripeFees: 0,
    netRevenue: 0,
    vatEstimate: 0,
    totalGuardsAssigned: 0,
    totalAgreedAmount: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('agreed_amount, payment_status, platform_fee, guard_payout_amount, status, is_deleted')
        .eq('is_deleted', false);

      const { count: pendingApprovalCount } = await supabase
        .from('job_completion_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: disputedCount } = await supabase
        .from('disputes')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'under_review']);

      const { data: transData } = await supabase
        .from('transactions')
        .select('amount, status')
        .eq('status', 'completed');

      const { data: subPaymentsData } = await supabase
        .from('subscription_payments')
        .select('amount, status')
        .eq('status', 'succeeded');

      const { data: assignedData } = await supabase
        .from('job_assignments')
        .select('guard_id', { count: 'exact' });

      const jobs = jobsData || [];
      const totalAgreedAmount = jobs.reduce((s, j) => s + (Number(j.agreed_amount) || 0), 0);
      const fundedJobs = jobs.filter((j) => j.payment_status === 'funded').length;
      const unpaidJobs = jobs.filter((j) => !j.payment_status || j.payment_status === 'unpaid').length;
      const readyToRelease = jobs.filter((j) => j.payment_status === 'completed').length;
      const releasedPayouts = jobs.filter((j) => j.payment_status === 'released').length;
      const refundedPayments = jobs.filter((j) => j.payment_status === 'refunded').length;
      const platformFees = jobs.reduce((s, j) => s + (Number(j.platform_fee) || 0), 0);

      const transAmount = (transData || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const subAmount = (subPaymentsData || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const totalJobPayments = transAmount + subAmount;

      const estimateStripeFee = (amount: number) => Math.max(amount * 0.015 + 0.20, 0.20);
      const stripeFees = estimateStripeFee(totalJobPayments);
      const netRevenue = totalJobPayments - platformFees - stripeFees;
      const vatEstimate = netRevenue * 0.2;

      setStats({
        totalJobPayments,
        fundedJobs,
        unpaidJobs,
        pendingApproval: pendingApprovalCount ?? 0,
        readyToRelease,
        releasedPayouts,
        disputedPayments: disputedCount ?? 0,
        refundedPayments,
        platformFees,
        stripeFees,
        netRevenue,
        vatEstimate,
        totalGuardsAssigned: (assignedData as any)?.length || 0,
        totalAgreedAmount,
      });
    } catch (err) {
      console.error('Failed to load payment stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const cards = [
    {
      label: 'Total Job Payments',
      value: stats.totalJobPayments,
      format: 'currency',
      icon: 'ri-money-pound-circle-line',
      color: 'text-slate-300',
      bg: 'bg-[#1a2b4a]',
      ring: 'ring-[#1e3048]',
    },
    {
      label: 'Funded Jobs',
      value: stats.fundedJobs,
      format: 'number',
      icon: 'ri-shield-check-line',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      ring: 'ring-emerald-500/20',
    },
    {
      label: 'Unpaid Jobs',
      value: stats.unpaidJobs,
      format: 'number',
      icon: 'ri-time-line',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      ring: 'ring-amber-500/20',
    },
    {
      label: 'Pending Approval',
      value: stats.pendingApproval,
      format: 'number',
      icon: 'ri-hourglass-line',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      ring: 'ring-orange-500/20',
    },
    {
      label: 'Ready to Release',
      value: stats.readyToRelease,
      format: 'number',
      icon: 'ri-send-plane-line',
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
      ring: 'ring-sky-500/20',
    },
    {
      label: 'Released Payouts',
      value: stats.releasedPayouts,
      format: 'number',
      icon: 'ri-check-double-line',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      ring: 'ring-blue-500/20',
    },
    {
      label: 'Disputed',
      value: stats.disputedPayments,
      format: 'number',
      icon: 'ri-alert-line',
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      ring: 'ring-red-500/20',
    },
    {
      label: 'Refunded',
      value: stats.refundedPayments,
      format: 'number',
      icon: 'ri-refund-line',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      ring: 'ring-rose-500/20',
    },
    {
      label: 'Platform Fees',
      value: stats.platformFees,
      format: 'currency',
      icon: 'ri-percent-line',
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      ring: 'ring-indigo-500/20',
    },
    {
      label: 'Stripe Fees',
      value: stats.stripeFees,
      format: 'currency',
      icon: 'ri-bank-card-line',
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      ring: 'ring-violet-500/20',
    },
    {
      label: 'Net Revenue',
      value: stats.netRevenue,
      format: 'currency',
      icon: 'ri-bar-chart-line',
      color: 'text-teal-400',
      bg: 'bg-teal-500/10',
      ring: 'ring-teal-500/20',
    },
    {
      label: 'VAT Estimate',
      value: stats.vatEstimate,
      format: 'currency',
      icon: 'ri-calculator-line',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      ring: 'ring-cyan-500/20',
    },
  ];

  const formatValue = (value: number, format: string) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 }).format(value);
    }
    return value.toLocaleString();
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Payment Summary</h2>
          {lastUpdated && (
            <p className="text-xs text-slate-500 mt-0.5">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={() => { loadStats(); onRefresh?.(); }}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
        >
          <div className={`w-4 h-4 flex items-center justify-center ${loading ? 'animate-spin' : ''}`}>
            <i className="ri-refresh-line text-base"></i>
          </div>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-xl ${card.bg} ${card.ring} ring-1 px-4 py-3.5 transition-all hover:shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className={`${card.icon} ${card.color} text-sm`}></i>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{card.label}</span>
            </div>
            {loading ? (
              <div className="h-6 bg-white/5 rounded animate-pulse w-20"></div>
            ) : (
              <p className={`text-lg font-extrabold ${card.color} leading-tight`}>
                {formatValue(card.value, card.format)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}