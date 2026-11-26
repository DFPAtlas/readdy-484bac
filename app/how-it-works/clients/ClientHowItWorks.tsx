'use client';
import { usePublicMediaBackground } from '@/hooks/usePublicMediaBackground';

import PublicMediaImage from '@/components/PublicMediaImage';

import Footer from '../../../components/Footer';
import Header from '../../../components/Header';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePublicPricing } from '@/lib/use-public-pricing';
import ClientPlanStats from './ClientPlanStats';
import ClientPlanFacts from './ClientPlanFacts';
import ClientPricingExample from './ClientPricingExample';
import ClientJourney from './ClientJourney';
import ClientSubscriptionVsBooking from './ClientSubscriptionVsBooking';
import ClientFaq from './ClientFaq';

const CLIENT_STEPS = [
  {
    icon: 'ri-search-eye-line',
    title: 'Check Availability as a Guest',
    desc: 'Enter your venue, shift date and times. The check compares your details against the coverage area, travel radius and availability guards have actually recorded. A match is not a reservation, does not hold a guard and does not guarantee cover.',
  },
  {
    icon: 'ri-login-box-line',
    title: 'Sign In, Review and Post Within Your Allowance',
    desc: 'Sign in or register a free client account, review the location, shift hours, SIA licence level and agreed gross guard rate, then publish the job if you still have allowance left this month. Posting does not charge the booking payment.',
  },
  {
    icon: 'ri-user-search-line',
    title: 'Eligible Guards Respond',
    desc: 'Guards whose recorded licence, coverage and availability fit the job are notified and can apply. Guard registration, browsing and applications are free, with no paid membership, tier or paid priority in applicant order.',
  },
  {
    icon: 'ri-secure-payment-line',
    title: 'Pay, Complete and Approve',
    desc: 'Your selection is provisional until the Stripe booking payment completes. The guard checks in and out and marks completion, and you approve or dispute. After the applicable release checks, eligible pay moves to the guard\u2019s connected Stripe account; the bank payout is a separate later step.',
  },
];

const VENUE_TYPES = [
  { icon: 'ri-door-open-line', label: 'Nightclubs & Bars', slug: 'nightclub_bar', href: '/security-for-nightclubs' },
  { icon: 'ri-store-2-line', label: 'Retail & Shops', slug: 'retail_shop', href: '/security-for-shops' },
  { icon: 'ri-hammer-line', label: 'Construction Sites', slug: 'construction_site', href: '/security-for-building-sites' },
  { icon: 'ri-calendar-event-line', label: 'Private Events', slug: 'private_event', href: '/security-for-events' },
  { icon: 'ri-building-2-line', label: 'Office Buildings', slug: 'office_building', href: '/post-job' },
  { icon: 'ri-store-3-line', label: 'Warehouses', slug: 'warehouse_property', href: '/post-job' },
];

const TRUST_POINTS = [
  {
    icon: 'ri-shield-check-line',
    title: 'SIA Licence on Record',
    desc: 'Guards need an approved account with a valid SIA licence on record before they can apply for jobs.',
  },
  {
    icon: 'ri-lock-2-line',
    title: 'Payment Through Stripe',
    desc: 'The booking payment confirms the shift. Release follows completion approval and the applicable checks.',
  },
  {
    icon: 'ri-star-line',
    title: 'Client Reviews',
    desc: 'Read feedback left by other clients before you choose which guards to select.',
  },
  {
    icon: 'ri-map-pin-line',
    title: 'Availability, Not Guaranteed Cover',
    desc: 'Matches reflect the coverage area, travel radius and availability each guard has recorded.',
  },
];

