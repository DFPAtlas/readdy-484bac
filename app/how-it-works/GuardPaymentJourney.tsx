const GUARD_POINTS = [
  'You receive your full agreed pay on new bookings',
  'QuickGuard does not deduct a guard booking commission',
  'Guard membership is separate from your earnings',
  'Standard payout costs are covered by the client booking service fee',
  'Payouts follow the existing Stripe onboarding and account eligibility checks',
];

const GUARD_PLANS = [
  { tier: 'Basic', price: '£10/month or £100/year' },
  { tier: 'Pro', price: '£19/month or £190/year' },
  { tier: 'Elite', price: '£29/month or £290/year' },
];

export default function GuardPaymentJourney() {
  return (
    <section className="py-24 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="guard-journey-heading">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <i className="ri-shield-user-line" />
            Guard Payments
          </div>
          <h2 id="guard-journey-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
            How Guard Payments Work
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Guards are paid for the work they do — membership and earnings are two separate things.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <ul className="space-y-4 list-none p-0 m-0">
              {GUARD_POINTS.map((item) => (
                <li key={item} className="flex items-start gap-3 bg-[#111d35] border border-slate-700/50 rounded-2xl p-5">
                  <i className="ri-check-line text-teal-400 mt-0.5" />
                  <span className="text-sm text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-slate-400 leading-relaxed">
              Guard payment is released after completion, subject to the existing confirmation, dispute and payout process.
              We do not promise instant payouts or fixed payout deadlines.
            </p>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-7 h-full">
              <h3 className="text-lg font-semibold text-white mb-2">Guard memberships</h3>
              <p className="text-sm text-slate-400 mb-5">Optional paid memberships, separate from what you earn on bookings.</p>
              <ul className="space-y-3 list-none p-0 m-0">
                {GUARD_PLANS.map((plan) => (
                  <li key={plan.tier} className="flex items-center justify-between gap-3 border-b border-slate-800/60 pb-3 last:border-0 last:pb-0">
                    <span className="text-sm font-semibold text-white whitespace-nowrap">{plan.tier}</span>
                    <span className="text-sm text-teal-400 whitespace-nowrap">{plan.price}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}