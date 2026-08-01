'use client';

import { useMemo } from 'react';

interface AnalyticsData {
  newGuards: number;
  newClients: number;
  cancelledAccounts: number;
  trialAccounts: number;
  activeAccounts: number;
  guardGrowth: number;
  clientGrowth: number;
}

interface Props {
  data: AnalyticsData;
  loading: boolean;
}

function StatCard({
  label,
  value,
  sub,
  subPositive,
  icon,
  color,
  bgColor,
}: {
  label: string;
  value: string;
  sub?: string;
  subPositive?: boolean;
  icon: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="bg-[#111d35] rounded-2xl p-5 shadow-sm border border-[#1e2d4a] hover:border-[#2a3a5c] transition-all duration-200">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bgColor}`}>
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={`${icon} ${color} text-lg`}></i>
          </div>
        </div>
        {sub && (
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
              subPositive ? 'bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20' : 'bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/20'
            }`}
          >
            {subPositive ? '↑' : '↓'} {sub}
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

export default function CustomerAnalytics({ data, loading }: Props) {
  const cards = useMemo(() => {
    return [
      {
        label: 'New Guards',
        value: String(data.newGuards),
        sub: Math.abs(data.guardGrowth).toFixed(0) + ' vs last month',
        subPositive: data.guardGrowth >= 0,
        icon: 'ri-shield-user-line',
        color: 'text-teal-400',
        bgColor: 'bg-teal-400/10',
      },
      {
        label: 'New Clients',
        value: String(data.newClients),
        sub: Math.abs(data.clientGrowth).toFixed(0) + ' vs last month',
        subPositive: data.clientGrowth >= 0,
        icon: 'ri-building-2-line',
        color: 'text-sky-400',
        bgColor: 'bg-sky-400/10',
      },
      {
        label: 'Cancelled Accounts',
        value: String(data.cancelledAccounts),
        sub: data.cancelledAccounts === 0 ? 'No churn' : 'Action needed',
        subPositive: data.cancelledAccounts === 0,
        icon: 'ri-user-unfollow-line',
        color: 'text-red-400',
        bgColor: 'bg-red-400/10',
      },
      {
        label: 'Trial Accounts',
        value: String(data.trialAccounts),
        sub: data.trialAccounts > 0 ? 'Active trials' : undefined,
        subPositive: data.trialAccounts > 0,
        icon: 'ri-vip-diamond-line',
        color: 'text-amber-400',
        bgColor: 'bg-amber-400/10',
      },
      {
        label: 'Active Accounts',
        value: String(data.activeAccounts),
        sub: data.activeAccounts > 0 ? 'Paying customers' : undefined,
        subPositive: data.activeAccounts > 0,
        icon: 'ri-user-follow-line',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-400/10',
      },
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {cards.map((c) => (
        <StatCard key={c.label} {...c} />
      ))}
    </div>
  );
}