import type { ReactNode } from 'react';

interface AdminPageShellProps {
  title: string;
  description?: string;
  eyebrow?: string;
  status?: ReactNode;
  actions?: ReactNode;
  kpis?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  maxWidthClassName?: string;
  contentClassName?: string;
}

export default function AdminPageShell({
  title,
  description,
  eyebrow,
  status,
  actions,
  kpis,
  filters,
  children,
  maxWidthClassName = 'max-w-7xl',
  contentClassName = 'space-y-6',
}: AdminPageShellProps) {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/90 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className={`${maxWidthClassName} mx-auto px-5 sm:px-8`}>
          <div className="min-h-16 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {eyebrow && (
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-400 mb-1">
                  {eyebrow}
                </p>
              )}
              <div className="flex items-center gap-2.5 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                  {title}
                </h1>
                {status}
              </div>
              {description && (
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
                  {description}
                </p>
              )}
            </div>

            {actions && (
              <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                {actions}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={`${maxWidthClassName} mx-auto px-5 sm:px-8 py-6 sm:py-8 ${contentClassName}`}>
        {kpis && (
          <section aria-label="Key metrics">
            {kpis}
          </section>
        )}

        {filters && (
          <section
            aria-label="Filters and controls"
            className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-3 sm:p-4"
          >
            {filters}
          </section>
        )}

        <section>
          {children}
        </section>
      </main>
    </div>
  );
}
