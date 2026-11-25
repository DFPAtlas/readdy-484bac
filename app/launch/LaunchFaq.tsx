'use client';

import { useState } from 'react';

const FAQS = [
  {
    question: 'Who is eligible?',
    answer: 'Eligible new clients who choose the monthly Client Pro offer during the campaign. Guard job access is free without a paid membership.',
  },
  {
    question: 'What\u2019s free?',
    answer: 'Eligible new clients pay no monthly Client Pro subscription until 1 January 2027. Booking payments and service fees remain separate. Guards have free job access without a paid membership.',
  },
  {
    question: 'What happens in January?',
    answer: 'For the Client Pro offer, £99/month starts on 1 January 2027 unless cancelled. Guard job access remains free.',
  },
  {
    question: 'What does the SIA licence check involve?',
    answer:
      'We verify your licence number against the official SIA register, checking that it is valid, current and held in your name. It happens automatically when you sign up, so there is nothing extra to send us.',
  },
];

export default function LaunchFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-20 bg-[#0e1628]">
      <div className="max-w-3xl mx-auto px-6 md:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Frequently asked questions</h2>
          <p className="text-lg text-slate-400">The essentials about the December launch offer.</p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className="bg-[#111d35] border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600 transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left cursor-pointer"
                >
                  <span className="flex items-center gap-3 flex-1">
                    <i className="ri-question-line text-teal-400" aria-hidden="true" />
                    <span className="font-semibold text-white text-base">{faq.question}</span>
                  </span>
                  <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <i
                      className={`ri-arrow-down-s-line text-xl text-slate-400 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pl-12">
                    <p className="text-slate-400 text-sm leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}