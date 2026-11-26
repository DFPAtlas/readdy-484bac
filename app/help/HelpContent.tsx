'use client';

import { CANCELLATION_GUIDANCE, GUARD_CANCELLATION_GUIDANCE, REFUND_TIMING_GUIDANCE, HUMAN_SUPPORT_HOURS } from '@/lib/customer-guidance';
import { GUARD_BANK_DEPOSIT_GUIDANCE, GUARD_COMPLETION_GUIDANCE, GUARD_PAYOUT_SETUP_GUIDANCE, GUARD_PAYOUT_SUPPORT_GUIDANCE } from '@/lib/guard-payment-guidance';

import PublicMediaImage from '@/components/PublicMediaImage';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BackToTop from '@/components/BackToTop';
import Footer from '@/components/Footer';
import NavSidebar from '@/components/NavSidebar';
import { CANCELLATION_WINDOWS, CANCELLATION_NOTES, LICENCE_CHECKS } from '@/lib/help-content';
import { calculatePaygFees, formatCurrency } from '@/lib/payg-fees';
import { usePublicPricing } from '@/lib/use-public-pricing';
import { bookingFeeText, planAllowanceText, pricingMoney, QUICKGUARD_TAX_NOTE, type PublicPricingPlan } from '@/lib/public-pricing';

type Role = 'client' | 'guard';

type HelpFaq = { question: string; answer: string; icon: string };
type LocalJourneyStep = { title: string; desc: string };
type LocalHelpTopic = { title: string; desc: string; href: string };

const CLIENT_JOURNEY_STEPS: LocalJourneyStep[] = [
  { title: 'Check availability', desc: 'See how many verified guards match your postcode, licence need, shift times and budget. This uses recorded criteria only; it is not a reservation or cover guarantee.' },
  { title: 'Create your account', desc: 'Choose a client plan. Your plan sets your monthly posting allowance and your per-booking service fee.' },
  { title: 'Post your job', desc: 'Sign in, review your request and confirm posting. Posting does not charge you and no guard is notified before you confirm.' },
  { title: 'Select guards', desc: 'Compare applicants and check their licence details. Your selection is provisional until payment succeeds.' },
  { title: 'Pay through Stripe', desc: 'Review agreed guard pay plus your plan service fee, then pay by card. The booking is confirmed only when payment succeeds.' },
  { title: 'Complete and release', desc: 'Guards check in and out. You approve completion or raise a dispute; release checks then transfer eligible pay to the guard’s Stripe account. The bank payout is separate.' },
];

const GUARD_JOURNEY_STEPS: LocalJourneyStep[] = [
  { title: 'Register free', desc: 'Create your profile and upload your identity and SIA licence details. Guard accounts are free, with no paid membership.' },
  { title: 'Get verified', desc: 'Licensable work needs an approved profile and a valid SIA licence of the required type. Verification timing varies.' },
  { title: 'Set your area', desc: 'Choose the travel radius and job alerts for the work you are willing to take.' },
  { title: 'Apply freely', desc: 'Applications are unlimited with no monthly cap, no paid job tiers and no paid priority. Clients choose who to book.' },
  { title: 'Work the shift', desc: 'Check in when you arrive and check out at the end. The client sees check-in times, and late check-ins are recorded.' },
  { title: 'Request completion', desc: GUARD_COMPLETION_GUIDANCE },
];

const CLIENT_HELP_TOPICS: LocalHelpTopic[] = [
  { title: 'Getting started', desc: 'Check guard availability, create an account and post your first job.', href: '/post-job' },
  { title: 'Plans & fees', desc: 'Monthly posting allowances, service fees and eligible promotions.', href: '/pricing' },
  { title: 'Selecting & paying', desc: 'Compare applicants, provisional selection and Stripe payment confirmation.', href: '/guide/client#step-04' },
  { title: 'On the day', desc: 'Check-in and check-out, attendance problems and completion approval.', href: '/guide/client' },
  { title: 'Cancellations & refunds', desc: 'Cancelling, refund review and how long a Stripe refund can take.', href: '/how-it-works/clients' },
  { title: 'Data & privacy', desc: 'What we keep, for how long, and how to request erasure.', href: '/privacy' },
];

