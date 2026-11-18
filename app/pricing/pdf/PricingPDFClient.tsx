'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CANCELLATION_GUIDANCE, REFUND_TIMING_GUIDANCE } from '@/lib/customer-guidance';
import { usePublicPricing } from '@/lib/use-public-pricing';
import { bookingFeeText, planAllowanceText } from '@/lib/public-pricing';
import { getFeatureLabel, presentPricingPlan } from '@/lib/pricing-presentation';
import PlanPrice from '@/components/pricing/PlanPrice';

export default function PricingPDFClient() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const catalogue = usePublicPricing();
  const clientPlans = catalogue.plans.filter(plan => plan.audience === 'client').map(plan => ({
    ...presentPricingPlan(plan),
    features: [planAllowanceText(plan), `${bookingFeeText(plan)} booking service fee`, 'Payment processing included', ...plan.features.map(feature => getFeatureLabel(feature, plan.audience))],
    cta: plan.monthly_price_pence === 0 ? 'Get Started Free' : 'View Plans',
  }));
  const guardPlans = catalogue.plans.filter(plan => plan.audience === 'guard').map(plan => ({
    ...presentPricingPlan(plan),
    features: [planAllowanceText(plan), ...plan.features.map(feature => getFeatureLabel(feature, plan.audience))],
    cta: plan.monthly_price_pence === 0 ? 'Create Free Account' : 'View Plans',
    link: plan.monthly_price_pence === 0 ? '/guard/register' : '/pricing',
    isFree: plan.monthly_price_pence === 0,
  }));
  const canPrint = !catalogue.loading && !catalogue.error && !catalogue.feesError;
  const clientFeeSummary = clientPlans.map(plan => `${plan.name}: ${bookingFeeText(plan)}`).join('; ');

  const handlePrint = () => {
    if (canPrint) window.print();
  };

  return (
    <div className="min-h-screen bg-white print:bg-white">
      <div className="max-w-[900px] mx-auto px-8 py-12 print:px-0 print:py-0">
        {/* Print button - hidden when printing */}
        <div className="flex items-center justify-between mb-8 print:hidden">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <i className="ri-arrow-left-line" />
            Back to Pricing
          </Link>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center bg-slate-100 rounded-full p-1 gap-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-slate-900 shadow'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  billingCycle === 'annual'
                    ? 'bg-white text-slate-900 shadow'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Annual
              </button>
            </div>
            <button
              onClick={handlePrint}
            disabled={!canPrint}
              className="inline-flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-teal-700 transition-all whitespace-nowrap cursor-pointer shadow"
            >
              <i className="ri-download-line" />
              Save as PDF
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-12 print:mb-10">
          <div className="flex items-center justify-center gap-3 mb-4 print:mb-2">
            <span className="font-[family-name:var(--font-pacifico)] text-3xl text-teal-600">QuickGuard</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">QuickGuard Pricing Guide</h1>
          <p className="text-slate-500 text-sm">Current catalogue prices for clients and security guards</p>
          <div className="w-24 h-0.5 bg-teal-500 mx-auto mt-4" />
        </div>

        {(catalogue.loading || catalogue.error || catalogue.feesError) && <div role="status" className="mb-8 border border-amber-300 bg-amber-50 rounded-xl p-5 text-amber-900">
          <p>{catalogue.loading ? 'Loading current plans and fees…' : catalogue.error || 'Current booking fees could not be confirmed. Please retry before printing.'}</p>
          {!catalogue.loading && <button type="button" onClick={catalogue.retry} className="underline mt-3 print:hidden">Retry pricing</button>}
        </div>}
        {catalogue.retrievedAt && <p className="text-xs text-slate-500 mb-6">Catalogue retrieved {new Date(catalogue.retrievedAt).toLocaleString('en-GB')}. Prices and eligible offers are confirmed at checkout.</p>}

        {/* Client Plans */}
        <section className="mb-12 print:mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-center">
              <i className="ri-briefcase-line text-xl text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Client Plans</h2>
              <p className="text-sm text-slate-500">For businesses hiring security guards</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 print:gap-4">
            {clientPlans.map((plan) => {
              const isPopular = !!plan.badge;

              return (
                <div
                  key={plan.name}
                  className={`rounded-xl border p-5 print:p-4 print:border-slate-300 ${
                    isPopular ? 'border-teal-500 bg-teal-50/40' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-900">{plan.name}</h3>
                    {isPopular && (
                      <span className="bg-teal-600 text-white text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{plan.description}</p>

                  <div className="mb-4 pb-4 border-b border-slate-200">
                    <PlanPrice plan={plan} billingCycle={billingCycle} print />
                  </div>

                  <ul className="space-y-2">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <i className="ri-check-line text-teal-600 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 print:hidden">
                    {plan.monthly_price_pence === 0 ? (
                      <Link
                        href="/client/register"
                        className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap block text-center bg-slate-100 text-slate-900 hover:bg-slate-200"
                      >
                        {plan.cta}
                      </Link>
                    ) : (
                      <a
                        href="/pricing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap block text-center bg-teal-600 text-white hover:bg-teal-700"
                      >
                        {plan.cta}
                      </a>
                    )}
                    {plan.monthly_price_pence === 0 && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                        <i className="ri-information-line text-amber-600 text-sm flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 leading-relaxed">
                          A service charge applies to all jobs on free accounts. Upgrade to a paid plan for lower fees.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Guard Plans */}
        <section className="mb-12 print:mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center">
              <i className="ri-shield-user-line text-xl text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Guard Membership Plans</h2>
              <p className="text-sm text-slate-500">For security professionals seeking work</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:gap-3">
            {guardPlans.map((plan) => {
              const isPopular = !!plan.badge;

              return (
                <div
                  key={plan.name}
                  className={`rounded-xl border p-4 print:p-3 print:border-slate-300 flex flex-col ${
                    isPopular ? 'border-blue-500 bg-blue-50/40' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <h3 className="font-bold text-slate-900">{plan.name}</h3>
                    {isPopular && (
                      <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{plan.description}</p>

                  <div className="mb-3 pb-3 border-b border-slate-200">
                    <PlanPrice plan={plan} billingCycle={billingCycle} print />
                  </div>

                  <ul className="space-y-1.5 flex-1">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-xs">
                        <i className="ri-check-line text-blue-600 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 print:hidden">
                    <Link
                      href={plan.link}
                      className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap block text-center ${
                        plan.isFree
                          ? 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Guard Hourly Rates */}
        <section className="mb-12 print:mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center">
              <i className="ri-time-line text-xl text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Illustrative Hourly Budgets</h2>
              <p className="text-sm text-slate-500">What clients pay per hour for different security roles</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-5 py-3 font-semibold text-slate-700">Role</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-700">Typical Rate</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-700">Best For</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200">
                  <td className="px-5 py-3 text-slate-900 font-medium">Security Guard</td>
                  <td className="px-5 py-3 text-slate-900 font-semibold">£15 — £18 /hr</td>
                  <td className="px-5 py-3 text-slate-500">Static sites, retail, offices</td>
                </tr>
                <tr className="border-t border-slate-200 bg-slate-50/50">
                  <td className="px-5 py-3 text-slate-900 font-medium">Door Supervisor</td>
                  <td className="px-5 py-3 text-slate-900 font-semibold">£18 — £22 /hr</td>
                  <td className="px-5 py-3 text-slate-500">Bars, clubs, events</td>
                </tr>
                <tr className="border-t border-slate-200">
                  <td className="px-5 py-3 text-slate-900 font-medium">Close Protection</td>
                  <td className="px-5 py-3 text-slate-900 font-semibold">£25 — £40 /hr</td>
                  <td className="px-5 py-3 text-slate-500">VIP, executive, personal security</td>
                </tr>
                <tr className="border-t border-slate-200 bg-slate-50/50">
                  <td className="px-5 py-3 text-slate-900 font-medium">Event Steward</td>
                  <td className="px-5 py-3 text-slate-900 font-semibold">£12 — £15 /hr</td>
                  <td className="px-5 py-3 text-slate-500">Crowd control, festivals</td>
                </tr>
                <tr className="border-t border-slate-200">
                  <td className="px-5 py-3 text-slate-900 font-medium">Residential Concierge</td>
                  <td className="px-5 py-3 text-slate-900 font-semibold">£14 — £17 /hr</td>
                  <td className="px-5 py-3 text-slate-500">Apartments, gated communities</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            These budget ranges are examples, not platform prices or guard quotes. Set your job rate and agree the booking with your selected guard. Client booking service fees: {clientFeeSummary || 'unavailable until current pricing loads'}. Processing is included, and guards keep their full agreed pay.
          </p>
        </section>

        {/* Fees Summary */}
        <section className="mb-12 print:mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center">
              <i className="ri-percent-line text-xl text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Fee Breakdown</h2>
              <p className="text-sm text-slate-500">Transparent breakdown of all charges</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 print:p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 text-sm">For Clients</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Monthly subscription (see plans above)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Guard hourly rate (set per job)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Booking service fee set by your plan: {clientFeeSummary || 'unavailable until current pricing loads'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Any applicable VAT is shown at checkout</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 text-sm">For Guards</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-blue-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Monthly membership (see plans above)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-blue-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Subscribe or cancel anytime</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-blue-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">No deductions from hourly earnings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-blue-600 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Payment held securely until job completion</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Promotions */}
        <section className="mb-12 print:mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-center">
              <i className="ri-gift-line text-xl text-rose-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Membership and Payment Notes</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-5">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-checkbox-circle-line text-teal-600" />
                <span className="font-bold text-teal-800 text-sm">Free Plan Available</span>
              </div>
              <p className="text-sm text-slate-600">
                A free client account has no subscription charge. Your current posting allowance is listed above; guard pay and booking service fees apply when you confirm a booking.
              </p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-5">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-refresh-line text-blue-600" />
                <span className="font-bold text-blue-800 text-sm">Cancellation and Refund Review</span>
              </div>
              <p className="text-sm text-slate-600">
                {CANCELLATION_GUIDANCE} {REFUND_TIMING_GUIDANCE}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-5">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-percent-line text-amber-600" />
                <span className="font-bold text-amber-800 text-sm">Compare Annual Billing</span>
              </div>
              <p className="text-sm text-slate-600">
                Annual and monthly prices are shown above. Compare the configured annual price with 12 monthly payments for your chosen plan; checkout confirms any eligible offer.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-shield-check-line text-emerald-600" />
                <span className="font-bold text-emerald-800 text-sm">No Setup Fees</span>
              </div>
              <p className="text-sm text-slate-600">
                No hidden charges, no setup costs, no contract lock-ins. Cancel anytime.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-8 mt-8 print:mt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-pacifico)] text-xl text-teal-600">QuickGuard</span>
              <span className="text-sm text-slate-400">|</span>
              <span className="text-sm text-slate-500">quickguard.uk</span>
            </div>
            <div className="text-sm text-slate-400">
              Questions? Contact us at <span className="text-slate-600 font-medium">support@quickguard.uk</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center mt-4 print:mt-2">
            All prices shown in GBP. VAT applies where applicable. Prices subject to change. 24/7 support is provided by our AI assistant; issues needing human review can be escalated during business hours. This guide uses the catalogue retrieved for this visit.
          </p>
        </div>
      </div>
    </div>
  );
}