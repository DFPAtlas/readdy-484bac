'use client';

export default function StripeRevenueChart() {
  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
          <i className="ri-bar-chart-grouped-line text-lg"></i>
        </div>
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Revenue Trend</span>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-10 bg-[#0a1628] rounded-xl border border-[#1a2b4a]">
        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-500/5 text-slate-600 mb-3">
          <i className="ri-bar-chart-line text-2xl"></i>
        </div>
        <p className="text-sm text-slate-500 font-medium">Awaiting Stripe data</p>
        <p className="text-[10px] text-slate-600 mt-1">Revenue chart will appear once Stripe is connected</p>
      </div>
    </div>
  );
}