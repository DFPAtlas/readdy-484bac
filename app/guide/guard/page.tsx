import Link from 'next/link';
import Footer from '@/components/Footer';
import NavSidebar from '@/components/NavSidebar';
import GuideNavPanel from './GuideNavPanel';
import GuardGuideSchema from './GuardGuideSchema';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Find Security Guard Jobs UK | Guard Guide | QuickGuard',
  description:
    'Complete guide for SIA-licensed guards. Register, get verified, find security work across the UK, and receive secure payments through QuickGuard.',
  keywords:
    'security guard jobs UK, SIA licence verification, QuickGuard guard guide, find security work, get paid as security guard, door supervisor jobs UK',
  alternates: {
    canonical: 'https://quickguard.uk/guide/guard',
  },
  openGraph: {
    title: 'Guard Guide | Find Security Jobs & Get Paid | QuickGuard',
    description:
      'Register, get SIA verified, find security jobs near you, and receive secure payments. Everything SIA-licensed guards need to know about QuickGuard.',
    url: 'https://quickguard.uk/guide/guard',
    siteName: 'QuickGuard',
    type: 'article',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=professional%20SIA%20licensed%20security%20guard%20in%20uniform%20standing%20confidently%20at%20a%20modern%20UK%20venue%20entrance%2C%20daytime%2C%20dark%20navy%20blue%20and%20teal%20color%20accents%2C%20clean%20corporate%20building%20background%20with%20glass%20facade%2C%20trustworthy%20and%20professional%20appearance%2C%20high%20quality%20realistic%20photography%20style%2C%20simple%20uncluttered%20background&width=1200&height=630&seq=og-guide-guard-002&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard Guard Guide — Find Security Jobs and Get Paid Across the UK',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Guard Guide | Find Security Jobs & Get Paid | QuickGuard',
    description:
      'Register, get SIA verified, find security jobs near you, and receive secure payments on QuickGuard.',
    images: [
      'https://readdy.ai/api/search-image?query=professional%20SIA%20licensed%20security%20guard%20in%20uniform%20standing%20confidently%20at%20a%20modern%20UK%20venue%20entrance%2C%20daytime%2C%20dark%20navy%20blue%20and%20teal%20color%20accents%2C%20clean%20corporate%20building%20background%20with%20glass%20facade%2C%20trustworthy%20and%20professional%20appearance%2C%20high%20quality%20realistic%20photography%20style%2C%20simple%20uncluttered%20background&width=1200&height=630&seq=og-guide-guard-002&orientation=landscape',
    ],
  },
};

const steps = [
  {
    number: '01',
    icon: 'ri-user-add-line',
    title: 'Create Your Account',
    description: 'Sign up as a guard in minutes and complete your professional profile.',
    items: [
      'Click "Sign Up" and select "I\'m a Guard"',
      'Enter your email and create a secure password',
      'Verify your email via the confirmation link',
      'Complete your profile with SIA licence details',
    ],
    highlight: {
      label: 'Required Information',
      items: [
        'Full name and contact details',
        'SIA licence number and expiry date',
        'Licence types (Door Supervisor, CCTV, etc.)',
        'Years of security experience',
        'Home address and postcode',
      ],
    },
  },
  {
    number: '02',
    icon: 'ri-shield-check-line',
    title: 'SIA Verification',
    description: 'Your SIA licence is automatically verified through our secure system.',
    items: [
      'Submit your SIA licence number during profile setup',
      'Our system checks your licence against the SIA register',
      'Verification typically completes within 5–10 minutes',
      'You\'ll receive an email once your account is approved',
      'A verified badge appears on your profile for clients to see',
    ],
    tip: {
      label: 'Verification Tips',
      items: [
        'Ensure your SIA licence is current and not expired',
        'Double-check the licence number before submitting',
        'Keep your profile details consistent with your licence',
        'Contact support if verification takes longer than 30 minutes',
      ],
    },
  },
  {
    number: '03',
    icon: 'ri-search-line',
    title: 'Find & Apply for Jobs',
    description: 'Browse available security jobs and apply with a single click.',
    cards: [
      { icon: 'ri-map-pin-line', title: 'Location', desc: 'Distance from your address' },
      { icon: 'ri-money-pound-circle-line', title: 'Pay Rate', desc: 'Hourly rate clearly shown' },
      { icon: 'ri-calendar-line', title: 'Schedule', desc: 'Dates and working hours' },
      { icon: 'ri-shield-check-line', title: 'Requirements', desc: 'Licence types needed' },
    ],
  },
  {
    number: '04',
    icon: 'ri-money-pound-circle-line',
    title: 'Complete Jobs & Get Paid',
    description: 'Work your shift and receive secure payment directly to your bank account.',
    paymentSteps: [
      { icon: 'ri-briefcase-line', label: 'Complete the Shift', desc: 'Finish your assigned security duties professionally' },
      { icon: 'ri-bank-card-line', label: 'Client Processes Payment', desc: 'Client reviews and releases payment through the platform' },
      { icon: 'ri-lock-line', label: 'Secure Bank Transfer', desc: 'Payment is transferred to your registered bank account' },
      { icon: 'ri-mail-check-line', label: 'Email Confirmation', desc: 'You receive a payment confirmation with full details' },
    ],
  },
];

