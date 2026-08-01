'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface FoundingGuard {
  id: string;
  full_name: string;
  signup_number: number;
  promo_tier: string;
  profile_image_url: string | null;
  location: string | null;
}

export default function FoundingGuardsWall() {
  const [guards, setGuards] = useState<FoundingGuard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'founding' | 'early' | 'launch'>('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('guards')
        .select('id, full_name, signup_number, promo_tier, profile_image_url, location')
        .in('promo_tier', ['founding', 'early', 'launch'])
        .eq('verification_status', 'approved')
        .order('signup_number', { ascending: true })
        .limit(500);

      setGuards(data || []);
      setLoading(false);
    }

    load();
  }, []);

  const filtered = filter === 'all' ? guards : guards.filter(g => g.promo_tier === filter);

  const getTierStyle = (tier: string) => {
    switch (tier) {
      case 'founding':
        return {
          border: 'border-amber-500/30',
          bg: 'bg-amber-500/10',
          text: 'text-amber-400',
          badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
          icon: 'ri-shield-star-line',
        };
      case 'early':
        return {
          border: 'border-slate-400/30',
          bg: 'bg-slate-500/10',
          text: 'text-slate-300',
          badge: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
          icon: 'ri-star-line',
        };
      default:
        return {
          border: 'border-teal-500/30',
          bg: 'bg-teal-500/10',
          text: 'text-teal-400',
          badge: 'bg-teal-500/15 text-teal-400 border-teal-500/25',
          icon: 'ri-rocket-line',
        };
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  };

  const getFirstNameInitial = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933]">
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <i className="ri-shield-star-line" aria-hidden="true"></i>
            QuickGuard Founding Members
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            The Guards Who Believed First
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            These are the verified security professionals who joined QuickGuard during our launch. Each one backed our mission before anyone else did.
          </p>
          <div className="flex items-center justify-center gap-6 mt-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-400">{guards.filter(g => g.promo_tier === 'founding').length}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Founding Guards</p>
            </div>
            <div className="w-px h-10 bg-slate-200 dark:bg-[#1e2d4d]"></div>
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-300">{guards.filter(g => g.promo_tier === 'early').length}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Early Guards</p>
            </div>
            <div className="w-px h-10 bg-slate-200 dark:bg-[#1e2d4d]"></div>
            <div className="text-center">
              <p className="text-3xl font-bold text-teal-400">{guards.filter(g => g.promo_tier === 'launch').length}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Launch Guards</p>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {(['all', 'founding', 'early', 'launch'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filter === t
                  ? 'bg-teal-500 text-white'
                  : 'bg-white dark:bg-[#111d35] border border-slate-200 dark:border-[#1e2d4d] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              {t === 'all' ? 'All Members' : t === 'founding' ? 'Founding' : t === 'early' ? 'Early' : 'Launch'}
            </button>
          ))}
        </div>

        {/* Wall Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <i className="ri-shield-user-line text-6xl text-slate-300 dark:text-slate-600"></i>
            <p className="text-slate-400 mt-4">No members in this tier yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map(guard => {
              const style = getTierStyle(guard.promo_tier);
              return (
                <div
                  key={guard.id}
                  className={`bg-white dark:bg-[#111d35] rounded-xl border ${style.border} p-5 text-center hover:shadow-lg transition-all hover:scale-[1.02]`}
                >
                  <div className={`w-14 h-14 mx-auto rounded-full ${style.bg} flex items-center justify-center mb-3 overflow-hidden`}>
                    {guard.profile_image_url ? (
                      <img
                        src={guard.profile_image_url}
                        alt={guard.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className={`text-lg font-bold ${style.text}`}>
                        {getInitials(guard.full_name)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {getFirstNameInitial(guard.full_name)}
                  </p>
                  {guard.location && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{guard.location}</p>
                  )}
                  <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${style.badge} text-xs font-semibold`}>
                    <i className={`${style.icon} text-xs`}></i>
                    {guard.promo_tier === 'founding' ? 'Founding' : guard.promo_tier === 'early' ? 'Early' : 'Launch'} #{String(guard.signup_number).padStart(3, '0')}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-16">
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            Want your name on this wall?
          </p>
          <Link
            href="/founding-guards-offer"
            className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105 whitespace-nowrap"
          >
            <i className="ri-rocket-line"></i>
            See the Offer
          </Link>
        </div>
      </div>
    </div>
  );
}