'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import SandboxNotice from './SandboxNotice';
import SandboxPlanButtons from './SandboxPlanButtons';
import SandboxStatusPanel from './SandboxStatusPanel';
import type { SandboxBlocked, SandboxStatus } from './types';

const ENDPOINT = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/christmas-offer-checkout`;

export default function ChristmasSandboxClient() {
  const [phase, setPhase] = useState<'checking' | 'signed-out' | 'ready' | 'blocked'>('checking');
  const [status, setStatus] = useState<SandboxStatus | null>(null);
  const [blocked, setBlocked] = useState<SandboxBlocked | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setPhase('checking');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setPhase('signed-out');
      return;
    }
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'status' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.promoAvailable) {
        setBlocked({ code: data?.code, message: data?.message || 'The sandbox promo preview is not available in this environment.' });
        setStatus(null);
        setPhase('blocked');
        return;
      }
      setStatus(data as SandboxStatus);
      setBlocked(null);
      setPhase('ready');
    } catch {
      setBlocked({ message: 'The sandbox promo preview could not be reached, so nothing was started.' });
      setPhase('blocked');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const start = async (planId: string) => {
    setPending(planId);
    setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setPhase('signed-out');
        return;
      }
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        setMessage('Test checkout created. Opening the Stripe test page...');
        window.location.href = data.url;
        return;
      }
      setMessage(data?.message || 'The test checkout did not start.');
    } catch {
      setMessage('The test checkout could not be started.');
    } finally {
      setPending(null);
    }
  };

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="w-full max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-2">
          <h1 className="text-2xl font-bold text-slate-900">Christmas offer sandbox</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 whitespace-nowrap">
            <i className="ri-lock-2-line w-3.5 h-3.5 flex items-center justify-center" />
            Test only
          </span>
        </div>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          A private preview of the Christmas offer checkout. Normal pricing and checkout are unchanged.
        </p>

        <SandboxNotice />

        {phase === 'checking' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 flex items-center gap-3">
            <span className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-600">Checking whether this environment may run the sandbox preview...</p>
          </div>
        )}

        {phase === 'signed-out' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            <p className="text-sm font-medium text-slate-900 mb-1">Please sign in first</p>
            <p className="text-sm text-slate-500 mb-5">The preview needs an account session so it can check your plan eligibility.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/client/login" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white text-sm font-semibold px-5 py-3 whitespace-nowrap">
                Client sign in
              </Link>
              <Link href="/guard/login" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 text-slate-800 text-sm font-semibold px-5 py-3 whitespace-nowrap">
                Guard sign in
              </Link>
            </div>
          </div>
        )}

        {phase === 'blocked' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <i className="ri-shield-keyhole-line text-slate-500 text-lg w-5 h-5 flex items-center justify-center" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Promo preview cannot run here</p>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{blocked?.message}</p>
                {blocked?.code && <p className="text-[11px] font-mono text-slate-400 mt-2 break-all">{blocked.code}</p>}
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  No test checkout was created and no subscription, entitlement or charge was made.
                </p>
                <button
                  type="button"
                  onClick={load}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 text-slate-800 text-sm font-semibold px-4 py-2.5 whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-refresh-line w-4 h-4 flex items-center justify-center" />
                  Check again
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'ready' && status && (
          <>
            <SandboxStatusPanel status={status} />
            <SandboxPlanButtons
              plans={status.plans}
              pending={pending}
              disabled={!status.eligibility.eligible}
              onSelect={start}
            />
            {message && (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 leading-relaxed">{message}</p>
            )}
          </>
        )}

        <p className="mt-8 text-xs text-slate-400 leading-relaxed">
          The offer closes at 00:00 UK time on 30 December 2026, so 29 December 2026 is the last sign-up day. Separately, Stripe requires at least 48 hours between checkout and the 1 January 2027 first charge, so anything after that minimum lead time is refused explicitly rather than charged early. 30 and 31 December sign-ups are not part of the offer.
        </p>
      </div>
    </main>
  );
}