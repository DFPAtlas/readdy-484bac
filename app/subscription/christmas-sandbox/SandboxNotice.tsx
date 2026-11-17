export default function SandboxNotice() {
  const terms = [
    { icon: 'ri-calendar-line', label: 'Offer window', value: '24 Nov to 29 Dec 2026, last sign-up day (UK time)' },
    { icon: 'ri-wallet-3-line', label: 'Due today', value: '£0 with a payment method on file' },
    { icon: 'ri-calendar-check-line', label: 'First regular payment', value: '1 January 2027 (UK time)' },
    { icon: 'ri-user-star-line', label: 'Who qualifies', value: 'New monthly Guard Pro (£19) and Client Pro (£99)' },
  ];

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 mb-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-amber-400/20 flex items-center justify-center flex-shrink-0">
          <i className="ri-flask-line text-amber-700 text-lg w-5 h-5 flex items-center justify-center" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900">Test only — nothing here touches the live site</p>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            This preview only runs when the isolated test project and the QuickGuard sandbox Stripe account are both confirmed in test mode. If either check fails, the preview tells you and starts nothing.
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {terms.map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-xl bg-white/70 border border-amber-200 px-3 py-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <i className={`${item.icon} text-amber-700 text-sm w-4 h-4 flex items-center justify-center`} />
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] uppercase tracking-wide text-amber-700">{item.label}</dt>
              <dd className="text-xs font-medium text-amber-900 truncate">{item.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}