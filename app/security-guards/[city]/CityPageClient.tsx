'use client';

import { useState } from 'react';
import Link from 'next/link';
import NavSidebar from '@/components/NavSidebar';
import Footer from '@/components/Footer';
import CityPageSchema from './CityPageSchema';

interface CityData {
  city: string;
  slug: string;
  region: string;
  heroImage: string;
  heroImageAlt: string;
  tagline: string;
  description: string;
  stats: { label: string; value: string }[];
  services: { icon: string; title: string; description: string }[];
  areas: string[];
  faqs: { question: string; answer: string }[];
  testimonials: { name: string; company: string; text: string; rating: number }[];
  nearbyLinks: { city: string; slug: string }[];
}

export default function CityPageClient({ data }: { data: CityData }) {
  return (
    <div className="min-h-screen bg-[#0B1933]">
      <CityPageSchema
        city={data.city}
        region={data.region}
        description={data.description}
        faqs={data.faqs}
      />
      <NavSidebar />

      <section
        className="relative min-h-[560px] flex items-center bg-cover bg-center bg-no-repeat pt-20"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(11,26,51,0.96) 0%, rgba(11,26,51,0.85) 50%, rgba(11,26,51,0.4) 100%), url('${data.heroImage}')`,
        }}
        aria-labelledby="city-hero-heading"
      >
        <img src={data.heroImage} alt={data.heroImageAlt} title={`SIA licensed security guards in ${data.city}`} className="sr-only" />
        <div className="w-full max-w-7xl mx-auto px-6 md:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-teal-500/15 border border-teal-400/30 text-teal-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <i className="ri-map-pin-line"></i>
              {data.region}
            </div>
            <h1 id="city-hero-heading" className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-[1.1] text-white">
              SIA Licensed Security Guards in{' '}
              <span className="text-teal-400">{data.city}</span>
            </h1>
            <p className="text-lg md:text-xl mb-8 text-slate-300 max-w-xl leading-relaxed">
              {data.tagline}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/client/register"
                className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-lg text-lg font-semibold transition-all hover:scale-105 whitespace-nowrap text-center"
              >
                Book a Guard in {data.city}
              </Link>
              <Link
                href="/guard/register"
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-lg text-lg font-semibold transition-all hover:scale-105 whitespace-nowrap text-center backdrop-blur-sm"
              >
                Find Jobs in {data.city}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-[#0e1628] border-y border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {data.stats.map((stat, i) => (
              <div key={i} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 hover:border-teal-500/30 transition-all">
                <div className="text-3xl font-bold text-teal-400 mb-1">{stat.value}</div>
                <div className="text-slate-400 text-sm font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#0B1933]" aria-labelledby="about-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
                <i className="ri-shield-check-line"></i>
                Local Coverage
              </div>
              <h2 id="about-heading" className="text-3xl md:text-4xl font-bold text-white mb-6">
                Security Guard Services in {data.city}
              </h2>
              <p className="text-slate-300 leading-relaxed mb-6 text-lg">
                {data.description}
              </p>
              <div className="flex flex-wrap gap-3">
                {data.areas.slice(0, 6).map((area, i) => (
                  <span key={i} className="bg-teal-500/10 border border-teal-400/20 text-teal-300 px-3 py-1.5 rounded-full text-sm font-medium">
                    <i className="ri-map-pin-2-line mr-1"></i>
                    {area}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden border border-slate-700/50">
              <img
                src={data.heroImage}
                alt={`SIA licensed security guard on duty in ${data.city}`}
                title={`SIA licensed security guard on duty in ${data.city}`}
                className="w-full h-80 object-cover object-top"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#0e1628]" aria-labelledby="services-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-service-line"></i>
              Our Services
            </div>
            <h2 id="services-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
              Security Services Available in {data.city}
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Fully verified SIA-licensed professionals ready to deploy across {data.city} and surrounding areas
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.services.map((service, i) => (
              <div key={i} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-7 hover:border-teal-500/30 hover:scale-[1.02] transition-all">
                <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 rounded-xl border border-teal-400/20 mb-5">
                  <i className={`${service.icon} text-2xl text-teal-400`}></i>
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">{service.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#0B1933]" aria-labelledby="areas-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-12">
            <h2 id="areas-heading" className="text-3xl font-bold text-white mb-4">
              Areas We Cover in {data.city}
            </h2>
            <p className="text-slate-400 text-lg">
              QuickGuard connects you with local guards across all major districts
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {data.areas.map((area, i) => (
              <div key={i} className="bg-[#111d35] border border-slate-700/50 rounded-xl px-4 py-3 text-center hover:border-teal-500/30 transition-all cursor-default">
                <i className="ri-map-pin-line text-teal-400 text-sm mr-1"></i>
                <span className="text-slate-300 text-sm font-medium">{area}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#0e1628]" aria-labelledby="testimonials-heading">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-star-line"></i>
              Client Reviews
            </div>
            <h2 id="testimonials-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
              Trusted by Businesses in {data.city}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {data.testimonials.map((t, i) => (
              <div key={i} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-7 hover:border-teal-500/30 transition-all">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <i key={j} className="ri-star-fill text-amber-400 text-sm"></i>
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-5 italic">&ldquo;{t.text}&rdquo;</p>
                <div>
                  <p className="text-white font-semibold text-sm">{t.name}</p>
                  <p className="text-slate-500 text-xs">{t.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#0B1933]" aria-labelledby="faq-heading">
        <div className="max-w-4xl mx-auto px-6 md:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <i className="ri-question-line"></i>
              FAQs
            </div>
            <h2 id="faq-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
              Frequently Asked Questions — {data.city}
            </h2>
          </div>
          <div className="space-y-4">
            {data.faqs.map((faq, i) => (
              <FaqItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {data.nearbyLinks.length > 0 && (
        <section className="py-12 bg-[#0e1628] border-t border-slate-800/60">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <h2 className="text-xl font-bold text-white mb-6 text-center">Security Guards in Other UK Cities</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {data.nearbyLinks.map((link, i) => (
                <Link
                  key={i}
                  href={`/security-guards/${link.slug}`}
                  className="bg-[#111d35] border border-slate-700/50 text-slate-300 hover:text-teal-400 hover:border-teal-500/40 px-5 py-2.5 rounded-full text-sm font-medium transition-all"
                >
                  <i className="ri-map-pin-line mr-1.5"></i>
                  {link.city}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-24 bg-[#0B1933] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-6 md:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <i className="ri-rocket-line"></i>
            Get Started Today
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Need Security Guards in {data.city}?
          </h2>
          <p className="text-xl mb-10 text-slate-400 max-w-2xl mx-auto">
            Post your job and get matched with verified SIA-licensed professionals in minutes. No upfront fees.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/client/register"
              className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105 whitespace-nowrap"
            >
              Book Security Guards
            </Link>
            <Link
              href="/jobs"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105 whitespace-nowrap backdrop-blur-sm"
            >
              Browse {data.city} Jobs
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#111d35] border border-slate-700/50 rounded-xl overflow-hidden hover:border-teal-500/30 transition-all">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer"
        aria-expanded={open}
      >
        <span className="text-white font-medium pr-4">{question}</span>
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
          <i className={`${open ? 'ri-subtract-line' : 'ri-add-line'} text-teal-400 text-lg`}></i>
        </div>
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-slate-400 text-sm leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}