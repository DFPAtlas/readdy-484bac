'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ContextualHelpCardProps {
  title: string;
  tip: string;
  learnMoreHref?: string;
  learnMoreLabel?: string;
  icon?: string;
  variant?: 'default' | 'compact';
}

export default function ContextualHelpCard({
  title,
  tip,
  learnMoreHref,
  learnMoreLabel = 'Learn more',
  icon = 'ri-lightbulb-flash-line',
  variant = 'default',
}: ContextualHelpCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (variant === 'compact') {
    return (
      <div className="bg-teal-500/5 border border-teal-500/15 rounded-xl px-4 py-3 flex items-start gap-3 mb-4">
        <div className="w-7 h-7 bg-teal-500/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-teal-400/20">
          <i className={`${icon} text-teal-400 text-sm`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-300 leading-snug">{tip}</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-300 cursor-pointer flex-shrink-0"
          aria-label="Dismiss"
        >
          <i className="ri-close-line text-sm" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#0e1628] border border-[#1e2d4d] rounded-xl p-5 mb-6 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-300 cursor-pointer"
        aria-label="Dismiss"
      >
        <i className="ri-close-line text-sm" />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-teal-500/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-teal-400/20">
          <i className={`${icon} text-teal-400 text-lg`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white mb-1">{title}</p>
          <p className="text-sm text-slate-400 leading-relaxed">{tip}</p>
          {learnMoreHref && (
            <Link
              href={learnMoreHref}
              className="inline-flex items-center gap-1 text-teal-400 text-sm font-semibold mt-2 hover:underline cursor-pointer"
            >
              {learnMoreLabel} <i className="ri-arrow-right-line text-xs" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}