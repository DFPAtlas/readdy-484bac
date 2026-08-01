'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import NavSidebar from '@/components/NavSidebar';
import { supabase } from '@/lib/supabase';
import { calculatePaygFees, formatCurrency } from '@/lib/payg-fees';

interface Plan {
  slug: string;
  name: string;
  description: string;
  monthly_price_pence: number;
  stripe_price_id: string | null;
  stripe_annual_price_id: string | null;
  features: string[];
  limitations?: string[];
  badge?: string;
  audience: string;
}

const clientFeatureLabels: Record<string, string> = {
  'client.post_job': 'Job postings',
  'client.ai_matching': 'AI guard matching',
  'client.email_support': 'Email support',
  'client.standard_payments': 'Standard payments',
  'client.escrow_payments': 'Standard payments',
  'client.job_templates': 'Job templates',
  'client.analytics': 'Advanced analytics',
  'client.priority_support': 'Priority support',
  'client.bulk_posting': 'Bulk posting',
  'client.dedicated_manager': 'Dedicated account manager',
  'client.unlimited_jobs': 'Unlimited jobs',
  'client.performance_analytics': 'Performance analytics',
  'client.priority_listing': 'Priority listing',
};

const guardFeatureLabels: Record<string, string> = {
  'guard.job_applications': 'Job applications',
  'guard.ai_matching': 'AI job matching',
  'guard.email_support': 'Email support',
  'guard.profile_visibility': 'Profile visibility',
  'guard.secure_payments': 'Secure payments',
  'guard.performance_analytics': 'Performance analytics',
  'guard.priority_support': 'Priority support',
  'guard.bulk_apply': 'Bulk applications',
  'guard.dedicated_manager': 'Dedicated account manager',
  'guard.unlimited_applications': 'Unlimited applications',
  'guard.enhanced_profile': 'Enhanced profile',
  'guard.priority_listing': 'Priority listing',
};

const planDescriptions: Record<string, string> = {
  'client-starter': 'For small businesses with regular security needs',
  'client-pro': 'For growing companies with high-volume needs',
  'client-enterprise': 'For multi-site and enterprise security needs',
  'guard-basic': 'Perfect for getting started',
  'guard-pro': 'For active security professionals',
  'guard-elite': 'Full access to all features',
};

const planBadges: Record<string, string> = {
  'client-pro': 'POPULAR',
  'guard-elite': 'MOST POPULAR',
};

const planLimitations: Record<string, string[]> = {
  'client_free': ['Limited to 1 job per month', 'Upgrade required for advanced matching', 'Upgrade required for job templates', 'Upgrade required for analytics dashboard', 'Upgrade required for direct contact', 'Upgrade required for multi-site features'],
  'client-starter': ['Limited to 10 jobs per month', 'No priority matching', 'No dedicated support'],
  'client-pro': ['Limited to 30 jobs per month', 'No dedicated account manager', 'No bulk posting'],
  'guard_starter': ['Limited to 1 application per month', 'No advanced job alerts', 'No performance analytics', 'No priority support'],
  'guard-basic': ['Limited to 10 applications/month', 'No performance analytics', 'No 24/7 support'],
  'guard-pro': ['Limited to 25 applications/month', 'No 24/7 support'],
};

const getFeatureLabel = (key: string, audience: string) => {
  if (audience === 'client' && clientFeatureLabels[key]) return clientFeatureLabels[key];
  if (audience === 'guard' && guardFeatureLabels[key]) return guardFeatureLabels[key];
  return key.split('.').pop()?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || key;
};

