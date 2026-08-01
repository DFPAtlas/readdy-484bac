'use client';

export default function StripeFinanceWidget() {
  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
          <i className="ri-bank-card-line text-lg"></i>
        </div>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Finance</span>
      </div>
      <div className="space-y-3">
        {[
          { label: 'Monthly Revenue', icon: 'ri-line-chart-line' },
          { label: 'Active Subscriptions', icon: 'ri-user-star-line' },
          { label: 'Churn Rate', icon: 'ri-user-unfollow-line' },
          { label: 'MRR', icon: 'ri-funds-line' },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between bg-[#0a1628] rounded-xl px-4 py-3 border border-[#1a2b4a]">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center text-slate-600">
                <i className={item.icon + ' text-xs'}></i>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">{item.label}</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium text-slate-600 bg-slate-500/5 border border-slate-500/10">
              <div className="w-3 h-3 flex items-center justify-center">
                <i className="ri-time-line text-[9px]"></i>
              </div>
              Awaiting Stripe data
            </span>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-slate-600 mt-3 text-center">
        Stripe connection required for live finance data
      </p>
    </div>
  );
}