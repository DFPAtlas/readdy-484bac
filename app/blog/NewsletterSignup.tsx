'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type Audience = 'both' | 'client' | 'guard';

const OPTIONS: { key: Audience; label: string }[] = [
  { key: 'both', label: 'Both' },
  { key: 'client', label: 'I book security' },
  { key: 'guard', label: 'I work shifts' },
];

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [audience, setAudience] = useState<Audience>('both');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }

    setSaving(true);
    setStatus('idle');

    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({ email: trimmed, audience });

    setSaving(false);

    if (error) {
      if (error.code === '23505') {
        setStatus('success');
        setMessage('You are already on the list — thanks for sticking with us.');
        setEmail('');
        return;
      }
      setStatus('error');
      setMessage('Something went wrong. Please try again in a moment.');
      return;
    }

    setStatus('success');
    setMessage('You are on the list. Look out for the next article.');
    setEmail('');
  }

  return (
    <section className="py-16 sm:py-20 bg-[#0e1628] border-t border-slate-800/60">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#111d35] border border-slate-700/50 rounded-3xl p-8 sm:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="lg:w-1/2 min-w-0">
              <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/25 text-teal-300 px-3 py-1 rounded-full text-xs font-semibold mb-4">
                <span className="w-3.5 h-3.5 flex items-center justify-center">
                  <i className="ri-mail-send-line text-xs" aria-hidden="true" />
                </span>
                Newsletter
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 leading-tight">
                One useful email a month.
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                New guides on licensing, shift planning and pay — no marketing noise, and you can unsubscribe whenever you like.
              </p>
            </div>

            <div className="lg:w-1/2 min-w-0 w-full">
              <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 min-w-0">
                    <label htmlFor="blog-newsletter-email" className="sr-only">Email address</label>
                    <div className="flex items-center bg-[#0B1933] border border-slate-700/70 rounded-xl focus-within:border-teal-400/60 transition-colors overflow-hidden">
                      <span className="w-10 h-11 flex items-center justify-center flex-shrink-0">
                        <i className="ri-mail-line text-slate-500 text-base" aria-hidden="true" />
                      </span>
                      <input
                        id="blog-newsletter-email"
                        type="email"
                        name="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@company.co.uk"
                        className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-slate-500 outline-none py-3 pr-3"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-slate-900 px-6 py-3 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {saving ? (
                      <span className="w-4 h-4 border-2 border-slate-900/40 border-t-slate-900 rounded-full animate-spin" />
                    ) : (
                      <span className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-send-plane-line text-base" aria-hidden="true" />
                      </span>
                    )}
                    Subscribe
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">I am interested as:</span>
                  {OPTIONS.map((option) => {
                    const active = audience === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setAudience(option.key)}
                        aria-pressed={active}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-teal-500/15 border-teal-400/50 text-teal-300'
                            : 'bg-transparent border-slate-700/60 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {status !== 'idle' && (
                  <p
                    className={`text-sm flex items-start gap-2 ${status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}
                    role="status"
                  >
                    <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i
                        className={status === 'success' ? 'ri-check-line text-sm' : 'ri-error-warning-line text-sm'}
                        aria-hidden="true"
                      />
                    </span>
                    {message}
                  </p>
                )}

                <p className="text-xs text-slate-500">
                  By subscribing you agree to our{' '}
                  <a href="/privacy" className="text-teal-400 hover:text-teal-300 underline">
                    privacy policy
                  </a>
                  .
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}