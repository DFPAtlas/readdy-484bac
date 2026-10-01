'use client';

import { useState } from 'react';
import type { IndustryFaq } from './types';

interface Props {
  faqs: IndustryFaq[];
}

export default function IndustryFaq({ faqs }: Props) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="faq-heading">
      <div className="max-w-3xl mx-auto px-6 md:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <i className="ri-question-line" aria-hidden="true" />
            FAQ
          </div>
          <h2 id="faq-heading" className="text-3xl font-bold text-white">Common Questions</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={faq.q} className="bg-[#111d35] border border-slate-700/50 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 p-5 text-left cursor-pointer"
                aria-expanded={open === i}
              >
                <span className="font-semibold text-white text-sm">{faq.q}</span>
                <i className={`ri-arrow-down-s-line text-teal-400 text-lg transition-transform shrink-0 ${open === i ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {open === i && (
                <div className="px-5 pb-5">
                  <p className="text-sm text-slate-400 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}