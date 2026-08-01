import Link from 'next/link';

interface DashboardSectionProps {
  title: string;
  icon?: string;
  iconBg?: string;
  iconColor?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}

export default function DashboardSection({
  title,
  icon,
  iconBg = 'bg-teal-500/15',
  iconColor = 'text-teal-400',
  viewAllHref,
  viewAllLabel = 'View All',
  children,
  className = '',
  headerRight,
}: DashboardSectionProps) {
  return (
    <div className={`bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          {icon && (
            <div className={`w-7 h-7 flex items-center justify-center ${iconBg} rounded-lg`}>
              <i className={`${icon} text-sm ${iconColor}`}></i>
            </div>
          )}
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {headerRight}
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-sm text-teal-500 dark:text-teal-400 font-semibold hover:underline cursor-pointer whitespace-nowrap"
            >
              {viewAllLabel}
            </Link>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}