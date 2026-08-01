'use client';

import { ReactNode } from 'react';

interface VerificationSectionProps {
  icon: string;
  iconColor: string;
  iconTextColor: string;
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export default function VerificationSection({
  icon,
  iconColor,
  iconTextColor,
  title,
  description,
  checked,
  onToggle,
  children,
}: VerificationSectionProps) {
  return (
    <div className="bg-[#111d35] border-2 border-[#1a2b4a] rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${iconColor} rounded-lg flex items-center justify-center`}>
            <i className={`${icon} text-xl ${iconTextColor}`}></i>
          </div>
          <div>
            <h4 className="font-semibold text-white">{title}</h4>
            <p className="text-sm text-slate-400">{description}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
            checked
              ? 'bg-emerald-500/10 text-emerald-400 border-2 border-emerald-500/30'
              : 'bg-[#1a2b4a] text-slate-400 border-2 border-[#1a2b4a] hover:bg-[#243452] hover:text-slate-300'
          }`}
        >
          {checked ? '✓ Confirmed' : 'Confirm'}
        </button>
      </div>
      {children}
    </div>
  );
}