'use client';

import Link from 'next/link';
import PortalSidebar from '@/components/PortalSidebar';
import { useClientGuard } from '@/hooks/useClientGuard';
import HelpSection from './HelpSection';
import FAQAccordion from './FAQAccordion';
import HowItWorksSteps from './HowItWorksSteps';
import SupportShortcuts from './SupportShortcuts';

const quickLinks = [
  { label: 'Post a Job', href: '/client/post-job', icon: 'ri-file-add-line', color: 'text-teal-400' },
  { label: 'My Jobs', href: '/client/jobs', icon: 'ri-briefcase-line', color: 'text-blue-400' },
  { label: 'Job Tracker', href: '/client/jobs/tracker', icon: 'ri-radar-line', color: 'text-emerald-400' },
  { label: 'Payment History', href: '/client/payment-history', icon: 'ri-wallet-3-line', color: 'text-violet-400' },
  { label: 'Messages', href: '/client/messages', icon: 'ri-message-3-line', color: 'text-amber-400' },
  { label: 'Support', href: '/client/support', icon: 'ri-customer-service-2-line', color: 'text-pink-400' },
  { label: 'Profile', href: '/client/profile', icon: 'ri-user-settings-line', color: 'text-cyan-400' },
  { label: 'Reviews', href: '/client/reviews', icon: 'ri-star-line', color: 'text-yellow-400' },
  { label: 'Activity Log', href: '/client/activity-log', icon: 'ri-history-line', color: 'text-slate-400' },
];

