'use client';

import BookingStatusBadge from './BookingStatusBadge';

interface JobStatusTrackerProps {
  status: string;
  applicationsCount: number;
  assignedGuards: number;
}

const STEPS = [
  {
    key: 'posted',
    label: 'Posted',
    icon: 'ri-file-list-3-line',
    statuses: ['open', 'pending', 'awaiting_guard_selection'],
  },
  {
    key: 'guards_selected',
    label: 'Guards Selected',
    icon: 'ri-user-follow-line',
    statuses: ['awaiting_payment'],
  },
  {
    key: 'payment',
    label: 'Payment',
    icon: 'ri-secure-payment-line',
    statuses: ['awaiting_client_confirmation'],
  },
  {
    key: 'confirmation',
    label: 'Confirmation',
    icon: 'ri-file-shield-line',
    statuses: ['confirmed'],
  },
  {
    key: 'complete',
    label: 'Complete',
    icon: 'ri-checkbox-circle-line',
    statuses: ['in_progress', 'completed'],
  },
];

export default function JobStatusTracker({ status, applicationsCount, assignedGuards }: JobStatusTrackerProps) {
  const isCancelled = status === 'cancelled';
  const isDisputed = status === 'disputed';

  const getState = (stepIndex: number): 'done' | 'active' | 'pending' => {
    if (isCancelled || isDisputed) return 'pending';
    const statusToActiveStep: Record<string, number> = {
      open: 0,
      pending: 0,
      awaiting_guard_selection: 0,
      awaiting_payment: 1,
      awaiting_client_confirmation: 2,
      confirmed: 3,
      in_progress: 4,
      completed: 4,
    };
    const activeStep = statusToActiveStep[status] ?? 0;
    if (stepIndex < activeStep) return 'done';
    if (stepIndex === activeStep) return 'active';
    return 'pending';
  };

  if (isCancelled) {
    return (
      <div className="mt-4 pt-4 border-t border-[#1e2d4d]">
        <div className="flex items-center gap-2 text-red-500 text-xs font-semibold">
          <i className="ri-close-circle-line text-sm"></i>
          This job has been cancelled
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
              <i className="ri-close-line text-sm text-white"></i>
            </div>
            <span className="text-xs font-semibold text-red-400">Cancelled</span>
          </div>
        </div>
      </div>
    );
  }

  if (isDisputed) {
    return (
      <div className="mt-4 pt-4 border-t border-[#1e2d4d]">
        <div className="flex items-center gap-2 text-orange-500 text-xs font-semibold">
          <i className="ri-shield-flash-line text-sm"></i>
          This job is under dispute
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
              <i className="ri-shield-flash-line text-sm text-white"></i>
            </div>
            <span className="text-xs font-semibold text-orange-400">Disputed</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-[#1e2d4d]">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Job Progress</p>
      <div className="flex items-center w-full">
        {STEPS.map((step, index) => {
          const state = getState(index);
          const isLast = index === STEPS.length - 1;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                    ${state === 'done' ? 'bg-emerald-500 text-white' : ''}
                    ${state === 'active' ? 'bg-teal-500 text-white ring-4 ring-teal-500/20' : ''}
                    ${state === 'pending' ? 'bg-[#162036] text-slate-600' : ''}
                  `}
                >
                  {state === 'done' ? (
                    <i className="ri-check-line text-sm font-bold"></i>
                  ) : (
                    <i className={`${step.icon} text-sm`}></i>
                  )}
                </div>
                <span
                  className={`text-xs font-semibold whitespace-nowrap
                    ${state === 'done' ? 'text-emerald-400' : ''}
                    ${state === 'active' ? 'text-teal-400' : ''}
                    ${state === 'pending' ? 'text-slate-600' : ''}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-all
                  ${state === 'done' ? 'bg-emerald-500/50' : 'bg-[#1e2d4d]'}
                `} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}