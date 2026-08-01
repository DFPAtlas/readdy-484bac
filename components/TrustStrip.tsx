'use client';

import { useState, useEffect } from 'react';

const trustSignals = [
  { icon: 'ri-shield-check-line', label: 'All Guards SIA-Verified', sub: 'Licence checked every 6 months' },
  { icon: 'ri-lock-line', label: 'Held Job Payment with Stripe', sub: 'Released only after shift completion' },
  { icon: 'ri-money-pound-circle-line', label: 'Pay Per Shift', sub: 'No contracts, no subscriptions' },
  { icon: 'ri-map-pin-2-line', label: 'UK-Wide Coverage', sub: 'Guards in every major city' },
];

export default function TrustStrip() {
  const [jsEnabled, setJsEnabled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setJsEnabled(true);
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    const el = document.getElementById('trust-strip');
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="trust-strip" className="py-12 bg-[#0B1933] border-b border-slate-800/60" aria-label="Trust signals">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div
          className={`grid grid-cols-2 md:grid-cols-4 gap-6 transition-all duration-1000 ${
            jsEnabled && !isVisible ? 'opacity-0 translate-y-6' : 'opacity-100 translate-y-0'
          }`}
        >
          {trustSignals.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500/10 rounded-lg flex items-center justify-center border border-teal-400/20 flex-shrink-0">
                <i className={`${s.icon} text-teal-400 text-lg`} aria-hidden="true"></i>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{s.label}</p>
                <p className="text-xs text-slate-500">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}