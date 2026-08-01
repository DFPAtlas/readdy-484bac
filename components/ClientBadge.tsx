'use client';

interface ClientBadgeProps {
  tier?: string | null;
  badge?: boolean;
  size?: 'sm' | 'md';
}

export default function ClientBadge({ tier, badge, size = 'sm' }: ClientBadgeProps) {
  if (!tier || tier === 'standard') return null;

  const isSmall = size === 'sm';

  if (tier === 'founding_client' || badge) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold border border-amber-400/30 bg-amber-500/15 text-amber-400 whitespace-nowrap ${
          isSmall ? 'px-2 py-0.5 rounded-full text-xs' : 'px-3 py-1 rounded-lg text-sm'
        }`}
        title="Founding Client — verified early adopter, reliable repeat poster"
      >
        <i className="ri-vip-crown-2-line" />
        {isSmall ? 'Founding' : 'Founding Client'}
      </span>
    );
  }

  if (tier === 'early_client') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold border border-slate-400/30 bg-slate-500/15 text-slate-300 whitespace-nowrap ${
          isSmall ? 'px-2 py-0.5 rounded-full text-xs' : 'px-3 py-1 rounded-lg text-sm'
        }`}
        title="Early Client — joined during the early-adopter window"
      >
        <i className="ri-star-line" />
        {isSmall ? 'Early' : 'Early Client'}
      </span>
    );
  }

  if (tier === 'launch_client') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold border border-teal-400/30 bg-teal-500/15 text-teal-400 whitespace-nowrap ${
          isSmall ? 'px-2 py-0.5 rounded-full text-xs' : 'px-3 py-1 rounded-lg text-sm'
        }`}
        title="Launch Client — joined during the launch window"
      >
        <i className="ri-rocket-line" />
        {isSmall ? 'Launch' : 'Launch Client'}
      </span>
    );
  }

  return null;
}