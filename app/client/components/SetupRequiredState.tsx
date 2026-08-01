import Link from 'next/link';

interface SetupStep {
  label: string;
  completed: boolean;
  href: string;
}

interface SetupRequiredStateProps {
  title?: string;
  message?: string;
  steps: SetupStep[];
  compact?: boolean;
}

export default function SetupRequiredState({
  title = 'Setup Required',
  message = 'Complete the steps below to unlock full access.',
  steps,
  compact = false,
}: SetupRequiredStateProps) {
  const padding = compact ? 'p-6 md:p-8' : 'p-10 md:p-16';
  const incomplete = steps.filter((s) => !s.completed);

  return (
    <div className={`bg-[#111d35] rounded-2xl border border-amber-500/20 shadow-sm ${padding}`}>
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
          <i className="ri-settings-3-line text-3xl text-amber-400"></i>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-slate-500 text-sm max-w-md mx-auto">{message}</p>
      </div>

      <div className="max-w-md mx-auto space-y-3">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`flex items-center gap-3 p-3 rounded-xl border ${
              step.completed
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-[#162036] border-[#1e2d4d]'
            }`}
          >
            <div
              className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ${
                step.completed
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              <i
                className={`${step.completed ? 'ri-check-line' : 'ri-close-line'} text-sm`}
              ></i>
            </div>
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  step.completed ? 'text-emerald-400 line-through' : 'text-slate-300'
                }`}
              >
                {step.label}
              </p>
            </div>
            {!step.completed && (
              <Link
                href={step.href}
                className="text-xs font-semibold text-teal-400 hover:text-teal-300 cursor-pointer whitespace-nowrap"
              >
                Complete
              </Link>
            )}
          </div>
        ))}
      </div>

      {incomplete.length > 0 && (
        <div className="mt-6 text-center">
          <Link
            href={incomplete[0].href}
            className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-right-line"></i>
            Continue Setup
          </Link>
        </div>
      )}
    </div>
  );
}