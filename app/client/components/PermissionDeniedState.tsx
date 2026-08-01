import Link from 'next/link';

interface PermissionDeniedStateProps {
  title?: string;
  message?: string;
  redirectHref?: string;
  redirectLabel?: string;
  compact?: boolean;
}

export default function PermissionDeniedState({
  title = 'Permission Denied',
  message = 'You do not have permission to view this content.',
  redirectHref = '/client/dashboard',
  redirectLabel = 'Go to Dashboard',
  compact = false,
}: PermissionDeniedStateProps) {
  const padding = compact ? 'p-6 md:p-8' : 'p-10 md:p-16';

  return (
    <div className={`bg-[#111d35] rounded-2xl border border-red-500/20 shadow-sm ${padding} text-center`}>
      <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
        <i className="ri-shield-cross-line text-3xl text-red-400"></i>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">{message}</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href={redirectHref}
          className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap w-full sm:w-auto justify-center"
        >
          <i className="ri-arrow-left-line"></i>
          {redirectLabel}
        </Link>
        <Link
          href="/client/support"
          className="inline-flex items-center gap-2 bg-[#162036] text-slate-300 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d] w-full sm:w-auto justify-center"
        >
          <i className="ri-customer-service-2-line"></i>
          Contact Support
        </Link>
      </div>
    </div>
  );
}