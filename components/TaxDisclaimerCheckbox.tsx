'use client';

import { useState } from 'react';

interface TaxDisclaimerCheckboxProps {
  userType: 'guard' | 'client';
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  variant?: 'signup' | 'payment' | 'compact';
}

export default function TaxDisclaimerCheckbox({ userType, accepted, onChange, variant = 'signup' }: TaxDisclaimerCheckboxProps) {
  const [expanded, setExpanded] = useState(false);

  const text = userType === 'guard'
    ? 'By using QuickGuard, you confirm that you are self-employed or responsible for your own tax, National Insurance, VAT, accounting records, and legal reporting obligations. QuickGuard is a marketplace platform, not your employer. QuickGuard does not deduct or pay tax on your behalf unless required by law. All income you receive through QuickGuard is your responsibility to report to HMRC.'
    : 'By using QuickGuard, you confirm that you are responsible for your own business tax, VAT, corporation tax, and accounting obligations. QuickGuard is a marketplace platform that connects you with security guards. Any payments made through QuickGuard are for guard services, and QuickGuard only retains a platform service fee. QuickGuard does not deduct or pay tax on your behalf unless required by law.';

  if (variant === 'compact') {
    return (
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-teal-500 cursor-pointer flex-shrink-0"
        />
        <span className="text-xs text-slate-400 leading-relaxed">
          I confirm I am responsible for my own tax, VAT, and legal reporting.
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setExpanded(!expanded); }}
            className="text-teal-400 hover:text-teal-300 ml-1 underline cursor-pointer"
          >
            {expanded ? 'Less' : 'More'}
          </button>
          {expanded && (
            <span className="block mt-1 text-slate-500">{text}</span>
          )}
        </span>
      </label>
    );
  }

  return (
    <div className={`rounded-xl border ${accepted ? 'border-teal-500/30 bg-teal-500/5' : 'border-amber-500/30 bg-amber-500/5'} p-4`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-slate-700/50">
          <i className="ri-government-line text-amber-400 text-sm" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-200 mb-1">
            Tax & Legal Responsibility
          </p>
          <p className="text-xs text-slate-400 leading-relaxed mb-3">
            {text}
          </p>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => onChange(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-teal-500 flex-shrink-0"
              required
            />
            <span className="text-sm text-slate-300">
              I have read and agree to the tax responsibility statement above.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}