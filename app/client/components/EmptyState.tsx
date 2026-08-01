import Link from 'next/link';

interface EmptyStateProps {
  icon: string;
  iconBgClass?: string;
  iconColorClass?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  actionOnClick?: () => void;
  secondaryLabel?: string;
  secondaryHref?: string;
  secondaryOnClick?: () => void;
  compact?: boolean;
}

export default function EmptyState({
  icon,
  iconBgClass = 'bg-[#162036]',
  iconColorClass = 'text-slate-600',
  title,
  description,
  actionLabel,
  actionHref,
  actionOnClick,
  secondaryLabel,
  secondaryHref,
  secondaryOnClick,
  compact = false,
}: EmptyStateProps) {
  const padding = compact ? 'p-6 md:p-8' : 'p-10 md:p-16';
  const iconSize = compact ? 'text-2xl' : 'text-3xl';
  const iconBoxSize = compact ? 'w-12 h-12' : 'w-16 h-16';
  const titleSize = compact ? 'text-sm' : 'text-lg';

  return (
    <div className={`bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm ${padding} text-center`}>
      <div className={`${iconBoxSize} ${iconBgClass} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
        <i className={`${icon} ${iconSize} ${iconColorClass}`}></i>
      </div>
      <h3 className={`${titleSize} font-semibold text-slate-200 mb-2`}>{title}</h3>
      {description && <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">{description}</p>}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap w-full sm:w-auto justify-center"
          >
            {actionLabel}
          </Link>
        )}
        {actionLabel && actionOnClick && (
          <button
            onClick={actionOnClick}
            className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap w-full sm:w-auto justify-center"
          >
            {actionLabel}
          </button>
        )}
        {secondaryLabel && secondaryHref && (
          <Link
            href={secondaryHref}
            className="inline-flex items-center gap-2 bg-[#162036] text-slate-300 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d] w-full sm:w-auto justify-center"
          >
            {secondaryLabel}
          </Link>
        )}
        {secondaryLabel && secondaryOnClick && (
          <button
            onClick={secondaryOnClick}
            className="inline-flex items-center gap-2 bg-[#162036] text-slate-300 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d] w-full sm:w-auto justify-center"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}