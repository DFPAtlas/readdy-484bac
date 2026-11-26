'use client';

import { useState } from 'react';
import { FAQS } from './industriesContent';

export default function IndustriesFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="industries-faq-heading">
      <div className="max-w-3xl mx-auto px-6 md:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <i className="ri-question-line" aria-hidden="true" />
            Common questions
          </div>
          <h2 id="industries-faq-heading" className="text-3xl font-bold text-white">
            Availability, fees and licences
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, index) => {
            const isOpen = open === index;
            return (
              <div key={faq.question} className="bg-[#111d35] border border-slate-700/50 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left cursor-pointer hover:bg-[#0e1628] transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-wide text-teal-400 bg-teal-500/10 px-2 py-1 rounded-full border border-teal-400/20 whitespace-nowrap">
                      {faq.category}
                    </span>
                    <span className="font-semibold text-white text-sm">{faq.question}</span>
                  </span>
                  <i
                    className={`ri-arrow-down-s-line text-teal-400 text-lg transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-slate-700/50 pt-4">
                    <p className="text-sm text-slate-400 leading-relaxed">{faq.answer}</p>
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