export default function ClientHowItWorks() {
  const managedHero = usePublicMediaBackground('hiw-clients-hero', "https://readdy.ai/api/search-image?query=Professional%20British%20business%20owner%20woman%20standing%20confidently%20in%20front%20of%20a%20modern%20UK%20venue%20entrance%20at%20twilight%2C%20warm%20street%20lighting%2C%20deep%20navy%20blue%20and%20teal%20color%20tones%2C%20cinematic%20wide%20angle%20shot%2C%20representing%20direct%20hiring%20of%20security%20staff%2C%20moody%20professional%20atmosphere%2C%20clean%20modern%20website%20hero%20background%20with%20space%20for%20text%20on%20the%20left%20side&width=1200&height=600&seq=hiw-clients-hero-001&orientation=landscape");
  const [activeStep, setActiveStep] = useState(0);
  const pricing = usePublicPricing();

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
          backgroundImage: `linear-gradient(to right, rgba(11, 26, 51, 0.92) 0%, rgba(11, 26, 51, 0.6) 50%, rgba(14, 22, 40, 0.4) 100%), url('${managedHero}')`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B1933]/50 via-transparent to-[#0B1933]" aria-hidden="true" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-10">
          <div className="lg:w-3/5 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <i className="ri-building-2-line" />
              For Clients Booking Guards
            </div>
            <h1 id="clients-heading" className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Book SIA-Licensed<br className="hidden md:block" /> <span className="text-teal-400">Guards by Shift</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-xl mb-8">
              Check availability as a guest, post within your plan allowance, review the guards who apply and pay through Stripe to
              confirm the shift. Your subscription, the booking service fee and the agreed guard pay are three separate amounts.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/post-job"
                className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-7 py-3.5 rounded-xl font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap cursor-pointer shadow-lg hover:shadow-teal-500/20"
              >
                <i className="ri-file-list-3-line" /> Post a Job
              </Link>
              <Link
                href="/find-a-guard"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-7 py-3.5 rounded-xl font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-user-search-line" /> Browse Guards
              </Link>
            </div>
          </div>

          {/* Illustrative image card */}
          <div className="lg:w-2/5 w-full max-w-md">
            <figure className="bg-[#111d35] rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
              <div className="relative aspect-video bg-[#0e1628] overflow-hidden">
                <PublicMediaImage
                  slot="hiw-clients-image-1"
                  src="https://readdy.ai/api/search-image?query=Modern%20dark-themed%20laptop%20screen%20displaying%20a%20security%20guard%20hiring%20platform%20dashboard%20showing%20guard%20profiles%20with%20ratings%20and%20booking%20buttons%2C%20dark%20navy%20blue%20UI%20theme%20with%20teal%20accent%20highlights%2C%20clean%20software%20screenshot%20aesthetic%2C%20professional%20SaaS%20interface%20on%20a%20desk%20with%20ambient%20lighting%2C%20representing%20an%20online%20marketplace%20for%20hiring%20security%20guards&width=640&height=360&seq=hiw-clients-video-thumb-001&orientation=landscape"
                  alt="Illustrative image of a security guard booking dashboard"
                  title="Illustrative image — not a live screenshot"
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />
                <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-slate-200">
                  <i className="ri-image-line" /> Illustrative image
                </span>
              </div>
              <figcaption className="px-5 py-4 bg-[#0e1628] border-t border-slate-700/50">
                <p className="text-white text-sm font-semibold">Booking a shift, step by step</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Illustrative image, not a live product screenshot. See the four stages below for what actually happens.
                </p>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* VENUE TYPES ROW */}
      <section className="py-16 bg-[#0e1628] border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm font-semibold text-slate-500 uppercase tracking-widest mb-8">
            Venue types you can post for
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
              Four Stages
            </div>
            <h2 id="steps-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
              How Client Booking Works
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              A recorded availability check, a job posted within your allowance, eligible guards who apply, then payment before the
              shift.
            </p>
          </div>

          {/* Step Progress Bar */}
          <div className="hidden md:flex items-center justify-center mb-16 max-w-3xl mx-auto">
            {CLIENT_STEPS.map((step, i) => (
              <div key={step.title} className="flex items-center">
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
                  <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">Step {i + 1}</span>
                </button>
                {i < CLIENT_STEPS.length - 1 && (
                  <div className={`w-16 h-0.5 mx-2 transition-all duration-500 ${
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
                <div className="relative h-80 overflow-hidden">
                  {CLIENT_STEPS.map((step, i) => (
                    <div
                      key={step.title}
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

                <div className="flex justify-center gap-2 py-4 bg-[#0e1628] border-t border-slate-700/50">
                  {CLIENT_STEPS.map((step, i) => (
                    <button
                      key={step.title}
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
                  key={step.title}
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

          <ClientPlanStats
            plans={pricing.plans}
            loading={pricing.loading}
            error={pricing.error}
            feesError={pricing.feesError}
          />
        </div>
      </section>

      {/* SEPARATE AMOUNTS */}
      <ClientSubscriptionVsBooking />

      {/* FULL JOURNEY */}
      <ClientJourney />

      {/* WORKED EXAMPLE */}
      <ClientPricingExample
        plans={pricing.plans}
        loading={pricing.loading}
        error={pricing.error}
        feesError={pricing.feesError}
        retry={pricing.retry}
      />

      {/* CURRENT PLANS */}
      <ClientPlanFacts
        plans={pricing.plans}
        loading={pricing.loading}
        error={pricing.error}
        feesError={pricing.feesError}
        retry={pricing.retry}
      />

      {/* TRUST STRIP */}
      <section className="py-16 bg-[#0e1628] border-b border-slate-800/60">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {TRUST_POINTS.map((item) => (
              <div key={item.title} className="text-center">
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

      {/* FAQ */}
      <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="faq-heading">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-question-answer-line" />
              Common Questions
            </div>
            <h2 id="faq-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
              Client Booking FAQs
            </h2>
            <p className="text-lg text-slate-400">
              Availability, postings, guard responses, payment and payout questions from clients
            </p>
          </div>
          <ClientFaq />
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
            Ready to Post Your Shift?
          </h2>
          <p className="text-xl mb-10 text-slate-400 max-w-2xl mx-auto">
            Check availability, post within your plan allowance and pay securely through Stripe before the guard arrives.
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
            Your plan sets the monthly posting allowance and the standard booking service fee, and both are shown before you pay. The
            service fee is never taken out of the agreed guard pay.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}