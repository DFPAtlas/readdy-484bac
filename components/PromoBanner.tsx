'use client';

interface PromoBannerProps {
  clientTier?: string | null;
  signupNumber?: number | null;
  promoEndsAt?: string | null;
  jobsRemaining?: number | null;
  lifetimeDiscount?: number | null;
  foundingBadge?: boolean;
  globalCounts?: {
    founding: number;
    early: number;
    launch: number;
    caps?: { tier1: number; tier2: number; tier3: number };
    tier3WindowEnd?: string;
  };
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export default function PromoBanner({
  clientTier,
  signupNumber,
  promoEndsAt,
  jobsRemaining,
  lifetimeDiscount,
  foundingBadge,
  globalCounts,
}: PromoBannerProps) {
  if (clientTier === 'standard') return null;
  if (clientTier === 'founding_client') {
    const end = promoEndsAt ? new Date(promoEndsAt) : null;
    const daysLeft = end ? daysBetween(new Date(), end) : null;
    const num = signupNumber ? String(signupNumber).padStart(3, '0') : '';
    return (
      <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl p-4 mb-6 flex items-start gap-3">
        <div className="w-10 h-10 flex items-center justify-center bg-amber-500/15 border border-amber-400/25 rounded-lg flex-shrink-0">
          <i className="ri-vip-crown-2-line text-amber-400 text-xl" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-400">
            Founding Client #{num}
          </p>
          <p className="text-sm text-slate-400">
            {daysLeft !== null && daysLeft > 0
              ? `${daysLeft}d remaining on zero fees. Lifetime ${Math.round((lifetimeDiscount || 0) * 100)}% off after.`
              : `Lifetime ${Math.round((lifetimeDiscount || 0) * 100)}% discount active.`}
          </p>
        </div>
        {foundingBadge && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-400/30 whitespace-nowrap">
            <i className="ri-shield-star-line" />
            Badge Active
          </span>
        )}
      </div>
    );
  }

  if (clientTier === 'early_client') {
    const end = promoEndsAt ? new Date(promoEndsAt) : null;
    const daysLeft = end ? daysBetween(new Date(), end) : null;
    return (
      <div className="bg-slate-500/10 border border-slate-400/20 rounded-xl p-4 mb-6 flex items-start gap-3">
        <div className="w-10 h-10 flex items-center justify-center bg-slate-500/15 border border-slate-400/25 rounded-lg flex-shrink-0">
          <i className="ri-star-line text-slate-300 text-xl" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-300">
            Early Client Offer
          </p>
          <p className="text-sm text-slate-400">
            {daysLeft !== null && daysLeft > 0
              ? `${daysLeft} days remaining on zero fees.`
              : 'Zero-fee period ended. Standard rates apply.'}
          </p>
        </div>
      </div>
    );
  }

  if (clientTier === 'launch_client') {
    const remaining = jobsRemaining ?? 0;
    const windowEnd = globalCounts?.tier3WindowEnd
      ? daysBetween(new Date(), new Date(globalCounts.tier3WindowEnd))
      : null;
    return (
      <div className="bg-teal-500/10 border border-teal-400/20 rounded-xl p-4 mb-6 flex items-start gap-3">
        <div className="w-10 h-10 flex items-center justify-center bg-teal-500/15 border border-teal-400/25 rounded-lg flex-shrink-0">
          <i className="ri-rocket-line text-teal-400 text-xl" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-teal-400">
            Launch Promo
          </p>
          <p className="text-sm text-slate-400">
            {remaining > 0
              ? `${remaining} free ${remaining === 1 ? 'job' : 'jobs'} remaining${windowEnd !== null && windowEnd > 0 ? ` · ${windowEnd} days left in launch window` : ''}.`
              : 'Launch promo used. Standard rates apply.'}
          </p>
        </div>
      </div>
    );
  }

  // Public / non-tiered: show live counter
  const caps = globalCounts?.caps ?? { tier1: 50, tier2: 250, tier3: 1000 };
  const counts = globalCounts ?? { founding: 0, early: 0, launch: 0 };
  const t1Left = Math.max(0, caps.tier1 - (counts.founding || 0));
  const t2Left = Math.max(0, caps.tier2 - (counts.early || 0));

  if (t1Left > 0) {
    return (
      <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl p-4 mb-6 flex items-start gap-3">
        <div className="w-10 h-10 flex items-center justify-center bg-amber-500/15 border border-amber-400/25 rounded-lg flex-shrink-0">
          <i className="ri-rocket-line text-amber-400 text-xl" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-400">
            Founding Client offer — {caps.tier1 - t1Left}/{caps.tier1} spots taken
          </p>
          <p className="text-sm text-slate-400">
            6 months zero fees + {Math.round((lifetimeDiscount ?? 0.5) * 100)}% off forever. Activate on your first paid job.
          </p>
        </div>
        {t1Left <= 10 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-400/30 whitespace-nowrap">
            <i className="ri-alarm-warning-line" />
            {t1Left} left
          </span>
        )}
      </div>
    );
  }

  if (t2Left > 0) {
    return (
      <div className="bg-slate-500/10 border border-slate-400/20 rounded-xl p-4 mb-6 flex items-start gap-3">
        <div className="w-10 h-10 flex items-center justify-center bg-slate-500/15 border border-slate-400/25 rounded-lg flex-shrink-0">
          <i className="ri-star-line text-slate-300 text-xl" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-300">
            Early Client offer — {caps.tier2 - t2Left}/{caps.tier2} spots taken
          </p>
          <p className="text-sm text-slate-400">
            3 months zero fees. Activate on your first paid job.
          </p>
        </div>
      </div>
    );
  }

  return null;
}