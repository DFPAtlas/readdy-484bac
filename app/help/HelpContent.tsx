'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BackToTop from '@/components/BackToTop';
import Footer from '@/components/Footer';
import NavSidebar from '@/components/NavSidebar';
import { CLIENT_JOURNEY, GUARD_JOURNEY, CLIENT_PLANS, GUARD_MEMBERSHIPS, CANCELLATION_WINDOWS, CANCELLATION_NOTES, LICENCE_CHECKS, CLIENT_TOPICS, GUARD_TOPICS } from '@/lib/help-content';
import { calculatePaygFees, formatCurrency } from '@/lib/payg-fees';

type Role = 'client' | 'guard';

const faqs = [
  { question: 'How do I get started as a Client?', answer: 'Register as a client, complete your profile, and post your first job. You can browse verified guards, review applications, and hire the best match for your security needs.', icon: 'ri-user-add-line' },
  { question: 'How do I get started as a Guard?', answer: 'Register as a guard, upload your SIA licence, and complete your profile. Once verified, you can browse available jobs and submit applications directly through the platform.', icon: 'ri-shield-user-line' },
  { question: 'Is SIA licence verification required?', answer: 'Yes. All security guards must hold a valid SIA licence. Every guard must pass an initial SIA licence check before they can take work through QuickGuard. We are also developing an AI agent to re-check licence status weekly and flag suspended, revoked or expired licences for review.', icon: 'ri-verified-badge-line' },
  { question: 'How does payment work?', answer: 'Clients review the agreed guard pay, plan service fee and any eligible promotion, then pay securely via Stripe before the booking is confirmed. Funds are held with Stripe and released to the guard after completion and the applicable release checks. All transactions are encrypted and processed through our secure platform.', icon: 'ri-secure-payment-line' },
  { question: 'Can I cancel or edit a job after posting?', answer: "Yes. You can cancel a job from My Jobs until the guard's payout has started. Refunds follow our published cancellation policy: more than 24 hours before the shift, a full refund including the service fee; 12\u201324 hours before, a 50% refund of the guard fee (the service fee is retained); under 12 hours, no refund. If a guard cancels, you receive a full refund including the service fee. Refund requests are reviewed by our team. To change job details once a guard is booked, contact support.", icon: 'ri-edit-2-line' },
  { question: 'How long does guard verification take?', answer: 'Verification timing can vary depending on the licence check and whether manual review is required. You will receive an email notification once your profile has been reviewed and approved.', icon: 'ri-time-line' },
  { question: 'What subscription plans are available?', answer: 'We offer flexible plans for clients of all sizes. Visit our Pricing page to compare features and choose the plan that best suits your business needs.', icon: 'ri-price-tag-3-line' },
  { question: 'How do I raise a complaint?', answer: 'You can submit a complaint directly from your job detail page. Our team reviews all complaints promptly and will keep you updated on the resolution progress.', icon: 'ri-feedback-line' },
];

const visualGuides = [
  {
    title: 'Client Dashboard',
    description: 'See where to find jobs, payments, profile setup and QuickGuard AI support.',
    image: 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/31e07790-0a5d-462a-afc4-cf9a2f6d9199_compressed_Screenshot-2026-10-04-014442.webp',
    href: '/guide/client',
  },
  {
    title: 'Post a Security Job',
    description: 'Follow the guided job-posting flow from job basics through review and posting.',
    image: 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/52d82073-26ad-4e44-b04e-b095eac18b4c_compressed_Screenshot-2026-10-04-014457.webp',
    href: '/guide/client',
  },
  {
    title: 'Manage Your Jobs',
    description: 'Track confirmed bookings, payment status, cancellations and refunds from My Jobs.',
    image: 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/0b10efad-d486-4d54-a57a-66170ddbacc7_compressed_Screenshot-2026-10-04-014544.webp',
    href: '/client/help',
  },
];

