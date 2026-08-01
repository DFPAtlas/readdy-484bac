'use client';

import StatCard from './StatCard';

interface Props {
  monthlyRevenue: number;
  monthlyCosts: number;
  profitLoss: number;
  stripeFees: number;
  estimatedVat: number;
  refunds: number;
  failedPayments: number;
  activeSubscriptions: number;
  loading: boolean;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
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

export default function FinanceOverviewCards({
  monthlyRevenue,
  monthlyCosts,
  profitLoss,
  stripeFees,
  estimatedVat,
  refunds,
  failedPayments,
  activeSubscriptions,
  loading,
}: Props) {
  const cards = [
    {
      label: 'Monthly Revenue',
      value: formatCurrency(monthlyRevenue),
      icon: 'ri-money-pound-circle-line',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10',
      trend: null,
    },
    {
      label: 'Monthly Costs',
      value: formatCurrency(monthlyCosts),
      icon: 'ri-price-tag-3-line',
      color: 'text-red-400',
      bgColor: 'bg-red-400/10',
      trend: null,
    },
    {
      label: 'Profit / Loss',
      value: formatCurrency(profitLoss),
      icon: 'ri-line-chart-line',
      color: profitLoss >= 0 ? 'text-teal-400' : 'text-red-400',
      bgColor: profitLoss >= 0 ? 'bg-teal-400/10' : 'bg-red-400/10',
      trend: null,
    },
    {
      label: 'Stripe Fees',
      value: formatCurrency(stripeFees),
      icon: 'ri-bank-card-line',
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-400/10',
      trend: 'Estimated',
    },
    {
      label: 'Estimated VAT',
      value: formatCurrency(estimatedVat),
      icon: 'ri-government-line',
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      trend: '20% rate',
    },
    {
      label: 'Refunds',
      value: formatCurrency(refunds),
      icon: 'ri-refund-2-line',
      color: 'text-rose-400',
      bgColor: 'bg-rose-400/10',
      trend: null,
    },
    {
      label: 'Failed Payments',
      value: formatCurrency(failedPayments),
      icon: 'ri-close-circle-line',
      color: 'text-red-400',
      bgColor: 'bg-red-400/10',
      trend: null,
    },
    {
      label: 'Active Subscriptions',
      value: String(activeSubscriptions),
      icon: 'ri-vip-crown-line',
      color: 'text-sky-400',
      bgColor: 'bg-sky-400/10',
      trend: null,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {loading
        ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        : cards.map((c) => <StatCard key={c.label} {...c} />)}
    </div>
  );
}