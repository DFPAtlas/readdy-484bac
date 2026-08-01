'use client';

import { useState } from 'react';
import Link from 'next/link';
import BackToTop from '@/components/BackToTop';
import Footer from '@/components/Footer';
import NavSidebar from '@/components/NavSidebar';

const faqs = [
  { question: 'How do I get started as a Client?', answer: 'Register as a client, complete your profile, and post your first job. You can browse verified guards, review applications, and hire the best match for your security needs.', icon: 'ri-user-add-line' },
  { question: 'How do I get started as a Guard?', answer: 'Register as a guard, upload your SIA licence, and complete your profile. Once verified, you can browse available jobs and submit applications directly through the platform.', icon: 'ri-shield-user-line' },
  { question: 'Is SIA licence verification required?', answer: 'Yes. All security guards must hold a valid SIA licence. Our automated verification system checks your licence status in real time to ensure full compliance and safety.', icon: 'ri-verified-badge-line' },
  { question: 'How does payment work?', answer: 'Clients pay securely via Stripe when a job is confirmed. Guards receive their earnings after completing assignments. All transactions are encrypted and processed through our secure platform.', icon: 'ri-secure-payment-line' },
  { question: 'Can I cancel or edit a job after posting?', answer: 'Yes. You can edit job details or cancel a posting from your client dashboard before guards are assigned. Once guards are assigned, please contact support for assistance.', icon: 'ri-edit-2-line' },
  { question: 'How long does guard verification take?', answer: 'SIA licence verification is typically completed within 24–48 hours. You will receive an email notification once your profile has been reviewed and approved.', icon: 'ri-time-line' },
  { question: 'What subscription plans are available?', answer: 'We offer flexible plans for clients of all sizes. Visit our Pricing page to compare features and choose the plan that best suits your business needs.', icon: 'ri-price-tag-3-line' },
  { question: 'How do I raise a complaint?', answer: 'You can submit a complaint directly from your job detail page. Our team reviews all complaints promptly and will keep you updated on the resolution progress.', icon: 'ri-feedback-line' },
];

