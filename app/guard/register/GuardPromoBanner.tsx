'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface PromoBannerData {
  tier1Remaining: number;
  tier1Cap: number;
  tier2Remaining: number;
  tier2Cap: number;
  tier3DaysLeft: number;
  tier3Active: boolean;
  verifiedCount: number;
  isPaused: boolean;
}

export default function GuardPromoBanner() {
  const [data, setData] = useState<PromoBannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchPromoStats() {
      try {
        const { data: config } = await supabase
          .from('promo_config')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (!config) {
          setData(null);
          setLoading(false);
          return;
        }

        const { count: verifiedCount } = await supabase
          .from('guards')
          .select('*', { count: 'exact', head: true })
          .eq('verification_status', 'approved');

        const count = verifiedCount || 0;

        const launchDate = new Date(config.launch_date);
        const tier3End = new Date(launchDate);
        tier3End.setDate(tier3End.getDate() + config.tier3_window_days);
        const now = new Date();
        const tier3DaysLeft = Math.max(0, Math.ceil((tier3End.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const tier3Active = count < config.tier3_cap && now <= tier3End && !config.is_paused;

        setData({
          tier1Remaining: Math.max(0, config.tier1_cap - count),
          tier1Cap: config.tier1_cap,
          tier2Remaining: Math.max(0, config.tier2_cap - Math.max(count, config.tier1_cap)),
          tier2Cap: config.tier2_cap,
          tier3DaysLeft,
          tier3Active,
          verifiedCount: count,
          isPaused: config.is_paused,
        });
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchPromoStats();
  }, []);

  if (loading || !data || data.isPaused) return null;

  // Exhausted? Hide banner
  if (data.tier1Remaining <= 0 && data.tier2Remaining <= 0 && !data.tier3Active) return null;

  const getBannerContent = () => {
    if (data.tier1Remaining > 0) {
      return {
        icon: 'ri-fire-line',
        iconColor: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/20',
        accent: 'text-amber-400',
        label: `${data.tier1Remaining} of ${data.tier1Cap} Founding Guard spots left`,
        sub: '12 months free + 5% lifetime fee',
      };
    }
    if (data.tier2Remaining > 0) {
      return {
        icon: 'ri-star-line',
        iconColor: 'text-slate-300',
        bg: 'bg-slate-500/10 border-slate-500/20',
        accent: 'text-slate-300',
        label: `Founding spots gone! Early Guard: ${data.tier2Remaining}/${data.tier2Cap} left`,
        sub: '6 months free',
      };
    }
    if (data.tier3Active) {
      return {
        icon: 'ri-rocket-line',
        iconColor: 'text-teal-400',
        bg: 'bg-teal-500/10 border-teal-500/20',
        accent: 'text-teal-400',
        label: `Launch promo ends in ${data.tier3DaysLeft} days`,
        sub: '3 months free — join now',
      };
    }
    return null;
  };

  const banner = getBannerContent();
  if (!banner) return null;

  return (
    <div className="max-w-md mx-auto px-6 mb-6">
      <div className={`rounded-xl border ${banner.bg} overflow-hidden`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className={`${banner.icon} ${banner.iconColor} text-lg`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{banner.label}</p>
            <p className="text-xs text-slate-400">{banner.sub}</p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
          >
            <i className={`${expanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-lg`}></i>
          </button>
        </div>

        {expanded && (
          <div className="px-4 pb-4 space-y-3">
            <div className="border-t border-white/10 pt-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <i className="ri-shield-star-line text-amber-400 text-sm"></i>
                </div>
                <div>
                  <p className="text-sm text-white font-medium">Founding Guard (first {data.tier1Cap})</p>
                  <p className="text-xs text-slate-400">12 months zero fees + permanent 5% rate + gold badge</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <i className="ri-star-line text-slate-300 text-sm"></i>
                </div>
                <div>
                  <p className="text-sm text-white font-medium">Early Guard ({data.tier1Cap + 1}–{data.tier2Cap})</p>
                  <p className="text-xs text-slate-400">6 months zero fees + silver badge</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <i className="ri-rocket-line text-teal-400 text-sm"></i>
                </div>
                <div>
                  <p className="text-sm text-white font-medium">Launch Guard (first {data.tier3DaysLeft} days)</p>
                  <p className="text-xs text-slate-400">3 months zero fees</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Tier locked at signup if verified within 14 days. After that, tier is based on verification date.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}