'use client';

import { useMemo } from 'react';

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPercent(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

interface KPIData {
  mrr: number;
  arr: number;
  clv: number;
  arpu: number;
  churnRate: number;
  failedPaymentRate: number;
  mrrGrowth: number;
  activeSubscriptions: number;
  trialCount: number;
  trialPipelineMrr: number;
}

interface Props {
  data: KPIData;
  loading: boolean;
}

function KPICard({
  label,
  value,
  trend,
  trendUp,
  icon,
  color,
  bgColor,
}: {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="bg-[#111d35] rounded-2xl p-5 shadow-sm border border-[#1e2d4a] hover:border-[#2a3a5c] transition-all duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bgColor}`}>
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={`${icon} ${color} text-lg`}></i>
          </div>
        </div>
        {trend && (
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
              trendUp ? 'bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20' : 'bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/20'
            }`}
          >
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
      <div className="text-2xl font-extrabold text-white mb-1 tracking-tight">{value}</div>
      <div className="text-sm font-medium text-slate-400">{label}</div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#111d35] rounded-2xl p-5 shadow-sm border border-[#1e2d4a] animate-pulse">
      <div className="w-11 h-11 rounded-xl bg-[#1a2b4a] mb-4"></div>
      <div className="w-20 h-8 bg-[#1a2b4a] rounded mb-2"></div>
      <div className="w-24 h-4 bg-[#1a2b4a] rounded"></div>
    </div>
  );
}

export default function KPIDashboard({ data, loading }: Props) {
  const cards = useMemo(() => {
    return [
      {
        label: 'MRR',
        value: formatCurrency(data.mrr),
        trend: formatPercent(Math.abs(data.mrrGrowth)),
        trendUp: data.mrrGrowth >= 0,
        icon: 'ri-coins-line',
        color: 'text-teal-400',
        bgColor: 'bg-teal-400/10',
      },
      {
        label: 'ARR',
        value: formatCurrency(data.arr),
        trend: undefined,
        trendUp: undefined,
        icon: 'ri-calendar-check-line',
        color: 'text-sky-400',
        bgColor: 'bg-sky-400/10',
      },
      {
        label: 'Trial Pipeline',
        value: formatCurrency(data.trialPipelineMrr),
        trend: data.trialCount > 0 ? `${data.trialCount} trialing` : undefined,
        trendUp: true,
        icon: 'ri-flask-line',
        color: 'text-violet-400',
        bgColor: 'bg-violet-400/10',
      },
      {
        label: 'Customer Lifetime Value',
        value: formatCurrency(data.clv),
        trend: undefined,
        trendUp: undefined,
        icon: 'ri-heart-pulse-line',
        color: 'text-rose-400',
        bgColor: 'bg-rose-400/10',
      },
      {
        label: 'ARPU',
        value: formatCurrency(data.arpu),
        trend: data.activeSubscriptions > 0 ? `${data.activeSubscriptions} customers` : undefined,
        trendUp: true,
        icon: 'ri-user-received-line',
        color: 'text-indigo-400',
        bgColor: 'bg-indigo-400/10',
      },
      {
        label: 'Churn Rate',
        value: formatPercent(data.churnRate),
        trend: data.churnRate < 0.05 ? 'Healthy' : data.churnRate < 0.1 ? 'Watch' : 'High',
        trendUp: data.churnRate < 0.05,
        icon: 'ri-arrow-down-circle-line',
        color: 'text-amber-400',
        bgColor: 'bg-amber-400/10',
      },
      {
        label: 'Failed Payment Rate',
        value: formatPercent(data.failedPaymentRate),
        trend: data.failedPaymentRate < 0.03 ? 'Healthy' : data.failedPaymentRate < 0.08 ? 'Watch' : 'High',
        trendUp: data.failedPaymentRate < 0.03,
        icon: 'ri-error-warning-line',
        color: 'text-red-400',
        bgColor: 'bg-red-400/10',
      },
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => (
        <KPICard key={c.label} {...c} />
      ))}
    </div>
  );
}