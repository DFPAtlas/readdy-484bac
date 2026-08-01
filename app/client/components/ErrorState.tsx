import Link from 'next/link';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
  hideSupportLink?: boolean;
}

export default function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load the data. Please try again.',
  onRetry,
  compact = false,
  hideSupportLink = false,
}: ErrorStateProps) {
  const padding = compact ? 'p-6' : 'p-10 md:p-16';
  const iconSize = compact ? 'text-2xl' : 'text-4xl';
  const titleSize = compact ? 'text-sm' : 'text-lg';

  return (
    <div className={`bg-[#111d35] rounded-2xl border border-red-500/20 shadow-sm ${padding} text-center`}>
      <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
        <i className={`ri-error-warning-line ${iconSize} text-red-400`}></i>
      </div>
      <h3 className={`${titleSize} font-semibold text-white mb-2`}>{title}</h3>
      <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">{message}</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d] w-full sm:w-auto justify-center"
          >
            <i className="ri-refresh-line"></i>
            Retry
          </button>
        )}
        {!hideSupportLink && (
          <Link
            href="/client/support"
            className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-red-500/20 transition-colors cursor-pointer whitespace-nowrap border border-red-500/25 w-full sm:w-auto justify-center"
          >
            <i className="ri-customer-service-2-line"></i>
            Contact Support
          </Link>
        )}
      </div>
    </div>
  );
}