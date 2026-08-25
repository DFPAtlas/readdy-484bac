'use client';

import Footer from '../../components/Footer';
import NavSidebar from '../../components/NavSidebar';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import ContactSchema from './ContactSchema';

export default function ContactClient() {
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: '',
    message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCategorySelect = (cat: string) => {
    setFormData(prev => ({ ...prev, category: cat }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (formData.message.length > 500) return;
    setFormStatus('sending');

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;

      const { error: insertError } = await supabase
        .from('contact_submissions')
        .insert({
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
          category: formData.category || null,
          user_id: userId,
          status: 'new'
        });

      if (insertError) {
        console.error('Contact submission insert failed:', insertError);
        setFormStatus('error');
        return;
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sessionData?.session?.access_token) {
          headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
        }

        await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-contact-form-email`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...formData, user_id: userId }),
          }
        );
      } catch (emailErr) {
        console.error('Contact email notification failed:', emailErr);
      }

      setFormStatus('success');
      setFormData({ name: '', email: '', subject: '', category: '', message: '' });
    } catch (err) {
      console.error('Contact form submit error:', err);
      setFormStatus('error');
    }
  };

  const categories = [
    { label: 'General Enquiry', icon: 'ri-question-line' },
    { label: 'Guard Support', icon: 'ri-shield-user-line' },
    { label: 'Client Support', icon: 'ri-building-2-line' },
    { label: 'Technical Issue', icon: 'ri-tools-line' },
    { label: 'Billing', icon: 'ri-bank-card-line' },
    { label: 'Partnership', icon: 'ri-team-line' },
  ];

  const contactCards = [
    {
      icon: 'ri-mail-send-line',
      color: 'bg-teal-500/10 border-teal-400/20 text-teal-400',
      title: 'Email Us',
      value: 'info@quickguard.uk',
      sub: 'Response within 24 hours',
      href: 'mailto:info@quickguard.uk',
    },
    {
      icon: 'ri-phone-line',
      color: 'bg-emerald-500/10 border-emerald-400/20 text-emerald-400',
      title: 'Call Us',
      value: '01992 217019',
      sub: 'Mon–Fri 9AM–6PM',
      href: 'tel:01992217019',
    },
    {
      icon: 'ri-map-pin-2-line',
      color: 'bg-purple-500/10 border-purple-400/20 text-purple-400',
      title: 'Our Office',
      value: 'London, United Kingdom',
      sub: 'Mon–Fri, 9AM – 6PM',
      href: '#',
    },
    {
      icon: 'ri-time-line',
      color: 'bg-amber-500/10 border-amber-400/20 text-amber-400',
      title: 'Support Hours',
      value: 'Mon–Fri 9AM–6PM',
      sub: 'Sat–Sun 10AM–4PM',
      href: '#',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <ContactSchema />
      <NavSidebar />

      <section className="relative pt-32 pb-24 bg-[#0e1628] border-b border-slate-800/60">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-customer-service-2-line text-sm" />
            </div>
            <span>We're here to help</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
            Get in Touch with<br />
            <span className="text-teal-400">QuickGuard</span>
          </h1>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto leading-relaxed">
            Whether you're a guard, a client, or just curious — our team is ready to answer your questions and support your journey.
          </p>
        </div>
      </section>

      <section className="relative z-10 max-w-6xl mx-auto px-6 -mt-20 mb-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {contactCards.map((card) => (
            <a
              key={card.title}
              href={card.href}
              className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 hover:border-teal-500/30 transition-all duration-300 cursor-pointer group"
            >
              <div className={`w-12 h-12 flex items-center justify-center rounded-xl ${card.color} mb-4 group-hover:scale-110 transition-transform`}>
                <i className={`${card.icon} text-xl`} />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{card.title}</p>
              <p className="text-sm font-bold text-white mb-1">{card.value}</p>
              <p className="text-xs text-slate-400">{card.sub}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid lg:grid-cols-5 gap-12">
          <div className="lg:col-span-2 space-y-8 pt-8">
            <div>
              <h2 className="text-3xl font-bold text-white mb-3">Let's Talk</h2>
              <p className="text-slate-400 leading-relaxed">
                Fill in the form and we'll get back to you within 24 hours. For urgent matters, call us directly.
              </p>
            </div>

            <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-mail-line text-teal-400 text-base" />
                </div>
                Dedicated Support Lines
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'Guards', email: 'guards@quickguard.uk', color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-400/20', icon: 'ri-shield-user-line' },
                  { label: 'Clients', email: 'clients@quickguard.uk', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-400/20', icon: 'ri-building-2-line' },
                  { label: 'Technical', email: 'tech@quickguard.uk', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-400/20', icon: 'ri-tools-line' },
                ].map((item) => (
                  <div key={item.label} className={`flex items-center gap-3 p-3 ${item.bg} rounded-xl border`}>
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0e1628]">
                      <i className={`${item.icon} ${item.color} text-sm`} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">{item.label} Support</p>
                      <a href={`mailto:${item.email}`} className={`text-sm font-semibold ${item.color} hover:underline`}>{item.email}</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
              <h3 className="font-bold text-white mb-4">Typical Response Times</h3>
              <div className="space-y-3">
                {[
                  { type: 'Email', time: 'Within 24 hours', pct: 90, color: 'bg-teal-500' },
                  { type: 'Phone', time: 'Immediate', pct: 100, color: 'bg-emerald-500' },
                  { type: 'Technical', time: 'Within 48 hours', pct: 75, color: 'bg-purple-500' },
                ].map((r) => (
                  <div key={r.type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-300">{r.type}</span>
                      <span className="text-slate-500">{r.time}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${r.color} rounded-full`} style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-[#111d35] border border-slate-700/50 rounded-3xl p-8">
              {formStatus === 'success' ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-full mb-6">
                    <i className="ri-check-line text-4xl text-teal-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Message Sent!</h3>
                  <p className="text-slate-400 max-w-sm mb-8">
                    Thanks for reaching out. Our team will get back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => setFormStatus('idle')}
                    className="px-6 py-3 bg-teal-500 text-slate-900 rounded-xl font-semibold hover:bg-teal-400 transition-all cursor-pointer whitespace-nowrap"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white mb-1">Send Us a Message</h2>
                    <p className="text-slate-500 text-sm">All fields are required unless marked optional.</p>
                  </div>

                  <form data-readdy-form id="contact-form" onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-1.5" htmlFor="name">Full Name</label>
                        <input
                          id="name"
                          name="name"
                          type="text"
                          required
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Jane Smith"
                          className="w-full border border-slate-700/50 bg-[#0e1628] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-1.5" htmlFor="email">Email Address</label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="jane@example.com"
                          className="w-full border border-slate-700/50 bg-[#0e1628] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Category</label>
                      <div className="grid grid-cols-3 gap-2">
                        {categories.map((cat) => (
                          <button
                            key={cat.label}
                            type="button"
                            onClick={() => handleCategorySelect(cat.label)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                              formData.category === cat.label
                                ? 'bg-teal-500 border-teal-500 text-slate-900 shadow-lg shadow-teal-500/20'
                                : 'bg-[#0e1628] border-slate-700/50 text-slate-400 hover:border-teal-500/30 hover:text-teal-400'
                            }`}
                          >
                            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                              <i className={`${cat.icon} text-sm`} />
                            </div>
                            <span className="truncate">{cat.label}</span>
                          </button>
                        ))}
                      </div>
                      <input type="hidden" name="category" value={formData.category} />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-1.5" htmlFor="subject">Subject</label>
                      <input
                        id="subject"
                        name="subject"
                        type="text"
                        required
                        value={formData.subject}
                        onChange={handleChange}
                        placeholder="How can we help you?"
                        className="w-full border border-slate-700/50 bg-[#0e1628] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-sm font-semibold text-slate-300" htmlFor="message">Message</label>
                        <span className={`text-xs ${formData.message.length > 480 ? 'text-red-400' : 'text-slate-500'}`}>
                          {formData.message.length}/500
                        </span>
                      </div>
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={5}
                        maxLength={500}
                        value={formData.message}
                        onChange={handleChange}
                        placeholder="Tell us more about your enquiry..."
                        className="w-full border border-slate-700/50 bg-[#0e1628] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition resize-none"
                      />
                    </div>

                    {formStatus === 'error' && (
                      <div className="flex items-center gap-2 bg-red-500/10 border border-red-400/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                          <i className="ri-error-warning-line text-sm" />
                        </div>
                        Something went wrong. Please try again or email us directly.
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={formStatus === 'sending' || formData.message.length > 500}
                      className="w-full bg-teal-500 hover:bg-teal-400 disabled:bg-slate-700 text-slate-900 font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-lg hover:shadow-teal-500/20"
                    >
                      {formStatus === 'sending' ? (
                        <>
                          <div className="w-4 h-4 flex items-center justify-center">
                            <i className="ri-loader-4-line text-base animate-spin" />
                          </div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <div className="w-4 h-4 flex items-center justify-center">
                            <i className="ri-send-plane-line text-base" />
                          </div>
                          Send Message
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0e1628] border-t border-slate-800/60 py-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-2xl mx-auto mb-5">
            <i className="ri-shield-check-line text-3xl text-teal-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Still have questions?</h2>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            Browse our Help Centre for instant answers, or check our guides for guards and clients.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/help" className="bg-teal-500 text-slate-900 font-semibold px-6 py-3 rounded-xl hover:bg-teal-400 transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-2 shadow-lg hover:shadow-teal-500/20">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-question-answer-line text-sm" />
              </div>
              Visit Help Centre
            </a>
            <a href="/guide/guard" className="bg-white/10 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/20 transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-2 border border-white/20">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-shield-user-line text-sm" />
              </div>
              Guard Guide
            </a>
            <a href="/guide/client" className="bg-white/10 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/20 transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-2 border border-white/20">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-building-2-line text-sm" />
              </div>
              Client Guide
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
