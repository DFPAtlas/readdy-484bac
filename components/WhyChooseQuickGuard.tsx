'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const comparisons = [
  {
    label: 'Time to book',
    quickguard: 'Under 5 minutes',
    agency: 'Days of calls & paperwork',
    highlight: true,
  },
  {
    label: 'Cost per hour',
    quickguard: 'You set the rate',
    agency: 'Markup + hidden fees',
    highlight: true,
  },
  {
    label: 'Contract lock-in',
    quickguard: 'None — book by the shift',
    agency: 'Minimum 3-12 month term',
  },
  {
    label: 'Choose your guard',
    quickguard: 'Browse profiles & reviews',
    agency: 'Assigned randomly',
  },
  {
    label: 'Payment protection',
    quickguard: 'Held with Stripe until done',
    agency: 'Pay upfront, chase refunds',
  },
  {
    label: 'Licence verification',
    quickguard: 'SIA badge checked automatically',
    agency: 'Manual checks, often skipped',
  },
];

export default function WhyChooseQuickGuard() {
  const [jsEnabled, setJsEnabled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setJsEnabled(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    const el = document.getElementById('why-qg');
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="why-qg" className="py-20 bg-[#0e1628] border-y border-slate-800/60" aria-labelledby="why-heading">
      <div className="max-w-5xl mx-auto px-6 md:px-8">
        <div
          className={`text-center mb-14 transition-all duration-1000 ${
            jsEnabled && !isVisible ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
          }`}
        >
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <i className="ri-scales-3-line" aria-hidden="true"></i>
            Compare
          </div>
          <h2 id="why-heading" className="text-3xl md:text-4xl font-bold text-white mb-3">
            Why QuickGuard vs a Security Company?
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            No middlemen. No long contracts. Just verified guards when you need them.
          </p>
        </div>

        <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-3 gap-0 border-b border-slate-700/50">
            <div className="p-4 md:p-5 text-sm font-semibold text-slate-500 uppercase tracking-wider"></div>
            <div className="p-4 md:p-5 text-sm font-bold text-teal-400 text-center bg-teal-500/5">
              <i className="ri-shield-check-line mr-1" aria-hidden="true"></i>
              QuickGuard
            </div>
            <div className="p-4 md:p-5 text-sm font-bold text-slate-400 text-center">
              <i className="ri-building-2-line mr-1" aria-hidden="true"></i>
              Traditional Agency
            </div>
          </div>
          {comparisons.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-3 gap-0 ${i < comparisons.length - 1 ? 'border-b border-slate-700/30' : ''} ${
                row.highlight ? 'bg-teal-500/[0.03]' : ''
              }`}
            >
              <div className="p-4 md:p-5 text-sm font-medium text-slate-300 flex items-center">
                {row.label}
              </div>
              <div className="p-4 md:p-5 text-sm text-teal-300 text-center font-medium flex items-center justify-center">
                <i className="ri-check-line text-teal-500 mr-1.5" aria-hidden="true"></i>
                {row.quickguard}
              </div>
              <div className="p-4 md:p-5 text-sm text-slate-500 text-center flex items-center justify-center">
                {row.agency}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/client/register"
            prefetch={false}
            className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-teal-500/30 focus:outline-none"
          >
            <i className="ri-shield-check-line" aria-hidden="true"></i>
            Hire a Guard Now
          </Link>
          <p className="text-sm text-slate-500 mt-3">
            No credit card required to post <span className="mx-1">&#183;</span> Pay only when you book
          </p>
        </div>
      </div>
    </section>
  );
}