const GUARD_HELP_TOPICS: LocalHelpTopic[] = [
  { title: 'Getting started', desc: 'Register free and build a profile that clients can review.', href: '/guide/guard' },
  { title: 'SIA verification', desc: 'Licence checks, expiry dates and what a mismatch blocks.', href: '/guide/guard#step-02' },
  { title: 'Finding work', desc: 'Job alerts, travel radius and unlimited applications.', href: '/jobs' },
  { title: 'Pay & payouts', desc: 'Completion approval, release checks, Stripe transfer and bank payout.', href: '/guide/guard#step-04' },
  { title: 'On the shift', desc: 'Check-in, check-out, extra hours and reporting problems.', href: '/guide/guard' },
  { title: 'Membership & billing', desc: 'Free access, retired memberships, old invoices and support.', href: '/contact' },
];

function clientPlanSummary(plans: PublicPricingPlan[]): string | null {
  const clientPlans = plans.filter((plan) => plan.audience === 'client');
  if (!clientPlans.length) return null;
  return clientPlans
    .map((plan) => {
      const price = plan.monthly_price_pence === 0 ? 'no monthly fee' : `${pricingMoney(plan.monthly_price_pence)} a month`;
      return `${plan.name}: ${price}, ${planAllowanceText(plan).toLowerCase()}, ${bookingFeeText(plan)} service fee`;
    })
    .join('; ');
}

const DATA_FAQ: HelpFaq = {
  question: 'What happens to my data and how long is it kept?',
  answer: 'Our privacy notice sets out retention. As a summary: active-account data is kept while the account is active and for two years after closure. A nightly process minimises account profile data after two years and deletes verification documents after three years. Financial records are kept for seven years as standard, with specific tax, accounting and legal requirements assessed separately, and a documented legal hold pauses cleanup while evidence is needed. You can request earlier erasure. See the privacy notice for the full detail.',
  icon: 'ri-lock-line',
};

const SUPPORT_FAQ: HelpFaq = {
  question: 'What support is available, and when?',
  answer: `QuickGuard AI Support answers platform questions 24/7. Human support is normally available ${HUMAN_SUPPORT_HOURS}; anything sent outside those hours is picked up when the team is next available. We do not guarantee a response time or a particular outcome, and no one can guarantee guard cover, refund timing or a bank arrival date.`,
  icon: 'ri-customer-service-2-line',
};

