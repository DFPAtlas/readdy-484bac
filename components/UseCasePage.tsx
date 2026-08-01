'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Step {
  icon: string;
  title: string;
  desc: string;
}

interface FAQ {
  q: string;
  a: string;
}

interface UseCaseData {
  slug: string;
  title: string;
  headline: string;
  subheadline: string;
  heroImage: string;
  steps: Step[];
  faqs: FAQ[];
  testimonialQuote: string;
  testimonialAuthor: string;
  testimonialVenue: string;
  venueCategory: string;
  ctaLabel: string;
}

export default function UseCasePage({ data }: { data: UseCaseData }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [jsEnabled, setJsEnabled] = useState(false);
  const [isVisible, setIsVisible] = useState<Record<string, boolean>>();

  useEffect(() => {
    setJsEnabled(true);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(prev => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <section
        className="relative min-h-[560px] md:min-h-[640px] flex items-center bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(11, 26, 51, 0.95) 0%, rgba(11, 26, 51, 0.85) 50%, rgba(11, 26, 51, 0.5) 100%), url('${data.heroImage}')`,
        }}
      >
        <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-teal-500/15 border border-teal-400/30 text-teal-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6 backdrop-blur-sm">
              <i className="ri-shield-check-line"></i>
              SIA-Verified Guards Available Now
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-[1.1] text-white">
              {data.headline}
            </h1>
            <p className="text-lg md:text-xl mb-8 text-slate-300 max-w-xl leading-relaxed">
              {data.subheadline}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/client/register"
                prefetch={false}
                className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-teal-500/30 focus:outline-none text-center"
              >
                {data.ctaLabel}
              </Link>
              <Link
                href="/find-a-guard"
                prefetch={false}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-white/20 focus:outline-none backdrop-blur-sm text-center"
              >
                Browse Guards
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="steps-heading">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-lightbulb-line"></i>
              How It Works
            </div>
            <h2 id="steps-heading" className="text-3xl md:text-4xl font-bold text-white mb-3">
              Hire Security in 4 Simple Steps
            </h2>
          </div>
          <ol className="grid md:grid-cols-4 gap-6 list-none p-0 m-0">
            {data.steps.map((step, i) => (
              <li
                key={i}
                data-animate
                id={`step-${i}`}
                className={`bg-[#111d35] border border-slate-700/50 p-6 rounded-2xl text-center transition-all duration-1000 delay-${(i + 1) * 200} hover:border-teal-500/30 hover:scale-[1.02] ${
                  jsEnabled && !isVisible[`step-${i}`] ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'
                }`}
              >
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl mx-auto mb-4 border border-teal-400/20">
                  <span className="text-lg font-bold text-teal-400">{i + 1}</span>
                </div>
                <div className="w-8 h-8 flex items-center justify-center mx-auto mb-3">
                  <i className={`${step.icon} text-xl text-teal-400`}></i>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-label="Trust signals">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: 'ri-shield-check-line', label: 'All Guards SIA-Verified', desc: 'Automatic licence checking against the SIA register' },
              { icon: 'ri-lock-line', label: 'Held Job Payment with Stripe', desc: 'Funds released only after the shift is complete' },
              { icon: 'ri-money-pound-circle-line', label: 'Pay Per Shift', desc: 'No contracts, no subscriptions, no hidden fees' },
              { icon: 'ri-map-pin-2-line', label: 'UK-Wide Coverage', desc: 'Guards in London, Manchester, Birmingham & beyond' },
            ].map((s) => (
              <div key={s.label} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 text-center hover:border-teal-500/30 transition-all">
                <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 border border-teal-400/20">
                  <i className={`${s.icon} text-xl text-teal-400`}></i>
                </div>
                <h3 className="font-semibold text-white mb-1">{s.label}</h3>
                <p className="text-sm text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-label="Testimonial">
        <div className="max-w-3xl mx-auto px-6 md:px-8 text-center">
          <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 md:p-12">
            <div className="w-12 h-12 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-teal-400/20">
              <i className="ri-double-quotes-l text-2xl text-teal-400"></i>
            </div>
            <blockquote className="text-xl md:text-2xl text-white font-medium leading-relaxed mb-6">
              &ldquo;{data.testimonialQuote}&rdquo;
            </blockquote>
            <div>
              <p className="font-semibold text-teal-400">{data.testimonialAuthor}</p>
              <p className="text-sm text-slate-500">{data.testimonialVenue}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="faq-heading">
        <div className="max-w-3xl mx-auto px-6 md:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-question-line"></i>
              FAQ
            </div>
            <h2 id="faq-heading" className="text-3xl font-bold text-white">Common Questions</h2>
          </div>
          <div className="space-y-3">
            {data.faqs.map((faq, i) => (
              <div key={i} className="bg-[#111d35] border border-slate-700/50 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left cursor-pointer"
                >
                  <span className="font-semibold text-white text-sm">{faq.q}</span>
                  <i className={`ri-arrow-down-s-line text-teal-400 text-lg transition-transform ${openFaq === i ? 'rotate-180' : ''}`}></i>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5">
                    <p className="text-sm text-slate-400 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-[#0B1933] relative overflow-hidden" aria-label="Call to action">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-6 md:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Ready to Secure Your Venue?
          </h2>
          <p className="text-xl mb-10 text-slate-400 max-w-2xl mx-auto">
            Post your job in under 5 minutes. Pay-as-you-go — no contracts, no subscriptions. SIA-verified guards in your area will be notified instantly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/client/register"
              prefetch={false}
              className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-teal-500/30 focus:outline-none"
            >
              {data.ctaLabel}
            </Link>
            <Link
              href="/find-a-guard"
              prefetch={false}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap focus:ring-4 focus:ring-white/20 focus:outline-none backdrop-blur-sm"
            >
              Browse Available Guards
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}