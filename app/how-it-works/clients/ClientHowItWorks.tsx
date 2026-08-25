'use client';

import Footer from '../../../components/Footer';
import Header from '../../../components/Header';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import FAQList from '../FAQList';

const CLIENT_STEPS = [
  {
    icon: 'ri-file-list-3-line',
    title: 'Post Your Job',
    desc: 'Tell us your venue type, shift date, location, and how many guards you need. It takes under 2 minutes.',
  },
  {
    icon: 'ri-robot-line',
    title: 'AI Finds Matching Guards',
    desc: 'Our system instantly surfaces verified, SIA-licensed guards in your area with the right licence type.',
  },
  {
    icon: 'ri-user-search-line',
    title: 'Browse Profiles & Book',
    desc: 'View guard photos, ratings, hourly rates, and verified SIA badges. Pick your favourite and request a booking.',
  },
  {
    icon: 'ri-secure-payment-line',
    title: 'Pay & Confirm',
    desc: 'Pre-pay securely via Stripe. Funds are held with Stripe and released only after the shift is marked complete.',
  },
];

const CLIENT_STATS = [
  { icon: 'ri-timer-flash-line', value: '< 2 hrs', label: 'Average time to hire' },
  { icon: 'ri-shield-check-line', value: '100%', label: 'SIA-licensed guards' },
  { icon: 'ri-map-pin-2-line', value: 'UK-wide', label: 'Coverage everywhere' },
  { icon: 'ri-lock-2-line', value: 'Held with Stripe', label: 'Your money is protected' },
];

const VENUE_TYPES = [
  { icon: 'ri-door-open-line', label: 'Nightclubs & Bars', slug: 'nightclub_bar', href: '/security-for-nightclubs' },
  { icon: 'ri-store-2-line', label: 'Retail & Shops', slug: 'retail_shop', href: '/security-for-shops' },
  { icon: 'ri-hammer-line', label: 'Construction Sites', slug: 'construction_site', href: '/security-for-building-sites' },
  { icon: 'ri-calendar-event-line', label: 'Private Events', slug: 'private_event', href: '/security-for-events' },
  { icon: 'ri-building-2-line', label: 'Office Buildings', slug: 'office_building', href: '/post-job' },
  { icon: 'ri-store-3-line', label: 'Warehouses', slug: 'warehouse_property', href: '/post-job' },
];

const TESTIMONIALS = [
  {
    text: 'We needed a door supervisor for a busy Saturday night. Posted the job at 2pm, had a guard confirmed by 3:30pm. No paperwork, no agency calls. Brilliant.',
    name: 'Sarah M.',
    role: 'Venue Manager · London',
    stars: 5,
  },
  {
    text: 'Used QuickGuard for our wedding reception security. The guard turned up early, was professional, and the held job payment with Stripe gave us peace of mind.',
    name: 'James R.',
    role: 'Private Client · Manchester',
    stars: 5,
  },
  {
    text: 'As a retail chain we were tied into a 12-month agency contract. Switching to QuickGuard cut our costs by 30% and we only pay for the shifts we actually need.',
    name: 'David H.',
    role: 'Operations Director · Leeds',
    stars: 5,
  },
];

