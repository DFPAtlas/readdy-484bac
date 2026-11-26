'use client';

import { useState } from 'react';
import { GUARD_BANK_DEPOSIT_GUIDANCE, GUARD_COMPLETION_GUIDANCE, GUARD_PAYOUT_SETUP_GUIDANCE, GUARD_PAYOUT_SUPPORT_GUIDANCE } from '@/lib/guard-payment-guidance';

const faqs = [
  {
    category: 'General',
    question: 'What is QuickGuard.uk?',
    answer:
      'QuickGuard.uk is a UK platform that connects SIA-licensed security guards with clients who need professional security cover. Clients check guard availability, post a job, review guard responses and pay for a confirmed booking, while guards create a free profile and apply for the shifts they want.',
  },
  {
    category: 'For Guards',
    question: 'Do I need an SIA licence to join as a security guard?',
    answer:
      'Yes. Guards must hold a valid SIA (Security Industry Authority) licence and submit their licence details for verification before they can apply for jobs. Each job also applies its own licence and site requirements, so a guard only applies where those requirements are met.',
  },
  {
    category: 'For Guards',
    question: 'How much does it cost for guards to use the platform?',
    answer:
      'Nothing. Guard registration, job browsing and applications are free, with no paid membership tiers and no monthly application cap. Paid guard memberships have been retired, and there is no paid job tier or paid priority in job discovery or applicant order. Any existing membership and historical invoices can still be reviewed in your guard dashboard.',
  },
  {
    category: 'For Guards',
    question: 'How many jobs can a guard apply for?',
    answer:
      'Applications are free and are not capped by a paid plan. Whether you are selected is always the client\u2019s decision, based on the job requirements, your licence, experience and availability. A paid membership cannot buy a higher position in a client\u2019s applicant list.',
  },
  {
    category: 'For Guards',
    question: 'When and how do guards get paid?',
    answer:
      `${GUARD_PAYOUT_SETUP_GUIDANCE} ${GUARD_COMPLETION_GUIDANCE} After the client approves completion and the applicable payment, dispute and Stripe account checks are met, eligible earnings are released to your connected Stripe account. On new bookings the agreed gross pay is not reduced by a platform or booking commission. ${GUARD_BANK_DEPOSIT_GUIDANCE}`,
  },
  {
    category: 'For Guards',
    question: 'What if the client has not confirmed completion or my payout is delayed?',
    answer: GUARD_PAYOUT_SUPPORT_GUIDANCE,
  },
  {
    category: 'For Clients',
    question: 'Can I check guard availability before creating an account?',
    answer:
      'Yes. A guest can enter a venue, shift date and times to see whether guards indicate availability for that area and time. A match is not a reservation, does not hold a guard and does not guarantee cover. To receive responses you still need to sign in or create an account and post the job.',
  },
  {
    category: 'For Clients',
    question: 'Is there a cost for clients to post a job?',
    answer:
      'Creating an account is free and the Free Starter plan includes one job posting per month. Posting a job does not charge the booking payment \u2014 you pay per booking after you select guards and review the agreed guard pay plus your plan\u2019s service fee and any eligible promotion. Your plan allowance is 1, 10, 30 or unlimited job postings per month.',
  },
  {
    category: 'For Clients',
    question: 'When is my guard selection confirmed?',
    answer:
      'Selecting guards is provisional. The shift is only confirmed once the Stripe booking payment completes. Until then the booking is not final and the guard is not committed to the shift.',
  },
  {
    category: 'For Clients',
    question: 'How quickly can I find a security guard?',
    answer:
      'There is no guaranteed response time or guaranteed cover. When you post, guards whose licence, coverage and availability fit the job are notified and can respond. You can review responses as they arrive and select the guards you want, subject to payment.',
  },
  {
    category: 'For Clients',
    question: 'Are all guards on the platform verified?',
    answer:
      'Every guard must hold a valid SIA licence and submit their licence details for verification before they can apply for work. Each job also applies its own licence and site requirements at the point guards apply. Verification reflects the information checked at the time and is not a guarantee of a guard\u2019s future licence status.',
  },
  {
    category: 'Payments & Security',
    question: 'How do subscription and booking payments work?',
    answer:
      'They are two separate charges. Client plans are £0, £49, £99 and £199 per month with standard booking service fees of 15%, 10%, 7.5% and 5%, and posting allowances of 1, 10, 30 and unlimited jobs per month. Your subscription covers the plan services and allowance; guard services are paid separately for each booking. A subscription never covers the guard\u2019s pay, and no plan removes booking fees entirely.',
  },
  {
    category: 'Payments & Security',
    question: 'Do guards pay a booking commission?',
    answer:
      'No. On new bookings the agreed gross guard pay is not reduced by a platform or booking commission. QuickGuard\u2019s service fee is a separate client charge added to the booking total, and standard payment processing is included in the client charges rather than deducted from guard pay.',
  },
  {
    category: 'Payments & Security',
    question: 'Is Stripe processing charged separately?',
    answer:
      'No separate card surcharge is added at checkout \u2014 standard payment processing is included in the client charges. Any applicable promotion reduces the booking service fee, and the final amount is always shown before you confirm payment.',
  },
  {
    category: 'Payments & Security',
    question: 'How does payment release work?',
    answer:
      'You review the agreed guard pay, your plan\u2019s service fee and any eligible promotion, then pay through Stripe before the booking is confirmed. After the shift the guard checks in and out and marks completion, and you approve it or raise a dispute. An open dispute or payment issue can pause release while it is reviewed. Once the release checks are met, eligible guard pay is transferred to the guard\u2019s connected Stripe account, and the bank payout is a separate later step on the guard\u2019s payout schedule. Cancellations or disputes can affect release under the published policy \u2014 existing funded bookings keep their recorded amounts and terms.',
  },
  {
    category: 'General',
    question: 'Which areas of the UK does QuickGuard.uk cover?',
    answer:
      'The platform is used across the United Kingdom, including England, Scotland, Wales and Northern Ireland. Guards set their own coverage area and travel radius, so the guards who can respond depend on the job location and their stated availability.',
  },
];

export default function FAQList() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="space-y-4">
      {faqs.map((faq, index) => (
        <div
          key={index}
          className="border border-slate-700/50 rounded-xl overflow-hidden hover:border-teal-500/30 transition-colors duration-200 bg-[#111d35]"
        >
          <button
            onClick={() => toggle(index)}
            className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-[#0e1628] transition-colors duration-200 cursor-pointer"
            aria-expanded={openIndex === index}
          >
            <div className="flex items-center gap-3 pr-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-teal-400 bg-teal-500/10 px-2 py-1 rounded-full border border-teal-400/20 whitespace-nowrap">
                {faq.category}
              </span>
              <span className="text-base font-semibold text-white">{faq.question}</span>
            </div>
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <i
                className={`ri-arrow-down-s-line text-xl text-teal-400 transition-transform duration-300 ${
                  openIndex === index ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              openIndex === index ? 'max-h-none opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="px-6 pb-5 pt-2 bg-[#0e1628] border-t border-slate-700/50">
              <p className="text-slate-400 leading-relaxed text-sm">{faq.answer}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}