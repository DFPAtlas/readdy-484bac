
'use client';

import { useEffect, useState } from 'react';

const badges = [
  {
    icon: 'ri-shield-star-line',
    title: 'SIA Licence Checked',
    description: "Every guard's SIA licence is checked before they can take work through QuickGuard.",
    color: 'blue',
  },
  {
    icon: 'ri-lock-line',
    title: 'Held Job Payments',
    description: 'Your payment is held until the shift is confirmed complete, then released to the guard.',
    color: 'green',
  },
  {
    icon: 'ri-secure-payment-line',
    title: 'Payments by Stripe',
    description: 'Card payments are processed by Stripe, a PCI DSS Level 1 certified provider. QuickGuard never stores your card details.',
    color: 'purple',
  },
  {
    icon: 'ri-file-shield-2-line',
    title: 'ICO Registered',
    description: "Registered with the Information Commissioner's Office. Personal data handled under UK GDPR.",
    color: 'indigo',
  },
];

export default function TrustBadges() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    const el = document.getElementById('trust-badges-section');
    if (el) observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-20 bg-[#0B1933]" aria-labelledby="trust-heading">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div
          id="trust-badges-section"
          className={`text-center mb-14 transition-all duration-1000 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <i className="ri-shield-check-line" aria-hidden="true"></i>
            Trusted &amp; Certified
          </div>
          <h2 id="trust-heading" className="text-4xl font-bold text-white mb-4">
            How We Keep Bookings Safe
          </h2>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto">
            The checks and protections built into every booking
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {badges.map((badge, index) => (
              <div
                key={badge.title}
                className={`group relative bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 transition-all duration-700 hover:border-teal-500/30 hover:-translate-y-1 cursor-default ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 120}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-14 h-14 flex items-center justify-center rounded-xl bg-teal-500/10 border border-teal-400/20 shrink-0 transition-transform duration-300 group-hover:scale-110"
                  >
                    <i className={`${badge.icon} text-2xl text-teal-400`} aria-hidden="true"></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{badge.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{badge.description}</p>
                  </div>
                </div>
              </div>
            ))}
        </div>

        <div
          className={`mt-14 bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-1000 delay-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20">
              <i className="ri-award-line text-2xl text-teal-400" aria-hidden="true"></i>
            </div>
            <div>
              <p className="font-semibold text-white text-lg">
                Every Guard Licence-Checked
              </p>
              <p className="text-slate-400 text-sm">
                Guards must pass an SIA licence check before they can accept any work.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 border-2 border-[#111d35] flex items-center justify-center"
                >
                  <i className="ri-user-line text-white text-sm" aria-hidden="true"></i>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
