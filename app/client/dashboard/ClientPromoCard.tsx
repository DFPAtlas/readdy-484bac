'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ClientPromoData {
  client_promo_tier: string;
  client_signup_number: number | null;
  client_promo_starts_at: string | null;
  client_promo_ends_at: string | null;
  client_lifetime_fee_discount: number | null;
  client_promo_jobs_remaining: number | null;
  founding_client_badge: boolean;
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ClientPromoCard() {
  const [promo, setPromo] = useState<ClientPromoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('clients')
        .select('client_promo_tier, client_signup_number, client_promo_starts_at, client_promo_ends_at, client_lifetime_fee_discount, client_promo_jobs_remaining, founding_client_badge')
        .eq('user_id', user.id)
        .maybeSingle();
      setPromo(data as ClientPromoData | null);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-6 animate-pulse">
        <div className="h-5 bg-slate-700 rounded w-1/2 mb-4" />
        <div className="h-4 bg-slate-700 rounded w-3/4" />
      </div>
    );
  }

  if (!promo || promo.client_promo_tier === 'standard') return null;

  const tier = promo.client_promo_tier;
  const num = promo.client_signup_number ? String(promo.client_signup_number).padStart(3, '0') : '';
  const endsAt = promo.client_promo_ends_at ? new Date(promo.client_promo_ends_at) : null;
  const daysLeft = endsAt ? daysBetween(new Date(), endsAt) : null;

  const isFounding = tier === 'founding_client';
  const isEarly = tier === 'early_client';
  const isLaunch = tier === 'launch_client';

  const badgeColor = isFounding
    ? 'border-amber-400/30 bg-amber-500/15 text-amber-400'
    : isEarly
    ? 'border-slate-400/30 bg-slate-500/15 text-slate-300'
    : 'border-teal-400/30 bg-teal-500/15 text-teal-400';

  const icon = isFounding ? 'ri-vip-crown-2-line' : isEarly ? 'ri-star-line' : 'ri-rocket-line';
  const title = isFounding ? 'Founding Client' : isEarly ? 'Early Client' : 'Launch Client';

  return (
    <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 flex items-center justify-center rounded-lg border ${badgeColor}`}>
            <i className={`${icon} text-sm`} />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
        </div>
        {isFounding && promo.founding_client_badge && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border border-amber-400/30 bg-amber-500/15 text-amber-400">
            <i className="ri-shield-star-line" />
            Badge Active
          </span>
        )}
      </div>

      {isFounding && (
        <div className="space-y-3">
          <div className="bg-slate-50 dark:bg-[#162036] rounded-xl p-3 border border-slate-200 dark:border-[#1e2d4d]">
            <p className="text-xs text-slate-500 dark:text-slate-500">Signup Number</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">#{num}</p>
          </div>
          {daysLeft !== null && daysLeft > 0 && (
            <div className="bg-slate-50 dark:bg-[#162036] rounded-xl p-3 border border-slate-200 dark:border-[#1e2d4d]">
              <p className="text-xs text-slate-500 dark:text-slate-500">Zero-fee time left</p>
              <p className="text-lg font-bold text-amber-400">{daysLeft} days</p>
            </div>
          )}
          <div className="bg-slate-50 dark:bg-[#162036] rounded-xl p-3 border border-slate-200 dark:border-[#1e2d4d]">
            <p className="text-xs text-slate-500 dark:text-slate-500">Lifetime discount</p>
            <p className="text-lg font-bold text-amber-400">
              {Math.round((promo.client_lifetime_fee_discount || 0) * 100)}% off
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            After the zero-fee period ends, you keep {Math.round((promo.client_lifetime_fee_discount || 0) * 100)}% off the standard service fee forever.
          </p>
        </div>
      )}

      {isEarly && daysLeft !== null && (
        <div className="space-y-3">
          <div className="bg-slate-50 dark:bg-[#162036] rounded-xl p-3 border border-slate-200 dark:border-[#1e2d4d]">
            <p className="text-xs text-slate-500 dark:text-slate-500">Zero-fee time left</p>
            <p className="text-lg font-bold text-slate-300">{daysLeft} days</p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Standard rates apply after the zero-fee period ends.
          </p>
        </div>
      )}

      {isLaunch && (
        <div className="space-y-3">
          <div className="bg-slate-50 dark:bg-[#162036] rounded-xl p-3 border border-slate-200 dark:border-[#1e2d4d]">
            <p className="text-xs text-slate-500 dark:text-slate-500">Free jobs left</p>
            <p className="text-lg font-bold text-teal-400">{promo.client_promo_jobs_remaining ?? 0}</p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Standard rates apply once your free jobs are used up.
          </p>
        </div>
      )}
    </div>
  );
}