function MoneySection({ role }: { role: Role }) {
  const [planSlug, setPlanSlug] = useState('starter');
  const [hours, setHours] = useState(8);
  const [rate, setRate] = useState(15);

  if (role === 'guard') {
    const prices = GUARD_MEMBERSHIPS.map((m) => m.monthlyPrice);
    const priceRange = `\u00a3${Math.min(...prices)}\u2013\u00a3${Math.max(...prices)}`;
    const guardCards = [
      {
        big: '0%',
        title: 'No booking commission',
        text: "Nothing is deducted from your pay. The client's service fee covers processing and standard payouts.",
      },
      {
        big: priceRange,
        title: 'Monthly membership',
        text: 'Basic \u00a310, Pro \u00a319 or Elite \u00a329 a month, with annual options. Membership is separate from your earnings.',
      },
      {
        big: 'Stripe',
        title: 'Paid after completion',
        text: 'Once the client confirms the shift is complete, your pay is released to your Stripe payout account, subject to the dispute and account checks.',
      },
    ];

    return (
      <div className="mb-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-sky-400">Your earnings</p>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">You keep your full agreed pay</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {guardCards.map((card) => (
            <div key={card.title} className="h-full bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
              <p className="text-3xl font-bold text-sky-400 mb-3">{card.big}</p>
              <h3 className="font-bold text-white text-base mb-2">{card.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const plan = CLIENT_PLANS.find((p) => p.slug === planSlug) ?? CLIENT_PLANS[0];
  const fees = calculatePaygFees({
    hourlyRate: rate,
    hours,
    numberOfGuards: 1,
    numberOfDays: 1,
    serviceFeePct: plan.serviceFeePct,
  });

  return (
    <div className="mb-16">
      <div className="grid lg:grid-cols-2 gap-10 items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-teal-400">What you&apos;ll pay</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-5">Two separate costs, both shown upfront</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            Your subscription covers platform features and your monthly posting allowance. Each booking is paid separately: the guard&apos;s agreed pay plus your plan&apos;s service fee. Card processing is included, and the guard never has anything deducted.
          </p>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Eligible launch promotions can reduce your service fee. Any applicable VAT is shown at checkout.
          </p>
          <Link href="/pricing" className="inline-flex items-center gap-1 text-teal-400 font-semibold text-sm hover:underline cursor-pointer whitespace-nowrap">
            Compare plans <i className="ri-arrow-right-line" />
          </Link>
        </div>

        <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Your plan</p>
            <div className="flex flex-wrap gap-2">
              {CLIENT_PLANS.map((p) => {
                const active = p.slug === planSlug;
                return (
                  <button
                    key={p.slug}
                    type="button"
                    onClick={() => setPlanSlug(p.slug)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-teal-500 border-teal-500 text-slate-900'
                        : 'bg-transparent border-slate-600 text-slate-300 hover:border-teal-400/50 hover:text-white'
                    }`}
                  >
                    {p.name} {'\u00b7'} {p.serviceFeePct}%
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-700/50">
            <div className="flex items-center justify-between py-3 border-b border-slate-700/50">
              <span className="text-sm text-slate-300">Hours</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Fewer hours"
                  onClick={() => setHours((h) => Math.max(1, h - 1))}
                  disabled={hours <= 1}
                  className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#0e1628] border border-slate-700/50 text-white hover:border-teal-400/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <i className="ri-subtract-line text-lg" />
                </button>
                <span className="w-8 text-center font-bold text-white">{hours}</span>
                <button
                  type="button"
                  aria-label="More hours"
                  onClick={() => setHours((h) => Math.min(24, h + 1))}
                  disabled={hours >= 24}
                  className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#0e1628] border border-slate-700/50 text-white hover:border-teal-400/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <i className="ri-add-line text-lg" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-slate-700/50">
              <span className="text-sm text-slate-300">Guard rate per hour</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Lower rate"
                  onClick={() => setRate((r) => Math.max(11, Math.round((r - 0.5) * 100) / 100))}
                  disabled={rate <= 11}
                  className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#0e1628] border border-slate-700/50 text-white hover:border-teal-400/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <i className="ri-subtract-line text-lg" />
                </button>
                <span className="w-20 text-center font-bold text-white">{formatCurrency(rate)}</span>
                <button
                  type="button"
                  aria-label="Higher rate"
                  onClick={() => setRate((r) => Math.min(40, Math.round((r + 0.5) * 100) / 100))}
                  disabled={rate >= 40}
                  className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#0e1628] border border-slate-700/50 text-white hover:border-teal-400/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <i className="ri-add-line text-lg" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Guard&apos;s agreed pay</span>
              <span className="text-white font-medium">{formatCurrency(fees.guardTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Service fee ({plan.serviceFeePct}%)</span>
              <span className="text-white font-medium">{formatCurrency(fees.serviceFee)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Card processing</span>
              <span className="text-teal-400 font-medium">Included</span>
            </div>
            <div className="flex justify-between items-center mt-3 pt-4 border-t border-slate-700/50">
              <span className="font-bold text-white">Booking total</span>
              <span className="font-bold text-teal-400 text-xl">{formatCurrency(fees.total)}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed mt-4">
            The guard receives {formatCurrency(fees.guardTotal)} in full. Example only; your total is confirmed before you pay.
          </p>
        </div>
      </div>
    </div>
  );
}

const cancellationTones: Record<string, { bg: string; label: string }> = {
  good: { bg: 'bg-teal-900', label: 'text-teal-300' },
  warn: { bg: 'bg-amber-900', label: 'text-amber-300' },
  bad: { bg: 'bg-red-900', label: 'text-red-300' },
};

function CancellationSection() {
  const notePrefixes = ['If a guard cancels,', 'Cancel from My Jobs'];
  const notes = CANCELLATION_NOTES.map((text, i) => {
    const prefix = notePrefixes[i] ?? '';
    const rest = prefix && text.startsWith(prefix) ? text.slice(prefix.length).trim() : text;
    return { prefix, rest };
  });

  return (
    <div className="mb-16">
      <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-teal-400">Cancelling a booking</p>
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">The earlier you cancel, the more you get back</h2>

      <div className="flex flex-col md:flex-row rounded-2xl overflow-hidden border border-slate-700/50">
        {CANCELLATION_WINDOWS.map((w) => {
          const tone = cancellationTones[w.tone] ?? cancellationTones.good;
          return (
            <div key={w.label} className={`flex-1 p-6 ${tone.bg}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${tone.label}`}>{w.label}</p>
              <p className="text-xl md:text-2xl font-bold text-white mb-2">{w.outcome}</p>
              <p className="text-sm text-white/80 leading-relaxed">{w.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        {notes.map((note, i) => (
          <div key={i} className="bg-[#111d35] border border-slate-700/50 rounded-xl p-4">
            <p className="text-sm text-slate-400 leading-relaxed">
              <span className="font-bold text-white">{note.prefix}</span> {note.rest}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LicenceChecksSection({ role }: { role: Role }) {
  const isClient = role === 'client';
  const intro = isClient
    ? "Every guard you book has passed an SIA licence check. Here's exactly what is in place today and what's coming."
    : "Your licence is checked before you can take work. Here's exactly what is in place today and what's coming.";

  return (
    <div className="mb-16">
      <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 md:p-8 grid lg:grid-cols-2 gap-8 items-start">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-3 ${isClient ? 'text-teal-400' : 'text-sky-400'}`}>Licence checks</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">What we check, and when</h2>
          <p className="text-slate-400 text-sm leading-relaxed">{intro}</p>
        </div>
        <div>
          {LICENCE_CHECKS.map((check, i) => {
            const live = check.status === 'live';
            return (
              <div key={check.title} className={`py-4 ${i > 0 ? 'border-t border-slate-700/50' : ''} ${i === 0 ? 'pt-0' : ''}`}>
                <span
                  className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border mb-3 ${
                    live
                      ? 'bg-teal-500/10 text-teal-400 border-teal-400/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-400/20'
                  }`}
                >
                  {live ? 'Live now' : 'Coming soon'}
                </span>
                <p className="font-bold text-white text-sm mb-1">{check.title}</p>
                <p className="text-slate-400 text-xs leading-relaxed">{check.detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function HelpContent() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role>('client');

  const handleAiSupport = () => {
    const widget = document.getElementById('vapi-widget-floating-button');
    if (widget) {
      (widget as HTMLElement).click();
    } else {
      router.push('/contact');
    }
  };

  const isClient = role === 'client';

  const accentText = isClient ? 'text-teal-400' : 'text-sky-400';
  const accentRing = isClient ? 'focus:ring-teal-500/50 focus:border-teal-500/50' : 'focus:ring-sky-500/50 focus:border-sky-500/50';
  const activeBtn = isClient
    ? 'bg-teal-500 text-slate-900 hover:bg-teal-400'
    : 'bg-sky-500 text-slate-900 hover:bg-sky-400';
  const accentSolid = isClient ? 'bg-teal-500 text-white' : 'bg-sky-500 text-white';

  const journey = isClient ? CLIENT_JOURNEY : GUARD_JOURNEY;
  const journeyLabel = isClient ? 'Hiring with QuickGuard' : 'Working with QuickGuard';
  const journeyHeading = isClient ? 'From job post to a guard on site' : 'From sign-up to getting paid';
  const searchPlaceholder = isClient
    ? 'Search: refunds, plans, posting a job\u2026'
    : 'Search: SIA check, payouts, job alerts\u2026';

  const query = search.toLowerCase();

  const filtered = faqs.filter(
    (f) => f.question.toLowerCase().includes(query) || f.answer.toLowerCase().includes(query)
  );

  const topics = isClient ? CLIENT_TOPICS : GUARD_TOPICS;
  const filteredTopics = topics.filter(
    (t) => t.title.toLowerCase().includes(query) || t.desc.toLowerCase().includes(query)
  );

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <NavSidebar />

      <div className="bg-[#0B1933] border-b border-slate-800/60">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-teal-400 transition-colors cursor-pointer">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-arrow-left-line text-sm" />
            </div>
            Back to Home
          </Link>
        </div>
      </div>

      <div className="relative pt-20 pb-16 bg-[#0e1628] border-b border-slate-800/60 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-4 ${accentText}`}>
            QuickGuard Help Centre
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">How can we help?</h1>
          <p className="text-slate-400 text-lg mb-8 max-w-2xl mx-auto">
            Tell us who you are and we&apos;ll show you exactly how QuickGuard works for you, from first booking to getting paid.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-8">
            <button
              type="button"
              onClick={() => setRole('client')}
              className={`min-h-[48px] px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all cursor-pointer ${
                isClient
                  ? activeBtn
                  : 'bg-transparent border border-slate-600 text-slate-300 hover:border-teal-400/50 hover:text-white'
              }`}
            >
              I&apos;m hiring security
            </button>
            <button
              type="button"
              onClick={() => setRole('guard')}
              className={`min-h-[48px] px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all cursor-pointer ${
                !isClient
                  ? activeBtn
                  : 'bg-transparent border border-slate-600 text-slate-300 hover:border-sky-400/50 hover:text-white'
              }`}
            >
              I&apos;m a security guard
            </button>
          </div>

          <div className="relative max-w-xl mx-auto">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
              <i className="ri-search-line text-slate-500 text-lg" />
            </div>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-12 pr-4 py-4 rounded-xl bg-[#111d35] border border-slate-700/50 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 transition ${accentRing}`}
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">

        <div className="mb-16">
          <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-3 ${accentText}`}>{journeyLabel}</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">{journeyHeading}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
            {journey.map((step, i) => (
              <div key={step.title} className="h-full bg-[#111d35] border border-slate-700/50 rounded-2xl p-5 hover:border-slate-500/50 transition-all duration-200">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-4 font-bold text-sm ${accentSolid}`}>
                  {i + 1}
                </div>
                <h3 className="font-bold text-white text-sm mb-2 leading-snug">{step.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <MoneySection role={role} />

        {isClient && <CancellationSection />}

        <LicenceChecksSection role={role} />

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-8">Browse help topics</h2>
          {filteredTopics.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-[#111d35] border border-slate-700/50 rounded-2xl">
              <p className="text-sm font-medium text-white">No topics match your search</p>
              <p className="text-xs mt-1">Try a different term or <Link href="/contact" className="text-teal-400 underline">contact support</Link></p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTopics.map((topic) => (
                <Link key={topic.title} href={topic.href} className="group">
                  <div className="h-full bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 hover:border-slate-500/50 transition-all duration-200">
                    <h3 className="font-bold text-white text-base mb-2 group-hover:underline">{topic.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">{topic.desc}</p>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${accentText}`}>
                      View articles <i className="ri-arrow-right-line" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {isClient && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-2xl font-bold text-white">Visual Quick Start</h2>
                <p className="text-slate-400 text-sm mt-1">Use these screenshots to recognise the main client screens before you start.</p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-5 mt-6">
              {visualGuides.map((guide) => (
                <Link key={guide.title} href={guide.href} className="group">
                  <div className="h-full bg-[#111d35] border border-slate-700/50 rounded-2xl overflow-hidden hover:border-teal-500/30 transition-all duration-200">
                    <div className="relative aspect-video bg-[#0e1628]">
                      <img
                        src={guide.image}
                        alt={guide.title}
                        className="absolute inset-0 w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-white text-sm mb-2 group-hover:text-teal-400 transition-colors">{guide.title}</h3>
                      <p className="text-slate-400 text-xs leading-relaxed">{guide.description}</p>
                      <div className="flex items-center gap-1 text-teal-400 text-xs font-semibold mt-4">
                        Open guide <i className="ri-arrow-right-line" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-2">Frequently Asked Questions</h2>
          <p className="text-slate-400 mb-6 text-sm">
            {search ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${search}"` : 'Everything you need to know'}
          </p>
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <i className="ri-search-line text-5xl" />
              </div>
              <p className="text-lg font-medium text-white">No results found</p>
              <p className="text-sm mt-1">Try a different search term or <Link href="/contact" className="text-teal-400 underline">contact support</Link></p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((faq, i) => (
                <div key={i} className="border border-slate-700/50 rounded-xl overflow-hidden hover:border-teal-500/30 transition-colors bg-[#111d35]">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#0e1628] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-teal-500/10 border border-teal-400/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className={`${faq.icon} text-teal-400 text-sm`} />
                      </div>
                      <span className="font-semibold text-white text-sm">{faq.question}</span>
                    </div>
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 ml-4">
                      <i className={`ri-${openFaq === i ? 'subtract' : 'add'}-line text-teal-400 text-lg transition-transform`} />
                    </div>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-5 pt-1 bg-[#0e1628] border-t border-slate-700/50">
                      <p className="text-slate-400 text-sm leading-relaxed pl-11">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#0e1628] border border-slate-700/50 rounded-2xl p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
          <div className="relative z-10">
            <div className="w-14 h-14 bg-teal-500/10 border border-teal-400/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-headphone-line text-2xl text-teal-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Still stuck?</h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto text-sm">QuickGuard AI Support answers platform questions 24/7. Anything that needs a person is escalated to our team during business hours.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleAiSupport}
                className="bg-teal-500 text-slate-900 font-bold px-8 py-3 rounded-xl hover:bg-teal-400 transition-all whitespace-nowrap shadow-lg hover:shadow-teal-500/20 cursor-pointer"
              >
                Ask AI Support
              </button>
              <Link
                href="/contact"
                className="bg-transparent border border-slate-600 text-slate-200 font-bold px-8 py-3 rounded-xl hover:border-teal-400/50 hover:text-white transition-all whitespace-nowrap cursor-pointer"
              >
                Raise a ticket
              </Link>
            </div>
          </div>
        </div>

      </div>
      <Footer />
      <BackToTop />
    </div>
  );
}