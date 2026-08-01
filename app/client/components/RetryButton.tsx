interface RetryButtonProps {
  onRetry: () => void;
  label?: string;
  className?: string;
  compact?: boolean;
}

export default function RetryButton({
  onRetry,
  label = 'Retry',
  className = '',
  compact = false,
}: RetryButtonProps) {
  return (
    <button
      onClick={onRetry}
      className={`inline-flex items-center gap-2 bg-[#162036] text-teal-400 font-semibold rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d] ${
        compact ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm'
      } ${className}`}
    >
      <i className="ri-refresh-line"></i>
      {label}
    </button>
  );
}