'use client';

import { GuardVerification } from './types';

interface AvailabilitySectionProps {
  guard: GuardVerification;
}

export default function AvailabilitySection({ guard }: AvailabilitySectionProps) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <span className="text-slate-400">Available Days:</span>
        <div className="flex flex-wrap gap-2 mt-2">
          {guard.available_days && guard.available_days.length > 0 ? (
            guard.available_days.map(day => (
              <span key={day} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-medium">
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </span>
            ))
          ) : (
            <span className="text-slate-500">Not specified</span>
          )}
        </div>
      </div>
      <div>
        <span className="text-slate-400">Working Hours:</span>
        <p className="font-medium text-slate-200">
          {guard.available_hours_from && guard.available_hours_to
            ? `${guard.available_hours_from} - ${guard.available_hours_to}`
            : 'Not specified'}
        </p>
      </div>
    </div>
  );
}