export default function ClientHowItWorks() {
  const [isVisible, setIsVisible] = useState<Record<string, boolean>>();
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && mountedRef.current) {
            setIsVisible((prev) => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.15 }
    );
    const elements = document.querySelectorAll('[data-animate]');
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % CLIENT_STEPS.length);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <Header />
      
      {/* HERO */}
      <section
        aria-labelledby="clients-heading"
        className="relative min-h-[62vh] flex items-center bg-cover bg-center bg-no-repeat pt-24"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(11, 26, 51, 0.92) 0%, rgba(11, 26, 51, 0.6) 50%, rgba(14, 22, 40, 0.4) 100%), url('https://readdy.ai/api/search-image?query=Professional%20British%20business%20owner%20woman%20standing%20confidently%20in%20front%20of%20a%20modern%20UK%20venue%20entrance%20at%20twilight%2C%20warm%20street%20lighting%2C%20deep%20navy%20blue%20and%20teal%20color%20tones%2C%20cinematic%20wide%20angle%20shot%2C%20representing%20direct%20hiring%20of%20security%20staff%2C%20moody%20professional%20atmosphere%2C%20clean%20modern%20website%20hero%20background%20with%20space%20for%20text%20on%20the%20left%20side&width=1200&height=600&seq=hiw-clients-hero-001&orientation=landscape')`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B1933]/50 via-transparent to-[#0B1933]" aria-hidden="true" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-10">
          <div className="lg:w-3/5 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <i className="ri-building-2-line" />
              For Direct Clients
            </div>
            <h1 id="clients-heading" className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Hire SIA Guards<br className="hidden md:block" /> Directly — <span className="text-teal-400">No Agency</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-xl mb-8">
              Post your shift. Browse verified guards. Book instantly. No contracts, no hidden fees — just professional security when you need it.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/post-job"
                className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-7 py-3.5 rounded-xl font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap cursor-pointer shadow-lg hover:shadow-teal-500/20"
              >
                <i className="ri-file-list-3-line" /> Post Your First Job
              </Link>
              <Link
                href="/find-a-guard"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-7 py-3.5 rounded-xl font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-user-search-line" /> Browse Guards
              </Link>
            </div>
          </div>

          {/* Video Placeholder Card */}
          <div className="lg:w-2/5 w-full max-w-md">
            <div className="bg-[#111d35] rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
              <div className="relative aspect-video bg-[#0e1628] flex items-center justify-center overflow-hidden">
                <img
                  src="https://readdy.ai/api/search-image?query=Modern%20dark-themed%20laptop%20screen%20displaying%20a%20security%20guard%20hiring%20platform%20dashboard%20showing%20guard%20profiles%20with%20ratings%20and%20booking%20buttons%2C%20dark%20navy%20blue%20UI%20theme%20with%20teal%20accent%20highlights%2C%20clean%20software%20screenshot%20aesthetic%2C%20professional%20SaaS%20interface%20on%20a%20desk%20with%20ambient%20lighting%2C%20representing%20an%20online%20marketplace%20for%20hiring%20security%20guards&width=640&height=360&seq=hiw-clients-video-thumb-001&orientation=landscape"
                  alt="QuickGuard walkthrough video thumbnail"
                  title="Watch how to book a security guard on QuickGuard"
                  loading="lazy"
                  decoding="async"
                  className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-500 ${videoPlaying ? 'opacity-0' : 'opacity-100'}`}
                />
                {!videoPlaying && (
                  <button
                    onClick={() => setVideoPlaying(true)}
                    className="absolute inset-0 flex items-center justify-center group cursor-pointer"
                    aria-label="Play walkthrough video"
                  >
                    <div className="w-16 h-16 flex items-center justify-center bg-teal-500/90 rounded-full shadow-lg group-hover:scale-110 group-hover:bg-teal-400 transition-all duration-300">
                      <i className="ri-play-fill text-white text-2xl ml-0.5" />
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-white text-sm font-semibold drop-shadow-md">Watch: How to Book a Guard in 2 Minutes</p>
                      <p className="text-slate-400 text-xs mt-0.5">2:34 walkthrough</p>
                    </div>
                  </button>
                )}
                {videoPlaying && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <div className="w-12 h-12 flex items-center justify-center border-2 border-slate-600 rounded-full mb-3 animate-pulse">
                      <i className="ri-film-line text-xl text-slate-500" />
                    </div>
                    <p className="text-sm font-medium">Video player placeholder</p>
                    <p className="text-xs text-slate-600 mt-1">Embed your YouTube or Vimeo URL here</p>
                    <button
                      onClick={() => setVideoPlaying(false)}
                      className="mt-4 text-xs text-teal-400 hover:text-teal-300 underline cursor-pointer"
                    >
                      Close preview
                    </button>
                  </div>
                )}
              </div>
              <div className="px-5 py-3 bg-[#0e1628] border-t border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  <span className="text-xs text-slate-400">Walkthrough available</span>
                </div>
                <span className="text-xs text-slate-500">HD · 2:34</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VENUE TYPES ROW */}
      <section className="py-16 bg-[#0e1628] border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm font-semibold text-slate-500 uppercase tracking-widest mb-8">
            Trusted by venues across the UK
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {VENUE_TYPES.map((v) => (
              <Link
                key={v.slug}
                href={`${v.href}?venue=${v.slug}`}
                className="flex flex-col items-center gap-3 bg-[#111d35] border border-slate-700/50 rounded-2xl px-4 py-6 hover:border-teal-500/30 hover:bg-[#141f38] transition-all duration-300 group cursor-pointer"
              >
                <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20 group-hover:bg-teal-500/20 transition-all">
                  <i className={`${v.icon} text-teal-400 text-xl`} />
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors text-center leading-tight">
                  {v.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4-STEP PROCESS */}
      <section className="py-24 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="steps-heading">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
              <i className="ri-list-check-2" />
              4 Simple Steps
            </div>
            <h2 id="steps-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
              How Direct Booking Works
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              From posting your shift to confirming the guard — everything happens in minutes, not days.
            </p>
          </div>

          {/* Step Progress Bar */}
          <div className="hidden md:flex items-center justify-center mb-16 max-w-3xl mx-auto">
            {CLIENT_STEPS.map((step, i) => (
              <div key={i} className="flex items-center">
                <button
                  onClick={() => setActiveStep(i)}
                  className={`flex flex-col items-center gap-2 transition-all duration-300 cursor-pointer ${
                    i === activeStep ? 'scale-105' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <div
                    className={`w-12 h-12 flex items-center justify-center rounded-full border-2 transition-all duration-300 ${
                      i <= activeStep
                        ? 'bg-teal-500 border-teal-500 text-white'
                        : 'bg-[#111d35] border-slate-600 text-slate-500'
                    }`}
                  >
                    <i className={`${step.icon} text-lg`} />
                  </div>
                  <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">{step.title}</span>
                </button>
                {i < CLIENT_STEPS.length - 1 && (
                  <div className={`w-20 h-0.5 mx-2 transition-all duration-500 ${
                    i < activeStep ? 'bg-teal-500' : 'bg-slate-700'
                  }`} />
                )}
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left — Active Step Visual */}
            <div className="relative">
              <div className="bg-[#111d35] rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
                <div className="relative h-72 overflow-hidden">
                  {CLIENT_STEPS.map((step, i) => (
                    <div
                      key={i}
                      className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${
                        i === activeStep ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
                      }`}
                    >
                      <div className="text-center px-8">
                        <div className="w-20 h-20 flex items-center justify-center bg-teal-500/10 rounded-2xl border border-teal-400/20 mx-auto mb-5">
                          <i className={`${step.icon} text-teal-400 text-3xl`} />
                        </div>
                        <p className="text-xl font-bold text-white mb-2">{step.title}</p>
                        <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">{step.desc}</p>
                        <span className="inline-block mt-4 bg-teal-500/10 text-teal-400 text-xs font-bold px-3 py-1 rounded-full border border-teal-400/20">
                          Step {i + 1} of {CLIENT_STEPS.length}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dot indicators */}
                <div className="flex justify-center gap-2 py-4 bg-[#0e1628] border-t border-slate-700/50">
                  {CLIENT_STEPS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveStep(i)}
                      className={`transition-all duration-300 rounded-full cursor-pointer ${
                        i === activeStep ? 'w-6 h-2.5 bg-teal-500' : 'w-2.5 h-2.5 bg-slate-600 hover:bg-slate-400'
                      }`}
                      aria-label={`Go to step ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right — Step Cards */}
            <div className="space-y-4">
              {CLIENT_STEPS.map((step, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  className={`w-full text-left flex items-start gap-4 p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                    i === activeStep
                      ? 'bg-teal-500/10 border-teal-500/50 shadow-md'
                      : 'bg-[#111d35]/60 border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <div
                    className={`w-11 h-11 flex items-center justify-center rounded-xl shrink-0 transition-all duration-300 ${
                      i === activeStep
                        ? 'bg-teal-500 text-white'
                        : 'bg-[#0e1628] text-slate-400 border border-slate-700/50'
                    }`}
                  >
                    <i className={`${step.icon} text-lg`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${
                          i === activeStep ? 'text-teal-400' : 'text-slate-500'
                        }`}
                      >
                        Step {i + 1}
                      </span>
                      {i === activeStep && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-teal-500/15 text-teal-400 border-teal-400/20">
                          Active
                        </span>
                      )}
                    </div>
                    <p className={`font-semibold text-sm mb-1 ${i === activeStep ? 'text-white' : 'text-slate-300'}`}>
                      {step.title}
                    </p>
                    <p className={`text-xs leading-relaxed ${i === activeStep ? 'text-slate-400' : 'text-slate-500'}`}>
                      {step.desc}
                    </p>
                  </div>
                  <div className={`w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 ${
                    i === activeStep ? 'text-teal-400' : 'text-slate-600'
                  }`}>
                    <i className="ri-arrow-right-s-line text-lg" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
            {CLIENT_STATS.map((stat, i) => (
              <div
                key={i}
                className="bg-[#111d35] border border-slate-700/50 rounded-2xl px-6 py-5 text-center hover:border-teal-500/30 transition-colors duration-300"
              >
                <div className="w-10 h-10 flex items-center justify-center bg-teal-500/10 rounded-xl mx-auto mb-3 border border-teal-400/20">
                  <i className={`${stat.icon} text-teal-400 text-xl`} />
                </div>
                <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY DIRECT */}
      <section className="py-20 bg-[#0e1628] border-b border-slate-800/60">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
              <i className="ri-scales-3-line" />
              Comparison
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Why QuickGuard vs a Security Company?
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="py-4 pr-4 text-sm font-semibold text-slate-400">Feature</th>
                  <th className="py-4 px-4 text-sm font-semibold text-teal-400 bg-teal-500/5 rounded-t-xl">QuickGuard Direct</th>
                  <th className="py-4 pl-4 text-sm font-semibold text-slate-500">Traditional Agency</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Time to hire', quickguard: 'Under 2 hours', agency: '1–3 days' },
                  { feature: 'Contract length', quickguard: 'No contract — book by shift', agency: '12-month minimum' },
                  { feature: 'Guard selection', quickguard: 'You choose the guard', agency: 'Agency assigns randomly' },
                  { feature: 'Hourly cost', quickguard: 'Transparent rate + 5% fee', agency: 'Hidden markups (30–50%)' },
                  { feature: 'Payment', quickguard: 'Stripe held job payment — protected', agency: 'Invoice after service' },
                  { feature: 'Licence verification', quickguard: 'Every guard SIA-verified', agency: 'Manual checks, often missed' },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-[#111d35]/30 transition-colors">
                    <td className="py-4 pr-4 text-sm text-slate-300 font-medium">{row.feature}</td>
                    <td className="py-4 px-4 text-sm text-teal-300 font-semibold bg-teal-500/5">
                      <i className="ri-check-line mr-1.5" />
                      {row.quickguard}
                    </td>
                    <td className="py-4 pl-4 text-sm text-slate-500">
                      <i className="ri-close-line mr-1.5 text-slate-600" />
                      {row.agency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="py-16 bg-[#0B1933] border-b border-slate-800/60">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: 'ri-shield-check-line', title: 'All Guards SIA-Verified', desc: 'Every badge checked against the official register.' },
              { icon: 'ri-lock-2-line', title: 'Payment Held with Stripe', desc: 'Your money is safe until the shift is done.' },
              { icon: 'ri-star-line', title: 'Rated by Real Clients', desc: 'Read genuine reviews before you book.' },
              { icon: 'ri-map-pin-line', title: 'UK-Wide Coverage', desc: 'From London to Glasgow — guards everywhere.' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 rounded-2xl border border-teal-400/20 mx-auto mb-4">
                  <i className={`${item.icon} text-teal-400 text-2xl`} />
                </div>
                <p className="text-sm font-semibold text-white mb-1">{item.title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 bg-[#0e1628] border-b border-slate-800/60">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-star-fill" />
              Real Reviews
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Trusted by Venues & Events Across the UK
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <article
                key={i}
                className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 flex flex-col gap-4 hover:border-slate-600 transition-all"
              >
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, s) => (
                    <i
                      key={s}
                      className={`ri-star-fill text-base ${s < t.stars ? 'text-yellow-400' : 'text-slate-700'}`}
                    />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed flex-1">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="pt-4 border-t border-slate-700/50">
                  <p className="font-semibold text-white text-sm">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="faq-heading">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-question-answer-line" />
              Common Questions
            </div>
            <h2 id="faq-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
              Direct Client FAQs
            </h2>
            <p className="text-lg text-slate-400">
              Everything you need to know about hiring guards directly through QuickGuard
            </p>
          </div>
          <FAQList />
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-[#0e1628] relative overflow-hidden" aria-labelledby="cta-heading">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <i className="ri-rocket-line" />
            Get Started Free
          </div>
          <h2 id="cta-heading" className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Ready to Hire Your Guard?
          </h2>
          <p className="text-xl mb-10 text-slate-400 max-w-2xl mx-auto">
            Post your first shift in under 2 minutes. Browse verified guards, choose your favourite, and book instantly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/post-job"
              className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap shadow-lg hover:shadow-teal-500/20"
            >
              <i className="ri-file-list-3-line mr-2" />
              Post a Job Now
            </Link>
            <Link
              href="/find-a-guard"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap"
            >
              <i className="ri-user-search-line mr-2" />
              Browse Guards First
            </Link>
          </div>
          <p className="text-xs text-slate-500 mt-6">
            No sign-up fees. No contracts. You only pay when you book a shift.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}