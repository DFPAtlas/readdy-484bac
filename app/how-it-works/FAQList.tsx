'use client';

import { useState } from 'react';

const faqs = [
  {
    category: 'General',
    question: 'What is QuickGuard.uk?',
    answer:
      'QuickGuard.uk is a UK-based platform that connects SIA-licensed security guards with clients who need professional security services. Our AI-powered matching system ensures the right guard is paired with the right job, anywhere across England, Scotland, Wales, and Northern Ireland.',
  },
  {
    category: 'For Guards',
    question: 'Do I need an SIA licence to join as a security guard?',
    answer:
      'Yes. All security guards on QuickGuard.uk must hold a valid SIA (Security Industry Authority) licence. We verify every guard\'s licence before they can apply for jobs, ensuring clients always work with fully compliant professionals.',
  },
  {
    category: 'For Guards',
    question: 'How much does it cost for guards to use the platform?',
    answer:
      'Guard membership starts from \u00a310/month (Basic), with Pro at \u00a319/month and Elite at \u00a329/month. Annual options are available. Membership is separate from your earnings \u2014 you always receive your full agreed pay on bookings, with no guard commission.',
  },
  {
    category: 'For Guards',
    question: 'When and how do guards get paid?',
    answer:
      'After the client confirms the shift is complete, your pay is released under the existing confirmation, dispute and payout process. You receive your full agreed pay with no guard booking commission, and standard payout costs are covered by the client booking service fee. Payouts follow the existing Stripe onboarding and account eligibility checks \u2014 we do not promise instant payouts or fixed payout deadlines.',
  },
  {
    category: 'For Clients',
    question: 'Is there a cost for clients to post a job?',
    answer:
      'Creating an account is free, and the Free plan publishes jobs within its monthly allowance. Posting a job does not charge the booking payment \u2014 you pay per booking, after you select a guard and review the agreed guard pay plus your plan\u2019s service fee and any eligible promotion. Payment is taken securely through Stripe before the booking is confirmed and held with Stripe until release.',
  },
  {
    category: 'For Clients',
    question: 'How quickly can I find a security guard?',
    answer:
      'Our AI matching system instantly surfaces the most suitable verified guards for your job. Many clients receive applications within minutes of posting. You can review profiles, check SIA credentials, and confirm a guard \u2014 all within the same day.',
  },
  {
    category: 'For Clients',
    question: 'Are all guards on the platform verified?',
    answer:
      'Yes. Every guard undergoes SIA licence verification before being approved on the platform. We check licence validity, specialisations, and compliance status so you can hire with complete confidence. Automated SIA licence rechecks are scheduled weekly. Failed licence checks block new work; uncertain results and worker delays are flagged for admin review.',
  },
  {
    category: 'Payments & Security',
    question: 'How do subscription and booking payments work?',
    answer:
      'They are two separate charges. Your subscription pays for platform features and your monthly posting allowance, and it sets your booking service fee (15% on Free, down to 5% on Enterprise). Guard services are paid separately for each booking \u2014 a subscription never covers the guard\u2019s pay, and no plan removes booking fees entirely.',
  },
  {
    category: 'Payments & Security',
    question: 'Do guards pay a booking commission?',
    answer:
      'No. Guards receive their full agreed pay on new bookings and pay no booking commission. Guard membership is separate from earnings, and QuickGuard does not deduct anything from guard pay.',
  },
  {
    category: 'Payments & Security',
    question: 'Is Stripe processing charged separately?',
    answer:
      'No. Payment processing and standard guard payouts are included \u2014 there is no separate Stripe or card surcharge for clients, and nothing is deducted from guard pay. Any applicable tax is only shown where supported by the implemented checkout.',
  },
  {
    category: 'Payments & Security',
    question: 'How does the payment protection work?',
    answer:
      'You review the agreed guard pay, your plan\u2019s service fee and any eligible promotion, then pay securely through Stripe before the booking is confirmed. Funds remain with Stripe pending completion and the applicable release checks, and guard pay is released after completion. Cancellations or disputes can affect release under the published policy \u2014 existing funded bookings keep their recorded amounts and terms.',
  },
  {
    category: 'General',
    question: 'Which areas of the UK does QuickGuard.uk cover?',
    answer:
      'We cover the entire United Kingdom \u2014 including major cities like London, Manchester, Birmingham, Edinburgh, Cardiff, and Belfast, as well as regional and rural areas. Guards can set their preferred coverage radius when creating their profile.',
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
              openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
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