'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadGuardPromotionSummary, type GuardPromotionSummary } from '@/lib/guard-promotion-summary';

export default function FoundingGuardsOfferClient() {
  const [summary, setSummary] = useState<GuardPromotionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loadGuardPromotionSummary().then(data => { if (active) setSummary(data); }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const tiers = summary ? [
    { name: 'Founding Guard', detail: 'Founding recognition for the earliest eligible approved guards.', remaining: summary.tier1Remaining, cap: summary.tier1Cap },
    { name: 'Early Guard', detail: 'Early-member recognition after the founding allocation.', remaining: summary.tier2Remaining, cap: summary.tier2Cap - summary.tier1Cap },
  ] : [];
  return (
    <main className="min-h-screen bg-[#0B1933] text-white px-6 py-24">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-teal-400">Back to QuickGuard</Link>
        <p className="text-amber-400 mt-10 mb-3 font-semibold">Guard recognition programme</p>
        <h1 className="text-4xl md:text-5xl font-bold mb-6">Join the QuickGuard guard community</h1>
        <p className="text-lg text-slate-300 mb-6">Eligible guards receive founding or early-member recognition when their profile is approved and a signup number is allocated. Allocation depends on the configured limits and availability at approval.</p>
        <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-6 mb-10">
          <h2 className="text-xl font-bold mb-3">Guard pay and membership are separate</h2>
          <p className="text-slate-300">All guards keep their full agreed booking pay with no guard booking commission. Recognition does not grant a free paid membership or a guaranteed search position, job or payout. Free accounts and paid memberships have their own application limits and prices.</p>
          <Link href="/pricing" className="inline-block mt-4 text-teal-300 underline">Compare current membership plans and subscription offers</Link>
        </div>
        {loading ? <p className="text-slate-400">Checking recognition availability…</p> : !summary ? <p role="status" className="text-amber-300">Availability could not be confirmed. Please contact support before relying on a recognition place.</p> : summary.isPaused ? <p role="status" className="text-amber-300">New recognition allocations are paused.</p> : <>
          <div className="grid md:grid-cols-2 gap-6">
            {tiers.map(tier => <section key={tier.name} className="bg-[#111d35] border border-slate-700 rounded-2xl p-6">
              <h2 className="text-2xl font-bold mb-3">{tier.name}</h2>
              <p className="text-slate-300 mb-3">{tier.detail}</p>
              <p className="text-amber-300">{tier.remaining} of {tier.cap} allocation places remain</p>
            </section>)}
          </div>
          <p className="text-slate-400 mt-6">{summary.tier3Active ? 'The legacy Launch Guard recognition window is open until the configured closing date.' : 'The legacy Launch Guard recognition window is closed. It has not been restarted for the forthcoming public launch.'}</p>
        </>}
        <div className="flex flex-wrap gap-4 mt-10">
          <Link href="/guard/register" className="px-6 py-3 bg-teal-500 text-slate-950 font-bold rounded-xl">Create a guard account</Link>
          <Link href="/contact" className="px-6 py-3 border border-slate-600 rounded-xl">Contact support</Link>
        </div>
      </div>
    </main>
  );
}
