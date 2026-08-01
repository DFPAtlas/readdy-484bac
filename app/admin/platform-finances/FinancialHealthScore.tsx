'use client';

import { useMemo } from 'react';

interface HealthMetrics {
  revenueGrowth: number;
  customerGrowth: number;
  paymentSuccessRate: number;
  subscriptionRetention: number;
}

interface Props {
  metrics: HealthMetrics;
  loading: boolean;
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? '#14b8a6' : score >= 60 ? '#f59e0b' : '#f43f5e';
  const radius = 40;
  const stroke = 6;
  const normalized = Math.min(100, Math.max(0, score));
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalized / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#1e2d4a"
            strokeWidth={stroke}
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-white">{Math.round(normalized)}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-slate-400">{label}</span>
    </div>
  );
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  const color = value >= 80 ? 'bg-teal-500' : value >= 60 ? 'bg-amber-500' : 'bg-rose-500';
  const normalized = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className="text-xs font-bold text-white">{normalized.toFixed(0)}%</span>
      </div>
      <div className="w-full h-2 bg-[#1e2d4a] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${normalized}%`, transition: 'width 0.5s ease-out' }}
        />
      </div>
    </div>
  );
}

export default function FinancialHealthScore({ metrics, loading }: Props) {
  const overallScore = useMemo(() => {
    const avg =
      (Math.max(0, metrics.revenueGrowth) * 100 * 0.25 +
        Math.max(0, metrics.customerGrowth) * 100 * 0.25 +
        metrics.paymentSuccessRate * 0.25 +
        metrics.subscriptionRetention * 0.25);
    return Math.min(100, Math.max(0, avg));
  }, [metrics]);

  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4a] shadow-sm p-5 animate-pulse">
        <div className="w-40 h-5 bg-[#1a2b4a] rounded mb-4"></div>
        <div className="w-24 h-24 bg-[#1a2b4a] rounded-full mx-auto mb-4"></div>
        <div className="space-y-3">
          <div className="w-full h-2 bg-[#1a2b4a] rounded"></div>
          <div className="w-full h-2 bg-[#1a2b4a] rounded"></div>
          <div className="w-full h-2 bg-[#1a2b4a] rounded"></div>
          <div className="w-full h-2 bg-[#1a2b4a] rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4a] shadow-sm p-5">
      <div className="mb-6">
        <h3 className="text-sm font-bold text-white">Financial Health Score</h3>
        <p className="text-xs text-slate-400 mt-0.5">Based on revenue, growth, and retention</p>
      </div>

      <div className="flex items-center gap-6 mb-6">
        <ScoreRing score={overallScore} label="Overall" />
        <div className="flex-1 space-y-3">
          <ScoreBar value={Math.max(0, metrics.revenueGrowth) * 100} label="Revenue Growth" />
          <ScoreBar value={Math.max(0, metrics.customerGrowth) * 100} label="Customer Growth" />
          <ScoreBar value={metrics.paymentSuccessRate} label="Payment Success" />
          <ScoreBar value={metrics.subscriptionRetention} label="Subscription Retention" />
        </div>
      </div>

      <div className="px-4 py-3 bg-[#0d1b33] rounded-xl">
        <p className="text-xs text-slate-400 leading-relaxed">
          Score weights: Revenue Growth 25%, Customer Growth 25%, Payment Success 25%, Retention 25%.
          {overallScore >= 80
            ? ' Platform is in excellent financial health.'
            : overallScore >= 60
            ? ' Platform health is good with some areas to watch.'
            : ' Platform health needs attention. Review alerts below.'}
        </p>
      </div>
    </div>
  );
}