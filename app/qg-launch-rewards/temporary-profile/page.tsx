'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TemporaryProfilePage() {
  const [refCode, setRefCode] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    location_text: '',
    role_interest: 'unsure',
    sia_licence_type: '',
    business_type: '',
    qg_terms_accepted: false,
    marketing_consent: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setRefCode(ref);
      localStorage.setItem('qg_referral_code', ref);
      sessionStorage.setItem('qg_referral_code', ref);
    } else {
      const stored = localStorage.getItem('qg_referral_code') || sessionStorage.getItem('qg_referral_code') || '';
      setRefCode(stored);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    if (!form.qg_terms_accepted) {
      setError('You must accept the QG Launch Rewards terms to continue.');
      setSubmitting(false);
      return;
    }

    if (!form.email || !form.email.includes('@')) {
      setError('Please enter a valid email address.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/qg-create-launch-profile`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: form.full_name,
            email: form.email,
            phone: form.phone || undefined,
            location_text: form.location_text,
            role_interest: form.role_interest,
            sia_licence_type: form.role_interest === 'guard' || form.role_interest === 'both' ? form.sia_licence_type : undefined,
            business_type: form.role_interest === 'client' || form.role_interest === 'both' ? form.business_type : undefined,
            referral_code: refCode || undefined,
            qg_terms_accepted: form.qg_terms_accepted,
            marketing_consent: form.marketing_consent,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create profile. Please try again.');
        setSubmitting(false);
        return;
      }

      setSubmittedEmail(form.email);
      setSuccess(true);
      localStorage.setItem('qg_launch_email', form.email);
    } catch (e: any) {
      setError(e.message || 'Network error. Please try again.');
    }
    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#071321] flex items-center justify-center px-6">
        <div className="max-w-lg w-full bg-[#111d35] border border-teal-500/20 rounded-2xl p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-teal-500/10 flex items-center justify-center">
            <i className="ri-check-line text-3xl text-teal-400"></i>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Your QG Launch Rewards profile has been created!</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Your QG Tokens will be linked to <strong className="text-teal-400">{submittedEmail}</strong>. Create a full QuickGuard account later with the same email to view and use eligible tokens after verification.
          </p>
          <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4 mb-6">
            <p className="text-teal-400 text-sm font-semibold mb-1">100 QG Tokens = £10 QuickGuard credit</p>
            <p className="text-slate-400 text-xs">Tokens are discount credits only. They become usable after your full account is verified.</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href={`/qg-launch-rewards/account`}
              className="w-full py-3.5 bg-teal-500 text-slate-900 font-bold rounded-xl text-sm hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer"
            >
              View My Launch Account
            </Link>
            <Link
              href={`/qg-launch-rewards${refCode ? `?ref=${refCode}` : ''}`}
              className="w-full py-3.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors border border-[#1a2b4a] whitespace-nowrap cursor-pointer"
            >
              Back to Launch Rewards
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#071321]">
      <section className="py-12 px-6 border-b border-[#1a2b4a] bg-gradient-to-b from-[#0B1933] to-[#071321]">
        <div className="max-w-5xl mx-auto">
          <Link href={`/qg-launch-rewards${refCode ? `?ref=${refCode}` : ''}`} className="inline-flex items-center gap-1 text-slate-400 hover:text-teal-400 text-sm mb-4 transition-colors cursor-pointer">
            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-arrow-left-line"></i></div>
            QG Launch Rewards
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Create Temporary Launch Profile</h1>
          <p className="text-slate-400">Join the launch network and start earning QG Tokens before creating your full account.</p>
          {refCode && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-500/10 border border-teal-500/20 rounded-full">
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-link text-teal-400 text-sm"></i></div>
              <span className="text-teal-400 text-xs font-mono">{refCode}</span>
            </div>
          )}
        </div>
      </section>

      <section className="py-12 px-6">
        <div className="max-w-xl mx-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-2">
              <div className="w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0"><i className="ri-error-warning-line"></i></div>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-8 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="Your full name"
                  className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Email Address *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500 transition-colors"
                />
                <p className="text-[10px] text-slate-500 mt-1">Use the same email when creating your full QuickGuard account so your QG Tokens link automatically.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Phone (optional)</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+44 7123 456789"
                  className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Location / Town / City</label>
                <input
                  type="text"
                  value={form.location_text}
                  onChange={(e) => setForm(p => ({ ...p, location_text: e.target.value }))}
                  placeholder="e.g. London, Manchester"
                  className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-2">I am interested in joining as *</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'guard', label: 'Guard', icon: 'ri-shield-user-line', desc: 'Security professional' },
                  { key: 'client', label: 'Client', icon: 'ri-building-line', desc: 'Business looking for security' },
                  { key: 'both', label: 'Both', icon: 'ri-user-star-line', desc: 'Interested in both roles' },
                  { key: 'unsure', label: 'Unsure', icon: 'ri-question-line', desc: 'Still deciding' },
                ].map((role) => (
                  <button
                    key={role.key}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, role_interest: role.key }))}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      form.role_interest === role.key
                        ? 'bg-teal-500/10 border-teal-500/30'
                        : 'bg-[#0B1933] border-[#1a2b4a] hover:border-teal-500/30'
                    }`}
                  >
                    <div className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 ${
                      form.role_interest === role.key ? 'bg-teal-500/20' : 'bg-slate-800'
                    }`}>
                      <i className={`${role.icon} ${form.role_interest === role.key ? 'text-teal-400' : 'text-slate-400'} text-sm`}></i>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${form.role_interest === role.key ? 'text-white' : 'text-slate-300'}`}>{role.label}</p>
                      <p className="text-[10px] text-slate-500">{role.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {(form.role_interest === 'guard' || form.role_interest === 'both') && (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">SIA Licence Type (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {['Door Supervisor', 'Security Guard', 'Close Protection', 'CCTV Operator', 'Vehicle Immobiliser', 'Key Holding'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, sia_licence_type: p.sia_licence_type === t ? '' : t }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                        form.sia_licence_type === t
                          ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                          : 'bg-slate-800 text-slate-400 border border-[#1a2b4a] hover:border-teal-500/30'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(form.role_interest === 'client' || form.role_interest === 'both') && (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Business Type (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {['Construction', 'Retail', 'Events', 'Nightlife', 'Corporate', 'Property Management', 'Other'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, business_type: p.business_type === t ? '' : t }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                        form.business_type === t
                          ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                          : 'bg-slate-800 text-slate-400 border border-[#1a2b4a] hover:border-teal-500/30'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-[#1a2b4a] pt-5 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.qg_terms_accepted}
                  onChange={(e) => setForm(p => ({ ...p, qg_terms_accepted: e.target.checked }))}
                  className="mt-1 w-4 h-4 rounded border-[#1a2b4a] bg-[#0B1933] accent-teal-500"
                />
                <span className="text-xs text-slate-400 leading-relaxed">
                  I understand QG Tokens are QuickGuard discount credits only and have no cash value. I have read and agree to the{' '}
                  <Link href="/qg-launch-rewards/terms" target="_blank" className="text-teal-400 hover:text-teal-300 underline cursor-pointer">
                    QG Launch Rewards Terms
                  </Link>.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.marketing_consent}
                  onChange={(e) => setForm(p => ({ ...p, marketing_consent: e.target.checked }))}
                  className="mt-1 w-4 h-4 rounded border-[#1a2b4a] bg-[#0B1933] accent-teal-500"
                />
                <span className="text-xs text-slate-400 leading-relaxed">
                  I'd like to receive email updates about the QuickGuard launch and QG Launch Rewards. (Optional)
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 transition-all text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 shadow-lg shadow-teal-500/20"
            >
              {submitting ? 'Creating Profile...' : 'Create Launch Profile'}
            </button>
          </form>

          <p className="text-center text-slate-600 text-[11px] mt-6 leading-relaxed">
            By creating a temporary launch profile, you agree that QG Tokens are discount credits only, have no cash value, and become usable only after your full QuickGuard account is verified. Single-level referrals only.
          </p>
        </div>
      </section>
    </div>
  );
}