export default function PricingClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [paygServiceFeePct, setPaygServiceFeePct] = useState(15);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string; role: 'guard' | 'client' | null } | null>(null);
  const [clientPlans, setClientPlans] = useState<Plan[]>([]);
  const [guardPlans, setGuardPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [switchSuccess, setSwitchSuccess] = useState<{ oldPlanName: string; newPlanName: string } | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(0);

  useEffect(() => {
    const loadPlans = async () => {
      const { data } = await supabase
        .from('plans')
        .select('*')
        .eq('active', true)
        .order('monthly_price_pence', { ascending: true });

      if (data) {
        const enriched = data.map((p: any) => ({
          ...p,
          description: planDescriptions[p.slug] || '',
          badge: planBadges[p.slug] || undefined,
          limitations: planLimitations[p.slug] || undefined,
        }));
        setClientPlans(enriched.filter((p: Plan) => p.audience === 'client'));
        setGuardPlans(enriched.filter((p: Plan) => p.audience === 'guard'));
      }
      setPlansLoading(false);
    };
    loadPlans();

    const loadConfig = async () => {
      const { data } = await supabase
        .from('pricing_config')
        .select('payg_service_fee_pct')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        setPaygServiceFeePct(Number(data.payg_service_fee_pct ?? 15));
      }
    };
    loadConfig();

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

  const example = calculatePaygFees({
    hourlyRate: 18,
    hours: 8,
    numberOfGuards: 1,
    numberOfDays: 1,
    serviceFeePct: paygServiceFeePct,
  });

  const calculateSavings = (monthlyPence: number, annualPence: number) => {
    if (monthlyPence === 0) return 0;
    const monthlyCost = monthlyPence * 12;
    return Math.round(((monthlyCost - annualPence) / monthlyCost) * 100);
  };

  const faqs = [
    { question: 'When am I charged?', answer: 'You are charged the full amount (guard pay + service fee) at the moment you post the job. Funds are held with Stripe and only released to the guard after the shift is confirmed complete.' },
    { question: 'What if a guard cancels?', answer: 'If the guard cancels before the shift starts, you get a full refund including the service fee. If a pattern of cancellations emerges, our admin team investigates.' },
    { question: 'What if I cancel the job?', answer: 'Cancelling more than 24 hours before the shift: full refund including the service fee. 12–24 hours before: 50% refund of the guard fee; service fee is retained. Less than 12 hours: no refund.' },
    { question: 'Is there a contract or minimum commitment?', answer: 'No. Pay-As-You-Go means zero commitment. Subscription plans can be cancelled anytime with no penalties.' },
    { question: 'Can I change my subscription plan?', answer: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we prorate the difference.' },
    { question: 'What happens if no guard accepts my job?', answer: 'If the start time passes and no guard has accepted, a full refund (including the service fee) is automatically issued after 24 hours.' },
    { question: 'Do guards get paid differently depending on my plan?', answer: 'No. Guards always receive their posted hourly rate multiplied by the hours worked. The service fee is separate and does not reduce guard pay.' },
    { question: 'How do you handle overruns?', answer: 'Guards log actual hours via time-tracking. If the actual shift runs longer than booked, a top-up payment request is sent before payout. The service fee applies to the top-up amount too.' },
  ];

  const renderPlanCard = (plan: Plan, index: number, accentColor: string) => {
    const monthlyPrice = plan.monthly_price_pence / 100;
    const annualTotal = Math.round((plan.monthly_price_pence * 10) / 100);
    const annualMonthlyEquiv = Math.round(annualTotal / 12);
    const price = billingCycle === 'monthly' ? monthlyPrice : annualMonthlyEquiv;
    const savings = calculateSavings(plan.monthly_price_pence, plan.monthly_price_pence * 10);
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

          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white">£{price}</span>
              <span className="text-slate-400">/month</span>
            </div>
            {billingCycle === 'annual' && plan.monthly_price_pence > 0 && (
              <p className="text-sm text-emerald-400 font-semibold mt-1">
                Save {savings}% with annual billing
              </p>
            )}
            {billingCycle === 'annual' && plan.monthly_price_pence > 0 && (
              <p className="text-sm text-slate-500 mt-0.5">
                Billed £{annualTotal} annually
              </p>
            )}
            {plan.monthly_price_pence === 0 && (
              <p className="text-sm text-slate-500 mt-1">No credit card required</p>
            )}
            {plan.monthly_price_pence === 0 && (
              <div className="mt-3 bg-amber-500/10 border border-amber-400/20 rounded-xl p-3 flex items-start gap-2.5">
                <i className="ri-information-line text-amber-400 text-sm flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">
                  A service charge applies to all jobs on free accounts. Upgrade to a paid plan for lower fees.
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
              disabled={subscribingPlan === plan.slug}
              className={`w-full py-3.5 rounded-xl font-bold text-base transition-all whitespace-nowrap block text-center ${bgColor} text-white ${hoverBg} shadow-lg ${
                subscribingPlan === plan.slug ? 'opacity-60 cursor-wait' : 'cursor-pointer'
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
                Prorated billing applied. No double charges. Returning to dashboard in {redirectCountdown}...
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

        {user && (
          <div className="max-w-7xl mx-auto px-6 pt-6">
            <Link
              href={user.role === 'guard' ? '/guard/dashboard' : '/client/dashboard'}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
            >
              <i className="ri-arrow-left-line" />
              Back to Dashboard
            </Link>
          </div>
        )}
        {/* HERO */}
        <div className="relative bg-gradient-to-br from-[#0e1628] via-[#0B1933] to-[#111d35] pt-24 pb-20 border-b border-slate-800/60">
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
              Choose a subscription that fits your needs, or stick with Pay-As-You-Go. Cancel anytime.
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
              Unlock job applications, priority matching, and full platform access to grow your security career.
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
              All plans include SIA-verified guards, secure held job payments with Stripe, and 24/7 dispute support. Upgrade, downgrade, or cancel anytime.
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
              No credit card required · Cancel anytime · Upgrade or downgrade as needed
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
                The {paygServiceFeePct}% fee covers everything that keeps QuickGuard safe, fast, and reliable.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: 'ri-shield-check-line', title: 'SIA Re-verification', desc: 'Every guard licence is checked and re-verified every 6 months so you only work with valid, active SIA holders.' },
                { icon: 'ri-safe-2-line', title: 'Held Job Payment Protection', desc: 'Your payment is held securely with Stripe and only released to the guard after the shift is marked complete.' },
                { icon: 'ri-customer-service-2-line', title: '24/7 Dispute Support', desc: 'If anything goes wrong, our support team is available around the clock to investigate and resolve.' },
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
                <p className="text-slate-400">A typical one-off 8-hour event security shift.</p>
              </div>

              <div className="bg-[#0e1628] rounded-2xl border border-slate-700/50 p-6 md:p-8">
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
                      <li>Stripe charges your card {formatCurrency(example.total)} at posting</li>
                      <li>Money sits with Stripe until the shift ends</li>
                      <li>Guard gets paid {formatCurrency(example.guardTotal)} after completion</li>
                      <li>QuickGuard retains {formatCurrency(example.serviceFee)} for platform services</li>
                    </ul>
                    <p className="mt-4 text-xs text-slate-500">
                      Promotional discounts (Founding, Early, Launch) are applied automatically at checkout and reduce the service fee shown above.
                    </p>
                  </div>
                </div>
              </div>
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
                Talk to Us
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
              Join thousands of UK venues and security professionals on QuickGuard.
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
              No credit card required · Cancel anytime · Upgrade or downgrade as needed
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}