'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface PromoStats {
  verifiedCount: number;
  tier1Cap: number;
  tier2Cap: number;
  tier3Cap: number;
  tier1Remaining: number;
  tier2Remaining: number;
  tier3Active: boolean;
  tier3DaysLeft: number;
  isPaused: boolean;
  launchDate: string;
}

export default function FoundingGuardsOfferClient() {
  const [stats, setStats] = useState<PromoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [faqOpen, setFaqOpen] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: config } = await supabase
        .from('promo_config')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (!config) {
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

      setStats({
        verifiedCount: count,
        tier1Cap: config.tier1_cap,
        tier2Cap: config.tier2_cap,
        tier3Cap: config.tier3_cap,
        tier1Remaining: Math.max(0, config.tier1_cap - count),
        tier2Remaining: Math.max(0, config.tier2_cap - Math.max(count, config.tier1_cap)),
        tier3Active: count < config.tier3_cap && now <= tier3End && !config.is_paused,
        tier3DaysLeft,
        isPaused: config.is_paused,
        launchDate: config.launch_date,
      });
      setLoading(false);
    }

    load();
  }, []);

  const tier1Taken = stats ? Math.min(stats.verifiedCount, stats.tier1Cap) : 0;
  const tier2Taken = stats ? Math.max(0, Math.min(stats.verifiedCount, stats.tier2Cap) - stats.tier1Cap) : 0;

  const faqs = [
    {
      id: 'tier-lock',
      q: 'When is my tier locked in?',
      a: 'Your tier is locked at your signup date if you complete SIA verification within 14 days. If verification takes longer, your tier is based on your verification date instead. Either way, the earlier you verify, the better your tier.',
    },
    {
      id: 'badge',
      q: 'What does the Founding badge look like?',
      a: 'Founding Guards get a gold badge on their public profile and in job listings. Early Guards get a silver badge. Clients see this when choosing which guard to book — it signals trust and commitment.',
    },
    {
      id: 'lifetime',
      q: 'Is the 5% fee really forever?',
      a: 'Yes. Founding Guards keep the 5% lifetime fee as long as their account remains active. Even after the 12-month free period ends, you only pay 5% per job instead of the standard 10%.',
    },
    {
      id: 'cancel',
      q: 'What if I delete my account and rejoin?',
      a: 'Signup numbers are not recycled. If you leave and rejoin, you receive a new signup number based on current availability. Your original tier is not transferrable.',
    },
    {
      id: 'after-promo',
      q: 'What happens after my free period ends?',
      a: 'After your free period, you move to either your lifetime rate (Founding = 5%) or the standard 10% rate. There is no subscription — you only pay when you work.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933]">
      {/* Hero */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-28">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          {!loading && stats && stats.tier1Remaining > 0 && (
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
              {stats.tier1Remaining} Founding spots remaining
            </div>
          )}
          {!loading && stats && stats.tier1Remaining <= 0 && stats.tier2Remaining > 0 && (
            <div className="inline-flex items-center gap-2 bg-slate-500/10 border border-slate-500/20 text-slate-300 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
              <div className="w-2 h-2 bg-slate-300 rounded-full animate-pulse"></div>
              {stats.tier2Remaining} Early spots remaining
            </div>
          )}
          {!loading && stats && stats.tier3Active && stats.tier1Remaining <= 0 && stats.tier2Remaining <= 0 && (
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
              <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
              Launch promo ends in {stats.tier3DaysLeft} days
            </div>
          )}
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
            Be One of the{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-300">
              First 100
            </span>
          </h1>
          <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10">
            12 months of zero platform fees. Then just 5% for life. Join the security platform that puts guards first.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/guard/register"
              className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105 whitespace-nowrap"
            >
              Become a Founding Guard
            </Link>
            <Link
              href="/founding-guards"
              className="border border-slate-200 dark:border-[#1e2d4d] text-slate-600 dark:text-slate-300 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-slate-100 dark:hover:bg-[#162036] transition-all whitespace-nowrap"
            >
              See the Wall
            </Link>
          </div>
        </div>
      </section>

      {/* Tier Comparison */}
      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tier 1 */}
            <div className="relative bg-white dark:bg-[#111d35] rounded-2xl border border-amber-500/30 p-8">
              <div className="absolute -top-3 left-6 bg-amber-500 text-slate-900 px-3 py-1 rounded-full text-xs font-bold">
                BEST VALUE
              </div>
              <div className="flex items-center gap-3 mb-6 mt-2">
                <div className="w-10 h-10 bg-amber-500/15 rounded-lg flex items-center justify-center">
                  <i className="ri-shield-star-line text-xl text-amber-400"></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Founding Guard</h3>
                  <p className="text-xs text-slate-500">Spots {stats?.tier1Remaining ?? 0} remaining</p>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-4xl font-bold text-slate-900 dark:text-white">£0</p>
                <p className="text-sm text-slate-500">for 12 months</p>
              </div>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400 mb-8">
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-teal-500 mt-0.5"></i>
                  <span>12 months zero platform fees</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-teal-500 mt-0.5"></i>
                  <span><strong>5% lifetime fee</strong> forever (vs 10% standard)</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-teal-500 mt-0.5"></i>
                  <span>Gold Founding badge on profile</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-teal-500 mt-0.5"></i>
                  <span>Priority job matching</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-teal-500 mt-0.5"></i>
                  <span>Name on the Founding Guards wall</span>
                </li>
              </ul>
              <Link
                href="/guard/register"
                className="block w-full text-center bg-amber-500 hover:bg-amber-400 text-slate-900 py-3 rounded-xl font-semibold transition-colors whitespace-nowrap"
              >
                Claim Your Spot
              </Link>
            </div>

            {/* Tier 2 */}
            <div className={`bg-white dark:bg-[#111d35] rounded-2xl border p-8 ${stats && stats.tier1Remaining > 0 ? 'border-slate-200 dark:border-[#1e2d4d] opacity-80' : 'border-slate-500/30'}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-slate-500/15 rounded-lg flex items-center justify-center">
                  <i className="ri-star-line text-xl text-slate-300"></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Early Guard</h3>
                  <p className="text-xs text-slate-500">{stats?.tier1Cap ?? 100}–{stats?.tier2Cap ?? 500}</p>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-4xl font-bold text-slate-900 dark:text-white">£0</p>
                <p className="text-sm text-slate-500">for 6 months</p>
              </div>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400 mb-8">
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-teal-500 mt-0.5"></i>
                  <span>6 months zero platform fees</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-teal-500 mt-0.5"></i>
                  <span>Silver Early badge on profile</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-teal-500 mt-0.5"></i>
                  <span>Standard 10% after free period</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-teal-500 mt-0.5"></i>
                  <span>Full platform access</span>
                </li>
              </ul>
              <Link
                href="/guard/register"
                className="block w-full text-center bg-slate-600 hover:bg-slate-500 text-white py-3 rounded-xl font-semibold transition-colors whitespace-nowrap"
              >
                Join as Early Guard
              </Link>
            </div>

            {/* Tier 3 */}
            <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-teal-500/20 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-teal-500/15 rounded-lg flex items-center justify-center">
                  <i className="ri-rocket-line text-xl text-teal-400"></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Launch Guard</h3>
                  <p className="text-xs text-slate-500">First 90 days</p>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-4xl font-bold text-slate-900 dark:text-white">£0</p>
                <p className="text-sm text-slate-500">for 3 months</p>
              </div>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400 mb-8">
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-teal-500 mt-0.5"></i>
                  <span>3 months zero platform fees</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-teal-500 mt-0.5"></i>
                  <span>Standard 10% after free period</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-teal-500 mt-0.5"></i>
                  <span>Full platform access</span>
                </li>
              </ul>
              <Link
                href="/guard/register"
                className="block w-full text-center border border-teal-500/30 text-teal-400 hover:bg-teal-500/10 py-3 rounded-xl font-semibold transition-colors whitespace-nowrap"
              >
                Join as Launch Guard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white dark:bg-[#111d35]/50 border-y border-slate-200 dark:border-[#1e2d4d]">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '1', icon: 'ri-user-add-line', title: 'Sign Up', desc: 'Create your guard account in under 2 minutes. Free to join.' },
              { step: '2', icon: 'ri-shield-check-line', title: 'Verify SIA', desc: 'Submit your SIA licence for admin review. Usually approved within 24 hours.' },
              { step: '3', icon: 'ri-briefcase-line', title: 'Accept Jobs', desc: 'Browse open shifts nearby, apply or accept direct bookings from clients.' },
              { step: '4', icon: 'ri-wallet-3-line', title: 'Keep Everything', desc: 'During your free period, every pound you earn is yours. No deductions.' },
            ].map(item => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 bg-teal-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <i className={`${item.icon} text-2xl text-teal-400`}></i>
                </div>
                <p className="text-xs font-semibold text-teal-500 uppercase tracking-wider mb-2">Step {item.step}</p>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-12">Questions Answered</h2>
          <div className="space-y-4">
            {faqs.map(faq => (
              <div key={faq.id} className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] overflow-hidden">
                <button
                  onClick={() => setFaqOpen(faqOpen === faq.id ? null : faq.id)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                >
                  <span className="font-semibold text-slate-900 dark:text-white text-sm">{faq.q}</span>
                  <i className={`${faqOpen === faq.id ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-slate-400 text-lg`}></i>
                </button>
                {faqOpen === faq.id && (
                  <div className="px-6 pb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 border-t border-slate-200 dark:border-[#1e2d4d]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Your Spot Won't Wait
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            Every verified guard takes a number. The earlier you sign up and verify, the better your tier.
          </p>
          <Link
            href="/guard/register"
            className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105 whitespace-nowrap"
          >
            <i className="ri-shield-star-line"></i>
            Become a Founding Guard
          </Link>
        </div>
      </section>
    </div>
  );
}