export default function ClientHelpPage() {
  const { loading: authLoading, allowed } = useClientGuard();

  if (authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName="Help Centre" subtitle="Client" initials="HC" />

        <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
          {/* Header Skeleton */}
          <header className="bg-[#111d35] border-b border-[#1e2d4d] px-4 sm:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-20">
            <div className="space-y-1">
              <div className="h-3 w-28 bg-[#162036] rounded animate-pulse" />
              <div className="h-7 sm:h-8 w-40 sm:w-48 bg-[#162036] rounded animate-pulse" />
            </div>
          </header>

          <main className="flex-1 px-4 sm:px-8 py-4 sm:py-8">
            {/* Hero Skeleton */}
            <div className="relative bg-[#0e1628] rounded-2xl border border-[#1e2d4d] p-6 sm:p-8 mb-6 sm:mb-8 overflow-hidden">
              <div className="relative z-10 space-y-3">
                <div className="h-6 sm:h-7 w-36 sm:w-44 bg-[#162036] rounded-full animate-pulse" />
                <div className="h-7 sm:h-8 w-48 sm:w-64 bg-[#162036] rounded animate-pulse" />
                <div className="h-3 w-full sm:w-96 bg-[#162036] rounded animate-pulse" />
                <div className="h-3 w-40 sm:w-48 bg-[#162036] rounded animate-pulse" />
              </div>
            </div>

            {/* Quick Links Skeleton */}
            <div className="mb-6 sm:mb-8">
              <div className="h-4 w-24 bg-[#162036] rounded animate-pulse mb-3 sm:mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 sm:p-4 bg-[#111d35] border border-[#1e2d4d] rounded-xl">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 bg-[#162036] rounded-lg flex-shrink-0 animate-pulse" />
                    <div className="h-4 flex-1 bg-[#162036] rounded animate-pulse" />
                    <div className="h-4 w-4 bg-[#162036] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* Support Shortcuts Skeleton */}
            <div className="mb-6 sm:mb-8">
              <div className="h-4 w-32 bg-[#162036] rounded animate-pulse mb-3 sm:mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#162036] rounded-xl flex-shrink-0 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-28 sm:w-32 bg-[#162036] rounded animate-pulse" />
                      <div className="h-3 w-full sm:w-40 bg-[#162036] rounded animate-pulse" />
                    </div>
                    <div className="h-4 w-4 bg-[#162036] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* How It Works Skeleton */}
            <div className="mb-6 sm:mb-8">
              <div className="h-4 w-40 bg-[#162036] rounded animate-pulse mb-3 sm:mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 sm:p-5 text-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#162036] rounded-xl mx-auto mb-3 animate-pulse" />
                    <div className="h-4 w-28 sm:w-32 bg-[#162036] rounded animate-pulse mx-auto mb-2" />
                    <div className="h-3 w-full sm:w-40 bg-[#162036] rounded animate-pulse mx-auto" />
                  </div>
                ))}
              </div>
            </div>

            {/* Help Sections Skeleton */}
            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              <div className="h-4 w-32 bg-[#162036] rounded animate-pulse mb-3 sm:mb-4" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 sm:p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-6 h-6 bg-[#162036] rounded animate-pulse" />
                    <div className="h-4 w-32 sm:w-40 bg-[#162036] rounded animate-pulse" />
                  </div>
                  <div className="space-y-2 pl-9">
                    <div className="h-3 w-full bg-[#162036] rounded animate-pulse" />
                    <div className="h-3 w-3/4 bg-[#162036] rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>

            {/* FAQ Skeleton */}
            <div className="mb-6 sm:mb-8">
              <div className="h-4 w-40 bg-[#162036] rounded animate-pulse mb-3 sm:mb-4" />
              <div className="space-y-2 sm:space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 sm:p-5 flex items-center justify-between">
                    <div className="h-4 w-full sm:w-2/3 bg-[#162036] rounded animate-pulse" />
                    <div className="h-4 w-4 bg-[#162036] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom CTA Skeleton */}
            <div className="bg-[#0e1628] border border-[#1e2d4d] rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden">
              <div className="relative z-10 space-y-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#162036] rounded-xl mx-auto animate-pulse" />
                <div className="h-6 sm:h-7 w-40 sm:w-48 bg-[#162036] rounded animate-pulse mx-auto" />
                <div className="h-3 w-full sm:w-96 bg-[#162036] rounded animate-pulse mx-auto" />
                <div className="flex flex-wrap gap-3 justify-center pt-2">
                  <div className="h-10 sm:h-11 w-32 sm:w-36 bg-teal-500/20 rounded-xl animate-pulse" />
                  <div className="h-10 sm:h-11 w-24 sm:w-28 bg-[#162036] rounded-xl animate-pulse" />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName="Help Centre"
        subtitle="Client"
        initials="HC"
      />

      <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
        <header className="bg-[#111d35] border-b border-[#1e2d4d] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Client Portal</p>
            <h1 className="text-xl font-bold text-white">Help Centre</h1>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">
          {/* Hero */}
          <div className="relative bg-[#0e1628] rounded-2xl border border-[#1e2d4d] p-8 mb-8 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
                <i className="ri-question-answer-line" />
                Help & Support
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">How can we help you?</h2>
              <p className="text-slate-400 text-sm mb-6 max-w-lg">
                Find guides, answers, and step-by-step instructions for everything you need on QuickGuard.
              </p>
              <p className="text-xs text-teal-400/70">Browse the sections below or use the FAQ search to find specific answers.</p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Quick Links</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className="group">
                  <div className="flex items-center gap-3 p-4 bg-[#111d35] border border-[#1e2d4d] rounded-xl hover:border-teal-500/30 transition-all cursor-pointer">
                    <div className="w-9 h-9 bg-[#0e1628] rounded-lg flex items-center justify-center border border-[#1e2d4d]">
                      <i className={`${link.icon} ${link.color} text-lg`} />
                    </div>
                    <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors whitespace-nowrap">
                      {link.label}
                    </span>
                    <i className="ri-arrow-right-s-line text-slate-600 ml-auto group-hover:text-teal-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Support Shortcuts */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Support Shortcuts</h3>
            <SupportShortcuts />
          </div>

          {/* How It Works */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">How QuickGuard Works</h3>
            <HowItWorksSteps />
          </div>

          {/* Help Sections */}
          <div className="space-y-4 mb-8">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Guide Sections</h3>

            <HelpSection id="getting-started" icon="ri-rocket-line" title="Getting Started" defaultOpen>
              <div className="space-y-4 text-sm text-slate-400">
                <p>Welcome to QuickGuard. Here is how to get up and running quickly:</p>
                <ol className="space-y-3 list-decimal list-inside">
                  <li className="text-slate-300"><span className="text-slate-400">Create your client account and verify your email address.</span></li>
                  <li className="text-slate-300"><span className="text-slate-400">Complete your company profile with business name, address, and contact details.</span></li>
                  <li className="text-slate-300"><span className="text-slate-400">Add billing information to enable payments and invoices.</span></li>
                  <li className="text-slate-300"><span className="text-slate-400">Set notification preferences so you never miss an applicant or update.</span></li>
                  <li className="text-slate-300"><span className="text-slate-400">Post your first job to start receiving applications from verified guards.</span></li>
                </ol>
                <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                  <p className="text-teal-400 font-semibold text-sm mb-1">Tip</p>
                  <p className="text-slate-400 text-sm">Completing your profile fully increases trust with guards and speeds up the booking process.</p>
                </div>
              </div>
            </HelpSection>

            <HelpSection id="posting-job" icon="ri-file-add-line" title="Posting Your First Job">
              <div className="space-y-4 text-sm text-slate-400">
                <p>A great job post attracts better applicants. Follow these best practices:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                    <p className="text-white font-semibold mb-2 flex items-center gap-2">
                      <i className="ri-check-line text-teal-400" /> Include
                    </p>
                    <ul className="space-y-1 text-slate-400 text-sm">
                      <li>Clear job title and security type</li>
                      <li>Exact shift dates and times</li>
                      <li>Full venue address and access instructions</li>
                      <li>Competitive hourly rate</li>
                      <li>Specific SIA licence requirements</li>
                      <li>Parking and break information</li>
                    </ul>
                  </div>
                  <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                    <p className="text-white font-semibold mb-2 flex items-center gap-2">
                      <i className="ri-close-line text-red-400" /> Avoid
                    </p>
                    <ul className="space-y-1 text-slate-400 text-sm">
                      <li>Vague or missing shift times</li>
                      <li>Incomplete venue addresses</li>
                      <li>Unrealistic hourly rates</li>
                      <li>Missing contact phone number</li>
                      <li>No site access instructions</li>
                    </ul>
                  </div>
                </div>
                <p>After posting, your job is instantly visible to matching guards in your area. You will receive notifications as applications arrive.</p>
              </div>
            </HelpSection>

            <HelpSection id="selecting-guards" icon="ri-user-search-line" title="Selecting Guards">
              <div className="space-y-4 text-sm text-slate-400">
                <p>When guards apply, you will see their full verified profile. Here is what to look for:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d] text-center">
                    <div className="w-10 h-10 bg-teal-500/10 rounded-lg flex items-center justify-center mx-auto mb-3 border border-teal-400/20">
                      <i className="ri-shield-check-line text-teal-400 text-xl" />
                    </div>
                    <p className="text-white font-semibold text-sm mb-1">SIA Verification</p>
                    <p className="text-slate-400 text-xs">Every guard is checked against the official SIA register. Look for the verified badge.</p>
                  </div>
                  <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d] text-center">
                    <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center mx-auto mb-3 border border-amber-400/20">
                      <i className="ri-star-line text-amber-400 text-xl" />
                    </div>
                    <p className="text-white font-semibold text-sm mb-1">Ratings & Reviews</p>
                    <p className="text-slate-400 text-xs">Read genuine feedback from previous clients to gauge reliability and professionalism.</p>
                  </div>
                  <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d] text-center">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto mb-3 border border-blue-400/20">
                      <i className="ri-map-pin-line text-blue-400 text-xl" />
                    </div>
                    <p className="text-white font-semibold text-sm mb-1">Location & Distance</p>
                    <p className="text-slate-400 text-xs">Guards closer to your venue are more likely to arrive on time and handle last-minute changes.</p>
                  </div>
                </div>
                <p>You can compare up to 3 guards side by side, message applicants before confirming, and save favourite guards for future jobs.</p>
              </div>
            </HelpSection>

            <HelpSection id="payments-invoices" icon="ri-secure-payment-line" title="Payments & Invoices">
              <div className="space-y-4 text-sm text-slate-400">
                <p>QuickGuard uses Stripe for secure payment processing. Here is how it works:</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-teal-500/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-teal-400/20">
                      <span className="text-teal-400 font-bold text-xs">1</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Guard Selection</p>
                      <p className="text-slate-400 text-sm">After selecting guards, you review the cost breakdown including guard fees, service fees, and VAT.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-teal-500/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-teal-400/20">
                      <span className="text-teal-400 font-bold text-xs">2</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Secure Payment</p>
                      <p className="text-slate-400 text-sm">Pay via Stripe. Funds are held with Stripe and only released after the shift is completed.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-teal-500/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-teal-400/20">
                      <span className="text-teal-400 font-bold text-xs">3</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Invoice & Receipt</p>
                      <p className="text-slate-400 text-sm">Download invoices from Payment History or have them emailed directly. All invoices include VAT breakdown.</p>
                    </div>
                  </div>
                </div>
                <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                  <p className="text-teal-400 font-semibold text-sm mb-1">Payment Security</p>
                  <p className="text-slate-400 text-sm">All card details are processed by Stripe. QuickGuard never stores your card information. You can retry failed payments directly from the Payment History page.</p>
                </div>
              </div>
            </HelpSection>

            <HelpSection id="managing-jobs" icon="ri-briefcase-line" title="Managing Active Jobs">
              <div className="space-y-4 text-sm text-slate-400">
                <p>Once a job is active, you can manage it from the Job Tracker or Job Detail page:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5" />
                    <span>View real-time guard check-in status and attendance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5" />
                    <span>Send messages to assigned guards directly</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5" />
                    <span>Request replacement guards if needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5" />
                    <span>Mark jobs as complete and download final reports</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5" />
                    <span>Report incidents or compliance issues from the job detail page</span>
                  </li>
                </ul>
                <p>Notifications are sent automatically when guards check in, if someone is late, or if a replacement is required.</p>
              </div>
            </HelpSection>

            <HelpSection id="attendance-checkin" icon="ri-calendar-check-line" title="Attendance & Check-In">
              <div className="space-y-4 text-sm text-slate-400">
                <p>Guards check in and out using the QuickGuard mobile app. Here is what you see:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                    <p className="text-white font-semibold text-sm mb-1">Checked In</p>
                    <p className="text-slate-400 text-xs">Guard has arrived on site and confirmed check-in. Time stamp recorded.</p>
                  </div>
                  <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                    <p className="text-white font-semibold text-sm mb-1">Late Arrival</p>
                    <p className="text-slate-400 text-xs">Guard arrived after the scheduled start time. Late minutes are logged.</p>
                  </div>
                  <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                    <p className="text-white font-semibold text-sm mb-1">No Show</p>
                    <p className="text-slate-400 text-xs">Guard did not arrive or check in. Immediate replacement and refund options available.</p>
                  </div>
                </div>
                <p>You receive push notifications and dashboard alerts for every check-in event. If a guard is late or absent, you can escalate immediately from the tracker.</p>
              </div>
            </HelpSection>

            <HelpSection id="cancellations-refunds" icon="ri-refund-line" title="Cancellations & Refunds">
              <div className="space-y-4 text-sm text-slate-400">
                <p>Sometimes plans change. Here is how cancellations and refunds work:</p>
                <div className="bg-[#162036] rounded-xl p-5 border border-[#1e2d4d]">
                  <p className="text-white font-semibold text-sm mb-3">Cancellation Eligibility</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-slate-300">Draft, Posted, Awaiting Applicants — Full refund</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-slate-300">Awaiting Payment — Refund minus platform fee</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-orange-400" />
                      <span className="text-slate-300">Confirmed — Partial refund depending on timing</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-slate-300">Active / Completed — Not eligible for cancellation</span>
                    </div>
                  </div>
                </div>
                <p>To cancel a job, go to your job list, click the cancel button, and select your reason. If eligible, you can request a full refund, partial refund, or credit toward a future booking. Refund requests are processed within 3–5 business days.</p>
                <p>For disputed cancellations, our support team will review and determine the outcome. You will be notified at every step.</p>
              </div>
            </HelpSection>

            <HelpSection id="support-disputes" icon="ri-customer-service-2-line" title="Support & Disputes">
              <div className="space-y-4 text-sm text-slate-400">
                <p>If something goes wrong, we are here to help. You can get support in several ways:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                    <p className="text-white font-semibold text-sm mb-2">Create a Support Ticket</p>
                    <p className="text-slate-400 text-xs mb-3">Best for non-urgent issues, billing questions, or general enquiries.</p>
                    <Link href="/client/support?new=general_support" className="inline-flex items-center gap-1 text-teal-400 text-xs font-semibold hover:underline cursor-pointer">
                      <i className="ri-add-line" /> Open Ticket
                    </Link>
                  </div>
                  <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                    <p className="text-white font-semibold text-sm mb-2">Report an Incident</p>
                    <p className="text-slate-400 text-xs mb-3">For guard no-shows, late arrivals, poor performance, or safety issues.</p>
                    <Link href="/client/support?new=guard_no_show" className="inline-flex items-center gap-1 text-red-400 text-xs font-semibold hover:underline cursor-pointer">
                      <i className="ri-alarm-warning-line" /> Report Now
                    </Link>
                  </div>
                </div>
                <p>All tickets are tracked in real time. You will receive notifications when our team replies. For urgent issues, we aim to respond within 1 hour during business hours.</p>
              </div>
            </HelpSection>

            <HelpSection id="account-billing" icon="ri-user-settings-line" title="Account & Billing">
              <div className="space-y-4 text-sm text-slate-400">
                <p>Manage your account and billing settings from your Profile page:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5" />
                    <span>Update company details, contact info, and billing address</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5" />
                    <span>Add or manage VAT numbers for invoice compliance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5" />
                    <span>View and manage subscription plans and billing cycle</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5" />
                    <span>Set notification preferences for email, SMS, and push alerts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="ri-check-line text-teal-400 mt-0.5" />
                    <span>Manage site contacts and saved venues for faster job posting</span>
                  </li>
                </ul>
                <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d]">
                  <p className="text-teal-400 font-semibold text-sm mb-1">Subscription Plans</p>
                  <p className="text-slate-400 text-sm">Compare Starter, Professional, and Enterprise plans. Upgrade anytime to unlock more features, lower fees, and priority support.</p>
                  <Link href="/pricing" className="inline-flex items-center gap-1 text-teal-400 text-sm font-semibold mt-2 hover:underline cursor-pointer">
                    View Plans <i className="ri-arrow-right-line" />
                  </Link>
                </div>
              </div>
            </HelpSection>
          </div>

          {/* FAQ */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Frequently Asked Questions</h3>
            <FAQAccordion />
          </div>

          {/* Bottom CTA */}
          <div className="bg-[#0e1628] border border-[#1e2d4d] rounded-2xl p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
            <div className="relative z-10">
              <div className="w-14 h-14 bg-teal-500/10 border border-teal-400/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-headphone-line text-2xl text-teal-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Still need help?</h3>
              <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
                Our UK support team is available to assist you. Reach out and we will get back to you as soon as possible.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link href="/client/support">
                  <button className="bg-teal-500 text-slate-900 font-bold px-6 py-3 rounded-xl hover:bg-teal-400 transition-all whitespace-nowrap shadow-lg hover:shadow-teal-500/20 cursor-pointer text-sm">
                    Contact Support
                  </button>
                </Link>
                <Link href="/contact">
                  <button className="bg-white/10 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/20 transition-all whitespace-nowrap cursor-pointer text-sm border border-white/20">
                    Email Us
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}