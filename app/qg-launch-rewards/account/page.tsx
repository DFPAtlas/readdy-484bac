'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function QGLaunchAccountPage() {
  const [email, setEmail] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<any>(null);
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');
  const [creatingRef, setCreatingRef] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('qg_launch_email');
    if (stored) {
      setEmail(stored);
      setEmailInput(stored);
      loadDashboard(stored);
    }
  }, []);

  async function loadDashboard(userEmail: string) {
    setLoading(true); setError('');
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qg-launch-account-dashboard`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_dashboard', email: userEmail })
        }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load dashboard'); setLoading(false); return; }
      setDashboard(data);
      if (data.profile) {
        setNewsletterConsent(data.profile.newsletter_consent || false);
      }
      localStorage.setItem('qg_launch_email', userEmail);
    } catch (e: any) {
      setError(e.message || 'Network error');
    }
    setLoading(false);

    // Record view
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qg-launch-account-dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action: 'record_account_view', email: userEmail })
      }).catch(() => {});
    }
  }

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = emailInput.trim();
    if (!trimmed || !trimmed.includes('@')) { setError('Please enter a valid email address'); return; }
    setEmail(trimmed);
    loadDashboard(trimmed);
  }

  async function handleToggleNewsletter() {
    if (!email) return;
    const newVal = !newsletterConsent;
    setNewsletterConsent(newVal);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qg-launch-account-dashboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_newsletter_consent', email, newsletter_consent: newVal })
      });
    } catch { setNewsletterConsent(!newVal); }
  }

  async function handleCreateReferralCode() {
    if (creatingRef || !email) return;
    setCreatingRef(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qg-launch-account-dashboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_referral_code', email, intended_role: dashboard?.profile?.intended_role || dashboard?.tokens?.intended_role || 'unknown' })
      });
      const data = await res.json();
      if (res.ok && data.referral_code) {
        setDashboard((prev: any) => ({
          ...prev,
          referral_code: data.referral_code,
          referral_link: data.referral_link
        }));
        localStorage.setItem('qg_referral_code', data.referral_code);
      }
    } catch {}
    setCreatingRef(false);
  }

  function handleCopyReferralLink() {
    if (!dashboard?.referral_link) return;
    const url = `${window.location.origin}${dashboard.referral_link}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyMsg('Copied!');
      setTimeout(() => setCopyMsg(''), 2000);
    }).catch(() => setCopyMsg('Failed to copy'));
  }

  function getProfileStatusLabel(status: string) {
    const map: Record<string, string> = {
      'temporary': 'Temporary',
      'linked': 'Linked',
      'converted_guard': 'Converted — Guard',
      'converted_client': 'Converted — Client',
      'verified': 'Verified'
    };
    return map[status] || status;
  }

  function getTokenStatusLabel(status: string) {
    const map: Record<string, string> = {
      'pre_account': 'Pre-Account',
      'linked': 'Linked',
      'verified': 'Verified',
      'cancelled': 'Cancelled',
      'rejected': 'Rejected',
      'none': 'No Tokens'
    };
    return map[status] || status;
  }

  const refCode = dashboard?.referral_code;
  const refLink = dashboard?.referral_link;
  const fullRefLink = refLink ? `https://quickguard.uk${refLink}` : '';
  const tokens = dashboard?.tokens;
  const profile = dashboard?.profile;
  const refStats = dashboard?.referral_stats;
  const updates = dashboard?.updates;
  const publicStats = dashboard?.public_stats;
  const checklist = dashboard?.checklist;

  const signupUrl = (path: string) => `${path}${refCode ? `?ref=${refCode}` : ''}`;

  return (
    <div className="min-h-screen bg-[#071321]">
      {/* Header */}
      <section className="py-16 px-6 bg-gradient-to-b from-[#0B1933] to-[#071321] border-b border-[#1a2b4a]">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/qg-launch-rewards" className="text-slate-400 hover:text-teal-400 transition-colors flex items-center gap-1 text-sm cursor-pointer">
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-arrow-left-line"></i></div>
              QG Launch Rewards
            </Link>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Your QG Launch Account</h1>
          <p className="text-slate-400 text-lg">Track your QG Tokens, referrals, and QuickGuard launch progress.</p>
        </div>
      </section>

      {/* Email Lookup */}
      {!email && (
        <section className="py-20 px-6">
          <div className="max-w-md mx-auto bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-8">
            <div className="w-14 h-14 flex items-center justify-center mx-auto mb-5 rounded-2xl bg-teal-500/10">
              <i className="ri-mail-check-line text-teal-400 text-2xl"></i>
            </div>
            <h2 className="text-xl font-bold text-white text-center mb-2">Find Your Launch Account</h2>
            <p className="text-slate-400 text-sm text-center mb-6">
              Enter the email address you used when you joined QG Launch Rewards.
            </p>
            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Email address</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500 transition-colors"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 transition-all text-sm whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'View My Launch Account'}
              </button>
            </form>
          </div>
        </section>
      )}

      {/* Loading */}
      {loading && email && (
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent"></div>
          </div>
        </section>
      )}

      {/* Error */}
      {error && email && !loading && (
        <section className="py-20 px-6">
          <div className="max-w-md mx-auto bg-[#111d35] border border-red-500/20 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 rounded-2xl bg-red-500/10">
              <i className="ri-error-warning-line text-red-400 text-2xl"></i>
            </div>
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => { setEmail(''); setError(''); }}
              className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors text-sm whitespace-nowrap cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </section>
      )}

      {/* Dashboard */}
      {dashboard && email && !loading && (
        <section className="py-12 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <p className="text-white font-semibold text-lg">{profile?.name || email}</p>
                  {profile?.profile_status && (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      profile.profile_status === 'verified' ? 'bg-teal-500/10 text-teal-400' :
                      profile.profile_status === 'linked' ? 'bg-amber-500/10 text-amber-400' :
                      profile.profile_status.includes('converted') ? 'bg-blue-500/10 text-blue-400' :
                      'bg-slate-500/10 text-slate-400'
                    }`}>
                      {getProfileStatusLabel(profile.profile_status)}
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-sm">{email}</p>
              </div>
              <button
                onClick={() => { setEmail(''); setDashboard(null); }}
                className="px-4 py-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 hover:text-white transition-colors text-sm whitespace-nowrap cursor-pointer"
              >
                Switch Account
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Token Counter Card */}
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-500/10">
                      <i className="ri-coins-line text-teal-400"></i>
                    </div>
                    <h3 className="text-white font-bold">QG Token Balance</h3>
                    {tokens?.status && (
                      <span className={`ml-auto text-xs font-medium px-2.5 py-1 rounded-full ${
                        tokens.status === 'verified' ? 'bg-teal-500/10 text-teal-400' :
                        tokens.status === 'linked' ? 'bg-amber-500/10 text-amber-400' :
                        tokens.status === 'pre_account' ? 'bg-blue-500/10 text-blue-400' :
                        tokens.status === 'none' ? 'bg-slate-500/10 text-slate-400' :
                        'bg-slate-500/10 text-slate-400'
                      }`}>
                        {getTokenStatusLabel(tokens.status)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div className="bg-[#0B1933] rounded-xl p-4 text-center">
                      <p className="text-3xl font-bold text-teal-400">{tokens?.total_tokens || 0}</p>
                      <p className="text-xs text-slate-400 mt-1">Total QG Tokens</p>
                    </div>
                    <div className="bg-[#0B1933] rounded-xl p-4 text-center">
                      <p className="text-3xl font-bold text-amber-400">{tokens?.pending_tokens || 0}</p>
                      <p className="text-xs text-slate-400 mt-1">Pending</p>
                    </div>
                    <div className="bg-[#0B1933] rounded-xl p-4 text-center">
                      <p className="text-3xl font-bold text-emerald-400">{tokens?.approved_tokens || 0}</p>
                      <p className="text-xs text-slate-400 mt-1">Approved</p>
                    </div>
                  </div>
                  <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-500/20 flex-shrink-0">
                      <i className="ri-discount-percent-line text-teal-400 text-lg"></i>
                    </div>
                    <div>
                      <p className="text-white font-bold">Estimated Credit: £{dashboard?.credit_estimate_pounds || '0.00'}</p>
                      <p className="text-slate-400 text-xs">100 QG Tokens = £10 QuickGuard credit</p>
                    </div>
                  </div>
                  {tokens?.pending_tokens > 0 && (
                    <p className="text-amber-400 text-xs mt-4 flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-information-line"></i></div>
                      These tokens are waiting for verification before they can be used.
                    </p>
                  )}
                  {tokens?.approved_tokens > 0 && (
                    <p className="text-teal-400 text-xs mt-4 flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-check-line"></i></div>
                      These tokens are approved and will become available for eligible QuickGuard discounts once your full account is active.
                    </p>
                  )}
                  {tokens?.total_tokens === 0 && (
                    <p className="text-slate-500 text-xs mt-4 flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-information-line"></i></div>
                      Start recommending trusted guards or businesses to earn QG Tokens.
                    </p>
                  )}
                </div>

                {/* Referral Card */}
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-500/10">
                      <i className="ri-user-shared-line text-teal-400"></i>
                    </div>
                    <h3 className="text-white font-bold">Recommend QuickGuard</h3>
                  </div>

                  {refCode ? (
                    <>
                      <div className="bg-[#0B1933] border border-[#1a2b4a] rounded-xl p-4 mb-4">
                        <p className="text-xs text-slate-400 mb-2">Your referral link</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-teal-400 text-sm font-mono bg-[#111d35] rounded-lg px-3 py-2 truncate">{fullRefLink}</code>
                          <button
                            onClick={handleCopyReferralLink}
                            className="px-4 py-2 bg-teal-500 text-slate-900 rounded-lg font-semibold text-xs hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer"
                          >
                            {copyMsg || 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-5">
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Join me on QuickGuard and earn QG Tokens towards platform discounts: ${fullRefLink}`)}`}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600/10 text-green-400 rounded-lg text-xs font-medium hover:bg-green-600/20 transition-colors whitespace-nowrap cursor-pointer border border-green-600/20"
                        >
                          <div className="w-4 h-4 flex items-center justify-center"><i className="ri-whatsapp-fill"></i></div>
                          WhatsApp
                        </a>
                        <button
                          onClick={() => {
                            const text = `Join me on QuickGuard and earn QG Tokens towards platform discounts. Use my referral link: ${fullRefLink}`;
                            navigator.clipboard.writeText(text).then(() => { setCopyMsg('Copied!'); setTimeout(() => setCopyMsg(''), 2000); });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <div className="w-4 h-4 flex items-center justify-center"><i className="ri-file-copy-line"></i></div>
                          Copy Text
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="bg-[#0B1933] border border-[#1a2b4a] rounded-xl p-4 mb-4 text-center">
                      <p className="text-slate-400 text-sm mb-3">You don't have a referral code yet.</p>
                      <button
                        onClick={handleCreateReferralCode}
                        disabled={creatingRef}
                        className="px-5 py-2.5 bg-teal-500 text-slate-900 rounded-lg font-bold text-sm hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
                      >
                        {creatingRef ? 'Creating...' : 'Get My Referral Link'}
                      </button>
                    </div>
                  )}

                  {refStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-[#0B1933] rounded-xl p-3 text-center">
                        <p className="text-xl font-bold text-white">{refStats.total_sent || 0}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Sent</p>
                      </div>
                      <div className="bg-[#0B1933] rounded-xl p-3 text-center">
                        <p className="text-xl font-bold text-purple-400">{refStats.clicked || 0}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Clicked</p>
                      </div>
                      <div className="bg-[#0B1933] rounded-xl p-3 text-center">
                        <p className="text-xl font-bold text-amber-400">{refStats.signed_up || 0}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Joined</p>
                      </div>
                      <div className="bg-[#0B1933] rounded-xl p-3 text-center">
                        <p className="text-xl font-bold text-teal-400">{refStats.verified || 0}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Verified</p>
                      </div>
                    </div>
                  )}

                  <p className="text-slate-500 text-xs mt-4">
                    Recommend QuickGuard to trusted guards and businesses. You earn QG Tokens when your referral creates a verified QuickGuard account.
                  </p>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Full Account CTA */}
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-500/10 mb-4">
                    <i className="ri-rocket-2-line text-teal-400 text-lg"></i>
                  </div>
                  <h3 className="text-white font-bold text-sm mb-2">Ready to create your full QuickGuard account?</h3>
                  <p className="text-slate-400 text-xs mb-4">
                    Use the same email address so your QG Tokens link automatically.
                  </p>
                  <div className="space-y-2">
                    <Link
                      href={signupUrl('/guard/register')}
                      className="block w-full py-2.5 bg-teal-500 text-slate-900 text-center text-sm font-bold rounded-xl hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer"
                    >
                      Set Up Full Guard Account
                    </Link>
                    <Link
                      href={signupUrl('/client/register')}
                      className="block w-full py-2.5 bg-slate-800 text-slate-300 text-center text-sm font-medium rounded-xl hover:bg-slate-700 transition-colors border border-[#1a2b4a] whitespace-nowrap cursor-pointer"
                    >
                      Set Up Full Client Account
                    </Link>
                  </div>
                </div>

                {/* Profile Checklist */}
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                  <h3 className="text-white font-bold text-sm mb-3">Profile Checklist</h3>
                  <p className="text-slate-500 text-xs mb-4">Complete your launch profile to make sure your QG Tokens are ready when QuickGuard opens full accounts.</p>
                  <div className="space-y-2.5">
                    {[
                      { key: 'email_added', label: 'Email added' },
                      { key: 'profile_created', label: 'Basic profile created' },
                      { key: 'referral_code_created', label: 'Referral code created' },
                      { key: 'first_recommendation_sent', label: 'First recommendation sent' },
                      { key: 'full_account_created', label: 'Full account created' },
                      { key: 'account_verified', label: 'Account verified' },
                      { key: 'tokens_approved', label: 'Tokens approved' },
                    ].map((item) => {
                      const done = checklist?.[item.key] === true;
                      return (
                        <div key={item.key} className="flex items-center gap-2.5">
                          <div className={`w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 ${done ? 'bg-teal-500/20' : 'bg-slate-800'}`}>
                            <i className={`${done ? 'ri-check-line text-teal-400' : 'ri-checkbox-blank-circle-line text-slate-700'} text-xs`}></i>
                          </div>
                          <span className={`text-xs ${done ? 'text-slate-300' : 'text-slate-600'}`}>{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Launch Progress */}
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                  <h3 className="text-white font-bold text-sm mb-3">QuickGuard Launch Progress</h3>
                  {publicStats && Object.keys(publicStats).length > 0 ? (
                    <div className="space-y-2.5 mb-3">
                      {publicStats.total_launch_members && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Launch Members</span>
                          <span className="text-sm font-bold text-white">{typeof publicStats.total_launch_members === 'string' ? JSON.parse(publicStats.total_launch_members) : publicStats.total_launch_members}</span>
                        </div>
                      )}
                      {publicStats.total_verified_guards && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Verified Guards</span>
                          <span className="text-sm font-bold text-teal-400">{typeof publicStats.total_verified_guards === 'string' ? JSON.parse(publicStats.total_verified_guards) : publicStats.total_verified_guards}</span>
                        </div>
                      )}
                      {publicStats.total_businesses_joined && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Businesses Joined</span>
                          <span className="text-sm font-bold text-blue-400">{typeof publicStats.total_businesses_joined === 'string' ? JSON.parse(publicStats.total_businesses_joined) : publicStats.total_businesses_joined}</span>
                        </div>
                      )}
                      {publicStats.total_qg_tokens_issued && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Tokens Issued</span>
                          <span className="text-sm font-bold text-amber-400">{typeof publicStats.total_qg_tokens_issued === 'string' ? JSON.parse(publicStats.total_qg_tokens_issued) : publicStats.total_qg_tokens_issued}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs mb-3">Launch stats coming soon.</p>
                  )}
                  {publicStats?.latest_launch_milestone && (
                    <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3">
                      <p className="text-teal-400 text-xs">
                        {typeof publicStats.latest_launch_milestone === 'string' ? JSON.parse(publicStats.latest_launch_milestone) : publicStats.latest_launch_milestone}
                      </p>
                    </div>
                  )}
                  <p className="text-slate-600 text-[10px] mt-3">More guards and clients joining means a stronger QuickGuard network for everyone.</p>
                </div>

                {/* Latest Updates */}
                <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
                  <h3 className="text-white font-bold text-sm mb-3">QuickGuard Launch Updates</h3>
                  {updates && updates.length > 0 ? (
                    <div className="space-y-3 mb-4">
                      {updates.map((u: any) => (
                        <div key={u.id} className="bg-[#0B1933] rounded-xl p-3">
                          <p className="text-white text-sm font-semibold mb-1">{u.title}</p>
                          <p className="text-slate-400 text-xs leading-relaxed">{u.summary}</p>
                          {u.published_at && (
                            <p className="text-slate-600 text-[10px] mt-1.5">{new Date(u.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs mb-4">No updates yet. Check back soon.</p>
                  )}

                  <div className="border-t border-[#1a2b4a] pt-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <button
                        onClick={handleToggleNewsletter}
                        className={`w-9 h-5 rounded-full transition-colors relative ${newsletterConsent ? 'bg-teal-500' : 'bg-slate-700'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${newsletterConsent ? 'left-4' : 'left-0.5'}`}></div>
                      </button>
                      <span className="text-xs text-slate-400">Email me launch updates</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Info */}
            <div className="mt-10 bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Your QG Tokens are stored against your email address. When you create your full QuickGuard account using the same email, your eligible tokens will link automatically.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/qg-launch-rewards${refCode ? `?ref=${refCode}` : ''}`} className="text-teal-400 hover:text-teal-300 text-sm whitespace-nowrap cursor-pointer">
                    Launch Rewards Home
                  </Link>
                  <Link href="/qg-launch-rewards/terms" className="text-slate-400 hover:text-teal-400 text-sm whitespace-nowrap cursor-pointer">
                    Programme Terms
                  </Link>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-[#1a2b4a]">
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  QG Tokens are discount credits only. They have no cash value, cannot be withdrawn, sold, transferred, or exchanged for money. Tokens become usable only after your full QuickGuard account is verified. Single-level referrals only. QuickGuard may reject fraudulent, duplicate, or self-referrals at its discretion.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <section className="py-8 px-6 bg-[#0B1933] border-t border-[#1a2b4a]">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <p className="text-slate-600 text-xs">QG Launch Account — QuickGuard.uk</p>
          <div className="flex gap-4">
            <Link href="/" className="text-slate-500 hover:text-teal-400 text-xs transition-colors cursor-pointer">Home</Link>
            <Link href="/qg-launch-rewards" className="text-slate-500 hover:text-teal-400 text-xs transition-colors cursor-pointer">QG Launch Rewards</Link>
            <Link href="/guard/login" className="text-slate-500 hover:text-teal-400 text-xs transition-colors cursor-pointer">Guard Login</Link>
            <Link href="/client/login" className="text-slate-500 hover:text-teal-400 text-xs transition-colors cursor-pointer">Client Login</Link>
          </div>
        </div>
      </section>
    </div>
  );
}