function buildFaqs(role: Role, plans: PublicPricingPlan[]): HelpFaq[] {
  const summary = clientPlanSummary(plans);

  if (role === 'guard') {
    return [
      { question: 'Is guard registration really free?', answer: 'Yes. Creating a guard account, browsing jobs and applying are free, with no monthly application cap. Approval and licence requirements still apply: a job that needs a licence requires a valid SIA licence of the required type.', icon: 'ri-shield-user-line' },
      { question: 'Are paid guard memberships or paid priority still available?', answer: 'No. Paid guard memberships have been retired, and there are no paid job tiers or paid priority placement. If you bought a membership earlier, its billing records and invoices remain available, and support can help with any question about that subscription.', icon: 'ri-close-circle-line' },
      { question: 'Is commission taken from my agreed pay?', answer: 'No QuickGuard booking commission is deducted from the agreed gross guard pay on new bookings. The client pays your agreed pay plus their plan service fee. Tax and any other statutory deductions depend on how you are engaged, so we do not promise a take-home amount.', icon: 'ri-money-pound-circle-line' },
      { question: 'How do I set up guard payouts and request completion?', answer: `${GUARD_PAYOUT_SETUP_GUIDANCE} ${GUARD_COMPLETION_GUIDANCE}`, icon: 'ri-bank-line' },
      { question: 'When is my pay released?', answer: 'After you request completion, the client approves it and the applicable payment, dispute and Stripe account checks pass, eligible pay is transferred to your connected Stripe account. If the client does not respond, the request can be approved automatically after the applicable release window, unless there is an open dispute or a finance hold. Release is not the same as money in your bank.', icon: 'ri-secure-payment-line' },
      { question: 'Does payment release mean the money is in my bank?', answer: GUARD_BANK_DEPOSIT_GUIDANCE, icon: 'ri-time-line' },
      { question: 'What if the client has not confirmed completion or my payout is delayed?', answer: GUARD_PAYOUT_SUPPORT_GUIDANCE, icon: 'ri-error-warning-line' },
      { question: 'How long does SIA and identity verification take?', answer: 'Timing depends on the licence check and whether manual review is required, so we cannot promise a fixed turnaround. You will be emailed once your profile has been reviewed. Keep your licence number, type and expiry date current: an expired or mismatched licence blocks applications for licensable work.', icon: 'ri-verified-badge-line' },
      { question: 'What do I do on the shift?', answer: 'Check in when you arrive and check out at the end from your guard account. Your check-in time is shown to the client and a late check-in is recorded. If a shift may run beyond the agreed hours, agree the change with the client and contact support before working extra hours; extra hours do not automatically create a top-up or a payout.', icon: 'ri-login-box-line' },
      { question: 'What if I cannot attend a confirmed shift?', answer: 'Contact the client and QuickGuard support as early as possible from the booking so a replacement can be arranged. Any refund or payment outcome is reviewed against the booking circumstances rather than decided automatically.', icon: 'ri-calendar-close-line' },
      SUPPORT_FAQ,
      DATA_FAQ,
    ];
  }

  return [
    { question: 'Can I check guard availability before creating an account?', answer: 'Yes. You can check how many verified guards match your postcode, licence requirement, shift times, budget, venue type and recorded travel preferences. The check uses recorded matching criteria only, is not a reservation and does not guarantee cover; guards whose availability is not recorded are excluded. It does not post your job or notify any guard: you sign in, review the request and confirm posting first. For recurring or ongoing cover the count covers the first requested shift only. No card details are taken until you select a guard and reach payment.', icon: 'ri-search-eye-line' },
    { question: 'How do I get started as a client?', answer: 'Register, verify your email, complete your company profile, choose a plan, then post your first job. You can check availability before signing in, but posting a job needs an account, and no guard is notified until you review and confirm the post.', icon: 'ri-user-add-line' },
    { question: 'What client plans and allowances are available?', answer: summary ? `Client plans are monthly memberships with a posting allowance and a separate service fee on each booking. Current plans: ${summary}. Allowances reset each month and the exact fee and total are confirmed before you pay. Guard accounts remain free.` : 'Client plans are monthly memberships with a posting allowance and a separate service fee on each booking. Current allowances and fees are listed on the pricing page and confirmed before you pay. Guard accounts remain free.', icon: 'ri-price-tag-3-line' },
    { question: 'What does a booking cost?', answer: `You pay the agreed guard pay plus your plan service fee; card processing is included and no QuickGuard booking commission is deducted from the guard’s agreed gross pay on new bookings. Eligible promotions can reduce the service fee. ${QUICKGUARD_TAX_NOTE} The total is shown before you pay.`, icon: 'ri-secure-payment-line' },
    { question: 'How does selecting a guard and confirming a booking work?', answer: 'Your selected guards are reserved provisionally for that job. The booking is confirmed only after your Stripe card payment succeeds; until then nothing is guaranteed and no work is confirmed. If a payment fails you can retry while the provisional selection stands, subject to availability.', icon: 'ri-shield-check-line' },
    { question: 'Is an SIA licence verified?', answer: 'Where a role involves licensable security activity, the guard must hold a valid SIA licence, and the licence number and type are shown on their profile so you can review them before confirming. Applying for a licensable job requires a verified, unexpired licence of the required type. Not every venue, event or site role is licensable, and roles that do not need a licence are not presented as licensed work.', icon: 'ri-verified-badge-line' },
    { question: 'What happens on the shift?', answer: 'Guards check in on arrival and check out at the end from their guard account, and you receive check-in and check-out notifications. Late check-ins are recorded. If a guard does not arrive or there is a problem on site, report it from the job page so our team can review next steps.', icon: 'ri-calendar-check-line' },
    { question: 'How does completion approval and payment release work?', answer: 'The guard marks the shift complete, which submits it for your review. You can approve completion or raise a dispute. Approval plus the applicable payment, dispute and Stripe account checks must pass before eligible pay transfers to the guard’s connected Stripe account. If you do not respond, the request can be approved automatically after the applicable release window, unless there is an open dispute or a finance hold. Bank deposit is a separate Stripe payout, and a dispute can pause release. There is no escrow.', icon: 'ri-checkbox-circle-line' },
    { question: 'Can I cancel or edit a job after posting?', answer: `${CANCELLATION_GUIDANCE} ${GUARD_CANCELLATION_GUIDANCE} ${REFUND_TIMING_GUIDANCE} To change a booked job, contact support.`, icon: 'ri-edit-2-line' },
    { question: 'How long does a refund take?', answer: `${REFUND_TIMING_GUIDANCE} Actual timing depends on Stripe and your bank, so no refund or arrival date is guaranteed, and a refund request is not an approved refund.`, icon: 'ri-refund-2-line' },
    { question: 'How do I raise a complaint or dispute?', answer: 'You can submit a complaint from the affected booking. Our team reviews the booking record, messages, attendance and payment history, and keeps you updated on progress. Outcomes and response times are not guaranteed, and the service fee, release or refund is reviewed against the circumstances rather than decided automatically.', icon: 'ri-feedback-line' },
    { question: 'Can I change or cancel my client plan?', answer: 'You can review and change your plan from your account billing area, and support can help with a cancellation question. Charges already taken for a booking are separate from your subscription: cancellation and any refund are reviewed through the booking process rather than refunded automatically.', icon: 'ri-repeat-line' },
    { question: 'Where do I find invoices and receipts?', answer: 'Payment History holds your saved payment records and receipts, showing recorded guard pay, service charges and refunds. Subscription invoices are available from your account billing area. These records are not VAT invoices, because QuickGuard is not VAT registered and adds no VAT to its own fees.', icon: 'ri-file-list-3-line' },
    SUPPORT_FAQ,
    DATA_FAQ,
  ];
}

