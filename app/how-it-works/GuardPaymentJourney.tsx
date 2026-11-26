import FreeGuardAccount from '@/components/pricing/FreeGuardAccount';
import Link from 'next/link';
import { GUARD_BANK_DEPOSIT_GUIDANCE, GUARD_COMPLETION_GUIDANCE, GUARD_PAYOUT_SETUP_GUIDANCE, GUARD_PAYOUT_SUPPORT_GUIDANCE } from '@/lib/guard-payment-guidance';

const GUARD_POINTS = [
  'Registration, job browsing and applications are free, with no paid membership and no monthly application cap',
  'Paid guard memberships are retired, with no paid job tiers or paid priority in discovery or applicant order',
  'On new bookings the agreed gross guard pay is not reduced by a platform or booking commission',
  'QuickGuard\u2019s service fee is a separate client charge, added to the client total rather than taken from guard pay',
  'Payouts follow the existing Stripe onboarding, account eligibility and release checks',
];

const GUARD_STEPS = [
  { label: 'Set up your payout account', desc: GUARD_PAYOUT_SETUP_GUIDANCE },
  { label: 'The client pays for the booking', desc: 'The client pays through Stripe before the booking is confirmed. Until that payment completes, the selection of guards is provisional.' },
  { label: 'Work the shift, check in and check out', desc: GUARD_COMPLETION_GUIDANCE },
  { label: 'The client approves completion or disputes it', desc: 'The client reviews your completion request and can approve it or raise a dispute. An open dispute or payment issue can pause release while it is reviewed.' },
  { label: 'Release checks, then pay to your Stripe account', desc: 'After approval and the applicable payment, dispute and Stripe account checks, eligible earnings are transferred to your connected Stripe account.' },
  { label: 'Stripe processes your bank deposit', desc: GUARD_BANK_DEPOSIT_GUIDANCE },
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
            Guard job access is free. The agreed gross guard pay and the client subscription and booking service fee are separate amounts.
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
              {GUARD_STEPS.map((step) => (
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