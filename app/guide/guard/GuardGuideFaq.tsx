'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GUARD_GUIDE_FAQS } from './guardGuideContent';

export default function GuardGuideFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="guard-faq" className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-question-line text-sm" />
          </div>
          Guard FAQ
        </div>
        <h2 className="text-3xl font-extrabold text-white mb-3">Questions Guards Ask Most</h2>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Free applications, licence review, selection, payouts and legacy membership records explained.
        </p>
      </div>

      <div className="space-y-3">
        {GUARD_GUIDE_FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={faq.question}
              className={`bg-[#111d35] rounded-2xl border transition-all ${
                isOpen ? 'border-teal-500/30' : 'border-slate-700/50 hover:border-teal-500/20'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="w-full flex items-start gap-4 p-5 text-left cursor-pointer"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-500/10 border border-teal-400/20 flex-shrink-0 mt-0.5">
                  <i className="ri-question-line text-teal-400 text-sm" />
                </div>
                <span className="flex-1 text-sm md:text-base font-semibold text-white">{faq.question}</span>
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-slate-400">
                  <i className={`ri-arrow-down-s-line text-xl transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pl-[68px]">
                  <p className="text-sm text-slate-400 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/guard/support"
          className="flex items-center gap-3 p-4 bg-[#111d35] rounded-2xl border border-slate-700/50 hover:border-teal-500/30 transition-all cursor-pointer"
        >
          <div className="w-10 h-10 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-xl flex-shrink-0">
            <i className="ri-customer-service-2-line text-teal-400 text-lg" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Guard support centre</p>
            <p className="text-xs text-slate-500">Booking and account help</p>
          </div>
        </Link>
        <Link
          href="/guard/dashboard#guard-membership"
          className="flex items-center gap-3 p-4 bg-[#111d35] rounded-2xl border border-slate-700/50 hover:border-teal-500/30 transition-all cursor-pointer"
        >
          <div className="w-10 h-10 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-xl flex-shrink-0">
            <i className="ri-receipt-line text-teal-400 text-lg" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Legacy membership card</p>
            <p className="text-xs text-slate-500">Manage an existing subscription</p>
          </div>
        </Link>
        <Link
          href="/guard/bank-settings"
          className="flex items-center gap-3 p-4 bg-[#111d35] rounded-2xl border border-slate-700/50 hover:border-teal-500/30 transition-all cursor-pointer"
        >
          <div className="w-10 h-10 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-xl flex-shrink-0">
            <i className="ri-bank-line text-teal-400 text-lg" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Bank settings</p>
            <p className="text-xs text-slate-500">Stripe payout setup</p>
          </div>
        </Link>
      </div>
    </section>
  );
}