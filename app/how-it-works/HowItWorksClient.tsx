'use client';

import Footer from '@/components/Footer';
import NavSidebar from '@/components/NavSidebar';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import FAQList from './FAQList';

const DEMO_TABS = [
  {
    id: 'guards',
    label: 'For Security Guards',
    icon: 'ri-shield-user-line',
    color: 'teal',
    steps: [
      { icon: 'ri-user-add-line', title: 'Create Your Profile', desc: 'Register in minutes, upload your SIA licence, and set your availability across the UK.' },
      { icon: 'ri-notification-3-line', title: 'Get Instant Job Alerts', desc: 'Receive real-time notifications for jobs that match your skills, location, and schedule.' },
      { icon: 'ri-send-plane-line', title: 'Apply with One Click', desc: 'Apply to multiple jobs instantly. Your verified SIA badge builds instant client trust.' },
      { icon: 'ri-bank-card-line', title: 'Get Paid Securely', desc: 'Funds are released automatically after shift completion. Track every payout in your dashboard.' },
    ],
  },
  {
    id: 'clients',
    label: 'For Clients',
    icon: 'ri-building-2-line',
    color: 'blue',
    steps: [
      { icon: 'ri-file-list-3-line', title: 'Post Your Job', desc: 'Describe your security needs — location, shift times, SIA requirements — in under 2 minutes.' },
      { icon: 'ri-robot-line', title: 'AI Matches Guards', desc: 'Our smart algorithm instantly surfaces the best-matched, verified UK security professionals.' },
      { icon: 'ri-user-search-line', title: 'Review & Select', desc: 'Browse guard profiles, check SIA credentials, and confirm your preferred candidate.' },
      { icon: 'ri-secure-payment-line', title: 'Pay & Confirm', desc: 'Pre-pay securely via Stripe. Funds are held with Stripe and released only on job completion.' },
    ],
  },
];

const PLATFORM_STATS = [
  { icon: 'ri-timer-flash-line', value: '< 2 hrs', label: 'Average time to hire' },
  { icon: 'ri-shield-check-line', value: '100%', label: 'SIA-verified guards' },
  { icon: 'ri-map-pin-2-line', value: 'UK-wide', label: 'Coverage across all regions' },
  { icon: 'ri-lock-2-line', value: 'Held with Stripe', label: 'Secure payment protection' },
];

