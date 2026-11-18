'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function FoundingClientsPromoSection() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc('get_client_promo_stats');
      if (data) {
        setStats({
          founding: data.counts?.founding ?? 0,
          early: data.counts?.early ?? 0,
          launch: data.counts?.launch ?? 0,
          caps: data.caps ?? { tier1: 50, tier2: 250, tier3: 1000 },
          tier3WindowEnd: data.tier3_window_end,
        });
      }
    };
    load();
  }, []);

  const t1Taken = stats?.founding ?? 0;
  const t1Cap = stats?.caps?.tier1 ?? 50;
  const t1Left = Math.max(0, t1Cap - t1Taken);

  return (
    <section className="py-20 bg-[#0B1933]" aria-labelledby="founding-clients-heading">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-400/20 text-amber-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <i className="ri-rocket-line" />
            Launch Offer
          </div>
          <h2 id="founding-clients-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            Be One of Our First {t1Cap} Clients
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            6 months fee-free + 50% off forever. Activate on your first paid job. Security companies excluded.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className={`rounded-2xl border p-6 ${t1Left > 0 ? 'border-amber-400/30 bg-amber-500/10' : 'border-slate-700/50 bg-[#111d35] opacity-50'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 flex items-center justify-center bg-amber-500/15 border border-amber-400/25 rounded-lg">
                <i className="ri-vip-crown-2-line text-amber-400 text-xl" />
              </div>
              <span className="text-sm font-bold text-amber-400">Founding Client</span>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{t1Taken}/{t1Cap}</p>
            <p className="text-sm text-slate-400 mb-4">First {t1Cap} paid jobs</p>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2"><i className="ri-check-line text-emerald-400 mt-0.5" /> 6 months zero service fees</li>
              <li className="flex items-start gap-2"><i className="ri-check-line text-emerald-400 mt-0.5" /> 50% off standard fee for life</li>
              <li className="flex items-start gap-2"><i className="ri-check-line text-emerald-400 mt-0.5" /> Founding Client badge on posts</li>
            </ul>
            {t1Left <= 5 && t1Left > 0 && (
              <span className="inline-flex items-center gap-1 mt-4 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-400/30 whitespace-nowrap">
                <i className="ri-alarm-warning-line" />
                Only {t1Left} spots left
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-slate-700/50 bg-[#111d35] p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 flex items-center justify-center bg-slate-500/15 border border-slate-400/25 rounded-lg">
                <i className="ri-star-line text-slate-300 text-xl" />
              </div>
              <span className="text-sm font-bold text-slate-300">Early Client</span>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{stats?.early ?? 0}/{stats?.caps?.tier2 ?? 250}</p>
            <p className="text-sm text-slate-400 mb-4">Spots 51–250</p>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2"><i className="ri-check-line text-emerald-400 mt-0.5" /> 3 months zero service fees</li>
              <li className="flex items-start gap-2"><i className="ri-check-line text-emerald-400 mt-0.5" /> Standard rates after promo</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-teal-400/20 bg-teal-500/10 p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 flex items-center justify-center bg-teal-500/15 border border-teal-400/25 rounded-lg">
                <i className="ri-rocket-line text-teal-400 text-xl" />
              </div>
              <span className="text-sm font-bold text-teal-400">Launch Client</span>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{stats?.launch ?? 0}/{stats?.caps?.tier3 ?? 1000}</p>
            <p className="text-sm text-slate-400 mb-4">Spots 251–1000 (90-day window)</p>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2"><i className="ri-check-line text-emerald-400 mt-0.5" /> First 3 jobs completely free</li>
              <li className="flex items-start gap-2"><i className="ri-check-line text-emerald-400 mt-0.5" /> Standard rates after that</li>
            </ul>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/client/register"
            prefetch={false}
            className="inline-flex items-center gap-2 bg-teal-500 text-slate-900 px-8 py-4 rounded-xl font-bold hover:bg-teal-400 transition-all whitespace-nowrap shadow-lg hover:shadow-teal-500/20 hover:scale-105"
          >
            <i className="ri-add-circle-line text-xl" />
            Sign Up Free &amp; Claim Your Tier
          </Link>
          <p className="text-xs text-slate-500 mt-3">Tier activates on first paid job. No card required to sign up.</p>
        </div>
      </div>
    </section>
  );
}