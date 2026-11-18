'use client';

import { CANCELLATION_GUIDANCE, GUARD_CANCELLATION_GUIDANCE, REFUND_TIMING_GUIDANCE, OVERRUN_GUIDANCE } from '@/lib/customer-guidance';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import NavSidebar from '@/components/NavSidebar';
import PricingBreadcrumb from './PricingBreadcrumb';
import { supabase } from '@/lib/supabase';
import { calculatePaygFees, formatCurrency } from '@/lib/payg-fees';
import { usePublicPricing } from '@/lib/use-public-pricing';
import { subscriptionPrice, bookingFeeText, type PublicPricingPlan } from '@/lib/public-pricing';
import { getFeatureLabel, presentPricingPlan } from '@/lib/pricing-presentation';
import PlanPrice from '@/components/pricing/PlanPrice';

interface Plan extends PublicPricingPlan { badge?: string; limitations?: string[]; }

export default function PricingClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const catalogue = usePublicPricing();
  const clientPlans = catalogue.plans.filter(plan => plan.audience === 'client').map(presentPricingPlan);
  const guardPlans = catalogue.plans.filter(plan => plan.audience === 'guard').map(presentPricingPlan);
  const freePlan = clientPlans.find(plan => plan.slug === 'client_free');
  const paygServiceFeePct = freePlan?.bookingFee ?? null;
  const paygFixedFeePence = freePlan?.bookingFeeFixedPence ?? 0;
  const pricingError = !!catalogue.error || catalogue.feesError;
  const plansLoading = catalogue.loading;
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string; role: 'guard' | 'client' | null } | null>(null);
  const [switchSuccess, setSwitchSuccess] = useState<{ oldPlanName: string; newPlanName: string } | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(0);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setUser(null); return; }
      let role: 'guard' | 'client' | null = null;
      const userType = user.user_metadata?.user_type;
      if (userType === 'guard') role = 'guard';
      else if (userType === 'client') role = 'client';
      else {
        const { data: guardData } = await supabase.from('guards').select('id').eq('user_id', user.id).maybeSingle();
        if (guardData) { role = 'guard'; }
        else {
          const { data: clientData } = await supabase.from('clients').select('id').eq('user_id', user.id).maybeSingle();
          if (clientData) { role = 'client'; }
        }
      }
      setUser({ id: user.id, email: user.email!, role });
    };
    checkUser();
  }, []);

  useEffect(() => {
    if (redirectCountdown <= 0) return;
    const timer = setTimeout(() => {
      if (redirectCountdown === 1) {
        window.location.href = user?.role === 'guard' ? '/guard/dashboard' : '/client/dashboard';
      } else {
        setRedirectCountdown(prev => prev - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [redirectCountdown, user]);

  const handleSubscribe = async (plan: Plan) => {
    const isGuardPlan = plan.audience === 'guard';
    const requiredRole = isGuardPlan ? 'guard' : 'client';

    if (!user) {
      window.location.href = isGuardPlan ? '/guard/register' : '/client/register';
      return;
    }
    if (user.role !== requiredRole) {
      const msg = isGuardPlan
        ? 'Please log in as a security guard to subscribe to guard plans.'
        : 'Please log in as a client to subscribe to client plans.';
      alert(msg);
      return;
    }

    if (plan.monthly_price_pence === 0) {
      alert('This is a free plan and does not require Stripe checkout.');
      return;
    }

    setSubscribingPlan(plan.slug);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;
      if (!accessToken) {
        alert('Your session has expired. Please log in again.');
        setSubscribingPlan(null);
        return;
      }

      const basePath = window.location.pathname.replace(/\/(pricing|upgrade).*$/, '');
      const siteUrl = window.location.origin + basePath;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-subscription-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            userId: user.id,
            userEmail: user.email,
            accountType: plan.audience,
            planId: plan.slug,
            billingCycle,
            siteUrl,
          }),
        }
      );
      const data = await response.json();
      if (data.switched) {
        setSubscribingPlan(null);
        setSwitchSuccess({ oldPlanName: data.oldPlanName || 'previous plan', newPlanName: data.newPlanName || plan.name });
        setRedirectCountdown(3);
      } else if (data.url) {
        window.open(data.url, '_blank');
      } else {
        alert(data.error || 'Payment setup failed. Please try again.');
      }
    } catch {
      alert('Payment setup failed. Please try again.');
    } finally {
      setSubscribingPlan(null);
    }
  };

  const example = paygServiceFeePct == null ? null : calculatePaygFees({
    hourlyRate: 18,
    hours: 8,
    numberOfGuards: 1,
    numberOfDays: 1,
    serviceFeePct: paygServiceFeePct,
    serviceFeeFixedPence: paygFixedFeePence,
  });

  const faqs = [
    { question: 'When am I charged?', answer: 'Posting a job does not charge the booking payment. Once you have reviewed applicants and selected your guards, you review the agreed guard pay, your plan’s service fee and any eligible promotion, then pay securely through Stripe before the booking is confirmed. Funds are held with Stripe and released to the guard after completion and the applicable release checks.' },
    { question: 'What if a guard cancels?', answer: `${GUARD_CANCELLATION_GUIDANCE} ${REFUND_TIMING_GUIDANCE}` },
    { question: 'What if I cancel the job?', answer: `${CANCELLATION_GUIDANCE} ${REFUND_TIMING_GUIDANCE}` },
    { question: 'Is there a contract or minimum commitment?', answer: 'A free account has no subscription charge; booking payments and service fees still apply. Paid subscriptions renew monthly or annually. You can cancel renewal at any time, with cancellation taking effect at the end of your current billing period. Annual plans are paid upfront for 12 months. Access continues until the period ends; unused time is not refunded unless required by law.' },
    { question: 'Can I change my subscription plan?', answer: 'You can switch between paid plans. Successful changes take effect immediately, and Stripe calculates a prorated charge or account credit for the remaining billing period. A credit is not an automatic cash refund. To stop renewal, use your billing settings or contact support.' },
    { question: 'What happens if no guard accepts my job?', answer: 'Posting a job does not charge the booking payment. You pay only after selecting guards and reviewing the booking total, so an unfilled, unpaid job has no booking payment to refund. If you have already paid and a selected guard can no longer attend, contact support for a cancellation and refund review.' },
    { question: 'Do guards get paid differently depending on my plan?', answer: 'No. Guards always receive their posted hourly rate multiplied by the hours worked. The service fee is separate and does not reduce guard pay.' },
    { question: 'How do you handle overruns?', answer: OVERRUN_GUIDANCE },
  ];

  const renderPlanCard = (plan: Plan, index: number, accentColor: string) => {
    const priceAvailable = subscriptionPrice(plan, billingCycle) !== null;
    const isPopular = !!plan.badge;
    const borderColor = accentColor === 'teal' ? 'border-teal-500' : 'border-blue-500';
    const textColor = accentColor === 'teal' ? 'text-teal-400' : 'text-blue-400';
    const bgColor = accentColor === 'teal' ? 'bg-teal-500' : 'bg-blue-500';
    const hoverBg = accentColor === 'teal' ? 'hover:bg-teal-400' : 'hover:bg-blue-400';
    const iconColor = accentColor === 'teal' ? 'text-teal-600' : 'text-blue-600';
    const iconBg = accentColor === 'teal' ? 'bg-teal-100' : 'bg-blue-100';

    return (
      <div
        key={plan.slug}
        className={`relative bg-[#111d35] rounded-2xl border flex flex-col ${isPopular ? 'overflow-visible' : 'overflow-hidden'} transition-all hover:shadow-2xl ${
          isPopular ? `${borderColor} shadow-xl scale-[1.03] z-10` : 'border-slate-700/50 hover:border-slate-600'
        }`}
      >
        {isPopular && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
            <span className={`${bgColor} text-white px-5 py-1.5 rounded-full text-xs font-bold shadow-lg whitespace-nowrap`}>
              {plan.badge}
            </span>
          </div>
        )}

        <div className="p-8 flex-grow">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
              <i className={`${accentColor === 'teal' ? 'ri-building-line' : 'ri-shield-user-line'} text-xl ${iconColor}`} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
            </div>
          </div>
          <p className="text-slate-400 mb-6 text-sm">{plan.description}</p>
          <p className="text-sm text-teal-400 mb-4">{plan.audience === "client" ? (plan.bookingFee != null ? `${bookingFeeText(plan)} booking service fee, in addition to guard pay. Payment processing included.` : "Service fee shown before you confirm payment.") : "Keep your full agreed pay. No guard commission. Standard payouts included."}</p>

          <div className="mb-6">
            <PlanPrice plan={plan} billingCycle={billingCycle} />
            {plan.monthly_price_pence === 0 && plan.audience === 'client' && (
              <div className="mt-3 bg-amber-500/10 border border-amber-400/20 rounded-xl p-3 flex items-start gap-2.5">
                <i className="ri-information-line text-amber-400 text-sm flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">
                  No subscription charge. Booking service fees apply when you pay for a booking. Paid client plans have lower standard service fees; eligible promotions may reduce them.
                </p>
              </div>
            )}
          </div>

          <ul className="space-y-2.5 text-sm">
            {plan.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <i className={`ri-checkbox-circle-fill ${textColor} flex-shrink-0 mt-0.5`} />
                <span className="text-slate-300">{getFeatureLabel(f, plan.audience)}</span>
              </li>
            ))}
            {plan.limitations?.map((l, i) => (
              <li key={`lim-${i}`} className="flex items-start gap-2.5 opacity-40">
                <i className="ri-close-circle-line text-slate-500 flex-shrink-0 mt-0.5" />
                <span className="text-slate-400">{l}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-8 pt-0">
          {plan.monthly_price_pence === 0 ? (
            <Link
              href={plan.audience === 'guard' ? '/guard/register' : '/client/register'}
              className="w-full py-3.5 rounded-xl font-bold text-base transition-all whitespace-nowrap block text-center bg-slate-700 text-white hover:bg-slate-600 border border-slate-600"
            >
              Get Started Free
            </Link>
          ) : (
            <button
              onClick={() => handleSubscribe(plan)}
              disabled={subscribingPlan === plan.slug || !priceAvailable}
              className={`w-full py-3.5 rounded-xl font-bold text-base transition-all whitespace-nowrap block text-center ${bgColor} text-white ${hoverBg} shadow-lg ${
                subscribingPlan === plan.slug || !priceAvailable ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {subscribingPlan === plan.slug ? 'Processing...' : 'Subscribe'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />

      <main>
        {switchSuccess && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111d35] rounded-2xl border border-emerald-500/30 shadow-2xl max-w-md w-full p-6 text-center">
              <div className="w-16 h-16 bg-emerald-500/15 rounded-2xl border border-emerald-400/25 flex items-center justify-center mx-auto mb-4">
                <i className="ri-check-line text-3xl text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Plan Changed!</h3>
              <p className="text-slate-400 text-sm mb-4">
                Switched from <span className="text-slate-300 font-semibold">{switchSuccess.oldPlanName}</span> to{' '}
                <span className="text-emerald-400 font-semibold">{switchSuccess.newPlanName}</span>.
              </p>
              <p className="text-slate-500 text-xs mb-6">
                Prorated billing applied. Check your Stripe invoice for any charge or account credit. Returning to dashboard in {redirectCountdown}...
              </p>
              <button
                onClick={() => { window.location.href = user?.role === 'guard' ? '/guard/dashboard' : '/client/dashboard'; }}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition-colors whitespace-nowrap cursor-pointer"
              >
                Go to Dashboard Now
              </button>
            </div>
          </div>
        )}

        <PricingBreadcrumb />
        {/* HERO */}
        <div className="relative bg-gradient-to-br from-[#0e1628] via-[#0B1933] to-[#111d35] pt-10 pb-20 border-b border-slate-800/60">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-7xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <i className="ri-shield-check-line" />
              Transparent UK Pricing
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
              Simple plans. No surprises.
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
              Choose a monthly or annual subscription, or start with a free account. Cancel renewal anytime. Current posting and application allowances are listed with each plan. Guard pay and booking service fees are separate from subscriptions.
            </p>

            <div className="inline-flex items-center bg-slate-800/80 backdrop-blur-sm rounded-full p-1 gap-1 border border-slate-700">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all whitespace-nowrap ${
                  billingCycle === 'monthly'
                    ? 'bg-teal-500 text-slate-900 shadow-lg'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
                  billingCycle === 'annual'
                    ? 'bg-teal-500 text-slate-900 shadow-lg'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Annual
                <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  Save
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-20">
          {pricingError && (
            <div role="alert" className="mb-10 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-200">
              <p>Some pricing details could not be loaded. Please retry or contact support@quickguard.uk. Your final booking service fee is shown before you confirm payment.</p>
              <button type="button" onClick={catalogue.retry} className="mt-3 underline">Retry pricing</button>
            </div>
          )}
          {/* CLIENT PLANS */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-building-line" />
              For Clients
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Client Subscription Plans
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Post jobs, find guards, and manage your security staffing with flexible monthly or annual billing.
            </p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center mb-24">
              <i className="ri-loader-4-line text-4xl text-teal-400 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24 pt-6">
              {clientPlans.map((plan, i) => renderPlanCard(plan, i, 'teal'))}
            </div>
          )}

          {/* GUARD PLANS */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-400/20 text-blue-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-shield-user-line" />
              For Security Guards
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Guard Membership Plans
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Compare application limits, profile features and support to find the membership that fits your security career.
            </p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center mb-24">
              <i className="ri-loader-4-line text-4xl text-blue-400 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24 pt-6">
              {guardPlans.map((plan, i) => renderPlanCard(plan, i, 'blue'))}
            </div>
          )}

          {/* CTA — Below the cards */}
          <div className="bg-[#0e1628] rounded-2xl border border-slate-700/50 p-8 md:p-12 mb-24 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-500/10 border border-teal-400/20 rounded-2xl mb-4">
              <i className="ri-list-check text-2xl text-teal-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Not sure which plan fits you?
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto mb-8">
              Every guard must pass an SIA licence check before taking work. Booking payments are processed through Stripe, and QuickGuard AI support is available 24/7 for platform and dispute questions. Human reviews are handled by our team; priority support depends on your plan.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/client/register"
                className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-6 py-3.5 rounded-xl font-bold text-base transition-all whitespace-nowrap shadow-lg hover:shadow-teal-500/20"
              >
                <i className="ri-building-line" />
                Start as a Client
              </Link>
              <Link
                href="/guard/register"
                className="inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-6 py-3.5 rounded-xl font-bold text-base transition-all whitespace-nowrap shadow-lg hover:shadow-blue-500/20"
              >
                <i className="ri-shield-user-line" />
                Start as a Guard
              </Link>
            </div>
            <p className="text-sm text-slate-500 mt-6">
              Free to create an account · Cancel renewal anytime · Paid access continues until your billing period ends
            </p>
          </div>

          {/* HOW THE FEE WORKS */}
          <div className="bg-[#0e1628] rounded-2xl border border-slate-700/50 p-8 md:p-12 mb-20">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-500/10 border border-teal-400/20 rounded-2xl mb-4">
                <i className="ri-information-line text-2xl text-teal-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">How the service fee works</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">
                Clients pay a booking service fee in addition to the agreed guard pay. Your rate depends on your client plan and any eligible promotion. Each client plan above shows its standard rate. Guards keep their full agreed pay, and payment processing is included.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: 'ri-shield-check-line', title: 'SIA licence checked before work', desc: 'Every guard must pass an SIA licence check before they can take work through QuickGuard. We are developing automated weekly re-checks that will flag suspended, revoked or expired licences for review.' },
                { icon: 'ri-safe-2-line', title: 'Held job payments', desc: 'Booking payments are processed through Stripe. Guard payouts follow shift completion and the applicable release checks, including any open dispute.' },
                { icon: 'ri-customer-service-2-line', title: '24/7 AI Dispute Support', desc: 'Our AI assistant is available 24/7 to help with dispute questions and common issues. Cases needing human review can be escalated to our team.' },
                { icon: 'ri-bank-card-line', title: 'Payment Processing', desc: 'Stripe handles all card processing securely. The fee covers PCI-compliant infrastructure and fraud prevention.' },
              ].map((item, i) => (
                <div key={i} className="bg-[#111d35] rounded-xl border border-slate-700/50 p-6">
                  <div className="w-10 h-10 bg-teal-500/10 rounded-xl border border-teal-400/20 flex items-center justify-center mb-4">
                    <i className={`${item.icon} text-teal-400 text-xl`} />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* WORKED EXAMPLE */}
          <div className="bg-[#111d35] rounded-2xl border border-slate-700/50 p-8 md:p-12 mb-20">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Worked example</h2>
                <p className="text-slate-400">One guard working an 8-hour shift at £18/hour, using the free client plan’s standard service fee before any promotion.</p>
              </div>

              {example ? <div className="bg-[#0e1628] rounded-2xl border border-slate-700/50 p-6 md:p-8">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Guard hourly rate</span>
                      <span className="font-medium text-white">{formatCurrency(example.guardRate)}/hr</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Hours booked</span>
                      <span className="font-medium text-white">{example.hours}h</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Number of guards</span>
                      <span className="font-medium text-white">× {example.numberOfGuards}</span>
                    </div>
                    <div className="border-t border-slate-700/50 pt-3 flex justify-between">
                      <span className="font-semibold text-white">Guard pay total</span>
                      <span className="font-semibold text-white">{formatCurrency(example.guardTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Service fee ({example.serviceFeeLabel})</span>
                      <span className="font-medium text-teal-400">{formatCurrency(example.serviceFee)}</span>
                    </div>
                    <div className="border-t border-slate-700/50 pt-3 flex justify-between items-center">
                      <span className="font-bold text-white text-lg">Total you pay</span>
                      <span className="font-bold text-teal-400 text-xl">{formatCurrency(example.total)}</span>
                    </div>
                  </div>

                  <div className="flex-1 bg-[#0b1322] rounded-xl border border-slate-700/30 p-5 text-sm text-slate-400 flex flex-col justify-center">
                    <p className="font-semibold text-slate-300 mb-3">What happens next:</p>
                    <ul className="space-y-2 list-disc pl-4">
                      <li>Stripe charges your card {formatCurrency(example.total)} before the booking is confirmed</li>
                      <li>Posting the job does not charge the booking payment</li>
                      <li>Money sits with Stripe until completion and the release checks</li>
                      <li>Guard receives {formatCurrency(example.guardTotal)} after completion and the applicable release checks</li>
                      <li>The {formatCurrency(example.serviceFee)} service fee covers QuickGuard platform services and payment processing</li>
                    </ul>
                    <p className="mt-4 text-xs text-slate-500">
                      This example excludes promotions. Any eligible booking service fee discount is shown in your booking payment summary before you confirm payment. Subscription offers have separate eligibility and billing terms.
                    </p>
                  </div>
                </div>
              </div> : <p className="text-center text-slate-400">{plansLoading ? 'Loading the current service fee…' : 'The current service fee could not be loaded. Please refresh or contact support@quickguard.uk.'}</p>}
            </div>
          </div>

          {/* FAQ */}
          <div className="bg-[#111d35] rounded-2xl border border-slate-700/50 p-8 mb-20">
            <h2 className="text-3xl font-bold text-white text-center mb-10">Frequently Asked Questions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {faqs.map((faq, index) => (
                <div key={index} className="bg-[#0e1628] border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600 transition-all">
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full flex items-start justify-between gap-4 p-5 text-left hover:bg-[#131d30] transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <i className="ri-question-line text-teal-400 mt-0.5 flex-shrink-0" />
                      <h3 className="font-semibold text-white text-sm">{faq.question}</h3>
                    </div>
                    <i className={`ri-arrow-down-s-line text-xl text-slate-500 transition-transform flex-shrink-0 ${openFaq === index ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === index && (
                    <div className="px-5 pb-5 pl-12">
                      <p className="text-slate-400 text-sm leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-10 pt-8 border-t border-slate-700/50 text-center">
              <p className="text-slate-400 mb-5">Still have questions?</p>
              <button
                onClick={() => {
                  const widget = document.querySelector('#vapi-widget-floating-button') as HTMLElement;
                  if (widget) widget.click();
                }}
                className="inline-flex items-center gap-2 bg-teal-500 text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer shadow-lg hover:shadow-teal-500/20"
              >
                <i className="ri-customer-service-line" />
                QuickGuard AI Support
              </button>
            </div>
          </div>
        </div>

        {/* BOTTOM CTA */}
        <section className="py-24 bg-[#0e1628] relative overflow-hidden border-t border-slate-800/60">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
          <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <i className="ri-rocket-line" />
              Get Started Today
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Ready to get started?
            </h2>
            <p className="text-xl mb-10 text-slate-400 max-w-2xl mx-auto">
              Connect with UK venues and security professionals on QuickGuard.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/client/register"
                className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap shadow-lg hover:shadow-teal-500/20"
              >
                I Need Security Guards
              </Link>
              <Link
                href="/guard/register"
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap backdrop-blur-sm"
              >
                I Am a Security Guard
              </Link>
            </div>
            <p className="text-sm text-slate-500 mt-6">
              Free to create an account · Cancel renewal anytime · Paid access continues until your billing period ends
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
