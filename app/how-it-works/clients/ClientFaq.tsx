'use client';

import { useState } from 'react';
import { QUICKGUARD_TAX_NOTE } from '@/lib/public-pricing';

const FAQS = [
  {
    category: 'Availability',
    question: 'Can I check guard availability before creating an account?',
    answer:
      'Yes. As a guest you can enter a venue, shift date and shift times to see whether guards appear to be available for that time and place. The check compares your details with the matching criteria guards have actually recorded, such as their coverage area, travel radius and stated shift availability.',
  },
  {
    category: 'Availability',
    question: 'Does an availability match reserve a guard?',
    answer:
      'No. A match is an indication based on what guards have recorded, not a reservation and not a guaranteed cover. No guard is held by the check, response times vary, and cover depends on guards choosing to apply for your job.',
  },
  {
    category: 'Posting',
    question: 'What does it cost to post a job?',
    answer:
      'Creating an account is free, and your plan includes a monthly job posting allowance. Posting a job itself does not charge the booking payment: you pay per booking after you have selected guards and reviewed the agreed gross guard pay, your plan\u2019s booking service fee and any eligible promotion.',
  },
  {
    category: 'Posting',
    question: 'How many jobs can I post each month?',
    answer:
      'Your plan sets a monthly posting allowance, from a single posting on the free plan up to unlimited postings on the highest plan. The current allowance for each plan is listed on the pricing page and shown in your account.',
  },
  {
    category: 'Guards',
    question: 'How are the guards who respond chosen?',
    answer:
      'Guards whose recorded licence, coverage and availability fit the job are notified and can apply. Guard registration, browsing and applications are free, with no paid guard memberships, no paid job tiers and no paid priority in job discovery or applicant order. You review the responses and make the selection.',
  },
  {
    category: 'Guards',
    question: 'Do guards pay to join, browse or apply?',
    answer:
      'No. Guard registration, job browsing and applications are free, and there is no paid membership and no paid priority. Guards still need an approved account with a valid SIA licence on record before they can apply, and each job applies its own licence and site requirements.',
  },
  {
    category: 'Payment',
    question: 'When is my guard selection confirmed?',
    answer:
      'Selecting guards is provisional. The shift is confirmed only once the Stripe booking payment completes. Until then the booking is not final and the guard is not committed to the shift.',
  },
  {
    category: 'Payment',
    question: 'What does the guard actually receive?',
    answer:
      'The agreed gross hourly rate multiplied by the booked hours. On new bookings that amount is not reduced by a platform or booking commission. Your plan\u2019s booking service fee is a separate client charge added on top of the agreed guard pay, not deducted from it.',
  },
  {
    category: 'Payment',
    question: 'How do check-in, completion and approval work?',
    answer:
      'The guard checks in at the start of the shift and checks out at the end, then marks the shift complete. You approve the completion or raise a dispute. An open dispute can pause payment release while the circumstances are reviewed.',
  },
  {
    category: 'Payment',
    question: 'When does the guard get paid, and when does it reach their bank?',
    answer:
      'After completion approval and the applicable payment, dispute and Stripe account checks, eligible guard pay is transferred to the guard\u2019s connected Stripe account. That step is not the same as a bank payment: the payout from the guard\u2019s Stripe balance to their own bank account happens separately and follows their payout schedule, so bank arrival times can vary.',
  },
  {
    category: 'Fees & tax',
    question: 'Can a promotion reduce the booking service fee?',
    answer:
      'Yes, where you are eligible. A promotion can lower the service fee and, where the promotion supports it, reduce it to zero. The amount that applies to your booking is shown in the payment summary before you confirm.',
  },
  {
    category: 'Fees & tax',
    question: 'Are QuickGuard fees shown with VAT?',
    answer: QUICKGUARD_TAX_NOTE,
  },
];

export default function ClientFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {FAQS.map((faq, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={faq.question}
            className="border border-slate-700/50 rounded-xl overflow-hidden hover:border-teal-500/30 transition-colors duration-200 bg-[#111d35]"
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-[#0e1628] transition-colors duration-200 cursor-pointer"
              aria-expanded={isOpen}
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
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {isOpen && (
              <div className="px-6 pb-5 pt-2 bg-[#0e1628] border-t border-slate-700/50">
                <p className="text-slate-400 leading-relaxed text-sm">{faq.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}