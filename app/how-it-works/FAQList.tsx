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
      'Guards pay a monthly subscription starting from \u00a310/month. There are multiple tiers available depending on the level of visibility and features you need. You can view all plans on our Pricing page.',
  },
  {
    category: 'For Guards',
    question: 'When and how do guards get paid?',
    answer:
      'Once a client confirms job completion, payment is released to your account minus a 5% platform fee. Funds are transferred directly to your registered UK bank account. You also receive automatic UTR and tax documentation to stay HMRC compliant.',
  },
  {
    category: 'For Clients',
    question: 'Is there a cost for clients to post a job?',
    answer:
      'There are no upfront costs or setup fees for clients. You only pay when a shift is successfully completed. Our transparent commission model means you always know exactly what you\'re paying for.',
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
      'Yes. Every guard undergoes SIA licence verification before being approved on the platform. We check licence validity, specialisations, and compliance status so you can hire with complete confidence.',
  },
  {
    category: 'Payments & Security',
    question: 'How does the payment protection work?',
    answer:
      'Clients pre-pay for the shift and funds are held securely with Stripe during the job. Payment is only released to the guard once the client confirms the shift has been completed satisfactorily. This protects both parties throughout the process.',
  },
  {
    category: 'Payments & Security',
    question: 'Is the platform HMRC compliant?',
    answer:
      'Yes. QuickGuard.uk is fully HMRC compliant. Guards receive automatic tax documentation and UTR support. All transactions are processed through our secure, regulated payment system.',
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
              openIndex === index ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
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