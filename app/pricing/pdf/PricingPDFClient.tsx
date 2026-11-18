'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PricingPDFClient() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Printable snapshot of the configured GBP catalogue. All checkout uses /pricing.
  const clientPlans = [
    { name: 'Free', monthlyPrice: 0, annualPrice: 0, description: 'For trying the platform', features: ['1 job posting per month', '15% booking service fee', 'Payment processing included'], cta: 'Get Started' },
    { name: 'Starter', monthlyPrice: 49, annualPrice: 490, description: 'For regular security needs', features: ['10 job postings per month', '10% booking service fee', 'Payment processing included'], cta: 'View Plans' },
    { name: 'Pro', monthlyPrice: 99, annualPrice: 990, description: 'For growing businesses', features: ['30 job postings per month', '7.5% booking service fee', 'Payment processing included'], cta: 'View Plans' },
    { name: 'Enterprise', monthlyPrice: 199, annualPrice: 1990, description: 'For enterprise security needs', features: ['Unlimited job postings', '5% booking service fee', 'Payment processing included'], cta: 'View Plans' },
  ];

  const guardPlans = [
    {
      name: 'Free Starter',
      price: 0,
      description: 'For starting your security career',
      features: [
        '2 job applications per month',
        'Access to standard jobs',
        'Job alerts',
        'Verified guard profile',
        'Secure payment processing',
      ],
      cta: 'Create Free Account',
      link: '/guard/register',
      isFree: true,
      popular: false,
    },
    {
      name: 'Guard Basic',
      price: 10,
      description: 'Perfect for getting started',
      features: [
        '10 job applications per month',
        'Access to standard jobs',
        'Job alerts',
        'Verified guard profile',
        'Secure payment processing',
      ],
      cta: 'Get Started',
      link: '/guard/register',
      isFree: false,
      popular: false,
    },
    {
      name: 'Guard Pro',
      price: 19,
      description: 'For active security professionals',
      features: [
        '25 job applications per month',
        'Priority profile placement',
        'Profile boost',
        'Advanced job alerts',
        'Performance analytics',
        'Priority support',
        'Direct client contact',
      ],
      cta: 'Get Started',
      link: '/guard/register',
      isFree: false,
      popular: false,
    },
    {
      name: 'Guard Elite',
      price: 29,
      description: 'Full access to all features',
      features: [
        'Up to 40 applications per month',
        'Priority profile placement',
        'Profile boost',
        'Advanced job alerts',
        'Performance analytics',
        'Priority support',
        'Direct client contact',
      ],
      cta: 'Get Started',
      link: '/guard/register',
      isFree: false,
      popular: true,
    },
  ];

  const calculateSavings = (monthly: number, annual: number) => {
    if (monthly === 0) return 0;
    const monthlyCost = monthly * 12;
    return Math.round(((monthlyCost - annual) / monthlyCost) * 100);
  };

  const handlePrint = () => {
    window.print();
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
            <span className="font-[family-name:var(--font-pacifico)] text-3xl text-teal-600">logo</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">QuickGuard Pricing Guide</h1>
          <p className="text-slate-500 text-sm">Complete pricing for clients and security guards — updated October 2026</p>
          <div className="w-24 h-0.5 bg-teal-500 mx-auto mt-4" />
        </div>

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
              const price = billingCycle === 'monthly' ? plan.monthlyPrice : Math.round(plan.annualPrice / 12);
              const savings = calculateSavings(plan.monthlyPrice, plan.annualPrice);
              const isPopular = plan.name === 'Professional';

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
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{plan.description}</p>

                  <div className="mb-4 pb-4 border-b border-slate-200">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-slate-900">£{price}</span>
                      <span className="text-sm text-slate-500">/month</span>
                    </div>
                    {billingCycle === 'annual' && savings > 0 && (
                      <p className="text-xs text-teal-600 font-semibold mt-1">Save {savings}% annually</p>
                    )}
                    {billingCycle === 'annual' && price > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5">Billed £{plan.annualPrice} per year</p>
                    )}
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
                    {plan.monthlyPrice === 0 ? (
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
                    {plan.monthlyPrice === 0 && (
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
              const isPopular = plan.popular;

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
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{plan.description}</p>

                  <div className="mb-3 pb-3 border-b border-slate-200">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-slate-900">£{plan.price}</span>
                      <span className="text-xs text-slate-500">/month</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {plan.isFree ? 'Free forever — no card needed' : 'Billed monthly · Cancel anytime'}
                    </p>
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
              <h2 className="text-xl font-bold text-slate-900">Typical Guard Hourly Rates</h2>
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
            Rates vary by location, shift length, and urgency. Client booking service fees are Free 15%, Starter 10%, Pro 7.5% and Enterprise 5%. Processing is included, and guards keep their full agreed pay.
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
                    <span className="text-slate-700">Booking service fee set by your plan: Free 15%, Starter 10%, Pro 7.5%, Enterprise 5%</span>
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
              <h2 className="text-xl font-bold text-slate-900">Current Promotions</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-5">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-checkbox-circle-line text-teal-600" />
                <span className="font-bold text-teal-800 text-sm">Free Plan Available</span>
              </div>
              <p className="text-sm text-slate-600">
                Create a free account and publish up to 1 job per month, paying only for each booking. No subscription is required to get started.
              </p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-5">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-refresh-line text-blue-600" />
                <span className="font-bold text-blue-800 text-sm">30-Day Money-Back Guarantee</span>
              </div>
              <p className="text-sm text-slate-600">
                Not satisfied? Get a full refund within 30 days — no questions asked.
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-5">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-percent-line text-amber-600" />
                <span className="font-bold text-amber-800 text-sm">20% Off Annual Billing</span>
              </div>
              <p className="text-sm text-slate-600">
                Pay yearly and save 20% — equivalent to getting over 2 months free.
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
              <span className="font-[family-name:var(--font-pacifico)] text-xl text-teal-600">logo</span>
              <span className="text-sm text-slate-400">|</span>
              <span className="text-sm text-slate-500">quickguard.uk</span>
            </div>
            <div className="text-sm text-slate-400">
              Questions? Contact us at <span className="text-slate-600 font-medium">support@quickguard.uk</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center mt-4 print:mt-2">
            All prices shown in GBP. VAT applies where applicable. Prices subject to change. 24/7 support is provided by our AI assistant; issues needing human review can be escalated during business hours. Last updated October 2026.
          </p>
        </div>
      </div>
    </div>
  );
}