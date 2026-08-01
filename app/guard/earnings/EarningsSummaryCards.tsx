
'use client';
import React from 'react';

interface SummaryProps {
  totalEarned?: number;
  pendingPayouts?: number;
  processingPayouts?: number;
  heldPayouts?: number;
  paidCount?: number;
  pendingCount?: number;
  processingCount?: number;
  heldCount?: number;
}

/**
 * Helper to safely format a number as a currency string.
 * Falls back to "0.00" when the value is undefined, null or not a valid number.
 */
const formatCurrency = (value: number | undefined): string => {
  const num = Number(value);
  if (Number.isNaN(num)) return '0.00';
  return num.toFixed(2);
};

export default function EarningsSummaryCards({
  totalEarned = 0,
  pendingPayouts = 0,
  processingPayouts = 0,
  heldPayouts = 0,
  paidCount = 0,
  pendingCount = 0,
  processingCount = 0,
  heldCount = 0,
}: SummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4d] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -translate-y-8 translate-x-8" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 flex items-center justify-center bg-emerald-500/15 rounded-lg">
              <i className="ri-check-double-line text-xl text-emerald-400" />
            </div>
            <span className="text-sm font-medium text-slate-400">Total Earned</span>
          </div>
          <div className="text-3xl font-bold text-white">£{formatCurrency(totalEarned)}</div>
          <p className="text-xs text-slate-500 mt-1">
            {paidCount} completed payment{paidCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4d] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full -translate-y-8 translate-x-8" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 flex items-center justify-center bg-amber-500/15 rounded-lg">
              <i className="ri-time-line text-xl text-amber-400" />
            </div>
            <span className="text-sm font-medium text-slate-400">Pending</span>
          </div>
          <div className="text-3xl font-bold text-white">£{formatCurrency(pendingPayouts)}</div>
          <p className="text-xs text-slate-500 mt-1">{pendingCount} awaiting payout</p>
        </div>
      </div>

      <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4d] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -translate-y-8 translate-x-8" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 flex items-center justify-center bg-blue-500/15 rounded-lg">
              <i className="ri-loader-4-line text-xl text-blue-400" />
            </div>
            <span className="text-sm font-medium text-slate-400">Processing</span>
          </div>
          <div className="text-3xl font-bold text-white">£{formatCurrency(processingPayouts)}</div>
          <p className="text-xs text-slate-500 mt-1">{processingCount} being transferred</p>
        </div>
      </div>

      <div className="bg-[#111d35] rounded-xl p-6 border border-[#1e2d4d] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full -translate-y-8 translate-x-8" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 flex items-center justify-center bg-red-500/15 rounded-lg">
              <i className="ri-error-warning-line text-xl text-red-400" />
            </div>
            <span className="text-sm font-medium text-slate-400">On Hold</span>
          </div>
          <div className="text-3xl font-bold text-white">£{formatCurrency(heldPayouts)}</div>
          <p className="text-xs text-slate-500 mt-1">
            {heldCount} held payment{heldCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