const bestPractices = [
  { icon: 'ri-user-star-line', title: 'Keep Profile Updated', desc: 'Regularly update your availability, skills, and contact details so clients can find and trust you.' },
  { icon: 'ri-time-line', title: 'Arrive Early', desc: 'Aim to arrive 10–15 minutes before your shift starts to check in and receive your briefing.' },
  { icon: 'ri-star-line', title: 'Earn 5-Star Ratings', desc: 'Professional conduct and reliability lead to great reviews, which attract more and better-paying jobs.' },
  { icon: 'ri-notification-3-line', title: 'Enable Job Alerts', desc: 'Turn on email notifications to be first to know about new jobs that match your profile and location.' },
  { icon: 'ri-calendar-check-line', title: 'Honour Commitments', desc: 'Only apply for jobs you can definitely attend. Cancellations damage your reputation and rating.' },
  { icon: 'ri-shield-star-line', title: 'Renew Your Licence', desc: 'Keep your SIA licence valid at all times. An expired licence means you cannot accept new jobs.' },
];

export default function GuardGuidePage() {
  return (
    <>
      <GuardGuideSchema />
      <div className="min-h-screen bg-[#0B1933]">
        <GuideNavPanel />
        <NavSidebar />

        <section className="relative pt-24 pb-24 bg-[#0e1628] border-b border-slate-800/60">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 text-sm font-medium px-4 py-2 rounded-full mb-6">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-shield-user-line text-sm" />
              </div>
              <span>Guard User Guide</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
              Find Security Work and Get Paid with<br />
              <span className="text-teal-400">Confidence</span>
            </h1>
            <p className="text-slate-400 text-xl max-w-2xl mx-auto leading-relaxed">
              Everything you need to know about registering, finding jobs, and receiving payments as an SIA-licensed security guard on QuickGuard.
            </p>
            <div className="flex flex-wrap gap-4 justify-center mt-10">
              <Link
                href="/guard/register"
                className="px-8 py-3.5 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer shadow-lg hover:shadow-teal-500/20"
              >
                <div className="w-4 h-4 flex items-center justify-center inline-flex mr-2">
                  <i className="ri-user-add-line text-sm" />
                </div>
                Register as a Guard
              </Link>
              <Link
                href="/guard/login"
                className="px-8 py-3.5 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-all whitespace-nowrap cursor-pointer border border-white/20"
              >
                <div className="w-4 h-4 flex items-center justify-center inline-flex mr-2">
                  <i className="ri-login-box-line text-sm" />
                </div>
                Sign In
              </Link>
            </div>
            <div className="mt-16 grid grid-cols-3 gap-8 w-full max-w-2xl mx-auto">
              {[
                { value: '5–10 min', label: 'SIA verification time' },
                { value: '100%', label: 'Secure payments' },
                { value: '24/7', label: 'Job alerts available' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl font-extrabold text-white">{stat.value}</div>
                  <div className="text-slate-400 text-sm mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 max-w-6xl mx-auto px-6 -mt-12 mb-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-4 rounded-2xl border border-slate-700/50 bg-[#111d35] hover:border-teal-500/30 transition-all"
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-500/10 border border-teal-400/20 flex-shrink-0">
                  <i className={`${step.icon} text-teal-400 text-lg`} />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-teal-400">Step {step.number}</div>
                  <div className="text-sm font-semibold text-white">{step.title}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 space-y-10 mb-16">
          {/* Step 1 */}
          <div id="step-01" className="grid grid-cols-2 gap-10 items-start bg-[#111d35] rounded-3xl border border-slate-700/50 p-10">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-2xl">
                  <i className="ri-user-add-line text-teal-400 text-2xl" />
                </div>
                <div>
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Step 01</span>
                  <h2 className="text-2xl font-bold text-white">Create Your Account</h2>
                </div>
              </div>
              <p className="text-slate-400 mb-6">Sign up as a guard in minutes and build your professional profile to start receiving job opportunities.</p>
              <ul className="space-y-3">
                {steps[0].items!.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-full flex-shrink-0 mt-0.5">
                      <i className="ri-check-line text-teal-400 text-xs" />
                    </div>
                    <span className="text-slate-300 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#0e1628] rounded-2xl p-8 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-information-line text-teal-400 text-xl" />
                </div>
                <h3 className="font-bold text-white">Required Information</h3>
              </div>
              <div className="space-y-3">
                {steps[0].highlight!.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#111d35] rounded-xl px-4 py-3 border border-slate-700/50">
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <i className="ri-checkbox-circle-fill text-teal-400 text-lg" />
                    </div>
                    <span className="text-slate-300 text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-slate-700/50 text-center">
                <Link href="/guard/register" className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-slate-900 font-semibold rounded-xl hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer text-sm shadow-lg hover:shadow-teal-500/20">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-user-add-line text-sm" />
                  </div>
                  Create Free Account
                </Link>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div id="step-02" className="grid grid-cols-2 gap-10 items-start bg-[#111d35] rounded-3xl border border-slate-700/50 p-10">
            <div className="bg-[#0e1628] rounded-2xl p-8 border border-slate-700/50 order-1">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-lightbulb-flash-line text-teal-400 text-xl" />
                </div>
                <h3 className="font-bold text-white">Verification Tips</h3>
              </div>
              <div className="space-y-3">
                {steps[1].tip!.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 bg-[#111d35] rounded-xl px-4 py-3 border border-slate-700/50">
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className="ri-arrow-right-circle-fill text-teal-400 text-lg" />
                    </div>
                    <span className="text-slate-300 text-sm">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-slate-700/50">
                <div className="flex items-center gap-3 bg-teal-500/10 rounded-xl px-4 py-3 border border-teal-400/20">
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <i className="ri-time-line text-teal-400 text-lg" />
                  </div>
                  <span className="text-teal-400 text-sm font-semibold">Verification usually takes 5–10 minutes</span>
                </div>
              </div>
            </div>
            <div className="order-2">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-2xl">
                  <i className="ri-shield-check-line text-teal-400 text-2xl" />
                </div>
                <div>
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Step 02</span>
                  <h2 className="text-2xl font-bold text-white">SIA Verification</h2>
                </div>
              </div>
              <p className="text-slate-400 mb-6">Your SIA licence is automatically verified through our secure system, giving clients full confidence in your credentials.</p>
              <div className="space-y-3">
                {[
                  { icon: 'ri-file-shield-line', label: 'Submit Licence', desc: 'Enter your SIA licence number in your profile' },
                  { icon: 'ri-search-eye-line', label: 'Automatic Check', desc: 'System verifies against the official SIA register' },
                  { icon: 'ri-mail-check-line', label: 'Email Notification', desc: 'Receive confirmation once your account is approved' },
                  { icon: 'ri-verified-badge-line', label: 'Verified Badge', desc: 'A trust badge appears on your profile for clients' },
                  { icon: 'ri-briefcase-line', label: 'Start Applying', desc: 'Browse and apply for jobs immediately after approval' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-[#0e1628] transition-colors border border-slate-700/50">
                    <div className="w-9 h-9 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-lg flex-shrink-0">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className={`${item.icon} text-teal-400 text-sm`} />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{item.label}</div>
                      <div className="text-xs text-slate-500">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div id="step-03" className="bg-[#111d35] rounded-3xl border border-slate-700/50 p-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-2xl">
                <i className="ri-search-line text-teal-400 text-2xl" />
              </div>
              <div>
                <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Step 03</span>
                <h2 className="text-2xl font-bold text-white">Find & Apply for Jobs</h2>
              </div>
            </div>
            <p className="text-slate-400 mb-8 max-w-2xl">Once verified, browse available security jobs near you. Each listing shows everything you need to decide if it's the right fit.</p>

            <div className="grid grid-cols-4 gap-5 mb-8">
              {steps[2].cards!.map((card, i) => (
                <div key={i} className="bg-[#0e1628] rounded-2xl p-6 border border-slate-700/50 text-center hover:border-teal-500/30 transition-all hover:shadow-lg hover:shadow-teal-500/5">
                  <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-xl mx-auto mb-3">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className={`${card.icon} text-teal-400 text-xl`} />
                    </div>
                  </div>
                  <h4 className="font-bold text-white mb-1 text-sm">{card.title}</h4>
                  <p className="text-xs text-slate-500">{card.desc}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-4 p-5 bg-teal-500/5 rounded-2xl border border-teal-400/10">
                <div className="w-10 h-10 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-xl flex-shrink-0">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-checkbox-circle-line text-teal-400 text-xl" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">Application Accepted</h4>
                  <p className="text-sm text-slate-400">You receive full job details — venue address, hours, uniform requirements, and client contact info.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-5 bg-amber-500/5 rounded-2xl border border-amber-400/10">
                <div className="w-10 h-10 flex items-center justify-center bg-amber-500/10 border border-amber-400/20 rounded-xl flex-shrink-0">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-notification-3-line text-amber-400 text-xl" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">Job Match Alerts</h4>
                  <p className="text-sm text-slate-400">Get instant email notifications when new jobs matching your profile and location are posted.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div id="step-04" className="grid grid-cols-2 gap-10 items-start bg-[#111d35] rounded-3xl border border-slate-700/50 p-10">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-2xl">
                  <i className="ri-money-pound-circle-line text-teal-400 text-2xl" />
                </div>
                <div>
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Step 04</span>
                  <h2 className="text-2xl font-bold text-white">Complete Jobs & Get Paid</h2>
                </div>
              </div>
              <p className="text-slate-400 mb-6">Work your shift and receive secure payment directly to your registered bank account.</p>
              <div className="space-y-4">
                {steps[3].paymentSteps!.map((ps, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-full flex-shrink-0">
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className={`${ps.icon} text-teal-400 text-sm`} />
                        </div>
                      </div>
                      {i < steps[3].paymentSteps!.length - 1 && (
                        <div className="w-px h-6 bg-teal-500/20 mt-1" />
                      )}
                    </div>
                    <div className="pb-2">
                      <div className="text-sm font-bold text-white">{ps.label}</div>
                      <div className="text-sm text-slate-400">{ps.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-[#0e1628] rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-shield-check-line text-teal-400 text-2xl" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-2">Bank-Level Security</h4>
                    <p className="text-slate-400 text-sm">All payments are processed through Stripe. Your bank details are never shared with clients and all transfers are fully encrypted.</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#0e1628] rounded-2xl p-6 border border-slate-700/50">
                <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-history-line text-slate-500" />
                  </div>
                  Earnings Features
                </h4>
                <ul className="space-y-2">
                  {[
                    'Full earnings history and payment records',
                    'Pending and completed payment tracking',
                    'Transaction IDs for every payout',
                    'Manage your bank details securely',
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                        <i className="ri-check-line text-teal-400 text-sm" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 pt-4 border-t border-slate-700/50">
                  <Link href="/guard/earnings" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-slate-900 font-semibold rounded-xl hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer text-sm shadow-lg hover:shadow-teal-500/20">
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-bar-chart-line text-sm" />
                    </div>
                    View Earnings Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Best Practices */}
        <section id="best-practices" className="bg-[#0e1628] border-y border-slate-800/60 py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-star-line text-sm" />
                </div>
                Best Practices
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-3">Tips for a Successful Guard Career</h2>
              <p className="text-slate-400 max-w-xl mx-auto">Follow these guidelines to build your reputation, earn great ratings, and secure more high-paying jobs.</p>
            </div>
            <div className="grid grid-cols-3 gap-6">
              {bestPractices.map((bp, i) => (
                <div key={i} className="bg-[#111d35] rounded-2xl p-6 border border-slate-700/50 hover:border-teal-500/30 transition-all hover:shadow-lg hover:shadow-teal-500/5">
                  <div className="w-12 h-12 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-xl mb-4">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className={`${bp.icon} text-teal-400 text-xl`} />
                    </div>
                  </div>
                  <h3 className="font-bold text-white mb-2">{bp.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{bp.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Key Reminders */}
        <section id="key-reminders" className="max-w-6xl mx-auto px-6 py-16 mb-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-400/20 text-red-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-alarm-warning-line text-sm" />
              </div>
              Important
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-3">Key Reminders</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Keep these in mind to stay compliant, professional, and in good standing on the platform.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: 'ri-shield-check-line', title: 'Keep Your SIA Licence Valid', desc: 'You cannot accept or work jobs with an expired SIA licence. Renew well in advance of the expiry date.' },
              { icon: 'ri-calendar-check-line', title: 'Honour Every Commitment', desc: 'Only apply for jobs you can definitely attend. Last-minute cancellations negatively impact your rating.' },
              { icon: 'ri-user-settings-line', title: 'Keep Your Profile Current', desc: 'Update your contact details, availability, and licence information whenever anything changes.' },
              { icon: 'ri-mail-check-line', title: 'Check Emails Regularly', desc: 'Job acceptances, payment confirmations, and important platform updates are sent via email.' },
            ].map((r, i) => (
              <div key={i} className="flex items-start gap-4 p-5 bg-red-500/5 rounded-2xl border border-red-400/10 hover:border-red-400/20 transition-all">
                <div className="w-10 h-10 flex items-center justify-center bg-red-500/10 border border-red-400/20 rounded-xl flex-shrink-0">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className={`${r.icon} text-red-400 text-xl`} />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">{r.title}</h4>
                  <p className="text-sm text-slate-400">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section id="get-started" className="max-w-6xl mx-auto px-6 pb-16">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0e1628] to-[#111d35] rounded-3xl p-12 text-center border border-slate-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
            <div className="relative">
              <div className="w-16 h-16 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-2xl mx-auto mb-6">
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className="ri-shield-user-line text-teal-400 text-3xl" />
                </div>
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-3">Ready to Start Finding Security Work?</h2>
              <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">Join thousands of SIA-licensed guards who trust QuickGuard to find reliable, well-paid security jobs across the UK.</p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link
                  href="/guard/register"
                  className="px-8 py-3.5 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer shadow-lg hover:shadow-teal-500/20"
                >
                  <div className="w-4 h-4 flex items-center justify-center inline-flex mr-2">
                    <i className="ri-user-add-line text-sm" />
                  </div>
                  Register as a Guard
                </Link>
                <Link
                  href="/contact"
                  className="px-8 py-3.5 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-all whitespace-nowrap cursor-pointer border border-white/20"
                >
                  <div className="w-4 h-4 flex items-center justify-center inline-flex mr-2">
                    <i className="ri-mail-line text-sm" />
                  </div>
                  Contact Support
                </Link>
              </div>
              <p className="text-slate-500 text-sm mt-6">
                Looking to hire guards instead? Check out the <Link href="/guide/client" className="text-teal-400 hover:text-teal-300 underline cursor-pointer">Client Guide</Link>.
              </p>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}