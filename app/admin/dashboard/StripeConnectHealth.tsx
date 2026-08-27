'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface StripeHealthData {
  totalGuards: number;
  guardsWithStripe: number;
  guardsReady: number;
  guardsPending: number;
  guardsRestricted: number;
  guardsNotStarted: number;
  failedTransfers: number;
}

export default function StripeConnectHealth() {
  const [data, setData] = useState<StripeHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [
          totalRes,
          withStripeRes,
          readyRes,
          pendingRes,
          restrictedRes,
          notStartedRes,
          failedTransfersRes,
        ] = await Promise.all([
          supabase.from('guards').select('*', { count: 'exact', head: true }),
          supabase.from('guards').select('*', { count: 'exact', head: true }).not('stripe_account_id', 'is', null),
          supabase.from('guards').select('*', { count: 'exact', head: true }).eq('stripe_account_status', 'ready'),
          supabase.from('guards').select('*', { count: 'exact', head: true }).eq('stripe_account_status', 'pending'),
          supabase.from('guards').select('*', { count: 'exact', head: true }).eq('stripe_account_status', 'restricted'),
          supabase.from('guards').select('*', { count: 'exact', head: true }).eq('stripe_account_status', 'not_started').not('stripe_account_id', 'is', null),
          supabase.from('guard_payouts').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        ]);

        setData({
          totalGuards: totalRes.count ?? 0,
          guardsWithStripe: withStripeRes.count ?? 0,
          guardsReady: readyRes.count ?? 0,
          guardsPending: pendingRes.count ?? 0,
          guardsRestricted: restrictedRes.count ?? 0,
          guardsNotStarted: notStartedRes.count ?? 0,
          failedTransfers: failedTransfersRes.count ?? 0,
        });
      } catch (err) {
        console.error('Stripe health fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#1a2b4a]"></div>
          <div className="h-5 w-40 bg-[#1a2b4a] rounded"></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-16 bg-[#1a2b4a] rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const items = [
    { label: 'Total Guards', value: data.totalGuards, color: 'text-slate-300', icon: 'ri-team-line' },
    { label: 'With Stripe', value: data.guardsWithStripe, color: 'text-indigo-400', icon: 'ri-link' },
    { label: 'Ready for Payouts', value: data.guardsReady, color: 'text-emerald-400', icon: 'ri-check-double-line' },
    { label: 'Pending Verification', value: data.guardsPending, color: 'text-amber-400', icon: 'ri-time-line' },
    { label: 'Restricted', value: data.guardsRestricted, color: 'text-red-400', icon: 'ri-error-warning-line' },
    { label: 'Failed Transfers', value: data.failedTransfers, color: 'text-orange-400', icon: 'ri-close-circle-line' },
  ];

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-exchange-funds-line text-violet-400 text-lg"></i>
          </div>
        </div>
        <h3 className="text-sm font-bold text-white">Stripe Connect Health</h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map(item => (
          <div key={item.label} className="bg-[#0B1933] rounded-lg p-3 border border-[#1a2b4a]">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{item.label}</p>
            <span className={`text-lg font-bold ${item.color} flex items-center gap-1.5`}>
              <span className="w-4 h-4 flex items-center justify-center">
                <i className={item.icon}></i>
              </span>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}