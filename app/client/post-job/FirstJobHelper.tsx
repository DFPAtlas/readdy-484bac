'use client';

import { useState } from 'react';

interface FirstJobHelperProps {
  step: number;
}

const stepTips: Record<number, { title: string; tip: string; example: string }> = {
  1: {
    title: 'Job Title Tip',
    tip: 'Be specific so guards know exactly what you need. Include the venue type and shift context.',
    example: 'e.g., "Door Supervisor for Friday Nightclub Event" or "Retail Security Guard for Shopping Centre"',
  },
  2: {
    title: 'Site Instructions Tip',
    tip: 'Guards need clear directions. Include parking, entry points, and any access codes.',
    example: 'e.g., "Park in rear staff car park. Enter via loading bay door. Check in with duty manager at reception."',
  },
  3: {
    title: 'Shift Times Tip',
    tip: 'Double-check your start and end times. Guards will use these to plan travel.',
    example: 'e.g., Start 21:00, End 03:00 for a nightclub event. Include break info if applicable.',
  },
  4: {
    title: 'Requirements Tip',
    tip: 'Select the right SIA licence type for the role. This filters applicants automatically.',
    example: 'e.g., Door Supervisor for bars/clubs, Security Guard for retail, CCTV Operator for control rooms.',
  },
  5: {
    title: 'Pay & Budget Tip',
    tip: 'Competitive rates attract better applicants faster. UK security rates typically range £12–£18/hr.',
    example: 'e.g., £15.00/hr for a Door Supervisor in London. Minimum rate is £10.00/hr.',
  },
  6: {
    title: 'Review Tip',
    tip: 'Check everything before posting. You can save as a draft or template for future use.',
    example: 'Once posted, guards will be notified and can apply within minutes.',
  },
};

export default function FirstJobHelper({ step }: FirstJobHelperProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || step < 1 || step > 6) return null;

  const info = stepTips[step];
  if (!info) return null;

  return (
    <div className="mb-4 bg-teal-500/10 border border-teal-500/20 rounded-xl p-4 flex items-start gap-3">
      <div className="w-8 h-8 bg-teal-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
        <i className="ri-lightbulb-line text-teal-500 text-sm"></i>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-teal-700 dark:text-teal-400">{info.title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{info.tip}</p>
        <p className="text-xs text-teal-600 dark:text-teal-400 mt-1 italic">{info.example}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer flex-shrink-0"
      >
        <i className="ri-close-line text-sm"></i>
      </button>
    </div>
  );
}