'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import QGLaunchRewardsFAQ from '@/components/QGLaunchRewardsFAQ';
import FooterExitPopupTestIcon from '@/components/qg-rewards/FooterExitPopupTestIcon';

const heroBg = "https://readdy.ai/api/search-image?query=Dark%20abstract%20gradient%20background%20deep%20navy%20blue%20cyan%20teal%20geometric%20mesh%20pattern%2C%20modern%20technology%20fintech%20SaaS%20aesthetic%2C%20subtle%20glowing%20particles%2C%20professional%20security%20brand%20feel%2C%20very%20dark%20moody%20atmosphere%2C%20low%20contrast%2C%20corporate%20premium%20background&width=1440&height=800&seq=1&orientation=landscape";

export default function QGLaunchRewardsPage() {
  const [refCode, setRefCode] = useState('');
  const [settings, setSettings] = useState<any>({});
  const [refCaptured, setRefCaptured] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('qg_referral_code', ref);
      sessionStorage.setItem('qg_referral_code', ref);
      setRefCode(ref);
      setRefCaptured(true);
      setTimeout(() => setRefCaptured(false), 5000);
    } else {
      const stored = localStorage.getItem('qg_referral_code') || sessionStorage.getItem('qg_referral_code') || '';
      setRefCode(stored);
    }
  }, []);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qg-public-launch-settings`);
        const data = await res.json();
        if (data?.settings) setSettings(data.settings);
      } catch (_) {}
    }
    loadSettings();
  }, []);

  const tokenValuePence = settings.token_value_pence_per_100 || 1000;
  const poundsPer100 = (tokenValuePence / 100).toFixed(0);
  const guardReward = settings.verified_guard_referral_tokens || 250;
  const clientReward = settings.verified_client_referral_tokens || 500;
  const guardRewardPounds = ((guardReward / 100) * poundsPer100).toFixed(2);
  const clientRewardPounds = ((clientReward / 100) * poundsPer100).toFixed(2);
  const profileBonus = settings.profile_completion_bonus_tokens || 50;
  const programmeEnabled = settings.programme_enabled === true || settings.programme_enabled === 'true';

  return (
    <div className="min-h-screen bg-[#071321]">
      {/* Hero */}
      <section
        className="relative w-full min-h-[600px] flex items-center overflow-hidden"
        style={{ backgroundImage: `url(${heroBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="absolute inset-0 bg-[#071321]/80" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#071321]/40 to-[#071321]" />
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-20">
          {!programmeEnabled && (
            <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium">
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-timer-line"></i></div>
              Coming Soon — Programme Launching Shortly
            </div>
          )}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-medium mb-6">
            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-rocket-2-line"></i></div>
            QG Launch Rewards
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-5 max-w-2xl">
            Help Build the QuickGuard Network &amp; Earn Discount Credits
          </h1>
          <p className="text-lg text-slate-300 max-w-xl mb-8 leading-relaxed">
            Refer verified guards and businesses to QuickGuard. Earn QG Tokens that reduce your subscription, job posting, and platform costs. No cash — real platform value.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href={`/qg-launch-rewards/temporary-profile${refCode ? `?ref=${refCode}` : ''}`}
              className="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/20 whitespace-nowrap cursor-pointer"
            >
              Create Temporary Launch Profile
              <div className="w-5 h-5 flex items-center justify-center"><i className="ri-arrow-right-line text-lg"></i></div>
            </Link>
            <Link
              href={`/guard/register${refCode ? `?ref=${refCode}` : ''}`}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/10 whitespace-nowrap cursor-pointer"
            >
              Join as a Guard
              <div className="w-5 h-5 flex items-center justify-center"><i className="ri-arrow-right-line text-lg"></i></div>
            </Link>
            <Link
              href={`/client/register${refCode ? `?ref=${refCode}` : ''}`}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/10 whitespace-nowrap cursor-pointer"
            >
              Join as a Client
              <div className="w-5 h-5 flex items-center justify-center"><i className="ri-arrow-right-line text-lg"></i></div>
            </Link>
          </div>

          {refCaptured && (
            <div className="mt-6 p-4 bg-teal-500/10 border border-teal-500/20 rounded-xl max-w-md">
              <p className="text-teal-400 text-sm flex items-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-check-line"></i></div>
                Referral code saved. Continue to create your profile.
              </p>
            </div>
          )}

          {refCode && !refCaptured && (
            <div className="mt-8 p-4 bg-[#111d35] border border-[#1a2b4a] rounded-xl max-w-md flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-500/10 flex-shrink-0">
                <i className="ri-link text-teal-400 text-lg"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 mb-0.5">You were referred by</p>
                <p className="text-sm font-mono font-bold text-teal-400 truncate">{refCode}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 px-6 bg-[#0B1933]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { icon: 'ri-verified-badge-line', title: 'Verified Guards', desc: 'Only SIA-licensed guards with verified profiles earn rewards.' },
              { icon: 'ri-building-2-line', title: 'Genuine Clients', desc: 'Real businesses with verified contact details. No fake accounts.' },
              { icon: 'ri-discount-percent-line', title: 'Discount Credits Only', desc: 'Tokens reduce platform costs. No cash withdrawals or transfers.' },
              { icon: 'ri-shield-check-line', title: 'Fair Referral Rules', desc: 'Single-level referrals. Fraud detection protects the programme.' },
            ].map((item) => (
              <div key={item.title} className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-teal-500/10 flex items-center justify-center">
                  <div className="w-5 h-5 flex items-center justify-center"><i className={`${item.icon} text-teal-400 text-lg`}></i></div>
                </div>
                <h3 className="text-white font-semibold text-sm mb-1.5">{item.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Token Value Explainer */}
      <section className="py-20 px-6 bg-[#071321]">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">100 QG Tokens = £{poundsPer100} QuickGuard Credit</h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            QG Tokens are discount credits that reduce your costs on QuickGuard. They have no cash value, cannot be withdrawn or transferred, and are exclusively for use on the QuickGuard platform.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-[#0B1933]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-14">How QG Launch Rewards Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {[
              { step: '1', icon: 'ri-user-add-line', title: 'Create Profile', desc: 'Sign up as a guard or client. Complete your basic profile to get your unique referral link.' },
              { step: '2', icon: 'ri-share-forward-line', title: 'Share Your Link', desc: 'Share your referral link with other guards or businesses that need security services.' },
              { step: '3', icon: 'ri-verified-badge-line', title: 'They Verify', desc: 'Referred guards or clients create verified QuickGuard accounts.' },
              { step: '4', icon: 'ri-coins-line', title: 'Earn Tokens', desc: `Earn ${guardReward} tokens per verified guard or ${clientReward} tokens per verified client.` },
              { step: '5', icon: 'ri-discount-percent-line', title: 'Use Credits', desc: 'Apply tokens as discounts on subscriptions, job postings, profile boosts, and future platform features.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                  <div className="w-8 h-8 flex items-center justify-center"><i className={`${item.icon} text-2xl text-teal-400`}></i></div>
                </div>
                <div className="w-8 h-8 mx-auto mb-3 rounded-full bg-teal-500 text-slate-900 flex items-center justify-center text-sm font-bold">{item.step}</div>
                <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rewards Table */}
      <section className="py-20 px-6 bg-[#071321]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-10">Reward Structure</h2>
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
            <div className="grid grid-cols-3 gap-4 p-5 border-b border-[#1a2b4a] text-sm font-semibold text-slate-400">
              <span>Action</span>
              <span className="text-center">QG Tokens</span>
              <span className="text-right">Credit Value</span>
            </div>
            <div className="divide-y divide-[#1a2b4a]">
              <div className="grid grid-cols-3 gap-4 p-5 items-center">
                <span className="text-white text-sm">Complete your profile</span>
                <span className="text-center text-teal-400 font-bold">{profileBonus}</span>
                <span className="text-right text-slate-300 text-sm">£{((profileBonus / 100) * poundsPer100).toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 p-5 items-center">
                <span className="text-white text-sm">Verified guard referral</span>
                <span className="text-center text-teal-400 font-bold">{guardReward}</span>
                <span className="text-right text-slate-300 text-sm">£{guardRewardPounds}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 p-5 items-center">
                <span className="text-white text-sm">Verified client referral</span>
                <span className="text-center text-teal-400 font-bold">{clientReward}</span>
                <span className="text-right text-slate-300 text-sm">£{clientRewardPounds}</span>
              </div>
            </div>
          </div>
          <p className="text-center text-slate-500 text-xs mt-4">Single-level referrals only. Tokens activate after the referred person creates a verified account.</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-[#0B1933]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-10">Frequently Asked Questions</h2>
          <QGLaunchRewardsFAQ />
        </div>
      </section>

      {/* CTAs */}
      <section className="py-20 px-6 bg-[#071321]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Start Earning?</h2>
          <p className="text-slate-400 text-lg mb-8">Create your QuickGuard account, get your referral link, and start earning QG Tokens towards platform discounts.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href={`/qg-launch-rewards/temporary-profile${refCode ? `?ref=${refCode}` : ''}`} className="px-8 py-4 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/20 whitespace-nowrap cursor-pointer">
              Create Temporary Launch Profile
            </Link>
            <Link href={`/guard/register${refCode ? `?ref=${refCode}` : ''}`} className="px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 border border-white/10 transition-all whitespace-nowrap cursor-pointer">
              Join as a Guard
            </Link>
            <Link href={`/client/register${refCode ? `?ref=${refCode}` : ''}`} className="px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 border border-white/10 transition-all whitespace-nowrap cursor-pointer">
              Join as a Client
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/qg-launch-rewards/terms" className="text-slate-400 hover:text-teal-400 text-sm transition-colors cursor-pointer">
              View Full Programme Terms
            </Link>
            <span className="text-slate-600">·</span>
            <Link href="/qg-launch-rewards/account" className="text-slate-400 hover:text-teal-400 text-sm transition-colors cursor-pointer">
              My Launch Account
            </Link>
            <span className="text-slate-600">·</span>
            <Link href="/guard/login" className="text-slate-400 hover:text-teal-400 text-sm transition-colors cursor-pointer">
              Guard Login
            </Link>
            <span className="text-slate-600">·</span>
            <Link href="/client/login" className="text-slate-400 hover:text-teal-400 text-sm transition-colors cursor-pointer">
              Client Login
            </Link>
          </div>
        </div>
      </section>

      {/* Terms Summary */}
      <section className="py-12 px-6 bg-[#0B1933] border-t border-[#1a2b4a]">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <FooterExitPopupTestIcon />
          </div>
          <h3 className="text-sm font-bold text-white mb-3">QG Launch Rewards Terms</h3>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <div className="w-3.5 h-3.5 flex items-center justify-center mt-0.5 flex-shrink-0"><i className="ri-check-line text-teal-500"></i></div>
              QG Tokens are discount credits only. They have no cash value.
            </li>
            <li className="flex items-start gap-2">
              <div className="w-3.5 h-3.5 flex items-center justify-center mt-0.5 flex-shrink-0"><i className="ri-check-line text-teal-500"></i></div>
              Tokens cannot be withdrawn, sold, transferred, traded, or converted into money.
            </li>
            <li className="flex items-start gap-2">
              <div className="w-3.5 h-3.5 flex items-center justify-center mt-0.5 flex-shrink-0"><i className="ri-check-line text-teal-500"></i></div>
              Tokens activate after the referred person creates a verified QuickGuard account.
            </li>
            <li className="flex items-start gap-2">
              <div className="w-3.5 h-3.5 flex items-center justify-center mt-0.5 flex-shrink-0"><i className="ri-check-line text-teal-500"></i></div>
              Single-level referrals only — you cannot earn from referrals made by people you referred.
            </li>
            <li className="flex items-start gap-2">
              <div className="w-3.5 h-3.5 flex items-center justify-center mt-0.5 flex-shrink-0"><i className="ri-check-line text-teal-500"></i></div>
              QuickGuard may reject fraudulent, duplicate, or self-referrals at its discretion.
            </li>
          </ul>
          <Link href="/qg-launch-rewards/terms" className="inline-block mt-3 text-teal-400 hover:text-teal-300 text-xs font-medium transition-colors cursor-pointer">
            Read full terms →
          </Link>
        </div>
      </section>
    </div>
  );
}