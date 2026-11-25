import FreeGuardAccount from '@/components/pricing/FreeGuardAccount';
import Link from 'next/link';
import { GUARD_PAYMENT_STEPS, GUARD_PAYOUT_SUPPORT_GUIDANCE } from '@/lib/guard-payment-guidance';

const GUARD_POINTS = [
  'You receive your full agreed pay on new bookings',
  'QuickGuard does not deduct a guard booking commission',
  'Guard profiles, job browsing and applications are free',
  'Standard payout costs are covered by the client booking service fee',
  'Payouts follow the existing Stripe onboarding and account eligibility checks',
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
            Guard job access is free. Agreed gross guard pay and client subscription/service fees are shown separately.
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
            <ol className="mt-8 space-y-4 list-decimal pl-5 text-slate-300">
              {GUARD_PAYMENT_STEPS.map((step) => (
                <li key={step.label} className="pl-2">
                  <h3 className="font-semibold text-white">{step.label}</h3>
                  <p className="mt-1 text-sm text-slate-400 leading-relaxed">{step.desc}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-slate-400 leading-relaxed">
              {GUARD_PAYOUT_SUPPORT_GUIDANCE}
            </p>
            <Link href="/guide/guard#step-04" className="inline-block mt-4 text-sm text-teal-400 underline">Read the guard payout guide</Link>
          </div>

          <div className="lg:col-span-2">
            <FreeGuardAccount />
          </div>
        </div>
      </div>
    </section>
  );
}
