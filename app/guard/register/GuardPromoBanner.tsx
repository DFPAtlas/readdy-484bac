'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadGuardPromotionSummary, type GuardPromotionSummary } from '@/lib/guard-promotion-summary';

export default function GuardPromoBanner() {
  const [summary, setSummary] = useState<GuardPromotionSummary | null>(null);
  useEffect(() => {
    let active = true;
    loadGuardPromotionSummary().then(data => { if (active) setSummary(data); }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!summary || summary.isPaused || (!summary.tier1Remaining && !summary.tier2Remaining && !summary.tier3Active)) return null;
  return <aside className="mb-6 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-slate-300">
    <p className="font-semibold text-amber-300 mb-2">Early guard recognition</p>
    <p>Recognition places are allocated when an eligible guard is approved. Recognition does not waive paid membership charges. All guards keep their full agreed booking pay with no guard commission.</p>
    <Link href="/founding-guards-offer" className="inline-block mt-2 text-amber-300 underline">Check recognition availability and terms</Link>
  </aside>;
}
