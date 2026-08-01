'use client';

import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
  icon: string;
}

const faqs: FAQItem[] = [
  {
    question: 'How do I post a job?',
    answer: 'Go to your dashboard and click "Post a Job". Fill in the job title, security type, location, shift dates and times, number of guards needed, and hourly rate. Add any special requirements like SIA licence types or uniform needs. Review and submit — your job will be live immediately and visible to matching guards.',
    icon: 'ri-file-add-line',
  },
  {
    question: 'When do I pay?',
    answer: 'You pay after selecting guards and confirming your booking. Payment is processed securely via Stripe. Funds are held safely until the job is completed. You can also set up automatic billing for recurring jobs.',
    icon: 'ri-secure-payment-line',
  },
  {
    question: 'Can I cancel a job?',
    answer: 'Yes, you can cancel a job from your job list if it has not yet started. The cancellation option is available for jobs in Draft, Posted, Awaiting Applicants, Awaiting Payment, and Confirmed status. Once a job is completed or disputed, cancellation is not available. If payment has already been made, you may be eligible for a refund depending on the cancellation window and policy.',
    icon: 'ri-close-circle-line',
  },
  {
    question: 'What happens if a guard does not show up?',
    answer: 'If a guard fails to check in or does not show up, you can report it immediately from the job tracker. We will flag the incident, open a support ticket, and begin finding a replacement guard. You may also be eligible for a partial or full refund depending on the circumstances. Report no-shows within 2 hours for fastest resolution.',
    icon: 'ri-user-unfollow-line',
  },
  {
    question: 'How do I request a replacement guard?',
    answer: 'From the job tracker or job detail page, click "Request Replacement". You can specify urgency (standard or emergency), provide a reason, and review replacement candidates. Emergency replacements are prioritised and filled within 2 hours where possible.',
    icon: 'ri-refresh-line',
  },
  {
    question: 'How do I download invoices?',
    answer: 'Go to Payment History in your client portal. Click on any completed payment to view the details, then click "Download Invoice" to get a PDF. You can also email the invoice directly to your billing contact. Invoices include VAT, guard fees, and service charges broken down clearly.',
    icon: 'ri-download-line',
  },
  {
    question: 'How do I contact support?',
    answer: 'Click "Support" in your sidebar, or visit the Help Centre. You can create a support ticket, chat with our team, or report urgent issues. Support tickets are tracked in real time and you will receive notifications when we reply. For emergencies, use the urgent issue button.',
    icon: 'ri-customer-service-2-line',
  },
  {
    question: 'How do I select the right guard?',
    answer: 'Review each applicant profile which includes SIA licence verification, ratings from previous clients, years of experience, and distance from your venue. Compare guards side by side, check their compliance badges, and read past reviews. You can also message guards before confirming to ask questions.',
    icon: 'ri-user-search-line',
  },
  {
    question: 'What are the cancellation and refund terms?',
    answer: 'Cancellations made more than 48 hours before the shift start time are typically eligible for a full refund. Cancellations within 48 hours may receive a partial refund depending on whether guards have already been assigned and confirmed. Platform fees are refunded if cancellation occurs before guard confirmation. For disputed cancellations, our support team will review and determine eligibility.',
    icon: 'ri-refund-line',
  },
  {
    question: 'How do I track guard attendance?',
    answer: 'Use the Job Tracker in your client portal. Each job shows real-time check-in status, late arrivals, and no-shows. Guards check in via the mobile app when they arrive on site. You receive notifications for check-ins, late arrivals, and any issues reported.',
    icon: 'ri-calendar-check-line',
  },
  {
    question: 'Can I edit a job after posting?',
    answer: 'Yes, you can edit job details before guards are selected and the job is confirmed. Changes to shift times, number of guards, or location can be made from the job detail page. Once guards are confirmed and payment is complete, edits may be restricted to prevent disruption. Contact support if you need changes after confirmation.',
    icon: 'ri-edit-2-line',
  },
  {
    question: 'What SIA licence types do I need?',
    answer: 'Common SIA licence types include Door Supervisor (for venues and bars), Security Guard (for retail and sites), and Close Protection (for high-risk scenarios). The job posting wizard will suggest the right licence based on your venue type. You can also specify multiple licence requirements if needed.',
    icon: 'ri-shield-check-line',
  },
];

export default function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [search, setSearch] = useState('');

  const filtered = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="relative max-w-xl mb-6">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
          <i className="ri-search-line text-slate-500 text-lg" />
        </div>
        <input
          type="text"
          placeholder="Search FAQs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#162036] border border-[#1e2d4d] text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <i className="ri-search-line text-4xl text-slate-600" />
          </div>
          <p className="text-lg font-medium text-white">No results found</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((faq, i) => (
            <div key={i} className="border border-[#1e2d4d] rounded-xl overflow-hidden hover:border-teal-500/30 transition-colors bg-[#111d35]">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#0e1628] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-teal-500/10 border border-teal-400/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className={`${faq.icon} text-teal-400 text-sm`} />
                  </div>
                  <span className="font-semibold text-white text-sm">{faq.question}</span>
                </div>
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 ml-4">
                  <i className={`ri-${openIndex === i ? 'subtract' : 'add'}-line text-teal-400 text-lg transition-transform`} />
                </div>
              </button>
              {openIndex === i && (
                <div className="px-6 pb-5 pt-1 bg-[#0e1628] border-t border-[#1e2d4d]">
                  <p className="text-slate-400 text-sm leading-relaxed pl-11">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}