const visualGuides = [
  {
    title: 'Client Dashboard',
    description: 'See where to find jobs, payments, profile setup and QuickGuard AI support.',
    slot: 'help-client-dashboard',
    image: 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/31e07790-0a5d-462a-afc4-cf9a2f6d9199_compressed_Screenshot-2026-10-04-014442.webp',
    href: '/guide/client',
  },
  {
    title: 'Post a Security Job',
    description: 'Follow the guided job-posting flow from job basics through review and posting.',
    slot: 'help-post-a-security-job',
    image: 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/52d82073-26ad-4e44-b04e-b095eac18b4c_compressed_Screenshot-2026-10-04-014457.webp',
    href: '/guide/client',
  },
  {
    title: 'Manage Your Jobs',
    description: 'Track confirmed bookings, payment status, cancellations and refunds from My Jobs.',
    slot: 'help-manage-your-jobs',
    image: 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/0b10efad-d486-4d54-a57a-66170ddbacc7_compressed_Screenshot-2026-10-04-014544.webp',
    href: '/client/help',
  },
];

function MoneySection({ role, catalogue }: { role: Role; catalogue: ReturnType<typeof usePublicPricing> }) {
  const [planSlug, setPlanSlug] = useState('client-starter');
  const clientPlans = catalogue.plans.filter(plan => plan.audience === 'client');
  const [hours, setHours] = useState(8);
  const [rate, setRate] = useState(15);

  if (role === 'guard') {
    const guardCards = [
      {
        big: '0%',
        title: 'No booking commission',
        text: "QuickGuard deducts no booking commission from the agreed gross guard pay on new bookings. Statutory deductions depend on how you are engaged.",
      },
      {
        big: '£0',
        title: 'Free guard job access',
        text: 'Create a profile and apply with no monthly application cap and no paid job tiers or paid priority. Approval and licence requirements apply. Any earlier membership keeps its billing records; support can help with an old subscription.',
      },
      {
        big: 'Stripe',
        title: 'Release, then bank deposit',
        text: 'Set up your payout account in Bank Settings. After completion approval (or the applicable review window) and the payment, dispute and Stripe account checks, eligible pay is transferred to Stripe. Bank arrival is a separate stage.',
      },
    ];

    return (
      <div className="mb-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-sky-400">Your earnings</p>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">Your agreed guard pay</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {guardCards.map((card) => (
            <div key={card.title} className="h-full bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
              <p className="text-3xl font-bold text-sky-400 mb-3">{card.big}</p>
              <h3 className="font-bold text-white text-base mb-2">{card.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-slate-400 leading-relaxed">{GUARD_BANK_DEPOSIT_GUIDANCE}</p>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">{GUARD_PAYOUT_SUPPORT_GUIDANCE}</p>
        <Link href="/guide/guard#step-04" className="inline-block mt-4 text-sm text-sky-400 underline">Read the guard payout guide</Link>
      </div>
    );
  }

  if (catalogue.loading || catalogue.error || catalogue.feesError
    || !clientPlans.length) {
    return <div role="status" className="mb-16 bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 text-slate-300">
      <p>{catalogue.loading ? 'Loading current plans and fees…' : catalogue.error || 'Current booking fees could not be confirmed. No estimate is available.'}</p>
      {!catalogue.loading && <button type="button" onClick={catalogue.retry} className="mt-3 text-teal-400 underline">Retry pricing</button>}
      <Link href="/pricing" className="ml-4 text-teal-400 underline">View pricing</Link>
    </div>;
  }

  const plan = clientPlans.find((p) => p.slug === planSlug) ?? clientPlans[0];
  const fees = calculatePaygFees({
    hourlyRate: rate,
    hours,
    numberOfGuards: 1,
    numberOfDays: 1,
    serviceFeePct: plan.bookingFee,
    serviceFeeFixedPence: plan.bookingFeeFixedPence,
  });

  return (
    <div className="mb-16">
      <div className="grid lg:grid-cols-2 gap-10 items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-teal-400">What you&apos;ll pay</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-5">Two separate costs, both shown upfront</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            Your subscription covers platform features and your monthly posting allowance. Each booking is paid separately: the guard&apos;s agreed pay plus your plan&apos;s service fee. Card processing is included, and no QuickGuard booking commission is deducted from the guard&apos;s agreed gross pay.
          </p>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Eligible promotions can reduce your service fee. {QUICKGUARD_TAX_NOTE}
          </p>
          <Link href="/pricing" className="inline-flex items-center gap-1 text-teal-400 font-semibold text-sm hover:underline cursor-pointer whitespace-nowrap">
            Compare plans <i className="ri-arrow-right-line" />
          </Link>
        </div>

        <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Your plan</p>
            <div className="flex flex-wrap gap-2">
              {clientPlans.map((p) => {
                const active = p.slug === planSlug;
                return (
                  <button
                    key={p.slug}
                    type="button"
                    onClick={() => setPlanSlug(p.slug)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-teal-500 border-teal-500 text-slate-900'
                        : 'bg-transparent border-slate-600 text-slate-300 hover:border-teal-400/50 hover:text-white'
                    }`}
                  >
                    {p.name} {'\u00b7'} {bookingFeeText(p)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-700/50">
            <div className="flex items-center justify-between py-3 border-b border-slate-700/50">
              <span className="text-sm text-slate-300">Hours</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Fewer hours"
                  onClick={() => setHours((h) => Math.max(1, h - 1))}
                  disabled={hours <= 1}
                  className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#0e1628] border border-slate-700/50 text-white hover:border-teal-400/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <i className="ri-subtract-line text-lg" />
                </button>
                <span className="w-8 text-center font-bold text-white">{hours}</span>
                <button
                  type="button"
                  aria-label="More hours"
                  onClick={() => setHours((h) => Math.min(24, h + 1))}
                  disabled={hours >= 24}
                  className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#0e1628] border border-slate-700/50 text-white hover:border-teal-400/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <i className="ri-add-line text-lg" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-slate-700/50">
              <span className="text-sm text-slate-300">Guard rate per hour</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Lower rate"
                  onClick={() => setRate((r) => Math.max(11, Math.round((r - 0.5) * 100) / 100))}
                  disabled={rate <= 11}
                  className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#0e1628] border border-slate-700/50 text-white hover:border-teal-400/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <i className="ri-subtract-line text-lg" />
                </button>
                <span className="w-20 text-center font-bold text-white">{formatCurrency(rate)}</span>
                <button
                  type="button"
                  aria-label="Higher rate"
                  onClick={() => setRate((r) => Math.min(40, Math.round((r + 0.5) * 100) / 100))}
                  disabled={rate >= 40}
                  className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#0e1628] border border-slate-700/50 text-white hover:border-teal-400/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <i className="ri-add-line text-lg" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Guard&apos;s agreed pay</span>
              <span className="text-white font-medium">{formatCurrency(fees.guardTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Service fee ({fees.serviceFeeLabel})</span>
              <span className="text-white font-medium">{formatCurrency(fees.serviceFee)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Card processing</span>
              <span className="text-teal-400 font-medium">Included</span>
            </div>
            <div className="flex justify-between items-center mt-3 pt-4 border-t border-slate-700/50">
              <span className="font-bold text-white">Booking total</span>
              <span className="font-bold text-teal-400 text-xl">{formatCurrency(fees.total)}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed mt-4">
            The guard&apos;s agreed pay is {formatCurrency(fees.guardTotal)}, with no QuickGuard booking commission deducted. Statutory deductions depend on the engagement. Example only; your total is confirmed before you pay.
          </p>
        </div>
      </div>
    </div>
  );
}

const cancellationTones: Record<string, { bg: string; label: string }> = {
  good: { bg: 'bg-teal-900', label: 'text-teal-300' },
  warn: { bg: 'bg-amber-900', label: 'text-amber-300' },
  bad: { bg: 'bg-red-900', label: 'text-red-300' },
};

function CancellationSection() {
  const notePrefixes = ['If a guard cancels,', 'Cancel from My Jobs'];
  const notes = CANCELLATION_NOTES.map((text, i) => {
    const prefix = notePrefixes[i] ?? '';
    const rest = prefix && text.startsWith(prefix) ? text.slice(prefix.length).trim() : text;
    return { prefix, rest };
  });

  return (
    <div className="mb-16">
      <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-teal-400">Cancelling a booking</p>
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">Cancellation and refund review</h2>

      <div className="flex flex-col md:flex-row rounded-2xl overflow-hidden border border-slate-700/50">
        {CANCELLATION_WINDOWS.map((w) => {
          const tone = cancellationTones[w.tone] ?? cancellationTones.good;
          return (
            <div key={w.label} className={`flex-1 p-6 ${tone.bg}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${tone.label}`}>{w.label}</p>
              <p className="text-xl md:text-2xl font-bold text-white mb-2">{w.outcome}</p>
              <p className="text-sm text-white/80 leading-relaxed">{w.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        {notes.map((note, i) => (
          <div key={i} className="bg-[#111d35] border border-slate-700/50 rounded-xl p-4">
            <p className="text-sm text-slate-400 leading-relaxed">
              <span className="font-bold text-white">{note.prefix}</span> {note.rest}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LicenceChecksSection({ role }: { role: Role }) {
  const isClient = role === 'client';
  const intro = isClient
    ? "Here's what licence information is shown today, and what it means for the role you are booking."
    : "Here's what licence information is shown today, and what it means for the work you apply for.";

  return (
    <div className="mb-16">
      <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 md:p-8 grid lg:grid-cols-2 gap-8 items-start">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-3 ${isClient ? 'text-teal-400' : 'text-sky-400'}`}>Licence checks</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">What is shown, and when</h2>
          <p className="text-slate-400 text-sm leading-relaxed">{intro}</p>
        </div>
        <div>
          {LICENCE_CHECKS.map((check, i) => {
            const live = check.status === 'live';
            return (
              <div key={check.title} className={`py-4 ${i > 0 ? 'border-t border-slate-700/50' : ''} ${i === 0 ? 'pt-0' : ''}`}>
                <span
                  className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border mb-3 ${
                    live
                      ? 'bg-teal-500/10 text-teal-400 border-teal-400/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-400/20'
                  }`}
                >
                  {live ? 'Live now' : 'Coming soon'}
                </span>
                <p className="font-bold text-white text-sm mb-1">{check.title}</p>
                <p className="text-slate-400 text-xs leading-relaxed">{check.detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function HelpContent() {
  const router = useRouter();
  const catalogue = usePublicPricing();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role>('client');

  const handleAiSupport = () => {
    const widget = document.getElementById('vapi-widget-floating-button');
    if (widget) {
      (widget as HTMLElement).click();
    } else {
      router.push('/contact');
    }
  };

  const isClient = role === 'client';

  const accentText = isClient ? 'text-teal-400' : 'text-sky-400';
  const accentRing = isClient ? 'focus:ring-teal-500/50 focus:border-teal-500/50' : 'focus:ring-sky-500/50 focus:border-sky-500/50';
  const activeBtn = isClient
    ? 'bg-teal-500 text-slate-900 hover:bg-teal-400'
    : 'bg-sky-500 text-slate-900 hover:bg-sky-400';
  const accentSolid = isClient ? 'bg-teal-500 text-white' : 'bg-sky-500 text-white';

  const journey = isClient ? CLIENT_JOURNEY_STEPS : GUARD_JOURNEY_STEPS;
  const journeyLabel = isClient ? 'Hiring with QuickGuard' : 'Working with QuickGuard';
  const journeyHeading = isClient ? 'From availability check to a guard on site' : 'From free sign-up to getting paid';
  const searchPlaceholder = isClient
    ? 'Search: availability, plans, refunds, release\u2026'
    : 'Search: SIA check, payouts, job alerts\u2026';

  const query = search.toLowerCase();
  const faqs = buildFaqs(role, catalogue.plans);

  const filtered = faqs.filter(
    (f) => f.question.toLowerCase().includes(query) || f.answer.toLowerCase().includes(query)
  );

  const topics = isClient ? CLIENT_HELP_TOPICS : GUARD_HELP_TOPICS;
  const filteredTopics = topics.filter(
    (t) => t.title.toLowerCase().includes(query) || t.desc.toLowerCase().includes(query)
  );

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />

      <div className="bg-[#0B1933] border-b border-slate-800/60">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-teal-400 transition-colors cursor-pointer">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-arrow-left-line text-sm" />
            </div>
            Back to Home
          </Link>
        </div>
      </div>

      <div className="relative pt-20 pb-16 bg-[#0e1628] border-b border-slate-800/60 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-4 ${accentText}`}>
            QuickGuard Help Centre
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">How can we help?</h1>
          <p className="text-slate-400 text-lg mb-8 max-w-2xl mx-auto">
            Tell us who you are and we&apos;ll show you exactly how QuickGuard works, from checking availability to getting paid.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-8">
            <button
              type="button"
              onClick={() => setRole('client')}
              className={`min-h-[48px] px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all cursor-pointer ${
                isClient
                  ? activeBtn
                  : 'bg-transparent border border-slate-600 text-slate-300 hover:border-teal-400/50 hover:text-white'
              }`}
            >
              I&apos;m hiring security
            </button>
            <button
              type="button"
              onClick={() => setRole('guard')}
              className={`min-h-[48px] px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all cursor-pointer ${
                !isClient
                  ? activeBtn
                  : 'bg-transparent border border-slate-600 text-slate-300 hover:border-sky-400/50 hover:text-white'
              }`}
            >
              I&apos;m a security guard
            </button>
          </div>

          <div className="relative max-w-xl mx-auto">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
              <i className="ri-search-line text-slate-500 text-lg" />
            </div>
            <input
              type="text"
              aria-label="Search the help centre"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-12 pr-4 py-4 rounded-xl bg-[#111d35] border border-slate-700/50 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 transition ${accentRing}`}
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">

        <div className="mb-16">
          <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-3 ${accentText}`}>{journeyLabel}</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">{journeyHeading}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
            {journey.map((step, i) => (
              <div key={step.title} className="h-full bg-[#111d35] border border-slate-700/50 rounded-2xl p-5 hover:border-slate-500/50 transition-all duration-200">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-4 font-bold text-sm ${accentSolid}`}>
                  {i + 1}
                </div>
                <h3 className="font-bold text-white text-sm mb-2 leading-snug">{step.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <MoneySection role={role} catalogue={catalogue} />

        {isClient && <CancellationSection />}

        <LicenceChecksSection role={role} />

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-8">Browse help topics</h2>
          {filteredTopics.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-[#111d35] border border-slate-700/50 rounded-2xl">
              <p className="text-sm font-medium text-white">No topics match your search</p>
              <p className="text-xs mt-1">Try a different term or <Link href="/contact" className="text-teal-400 underline">contact support</Link></p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTopics.map((topic) => (
                <Link key={topic.title} href={topic.href} className="group">
                  <div className="h-full bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 hover:border-slate-500/50 transition-all duration-200">
                    <h3 className="font-bold text-white text-base mb-2 group-hover:underline">{topic.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">{topic.desc}</p>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${accentText}`}>
                      View articles <i className="ri-arrow-right-line" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {isClient && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-2xl font-bold text-white">Visual Quick Start</h2>
                <p className="text-slate-400 text-sm mt-1">Use these screenshots to recognise the main client screens before you start.</p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-5 mt-6">
              {visualGuides.map((guide) => (
                <Link key={guide.title} href={guide.href} className="group">
                  <div className="h-full bg-[#111d35] border border-slate-700/50 rounded-2xl overflow-hidden hover:border-teal-500/30 transition-all duration-200">
                    <div className="relative aspect-video bg-[#0e1628]">
                      <PublicMediaImage
                        slot={guide.slot}
                        src={guide.image}
                        alt={guide.title}
                        className="absolute inset-0 w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-white text-sm mb-2 group-hover:text-teal-400 transition-colors">{guide.title}</h3>
                      <p className="text-slate-400 text-xs leading-relaxed">{guide.description}</p>
                      <div className="flex items-center gap-1 text-teal-400 text-xs font-semibold mt-4">
                        Open guide <i className="ri-arrow-right-line" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-2">Frequently Asked Questions</h2>
          <p className="text-slate-400 mb-6 text-sm">
            {search ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${search}"` : 'Everything you need to know'}
          </p>
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <i className="ri-search-line text-5xl" />
              </div>
              <p className="text-lg font-medium text-white">No results found</p>
              <p className="text-sm mt-1">Try a different search term or <Link href="/contact" className="text-teal-400 underline">contact support</Link></p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((faq, i) => (
                <div key={i} className="border border-slate-700/50 rounded-xl overflow-hidden hover:border-teal-500/30 transition-colors bg-[#111d35]">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#0e1628] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-teal-500/10 border border-teal-400/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className={`${faq.icon} text-teal-400 text-sm`} />
                      </div>
                      <span className="font-semibold text-white text-sm">{faq.question}</span>
                    </div>
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 ml-4">
                      <i className={`ri-${openFaq === i ? 'subtract' : 'add'}-line text-teal-400 text-lg transition-transform`} />
                    </div>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-5 pt-1 bg-[#0e1628] border-t border-slate-700/50">
                      <p className="text-slate-400 text-sm leading-relaxed pl-11">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#0e1628] border border-slate-700/50 rounded-2xl p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
          <div className="relative z-10">
            <div className="w-14 h-14 bg-teal-500/10 border border-teal-400/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-headphone-line text-2xl text-teal-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Still stuck?</h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto text-sm">QuickGuard AI Support answers platform questions 24/7. Human support is normally available {HUMAN_SUPPORT_HOURS}; anything outside those hours is picked up when the team is next available.</p>
            <p className="text-slate-500 mb-6 max-w-md mx-auto text-xs">We do not guarantee a response time, guard cover, a refund or a bank arrival date.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleAiSupport}
                className="bg-teal-500 text-slate-900 font-bold px-8 py-3 rounded-xl hover:bg-teal-400 transition-all whitespace-nowrap shadow-lg hover:shadow-teal-500/20 cursor-pointer"
              >
                Ask AI Support
              </button>
              <Link
                href="/contact"
                className="bg-transparent border border-slate-600 text-slate-200 font-bold px-8 py-3 rounded-xl hover:border-teal-400/50 hover:text-white transition-all whitespace-nowrap cursor-pointer"
              >
                Raise a ticket
              </Link>
            </div>
          </div>
        </div>

      </div>
      <Footer />
      <BackToTop />
    </div>
  );
}
