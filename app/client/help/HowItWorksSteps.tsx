'use client';

import { useState } from 'react';
import Link from 'next/link';

const steps = [
  {
    number: '01',
    icon: 'ri-user-add-line',
    title: 'Create Your Account',
    desc: 'Sign up as a client, verify your email, and complete your company profile.',
    href: '/client/register',
  },
  {
    number: '02',
    icon: 'ri-building-line',
    title: 'Complete Company Details',
    desc: 'Add your business address, VAT number, billing contacts, and site information.',
    href: '/client/profile',
  },
  {
    number: '03',
    icon: 'ri-file-add-line',
    title: 'Post a Job',
    desc: 'Describe your security needs, shift times, location, and number of guards required.',
    href: '/client/post-job',
  },
  {
    number: '04',
    icon: 'ri-user-received-line',
    title: 'Review Applicants',
    desc: 'Verified SIA-licensed guards apply to your job. Review their profiles, ratings, and experience.',
    href: '/client/jobs',
  },
  {
    number: '05',
    icon: 'ri-user-search-line',
    title: 'Select Guards',
    desc: 'Choose the best guards for your job. Compare profiles, message applicants, and confirm your selection.',
    href: '/client/jobs',
  },
  {
    number: '06',
    icon: 'ri-secure-payment-line',
    title: 'Pay & Confirm Booking',
    desc: 'Pay securely via Stripe. Funds are held with Stripe until the shift is completed.',
    href: '/client/payment-history',
  },
  {
    number: '07',
    icon: 'ri-calendar-check-line',
    title: 'Track Attendance',
    desc: 'Monitor real-time check-ins, late arrivals, and no-shows from the Job Tracker.',
    href: '/client/jobs/tracker',
  },
  {
    number: '08',
    icon: 'ri-checkbox-circle-line',
    title: 'Complete Job',
    desc: 'Mark the job as complete once the shift ends. Review guard performance and confirm final details.',
    href: '/client/jobs/tracker',
  },
  {
    number: '09',
    icon: 'ri-star-line',
    title: 'Leave Review',
    desc: 'Rate your guards and leave feedback. This helps other clients and builds trust in the community.',
    href: '/client/reviews',
  },
];

export default function HowItWorksSteps() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div>
      {/* Desktop step bar */}
      <div className="hidden lg:flex items-center justify-between mb-10">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center">
            <button
              onClick={() => setActiveStep(i)}
              className={`flex flex-col items-center gap-2 transition-all cursor-pointer ${
                i === activeStep ? 'scale-105' : 'opacity-60 hover:opacity-100'
              }`}
            >
              <div
                className={`w-12 h-12 flex items-center justify-center rounded-full border-2 transition-all ${
                  i <= activeStep
                    ? 'bg-teal-500 border-teal-500 text-white'
                    : 'bg-[#111d35] border-slate-600 text-slate-500'
                }`}
              >
                <i className={`${step.icon} text-lg`} />
              </div>
              <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap max-w-[80px] text-center leading-tight">
                {step.title}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 transition-all ${i < activeStep ? 'bg-teal-500' : 'bg-slate-700'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Active step detail */}
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-6 lg:p-8 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-teal-500/10 border border-teal-400/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <i className={`${steps[activeStep].icon} text-teal-400 text-2xl`} />
            </div>
            <div>
              <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Step {steps[activeStep].number}</span>
              <h3 className="text-xl font-bold text-white">{steps[activeStep].title}</h3>
            </div>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed lg:flex-1 lg:text-right">
            {steps[activeStep].desc}
          </p>
          <Link
            href={steps[activeStep].href}
            className="flex items-center gap-2 bg-teal-500 text-slate-900 font-semibold px-5 py-2.5 rounded-xl hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer text-sm shadow-lg hover:shadow-teal-500/20"
          >
            Go to Step
            <i className="ri-arrow-right-line" />
          </Link>
        </div>
      </div>

      {/* Mobile step list */}
      <div className="lg:hidden space-y-3">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => setActiveStep(i)}
            className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
              i === activeStep
                ? 'bg-teal-500/10 border-teal-500/50'
                : 'bg-[#111d35]/60 border-[#1e2d4d] hover:border-slate-600'
            }`}
          >
            <div
              className={`w-10 h-10 flex items-center justify-center rounded-xl shrink-0 ${
                i === activeStep
                  ? 'bg-teal-500 text-white'
                  : 'bg-[#0e1628] text-slate-400 border border-[#1e2d4d]'
              }`}
            >
              <i className={`${step.icon} text-lg`} />
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-xs font-bold uppercase tracking-wider ${i === activeStep ? 'text-teal-400' : 'text-slate-500'}`}>
                Step {step.number}
              </span>
              <p className={`font-semibold text-sm ${i === activeStep ? 'text-white' : 'text-slate-300'}`}>
                {step.title}
              </p>
            </div>
            <i className={`ri-arrow-right-s-line text-lg ${i === activeStep ? 'text-teal-400' : 'text-slate-600'}`} />
          </button>
        ))}
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-6">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveStep(i)}
            className={`transition-all rounded-full cursor-pointer ${
              i === activeStep ? 'w-6 h-2.5 bg-teal-500' : 'w-2.5 h-2.5 bg-slate-600 hover:bg-slate-400'
            }`}
            aria-label={`Go to step ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}