export default function HowItWorksClient() {
  const [isVisible, setIsVisible] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'guards' | 'clients'>('guards');
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
      { threshold: 0.1 }
    );
    const elements = document.querySelectorAll('[data-animate]');
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setActiveStep(0);
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2800);
    return () => clearInterval(interval);
  }, [activeTab]);

  const currentTab = DEMO_TABS.find((t) => t.id === activeTab)!;
  const colorMap: Record<string, { bg: string; text: string; border: string; pill: string; dot: string; activeBg: string }> = {
    teal: {
      bg: 'bg-teal-500',
      text: 'text-teal-400',
      border: 'border-teal-500/50',
      pill: 'bg-teal-500/15 text-teal-400',
      dot: 'bg-teal-500',
      activeBg: 'bg-teal-500/10',
    },
    blue: {
      bg: 'bg-blue-500',
      text: 'text-blue-400',
      border: 'border-blue-500/50',
      pill: 'bg-blue-500/15 text-blue-400',
      dot: 'bg-blue-500',
      activeBg: 'bg-blue-500/10',
    },
  };
  const c = colorMap[currentTab.color];

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />
      {/* HERO */}
      <section
        aria-labelledby="page-heading"
        className="relative min-h-[60vh] flex items-center justify-center bg-cover bg-center bg-no-repeat pt-24"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(11, 26, 51, 0.7), rgba(14, 22, 40, 0.85)), url('https://readdy.ai/api/search-image?query=Professional%20security%20guard%20silhouette%20against%20a%20modern%20UK%20city%20skyline%20at%20twilight%2C%20deep%20navy%20blue%20and%20dark%20teal%20gradient%20sky%2C%20dramatic%20atmospheric%20lighting%20with%20subtle%20blue%20glow%2C%20cinematic%20wide%20angle%20shot%2C%20moody%20and%20professional%20tone%2C%20clean%20modern%20aesthetic%20suitable%20for%20website%20hero%20background%20with%20text%20overlay&width=1200&height=600&seq=hiw-hero-002&orientation=landscape')`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B1933]/60 via-[#0B1933]/40 to-[#0B1933]" aria-hidden="true" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <i className="ri-lightbulb-line" />
            Simple Process
          </div>
          <h1 id="page-heading" className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            How QuickGuard.uk Works
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto">
            Connecting UK security professionals with clients through intelligent matching
          </p>
        </div>
      </section>

      {/* DEMO SECTION */}
      <section className="py-24 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="demo-heading">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 bg-teal-500/10 text-teal-400 text-sm font-semibold px-4 py-1.5 rounded-full mb-5 uppercase tracking-widest border border-teal-400/20">
              <i className="ri-play-circle-line text-base" />
              Platform Walkthrough
            </span>
            <h2 id="demo-heading" className="text-4xl font-bold text-white mb-4">
              See How It Works in Action
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              An interactive step-by-step demo of the QuickGuard.uk platform — from registration to payment, in minutes.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex bg-[#111d35] border border-slate-700/50 rounded-full p-1 gap-1">
              {DEMO_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'guards' | 'clients')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 whitespace-nowrap cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <i className={`${tab.icon} text-base`} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Left — Mockup */}
            <div className="relative">
              <div className="bg-[#111d35] rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden hover:border-slate-600 transition-all">
                <div className="flex items-center gap-2 px-4 py-3 bg-[#0e1628] border-b border-slate-700/50">
                  <span className="w-3 h-3 rounded-full bg-red-500/80" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <span className="w-3 h-3 rounded-full bg-green-500/80" />
                  <div className="flex-1 mx-4 bg-slate-800 rounded-full px-3 py-1 text-xs text-slate-400 text-center">
                    quickguard.uk
                  </div>
                </div>

                <div className="relative h-80 overflow-hidden">
                  <img
                    src="https://readdy.ai/api/search-image?query=Modern%20dark-themed%20web%20application%20dashboard%20interface%20on%20a%20computer%20screen%20showing%20security%20guard%20matching%20platform%2C%20dark%20navy%20blue%20UI%20theme%20with%20data%20cards%20and%20profile%20listings%2C%20clean%20software%20screenshot%20aesthetic%2C%20professional%20SaaS%20product%20interface%20photography&width=800&height=450&seq=hiw-demo-002&orientation=landscape"
                    alt={`Platform demo step ${activeStep + 1}`}
                    title={`QuickGuard platform demo — step ${activeStep + 1}`}
                    className="w-full h-full object-cover object-top transition-opacity duration-700"
                  />

                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-[#0B1933]/90 backdrop-blur-sm rounded-xl px-4 py-3 border border-slate-700/50 flex items-center gap-3">
                      <div className={`w-9 h-9 flex items-center justify-center rounded-full ${c.bg} shrink-0`}>
                        <i className={`${currentTab.steps[activeStep].icon} text-white text-base`} />
                      </div>
                      <div>
                        <p className="text-white text-sm font-semibold leading-tight">{currentTab.steps[activeStep].title}</p>
                        <p className="text-slate-400 text-xs mt-0.5 leading-snug">{currentTab.steps[activeStep].desc}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center gap-2 py-4 bg-[#0e1628]">
                  {currentTab.steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveStep(i)}
                      className={`transition-all duration-300 rounded-full cursor-pointer ${
                        i === activeStep ? `w-6 h-2.5 ${c.dot}` : 'w-2.5 h-2.5 bg-slate-600 hover:bg-slate-400'
                      }`}
                      aria-label={`Go to step ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right — Step List */}
            <div className="space-y-4">
              {currentTab.steps.map((step, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  className={`w-full text-left flex items-start gap-4 p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${
                    i === activeStep
                      ? `${c.activeBg} ${c.border} shadow-md`
                      : 'bg-[#111d35]/60 border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <div className={`w-11 h-11 flex items-center justify-center rounded-xl shrink-0 transition-all duration-300 ${
                    i === activeStep ? `${c.bg} text-white` : 'bg-[#0e1628] text-slate-400 border border-slate-700/50'
                  }`}>
                    <i className={`${step.icon} text-lg`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        i === activeStep ? c.text : 'text-slate-500'
                      }`}>Step {i + 1}</span>
                      {i === activeStep && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${c.pill}`}>Active</span>
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
                    i === activeStep ? c.text : 'text-slate-600'
                  }`}>
                    <i className="ri-arrow-right-s-line text-lg" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Platform Stats Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
            {PLATFORM_STATS.map((stat, i) => (
              <div key={i} className="bg-[#111d35] border border-slate-700/50 rounded-2xl px-6 py-5 text-center hover:border-teal-500/30 transition-colors duration-300">
                <div className="w-10 h-10 flex items-center justify-center bg-teal-500/10 rounded-xl mx-auto mb-3 border border-teal-400/20">
                  <i className={`${stat.icon} text-teal-400 text-xl`} />
                </div>
                <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* CTA row */}
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/guard/register"
              className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 px-7 py-3.5 rounded-xl font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap cursor-pointer shadow-lg hover:shadow-teal-500/20"
            >
              <i className="ri-shield-user-line" /> Get Started as a Guard
            </Link>
            <Link
              href="/client/register"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-7 py-3.5 rounded-xl font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap cursor-pointer"
            >
              <i className="ri-building-2-line" /> Post a Job as a Client
            </Link>
          </div>
        </div>
      </section>

      {/* 5-STEP PROCESS */}
      <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="process-heading">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-list-check-2" />
              Step-by-Step
            </div>
            <h2 id="process-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
              Our 5-Step Process
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              From profile creation to secure payment — here's exactly how QuickGuard connects guards and clients
            </p>
            <Link
              href="/how-it-works/clients"
              className="inline-flex items-center gap-2 mt-6 text-sm text-teal-400 hover:text-teal-300 font-medium transition-colors"
            >
              <i className="ri-arrow-right-line" />
              See the detailed guide for direct clients
            </Link>
          </div>

          <ol className="space-y-20 list-none p-0 m-0">
            {/* STEP 1 */}
            <li
              id="step-1"
              data-animate="true"
              className={`flex flex-col lg:flex-row items-center gap-12 transition-all duration-1000 ${
                isVisible['step-1'] ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
              }`}
            >
              <div className="lg:w-1/2">
                <div className="w-16 h-16 bg-teal-500/10 border border-teal-400/20 rounded-2xl flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-teal-400">1</span>
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">Security Guards Create Profiles</h3>
                <p className="text-lg text-slate-400 mb-6">
                  UK security professionals register and create comprehensive profiles showcasing their:
                </p>
                <ul className="space-y-3 text-slate-400 list-none p-0 m-0">
                  {[
                    'SIA licence and door supervisor badges',
                    'Years of experience in security',
                    'Specialisation areas (retail, events, corporate)',
                    'Availability schedule and shift patterns',
                    'Coverage areas across the UK'
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <i className="ri-check-line text-teal-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <figure className="lg:w-1/2">
                <div className="rounded-2xl overflow-hidden border border-slate-700/50 hover:border-teal-500/30 transition-all">
                  <img
                    src="https://readdy.ai/api/search-image?query=Professional%20British%20security%20guard%20in%20formal%20uniform%20holding%20a%20tablet%20device%20and%20smiling%2C%20modern%20office%20environment%20background%20with%20dark%20moody%20lighting%2C%20warm%20natural%20highlights%2C%20clean%20and%20friendly%20portrait%20style%20photography%2C%20high%20quality%20professional%20headshot%20aesthetic%2C%20representing%20online%20profile%20creation%2C%20dark%20navy%20blue%20color%20palette&width=600&height=350&seq=hiw-step1-002&orientation=landscape"
                    alt="Security guard creating profile"
                    title="Security guard creating a profile on QuickGuard"
                    className="w-full h-[260px] object-cover object-top"
                  />
                </div>
                <figcaption className="sr-only">Guard Profile Creation Process</figcaption>
              </figure>
            </li>

            {/* STEP 2 */}
            <li
              id="step-2"
              data-animate="true"
              className={`flex flex-col lg:flex-row-reverse items-center gap-12 transition-all duration-1000 ${
                isVisible['step-2'] ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
              }`}
            >
              <div className="lg:w-1/2">
                <div className="w-16 h-16 bg-blue-500/10 border border-blue-400/20 rounded-2xl flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-blue-400">2</span>
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">UK Clients Post Security Jobs</h3>
                <p className="text-lg text-slate-400 mb-6">
                  Clients across England, Scotland, Wales and Northern Ireland describe their security requirements including:
                </p>
                <ul className="space-y-3 text-slate-400 list-none p-0 m-0">
                  {[
                    'Job location (London, Manchester, Birmingham, etc.)',
                    'Duration and shift patterns (days, nights, weekends)',
                    'Required SIA licence level',
                    'Special requirements (CCTV, crowd control)',
                    'Hourly rates and payment terms (£12-25/hour)'
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <i className="ri-check-line text-blue-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <figure className="lg:w-1/2">
                <div className="rounded-2xl overflow-hidden border border-slate-700/50 hover:border-blue-500/30 transition-all">
                  <img
                    src="https://readdy.ai/api/search-image?query=British%20business%20professional%20woman%20sitting%20at%20a%20modern%20desk%20using%20a%20laptop%20computer%20to%20post%20a%20job%20online%2C%20contemporary%20office%20interior%20with%20glass%20walls%20and%20dark%20ambient%20lighting%2C%20subtle%20teal%20accent%20lights%2C%20clean%20corporate%20photography%20style%2C%20professional%20and%20approachable%20mood%2C%20dark%20navy%20blue%20color%20palette&width=600&height=350&seq=hiw-step2-002&orientation=landscape"
                    alt="Client posting a security job online"
                    title="Client posting a security job on QuickGuard"
                    className="w-full h-[260px] object-cover object-top"
                  />
                </div>
                <figcaption className="sr-only">Client Job Posting Process</figcaption>
              </figure>
            </li>

            {/* STEP 3 */}
            <li
              id="step-3"
              data-animate="true"
              className={`flex flex-col lg:flex-row items-center gap-12 transition-all duration-1000 ${
                isVisible['step-3'] ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
              }`}
            >
              <div className="lg:w-1/2">
                <div className="w-16 h-16 bg-purple-500/10 border border-purple-400/20 rounded-2xl flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-purple-400">3</span>
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">AI-Powered Smart Matching</h3>
                <p className="text-lg text-slate-400 mb-6">
                  Our intelligent algorithm analyses and matches UK security professionals based on:
                </p>
                <ul className="space-y-3 text-slate-400 list-none p-0 m-0">
                  {[
                    'SIA licence validity and specialisations',
                    'Geographic proximity within the UK',
                    'Shift availability and working patterns',
                    'Experience in similar UK venues',
                    'Client feedback and performance ratings'
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <i className="ri-check-line text-purple-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <figure className="lg:w-1/2">
                <div className="rounded-2xl overflow-hidden border border-slate-700/50 hover:border-purple-500/30 transition-all">
                  <img
                    src="https://readdy.ai/api/search-image?query=Abstract%20digital%20network%20visualization%20showing%20connected%20nodes%20and%20glowing%20lines%20forming%20a%20matching%20pattern%2C%20deep%20navy%20blue%20and%20dark%20teal%20gradient%20background%2C%20futuristic%20AI%20technology%20concept%2C%20clean%20minimalist%20digital%20art%20style%2C%20representing%20intelligent%20algorithm%20matching%20security%20professionals%20with%20jobs%2C%20subtle%20purple%20and%20blue%20neon%20glow%20accents&width=600&height=350&seq=hiw-step3-002&orientation=landscape"
                    alt="AI-powered smart matching technology connecting security guards with clients"
                    title="QuickGuard AI smart matching for security jobs"
                    className="w-full h-[260px] object-cover object-top"
                  />
                </div>
                <figcaption className="sr-only">AI Matching Process Visualization</figcaption>
              </figure>
            </li>

            {/* STEP 4 */}
            <li
              id="step-4"
              data-animate="true"
              className={`flex flex-col lg:flex-row-reverse items-center gap-12 transition-all duration-1000 ${
                isVisible['step-4'] ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
              }`}
            >
              <div className="lg:w-1/2">
                <div className="w-16 h-16 bg-orange-500/10 border border-orange-400/20 rounded-2xl flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-orange-400">4</span>
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">Guards Apply & Clients Select</h3>
                <p className="text-lg text-slate-400 mb-6">
                  Matched UK security guards receive notifications and can apply for suitable positions. Clients review applications and select their preferred guards based on SIA qualifications and experience.
                </p>
                <aside className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
                  <h4 className="font-semibold text-white mb-3">UK Selection Process:</h4>
                  <ul className="space-y-2 text-sm text-slate-400 list-none p-0 m-0">
                    {[
                      'Guards receive job notifications via app/SMS',
                      'One-click application with SIA verification',
                      'Client reviews all UK-verified applications',
                      'Direct communication through secure messaging',
                      'Final selection and shift confirmation'
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <i className="ri-arrow-right-line text-orange-400 text-xs" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </aside>
              </div>
              <figure className="lg:w-1/2">
                <div className="rounded-2xl overflow-hidden border border-slate-700/50 hover:border-orange-500/30 transition-all">
                  <img
                    src="https://readdy.ai/api/search-image?query=Professional%20British%20businessman%20reviewing%20documents%20on%20a%20tablet%20screen%20while%20seated%20at%20a%20conference%20table%2C%20modern%20office%20meeting%20room%20background%20with%20dark%20ambient%20lighting%20and%20subtle%20teal%20accents%2C%20corporate%20photography%20style%2C%20selective%20focus%20on%20the%20tablet%20and%20hands%2C%20clean%20aesthetic%2C%20dark%20navy%20blue%20color%20palette&width=600&height=350&seq=hiw-step4-002&orientation=landscape"
                    alt="Client reviewing and selecting security guard applications"
                    title="Client reviewing guard applications on QuickGuard"
                    className="w-full h-[260px] object-cover object-top"
                  />
                </div>
                <figcaption className="sr-only">Application Review Process</figcaption>
              </figure>
            </li>

            {/* STEP 5 */}
            <li
              id="step-5"
              data-animate="true"
              className={`flex flex-col lg:flex-row items-center gap-12 transition-all duration-1000 ${
                isVisible['step-5'] ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
              }`}
            >
              <div className="lg:w-1/2">
                <div className="w-16 h-16 bg-teal-500/10 border border-teal-400/20 rounded-2xl flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-teal-400">5</span>
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">Secure Payment & Job Completion</h3>
                <p className="text-lg text-slate-400 mb-6">
                  Our secure UK payment system ensures protection for both parties with HMRC compliance:
                </p>
                <ul className="space-y-3 text-slate-400 list-none p-0 m-0">
                  {[
                    'Client pre-pays for shift security',
                    'Funds held securely during shift',
                    'Client confirms job completion',
                    'Guard receives payment (minus 5% platform fee)',
                    'Automatic UTR and tax documentation'
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <i className="ri-check-line text-teal-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <figure className="lg:w-1/2">
                <div className="rounded-2xl overflow-hidden border border-slate-700/50 hover:border-teal-500/30 transition-all">
                  <img
                    src="https://readdy.ai/api/search-image?query=Close%20up%20of%20a%20secure%20digital%20payment%20interface%20on%20a%20smartphone%20screen%20with%20shield%20security%20icon%2C%20professional%20hands%20holding%20the%20phone%2C%20dark%20blurred%20office%20background%2C%20teal%20and%20blue%20trust%20colors%20glowing%20softly%2C%20clean%20modern%20fintech%20photography%20style%2C%20representing%20secure%20held%20job%20payment%20system%2C%20dark%20navy%20blue%20color%20palette&width=600&height=350&seq=hiw-step5-002&orientation=landscape"
                    alt="Secure payment and job completion process"
                    title="Secure held job payment on QuickGuard"
                    className="w-full h-[260px] object-cover object-top"
                  />
                </div>
                <figcaption className="sr-only">Secure Payment Process</figcaption>
              </figure>
            </li>
          </ol>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="pricing-overview-heading">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-money-pound-circle-line" />
              Transparent Pricing
            </div>
            <h2 id="pricing-overview-heading" className="text-3xl md:text-4xl font-bold text-white">
              Simple, Transparent UK Pricing
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <article className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/30 transition-all">
              <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20 mb-5">
                <i className="ri-shield-user-line text-2xl text-teal-400" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-white">For Security Guards</h3>
              <p className="text-3xl font-bold mb-2 text-white">
                From £10<span className="text-lg text-slate-400">/month</span>
              </p>
              <p className="text-slate-400 mb-6 text-sm">Monthly subscription for access to UK security jobs</p>
              <ul className="text-sm text-slate-400 space-y-2 mb-6 text-left list-none p-0 m-0">
                {[
                  'Multiple membership tiers available',
                  'Profile visibility to UK clients',
                  'Mobile app with instant notifications',
                  'SIA licence verification support'
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <i className="ri-check-line text-teal-400 text-xs" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/pricing#guard-pricing"
                onClick={() => window.scrollTo(0, 0)}
                className="inline-flex items-center gap-2 bg-teal-500 text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-teal-400 transition-all whitespace-nowrap shadow-lg hover:shadow-teal-500/20"
              >
                View All Guard Plans
                <i className="ri-arrow-right-line" />
              </Link>
            </article>

            <article className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/30 transition-all">
              <div className="w-12 h-12 flex items-center justify-center bg-blue-500/10 rounded-xl border border-blue-400/20 mb-5">
                <i className="ri-building-2-line text-2xl text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-white">For UK Clients</h3>
              <Link
                href="/pricing"
                className="text-3xl font-bold mb-2 text-blue-400 hover:text-blue-300 underline inline-block"
              >
                View Pricing
              </Link>
              <p className="text-slate-400 mb-6 mt-3 text-sm">Commission on successful shift completion</p>
              <ul className="text-sm text-slate-400 space-y-2 text-left list-none p-0 m-0">
                {[
                  'No upfront costs or setup fees',
                  'Pay only for completed shifts',
                  'HMRC compliant payment processing',
                  'Full UK client support'
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <i className="ri-check-line text-blue-400 text-xs" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-20 bg-[#0e1628] border-b border-slate-800/60" aria-labelledby="faq-heading">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-question-answer-line" />
              Common Questions
            </div>
            <h2 id="faq-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-slate-400">Everything you need to know about QuickGuard.uk</p>
          </div>
          <FAQList />
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section className="py-20 bg-[#0B1933] border-b border-slate-800/60" aria-labelledby="testimonials-heading">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-star-fill" />
              Real Reviews
            </div>
            <h2 id="testimonials-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">Trusted by Guards & Clients Across the UK</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">See what security professionals and businesses say about their experience with QuickGuard.uk</p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mb-14">
            <div className="text-center bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
              <p className="text-4xl font-bold text-teal-400">4.9<span className="text-2xl">/5</span></p>
              <div className="flex justify-center gap-0.5 my-1">
                {[1,2,3,4,5].map(i => (
                  <i key={i} className="ri-star-fill text-yellow-400 text-lg" />
                ))}
              </div>
              <p className="text-sm text-slate-400">Average Rating</p>
            </div>
            <div className="text-center bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
              <p className="text-4xl font-bold text-teal-400">2,400+</p>
              <p className="text-sm text-slate-400 mt-2">Verified Reviews</p>
            </div>
            <div className="text-center bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
              <p className="text-4xl font-bold text-teal-400">98%</p>
              <p className="text-sm text-slate-400 mt-2">Would Recommend</p>
            </div>
          </div>

          {/* Testimonial Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                text: "QuickGuard.uk completely transformed how I find security work. Within 48 hours of signing up I had three job offers in Manchester. The SIA verification process was smooth and clients trust the platform.",
                name: "Marcus T.",
                role: "SIA Door Supervisor · Manchester",
                tag: "Guard",
                tagColor: "teal",
                img: "https://readdy.ai/api/search-image?query=Professional%20headshot%20portrait%20of%20a%20confident%20Black%20British%20man%20in%20his%20thirties%20with%20short%20hair%2C%20wearing%20a%20navy%20blue%20polo%20shirt%2C%20dark%20grey%20studio%20background%20with%20subtle%20rim%20lighting%2C%20warm%20natural%20highlights%2C%20clean%20corporate%20photography%20style&width=200&height=200&seq=hiw-avatar-007&orientation=squarish"
              },
              {
                text: "We needed security for a large corporate event in London on short notice. QuickGuard matched us with four verified guards within hours. The payment system is transparent and HMRC compliant — exactly what we needed.",
                name: "Sarah M.",
                role: "Events Director · London",
                tag: "Client",
                tagColor: "blue",
                img: "https://readdy.ai/api/search-image?query=Professional%20headshot%20portrait%20of%20a%20British%20businesswoman%20in%20her%20forties%20with%20blonde%20hair%2C%20wearing%20a%20charcoal%20blazer%2C%20dark%20grey%20studio%20background%20with%20subtle%20rim%20lighting%2C%20soft%20professional%20lighting%2C%20clean%20corporate%20photography%20style&width=200&height=200&seq=hiw-avatar-008&orientation=squarish"
              },
              {
                text: "The earnings dashboard is brilliant. I can track every shift, see my payouts clearly, and the 5% platform fee is the lowest I've seen. I've doubled my monthly income since joining QuickGuard.",
                name: "Rajan P.",
                role: "SIA Security Officer · Birmingham",
                tag: "Guard",
                tagColor: "teal",
                img: "https://readdy.ai/api/search-image?query=Professional%20headshot%20portrait%20of%20a%20South%20Asian%20British%20man%20in%20his%20thirties%20with%20neat%20dark%20hair%2C%20wearing%20a%20light%20blue%20button-up%20shirt%2C%20dark%20grey%20studio%20background%20with%20subtle%20rim%20lighting%2C%20warm%20natural%20highlights%2C%20clean%20corporate%20photography%20style&width=200&height=200&seq=hiw-avatar-009&orientation=squarish"
              },
              {
                text: "As a retail chain manager, I use QuickGuard regularly for weekend cover across our Leeds stores. The AI matching is genuinely impressive — it always finds guards with retail experience. Highly recommended.",
                name: "David H.",
                role: "Retail Operations Manager · Leeds",
                tag: "Client",
                tagColor: "blue",
                img: "https://readdy.ai/api/search-image?query=Professional%20headshot%20portrait%20of%20a%20British%20man%20in%20his%20fifties%20with%20grey%20hair%2C%20wearing%20a%20dark%20green%20sweater%2C%20dark%20grey%20studio%20background%20with%20subtle%20rim%20lighting%2C%20soft%20natural%20lighting%2C%20clean%20corporate%20photography%20style&width=200&height=200&seq=hiw-avatar-010&orientation=squarish"
              },
              {
                text: "I was sceptical at first but the SIA licence verification gave me real confidence. The platform is easy to use, the app notifications are instant, and I've never missed a job opportunity since joining.",
                name: "Claire W.",
                role: "SIA CCTV Operator · Glasgow",
                tag: "Guard",
                tagColor: "teal",
                img: "https://readdy.ai/api/search-image?query=Professional%20headshot%20portrait%20of%20a%20Scottish%20woman%20in%20her%20thirties%20with%20auburn%20hair%2C%20wearing%20a%20white%20blouse%2C%20dark%20grey%20studio%20background%20with%20subtle%20rim%20lighting%2C%20warm%20professional%20lighting%2C%20clean%20corporate%20photography%20style&width=200&height=200&seq=hiw-avatar-011&orientation=squarish"
              },
              {
                text: "The held job payment system with Stripe is a game-changer. Funds are held securely until the shift is complete — it protects both sides. We've hired over 30 guards through QuickGuard and every experience has been professional.",
                name: "Priya K.",
                role: "Venue Manager · Bristol",
                tag: "Client",
                tagColor: "blue",
                img: "https://readdy.ai/api/search-image?query=Professional%20headshot%20portrait%20of%20a%20British%20Indian%20woman%20in%20her%20thirties%20with%20long%20dark%20hair%2C%20wearing%20a%20burgundy%20top%2C%20dark%20grey%20studio%20background%20with%20subtle%20rim%20lighting%2C%20soft%20natural%20lighting%2C%20clean%20corporate%20photography%20style&width=200&height=200&seq=hiw-avatar-012&orientation=squarish"
              }
            ].map((card, idx) => (
              <article key={idx} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-7 flex flex-col gap-4 hover:border-slate-600 transition-all">
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(i => <i key={i} className="ri-star-fill text-yellow-400 text-base" />)}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed flex-1">
                  "{card.text}"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-700/50">
                  <img
                    src={card.img}
                    alt={card.name}
                    title={`${card.name} — ${card.role}`}
                    className="w-11 h-11 rounded-full object-cover object-top"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{card.name}</p>
                    <p className="text-xs text-slate-500">{card.role}</p>
                  </div>
                  <span className={`${card.tagColor === 'teal' ? 'bg-teal-500/15 text-teal-400 border-teal-400/20' : 'bg-blue-500/15 text-blue-400 border-blue-400/20'} text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap`}>
                    {card.tag}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="py-24 bg-[#0e1628] relative overflow-hidden" aria-labelledby="cta-heading">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <i className="ri-rocket-line" />
            Get Started Today
          </div>
          <h2 id="cta-heading" className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Ready to Start?
          </h2>
          <p className="text-xl mb-10 text-slate-400 max-w-2xl mx-auto">
            Join our platform and experience the future of UK security staffing
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/guard/register"
              className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap shadow-lg hover:shadow-teal-500/20"
            >
              Join as UK Security Guard
            </Link>
            <Link
              href="/client/register"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap"
            >
              Post Your First UK Job
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}