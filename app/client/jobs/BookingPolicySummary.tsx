import Link from 'next/link';
import { CANCELLATION_WINDOWS } from '@/lib/help-content';

const toneText: Record<string, string> = {
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  bad: 'text-red-400',
};

export default function BookingPolicySummary() {
  return (
    <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <i className="ri-file-shield-line text-teal-400"></i>
          Booking policy
        </p>
        <Link
          href="/terms#payments"
          className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors whitespace-nowrap cursor-pointer"
        >
          Payment terms
        </Link>
      </div>

      <div className="space-y-2.5">
        {CANCELLATION_WINDOWS.map((window) => (
          <div key={window.label} className="flex items-start gap-2">
            <div className={`w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5 ${toneText[window.tone] ?? 'text-slate-400'}`}>
              <i className="ri-time-line text-sm"></i>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200">
                {window.label} — <span className={toneText[window.tone] ?? 'text-slate-400'}>{window.outcome}</span>
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">{window.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-[#1e2d4d] flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500">Refund requests are reviewed separately from the cancellation.</p>
        <Link
          href="/help"
          className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors whitespace-nowrap cursor-pointer"
        >
          Refund policy
        </Link>
      </div>
    </div>
  );
}