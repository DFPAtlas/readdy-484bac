'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface PromoStatus {
  tier: string;
  signupNumber: number;
  promoEndsAt: string | null;
  lifetimeFee: number | null;
  foundingBadge: boolean;
}

interface Props {
  guardId: string;
}

export default function GuardPromoCard({ guardId }: Props) {
  const [promo, setPromo] = useState<PromoStatus | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    async function loadPromo() {
      const { data } = await supabase
        .from('guards')
        .select('promo_tier, signup_number, promo_ends_at, lifetime_fee_percentage, founding_badge')
        .eq('id', guardId)
        .maybeSingle();

      if (data) {
        setPromo({
          tier: data.promo_tier || 'standard',
          signupNumber: data.signup_number || 0,
          promoEndsAt: data.promo_ends_at,
          lifetimeFee: data.lifetime_fee_percentage,
          foundingBadge: data.founding_badge || false,
        });
      }
    }

    loadPromo();
  }, [guardId]);

  useEffect(() => {
    if (!promo?.promoEndsAt) return;

    function updateCountdown() {
      const end = new Date(promo!.promoEndsAt!).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setCountdown('Free period ended');
        return;
      }

      const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
      const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));
      setCountdown(`${months} months ${days} days remaining`);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [promo?.promoEndsAt]);

  if (!promo || promo.tier === 'standard') return null;

  const tierConfig: Record<string, { label: string; icon: string; iconColor: string; border: string; bg: string; badgeColor: string }> = {
    founding: {
      label: 'Founding Guard',
      icon: 'ri-shield-star-line',
      iconColor: 'text-amber-400',
      border: 'border-amber-500/20',
      bg: 'bg-amber-500/10',
      badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    },
    early: {
      label: 'Early Guard',
      icon: 'ri-star-line',
      iconColor: 'text-slate-300',
      border: 'border-slate-500/20',
      bg: 'bg-slate-500/10',
      badgeColor: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
    },
    launch: {
      label: 'Launch Guard',
      icon: 'ri-rocket-line',
      iconColor: 'text-teal-400',
      border: 'border-teal-500/20',
      bg: 'bg-teal-500/10',
      badgeColor: 'bg-teal-500/15 text-teal-400 border-teal-500/25',
    },
  };

  const cfg = tierConfig[promo.tier] || tierConfig.launch;

  return (
    <div className={`max-w-7xl mx-auto mb-6 rounded-2xl border ${cfg.border} ${cfg.bg} p-5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center`}>
            <i className={`${cfg.icon} ${cfg.iconColor} text-2xl`}></i>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-white">{cfg.label}</p>
              {promo.signupNumber > 0 && (
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${cfg.badgeColor}`}>
                  #{String(promo.signupNumber).padStart(3, '0')}
                </span>
              )}
            </div>
            {promo.promoEndsAt ? (
              <p className="text-xs text-slate-400">
                {countdown}
                {promo.lifetimeFee ? ` · Lifetime ${promo.lifetimeFee}% fee after` : ''}
              </p>
            ) : promo.lifetimeFee ? (
              <p className="text-xs text-slate-400">Lifetime {promo.lifetimeFee}% fee</p>
            ) : null}
          </div>
        </div>
        <div className="hidden sm:block">
          {promo.promoEndsAt && countdown !== 'Free period ended' && (
            <div className={`px-3 py-1.5 rounded-lg border ${cfg.badgeColor} text-xs font-medium`}>
              Fee-free active
            </div>
          )}
          {promo.lifetimeFee && (!promo.promoEndsAt || countdown === 'Free period ended') && (
            <div className={`px-3 py-1.5 rounded-lg border ${cfg.badgeColor} text-xs font-medium`}>
              Lifetime {promo.lifetimeFee}% rate
            </div>
          )}
        </div>
      </div>
    </div>
  );
}