const categories = [
  { label: 'Getting Started', icon: 'ri-rocket-line', color: 'bg-teal-500/10 text-teal-400 border-teal-400/20', href: '/how-it-works' },
  { label: 'Payments & Billing', icon: 'ri-bank-card-line', color: 'bg-blue-500/10 text-blue-400 border-blue-400/20', href: '/pricing' },
  { label: 'Guard Verification', icon: 'ri-shield-check-line', color: 'bg-purple-500/10 text-purple-400 border-purple-400/20', href: '/guide/guard' },
  { label: 'Job Management', icon: 'ri-briefcase-line', color: 'bg-orange-500/10 text-orange-400 border-orange-400/20', href: '/guide/client' },
  { label: 'Client Help Portal', icon: 'ri-dashboard-line', color: 'bg-teal-500/10 text-teal-400 border-teal-400/20', href: '/client/help' },
  { label: 'Account & Profile', icon: 'ri-account-circle-line', color: 'bg-pink-500/10 text-pink-400 border-pink-400/20', href: '/guide/client' },
  { label: 'Contact Support', icon: 'ri-customer-service-2-line', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20', href: '/contact' },
];

const popularArticles = [
  { title: 'How to Post Your First Security Job', excerpt: 'A step-by-step walkthrough for clients posting their first job — from job details to guard selection.', category: 'Getting Started', categoryColor: 'bg-teal-500/10 text-teal-400 border-teal-400/20', icon: 'ri-file-add-line', views: '12.4k', href: '/guide/client', trending: true },
  { title: 'SIA Licence Verification Explained', excerpt: 'Understand how our automated SIA licence check works and what to do if your verification is delayed.', category: 'Guard Verification', categoryColor: 'bg-purple-500/10 text-purple-400 border-purple-400/20', icon: 'ri-shield-check-line', views: '9.8k', href: '/guide/guard', trending: true },
  { title: 'Understanding Subscription Plans', excerpt: 'Compare our Starter, Professional, and Enterprise plans to find the right fit for your business.', category: 'Payments & Billing', categoryColor: 'bg-blue-500/10 text-blue-400 border-blue-400/20', icon: 'ri-price-tag-3-line', views: '8.1k', href: '/pricing', trending: false },
  { title: 'How Guards Get Paid', excerpt: 'Learn about payout schedules, bank detail setup, and how earnings are calculated per assignment.', category: 'Payments & Billing', categoryColor: 'bg-blue-500/10 text-blue-400 border-blue-400/20', icon: 'ri-money-pound-circle-line', views: '7.5k', href: '/guide/guard', trending: false },
  { title: 'Selecting & Hiring the Right Guard', excerpt: 'Tips on reviewing guard profiles, ratings, and experience to make the best hiring decision.', category: 'Job Management', categoryColor: 'bg-orange-500/10 text-orange-400 border-orange-400/20', icon: 'ri-user-search-line', views: '6.9k', href: '/guide/client', trending: true },
  { title: 'How to Raise a Complaint', excerpt: "If something goes wrong on a job, here's how to submit a complaint and what happens next.", category: 'Account & Profile', categoryColor: 'bg-pink-500/10 text-pink-400 border-pink-400/20', icon: 'ri-feedback-line', views: '5.3k', href: '/guide/client', trending: false },
];

export default function HelpContent() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const filtered = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase())
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

      <div className="relative pt-24 pb-20 bg-[#0e1628] border-b border-slate-800/60 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <i className="ri-question-answer-line" />
            Help Centre
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">How can we help you?</h1>
          <p className="text-slate-400 text-lg mb-8">Search our knowledge base or browse guides below</p>
          <div className="relative max-w-xl mx-auto">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
              <i className="ri-search-line text-slate-500 text-lg" />
            </div>
            <input
              type="text"
              placeholder="Search for answers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-xl bg-[#111d35] border border-slate-700/50 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">

        <div className="mb-16">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-500/10 border border-amber-400/20 rounded-xl flex items-center justify-center">
                <i className="ri-fire-line text-amber-400 text-lg" />
              </div>
              <h2 className="text-2xl font-bold text-white">Popular Articles</h2>
            </div>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Most visited this month</span>
          </div>
          <p className="text-slate-400 text-sm mb-7 pl-12">Quick answers to the topics our users visit most</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {popularArticles.map((article, i) => (
              <Link key={i} href={article.href} className="group">
                <div className="h-full bg-[#111d35] border border-slate-700/50 rounded-2xl p-5 hover:border-teal-500/30 transition-all duration-200 cursor-pointer flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-[#0e1628] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-teal-500/10 transition-colors border border-slate-700/50">
                      <i className={`${article.icon} text-slate-400 group-hover:text-teal-400 text-lg transition-colors`} />
                    </div>
                    {article.trending && (
                      <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 text-xs font-semibold px-2 py-1 rounded-full border border-amber-400/20">
                        <i className="ri-fire-line text-xs" /> Trending
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-white text-sm mb-2 group-hover:text-teal-400 transition-colors leading-snug">{article.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed flex-1 mb-4">{article.excerpt}</p>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-700/50">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${article.categoryColor}`}>{article.category}</span>
                    <div className="flex items-center gap-1 text-slate-500 text-xs">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-eye-line text-xs" />
                      </div>
                      <span>{article.views} views</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <Link href="/guide/client" className="group">
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 hover:border-teal-500/30 hover:shadow-2xl transition-all duration-300 cursor-pointer h-full bg-[#111d35]">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-teal-500/10 border border-teal-400/20 rounded-xl flex items-center justify-center">
                    <i className="ri-briefcase-line text-xl text-teal-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Client Guide</h2>
                </div>
                <p className="text-slate-400 text-sm mb-4">Post jobs, hire verified guards, manage assignments, and process payments — all in one place.</p>
                <div className="flex items-center text-teal-400 font-semibold text-sm group-hover:translate-x-1 transition-transform">
                  Read Client Guide <i className="ri-arrow-right-line ml-1" />
                </div>
              </div>
            </div>
          </Link>

          <Link href="/guide/guard" className="group">
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 hover:border-teal-500/30 hover:shadow-2xl transition-all duration-300 cursor-pointer h-full bg-[#111d35]">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-500/10 border border-blue-400/20 rounded-xl flex items-center justify-center">
                    <i className="ri-shield-user-line text-xl text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Guard Guide</h2>
                </div>
                <p className="text-slate-400 text-sm mb-4">Find jobs, get SIA verified, build your profile, and start earning through the QuickGuard platform.</p>
                <div className="flex items-center text-blue-400 font-semibold text-sm group-hover:translate-x-1 transition-transform">
                  Read Guard Guide <i className="ri-arrow-right-line ml-1" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-2">Browse by Category</h2>
          <p className="text-slate-400 mb-6 text-sm">Jump straight to the topic you need</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((cat) => (
              <Link key={cat.label} href={cat.href} className="group">
                <div className="flex flex-col items-center text-center p-4 rounded-xl border border-slate-700/50 hover:shadow-md hover:border-teal-500/30 transition-all duration-200 bg-[#111d35] cursor-pointer">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${cat.color}`}>
                    <i className={`${cat.icon} text-xl`} />
                  </div>
                  <span className="text-xs font-semibold text-slate-300 leading-tight">{cat.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

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

        <div className="grid md:grid-cols-3 gap-5 mb-16">
          {[
            { href: '/how-it-works', icon: 'ri-information-line', color: 'bg-teal-500/10 text-teal-400 border-teal-400/20', title: 'How It Works', sub: 'Platform overview' },
            { href: '/pricing', icon: 'ri-price-tag-3-line', color: 'bg-blue-500/10 text-blue-400 border-blue-400/20', title: 'Pricing Plans', sub: 'Compare all plans' },
            { href: '/contact', icon: 'ri-customer-service-2-line', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20', title: 'Contact Support', sub: 'Talk to our team' },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="flex items-center gap-4 p-5 bg-[#111d35] border border-slate-700/50 rounded-xl hover:shadow-md hover:border-teal-500/30 transition-all cursor-pointer">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                  <i className={`${item.icon} text-xl`} />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.sub}</p>
                </div>
                <div className="ml-auto w-5 h-5 flex items-center justify-center">
                  <i className="ri-arrow-right-s-line text-slate-500 text-lg" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="bg-[#0e1628] border border-slate-700/50 rounded-2xl p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
          <div className="relative z-10">
            <div className="w-14 h-14 bg-teal-500/10 border border-teal-400/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-headphone-line text-2xl text-teal-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Still need help?</h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto text-sm">Our support team is available to assist you. Reach out and we'll get back to you as soon as possible.</p>
            <Link href="/contact">
              <button className="bg-teal-500 text-slate-900 font-bold px-8 py-3 rounded-xl hover:bg-teal-400 transition-all whitespace-nowrap shadow-lg hover:shadow-teal-500/20">
                Contact Support
              </button>
            </Link>
          </div>
        </div>

      </div>
      <Footer />
      <BackToTop />
    </div>
  );
}