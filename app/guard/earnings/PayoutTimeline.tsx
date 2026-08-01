
'use client';
import React from 'react';

interface Payout {
  status?: string;
  payment_status?: string;
  // add other fields as needed
}

interface PayoutTimelineProps {
  payout: Payout;
}

/**
 * Returns the zero‑based index of the active step.
 * - Returns -1 / -2 for special states (held / failed) which are handled separately.
 */
const getActiveStep = (status: string): number => {
  switch (status) {
    case 'completed':
    case 'paid':
      return 4;
    case 'processing':
      return 3;
    case 'initiated':
      return 2;
    case 'client_paid':
      return 1;
    case 'pending':
      return 0;
    case 'held':
      return -1;
    case 'failed':
      return -2;
    default:
      return 0;
  }
};

export default function PayoutTimeline({ payout }: PayoutTimelineProps) {
  // Defensive programming – ensure we always have a status string
  const status = payout?.status ?? payout?.payment_status ?? 'pending';
  const activeStep = getActiveStep(status);
  const isFailed = status === 'failed';
  const isHeld = status === 'held';

  const steps = [
    { key: 'job_completed', label: 'Job Completed', icon: 'ri-briefcase-line' },
    { key: 'client_paid', label: 'Client Paid', icon: 'ri-bank-card-line' },
    { key: 'payout_initiated', label: 'Payout Initiated', icon: 'ri-send-plane-line' },
    { key: 'payout_processing', label: 'Processing', icon: 'ri-loader-4-line' },
    { key: 'payout_completed', label: 'Paid to You', icon: 'ri-check-double-line' },
  ];

  return (
    <div className="relative">
      {(isFailed || isHeld) && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            isFailed ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          <i
            className={`${
              isFailed ? 'ri-close-circle-line' : 'ri-pause-circle-line'
            } text-lg`}
          ></i>
          <span>
            {isFailed
              ? 'This payout has failed. QuickGuard support will contact you.'
              : 'This payout is on hold. Please contact support for details.'}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index <= activeStep && activeStep >= 0;
          const isCurrent = index === activeStep && activeStep >= 0;

          return (
            <div key={step.key} className="flex flex-col items-center relative flex-1">
              {/* connector line */}
              {index < steps.length - 1 && (
                <div
                  className={`absolute top-4 left-1/2 w-full h-0.5 ${
                    index < activeStep && activeStep >= 0 ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                ></div>
              )}

              {/* step circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10
                  ${
                    isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : isActive
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
              >
                <i className={`${step.icon} text-sm`}></i>
              </div>

              {/* label */}
              <span
                className={`text-xs mt-2 text-center ${
                  isCurrent
                    ? 'font-semibold text-blue-600'
                    : isActive
                    ? 'text-green-600'
                    : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
