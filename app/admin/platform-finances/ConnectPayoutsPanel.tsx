'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface MarketplaceStat {
  label: string;
  value: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}

export default function ConnectPayoutsPanel() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MarketplaceStat[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [jobsRes, payoutsRes, disputesRes] = await Promise.all([
          supabase
            .from('jobs')
            .select('agreed_amount, payment_status, platform_fee, guard_payout_amount'),
          supabase
            .from('guard_payouts')
            .select('amount, net_amount, status, stripe_transfer_id'),
          supabase
            .from('disputes')
            .select('status, jobs:job_id(agreed_amount)'),
        ]);

        const allJobs = jobsRes.data || [];
        const allPayouts = payoutsRes.data || [];
        const allDisputes = disputesRes.data || [];

        const totalJobValue = allJobs.reduce((s, j) => s + (j.agreed_amount || 0), 0);
        const platformFeesEarned = allJobs
          .filter(j => ['funded', 'released', 'completed'].includes(j.payment_status))
          .reduce((s, j) => s + (j.platform_fee || 0), 0);

        const pendingPayouts = allPayouts
          .filter(p => p.status === 'pending')
          .reduce((s, p) => s + (p.net_amount || p.amount || 0), 0);

        const releasedPayouts = allPayouts
          .filter(p => p.status === 'completed')
          .reduce((s, p) => s + (p.net_amount || p.amount || 0), 0);

        const stripeConnectCount = allPayouts
          .filter(p => p.stripe_transfer_id)
          .length;

        const disputedAmount = allDisputes
          .filter(d => d.status === 'open' || d.status === 'under_review')
          .reduce((s: number, d: any) => s + ((d.jobs?.agreed_amount) || 0), 0);

        const openDisputesCount = allDisputes
          .filter(d => d.status === 'open' || d.status === 'under_review').length;

        setStats([
          {
            label: 'Total Job Value',
            value: `£${totalJobValue.toFixed(2)}`,
            icon: 'ri-briefcase-line',
            color: 'text-teal-400',
            bg: 'bg-teal-400/5',
            border: 'border-teal-400/20',
          },
          {
            label: 'Platform Fees Earned',
            value: `£${platformFeesEarned.toFixed(2)}`,
            icon: 'ri-percent-line',
            color: 'text-emerald-400',
            bg: 'bg-emerald-400/5',
            border: 'border-emerald-400/20',
          },
          {
            label: 'Guard Payouts Pending',
            value: `£${pendingPayouts.toFixed(2)}`,
            icon: 'ri-time-line',
            color: 'text-amber-400',
            bg: 'bg-amber-400/5',
            border: 'border-amber-400/20',
          },
          {
            label: 'Guard Payouts Released',
            value: `£${releasedPayouts.toFixed(2)}`,
            icon: 'ri-send-plane-line',
            color: 'text-sky-400',
            bg: 'bg-sky-400/5',
            border: 'border-sky-400/20',
          },
          {
            label: 'Stripe Connect Transfers',
            value: String(stripeConnectCount),
            icon: 'ri-bank-card-line',
            color: 'text-indigo-400',
            bg: 'bg-indigo-400/5',
            border: 'border-indigo-400/20',
          },
          {
            label: `Disputed Amount (${openDisputesCount} open)`,
            value: `£${disputedAmount.toFixed(2)}`,
            icon: 'ri-error-warning-line',
            color: 'text-red-400',
            bg: 'bg-red-400/5',
            border: 'border-red-400/20',
          },
        ]);
      } catch (err) {
        console.error('Error loading marketplace stats:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div>
      <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
        Marketplace Finance (Job Payments & Payouts)
      </h2>
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-20 bg-[#1a2b4a] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat, i) => (
            <div
              key={i}
              className={`${stat.bg} border ${stat.border} rounded-xl p-4 flex items-center gap-4`}
            >
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center border ${stat.border}`}>
                <i className={`${stat.icon} text-xl ${stat.color}`}></i>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-0.5">{stat.label}</p>
                <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}