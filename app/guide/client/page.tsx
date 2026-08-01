import Link from 'next/link';
import Footer from '@/components/Footer';
import NavSidebar from '@/components/NavSidebar';
import ClientNavPanel from './ClientNavPanel';
import ClientGuideSchema from './ClientGuideSchema';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How to Hire Security Guards | Client Guide | QuickGuard UK',
  description:
    'Step-by-step guide for UK businesses hiring security guards. Learn to post jobs, review SIA-verified profiles, and process secure payments on QuickGuard.',
  keywords:
    'hire security guards UK, how to post security job, SIA verified guards, security staffing guide, QuickGuard client guide, event security hiring',
  alternates: {
    canonical: 'https://quickguard.uk/guide/client',
  },
  openGraph: {
    title: 'Client Guide | Hire SIA-Licensed Security Guards | QuickGuard',
    description:
      'Post a job, review SIA-verified guard profiles, and process secure payments in minutes. Complete guide to hiring security on QuickGuard.',
    url: 'https://quickguard.uk/guide/client',
    siteName: 'QuickGuard',
    type: 'article',
    images: [
      {
        url: 'https://readdy.ai/api/search-image?query=UK%20business%20manager%20reviewing%20security%20guard%20profiles%20on%20a%20laptop%20in%20a%20dark%20modern%20office%2C%20dark%20navy%20blue%20color%20scheme%2C%20professional%20corporate%20setting%2C%20clean%20desk%20with%20ambient%20lighting%2C%20confident%20and%20organised%20atmosphere%2C%20hiring%20and%20recruitment%20concept%2C%20realistic%20photography%20style&width=1200&height=630&seq=og-guide-client-002&orientation=landscape',
        width: 1200,
        height: 630,
        alt: 'QuickGuard Client Guide — How to Hire SIA-Licensed Security Guards in the UK',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Client Guide | Hire SIA-Licensed Security Guards | QuickGuard',
    description: 'Post a job, review SIA-verified guard profiles, and process secure payments in minutes on QuickGuard.',
    images: [
      'https://readdy.ai/api/search-image?query=UK%20business%20manager%20reviewing%20security%20guard%20profiles%20on%20a%20laptop%20in%20a%20dark%20modern%20office%2C%20dark%20navy%20blue%20color%20scheme%2C%20professional%20corporate%20setting%2C%20clean%20desk%20with%20ambient%20lighting%2C%20confident%20and%20organised%20atmosphere%2C%20hiring%20and%20recruitment%20concept%2C%20realistic%20photography%20style&width=1200&height=630&seq=og-guide-client-002&orientation=landscape',
    ],
  },
};

const steps = [
  {
    number: '01',
    icon: 'ri-user-add-line',
    title: 'Create Your Account',
    description: 'Sign up as a client in minutes and complete your company profile.',
    items: [
      'Click "Sign Up" and select "I\'m a Client"',
      'Enter your email and create a secure password',
      'Verify your email via the confirmation link',
      'Complete your company profile with business details',
    ],
    highlight: {
      items: ['Company name and type', 'Contact person details', 'Business address', 'Phone number and email'],
    },
  },
  {
    number: '02',
    icon: 'ri-file-add-line',
    title: 'Post a Job',
    description: 'Create a detailed job listing to attract the best-matched security guards.',
    items: [
      'Enter job title, security type, and number of guards needed',
      'Set start/end dates, working hours, and urgency level',
      'Specify SIA license types, experience, and uniform requirements',
      'Add venue name, full address, and access instructions',
      'Set hourly rate and payment terms',
    ],
    tip: {
      items: [
        'Be specific about job requirements and expectations',
        'Offer competitive hourly rates to attract quality guards',
        'Provide detailed venue information and parking details',
        'Mark urgent jobs to get faster responses',
      ],
    },
  },
  {
    number: '03',
    icon: 'ri-team-line',
    title: 'Review & Select Guards',
    description: 'Browse applicants and choose the best guards for your job.',
    cards: [
      { icon: 'ri-shield-star-line', title: 'SIA License', desc: 'Verified license number and types' },
      { icon: 'ri-star-line', title: 'Ratings', desc: 'Reviews from previous clients' },
      { icon: 'ri-briefcase-line', title: 'Experience', desc: 'Years of security experience' },
      { icon: 'ri-map-pin-line', title: 'Location', desc: 'Distance from your venue' },
    ],
  },
  {
    number: '04',
    icon: 'ri-secure-payment-line',
    title: 'Secure Payment',
    description: 'Pay guards safely and securely through our Stripe-powered payment system.',
    paymentSteps: [
      { icon: 'ri-check-double-line', label: 'Job Completion', desc: 'Guard completes the assigned security shift' },
      { icon: 'ri-bank-card-line', label: 'Payment Processing', desc: 'Process payment through your dashboard using Stripe' },
      { icon: 'ri-lock-line', label: 'Secure Transfer', desc: 'Payment is securely transferred to the guard\'s account' },
      { icon: 'ri-mail-check-line', label: 'Confirmation', desc: 'Both parties receive payment confirmation emails' },
    ],
  },
];

const bestPractices = [
  { icon: 'ri-time-line', title: 'Post Jobs Early', desc: 'Give guards time to see and apply. Last-minute postings may get fewer quality applications.' },
  { icon: 'ri-message-3-line', title: 'Communicate Clearly', desc: 'Provide detailed job descriptions, venue info, and any special requirements upfront.' },
  { icon: 'ri-star-line', title: 'Leave Reviews', desc: 'Rate guards after jobs to help other clients and build a quality community.' },
  { icon: 'ri-money-pound-circle-line', title: 'Pay Promptly', desc: 'Process payments quickly after job completion to maintain great guard relationships.' },
  { icon: 'ri-bookmark-line', title: 'Save Favourites', desc: 'Bookmark reliable guards for future jobs and build your trusted security team.' },
  { icon: 'ri-shield-check-line', title: 'Verify Requirements', desc: 'Always confirm SIA license types match your specific security needs before hiring.' },
];

export default function ClientGuidePage() {
  return (
    <>
      <ClientGuideSchema />
      <div className="min-h-screen bg-[#0B1933]">
        <ClientNavPanel />
        <NavSidebar />

        <section className="relative pt-24 pb-24 bg-[#0e1628] border-b border-slate-800/60">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 text-sm font-medium px-4 py-2 rounded-full mb-6">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-building-2-line text-sm" />
              </div>
              <span>Client User Guide</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
              Hire Verified Security Guards with<br />
              <span className="text-teal-400">Confidence</span>
            </h1>
            <p className="text-slate-400 text-xl max-w-2xl mx-auto leading-relaxed">
              Everything you need to know about posting jobs, selecting guards, and managing payments on QuickGuard.
            </p>
            <div className="flex flex-wrap gap-4 justify-center mt-10">
              <Link
                href="/client/register"
                className="px-8 py-3.5 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer shadow-lg hover:shadow-teal-500/20"
              >
                <div className="w-4 h-4 flex items-center justify-center inline-flex mr-2">
                  <i className="ri-user-add-line text-sm" />
                </div>
                Get Started Free
              </Link>
              <Link
                href="/client/login"
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
                { value: '5 mins', label: 'To post a job' },
                { value: '100%', label: 'SIA verified guards' },
                { value: '24/7', label: 'Platform support' },
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
              <div key={i} className="flex items-center gap-3 p-4 rounded-2xl border border-slate-700/50 bg-[#111d35] hover:border-teal-500/30 transition-all">
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
              <p className="text-slate-400 mb-6">Sign up as a client in minutes and complete your company profile to start posting jobs.</p>
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
                <Link href="/client/register" className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-slate-900 font-semibold rounded-xl hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer text-sm shadow-lg hover:shadow-teal-500/20">
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
                <h3 className="font-bold text-white">Pro Tips</h3>
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
              <div className="mt-6 pt-5 border-t border-slate-700/50 text-center">
                <Link href="/client/post-job" className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-slate-900 font-semibold rounded-xl hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer text-sm shadow-lg hover:shadow-teal-500/20">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-file-add-line text-sm" />
                  </div>
                  Post a Job Now
                </Link>
              </div>
            </div>
            <div className="order-2">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-2xl">
                  <i className="ri-file-add-line text-teal-400 text-2xl" />
                </div>
                <div>
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Step 02</span>
                  <h2 className="text-2xl font-bold text-white">Post a Job</h2>
                </div>
              </div>
              <p className="text-slate-400 mb-6">Create a detailed listing to attract the best-matched, verified security guards.</p>
              <div className="space-y-3">
                {[
                  { icon: 'ri-file-text-line', label: 'Job Details', desc: 'Title, security type, number of guards needed' },
                  { icon: 'ri-calendar-line', label: 'Schedule', desc: 'Start/end dates, hours, and urgency level' },
                  { icon: 'ri-shield-check-line', label: 'Requirements', desc: 'SIA license types, experience, uniform' },
                  { icon: 'ri-map-pin-line', label: 'Venue Info', desc: 'Address, access instructions, parking' },
                  { icon: 'ri-money-pound-circle-line', label: 'Payment Terms', desc: 'Hourly rate and payment schedule' },
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
                <i className="ri-team-line text-teal-400 text-2xl" />
              </div>
              <div>
                <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Step 03</span>
                <h2 className="text-2xl font-bold text-white">Review & Select Guards</h2>
              </div>
            </div>
            <p className="text-slate-400 mb-8 max-w-2xl">When guards apply, you'll see their complete verified profiles. Review each applicant and choose the best fit for your job.</p>

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
                  <h4 className="font-bold text-white mb-1">Accept Application</h4>
                  <p className="text-sm text-slate-400">Guard receives instant notification and full job confirmation details.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-5 bg-red-500/5 rounded-2xl border border-red-400/10">
                <div className="w-10 h-10 flex items-center justify-center bg-red-500/10 border border-red-400/20 rounded-xl flex-shrink-0">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-close-circle-line text-red-400 text-xl" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">Decline Application</h4>
                  <p className="text-sm text-slate-400">Guard is notified politely, and your job stays open for other applicants.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div id="step-04" className="grid grid-cols-2 gap-10 items-start bg-[#111d35] rounded-3xl border border-slate-700/50 p-10">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-2xl">
                  <i className="ri-secure-payment-line text-teal-400 text-2xl" />
                </div>
                <div>
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Step 04</span>
                  <h2 className="text-2xl font-bold text-white">Secure Payment</h2>
                </div>
              </div>
              <p className="text-slate-400 mb-6">Pay guards safely through our Stripe-powered payment system with full transaction history.</p>
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
                    <p className="text-slate-400 text-sm">All payments are processed through Stripe, ensuring complete security and protection for both clients and guards.</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#0e1628] rounded-2xl p-6 border border-slate-700/50">
                <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-history-line text-slate-500" />
                  </div>
                  Payment Features
                </h4>
                <ul className="space-y-2">
                  {[
                    'Full payment history & receipts',
                    'Automatic invoice generation',
                    'Dispute resolution support',
                    'Multiple payment methods accepted',
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                        <i className="ri-check-line text-teal-400 text-sm" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
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
              <h2 className="text-3xl font-extrabold text-white mb-3">Tips for Getting the Best Results</h2>
              <p className="text-slate-400 max-w-xl mx-auto">Follow these guidelines to attract top-quality guards and run smooth, successful security operations.</p>
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

        {/* CTA */}
        <section id="get-started" className="max-w-6xl mx-auto px-6 py-16">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0e1628] to-[#111d35] rounded-3xl p-12 text-center border border-slate-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-slate-900/40 pointer-events-none" />
            <div className="relative">
              <div className="w-16 h-16 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-2xl mx-auto mb-6">
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className="ri-customer-service-2-line text-teal-400 text-3xl" />
                </div>
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-3">Ready to Hire Your Security Team?</h2>
              <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">Join thousands of businesses that trust QuickGuard to find verified, SIA-licensed security professionals.</p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link
                  href="/client/register"
                  className="px-8 py-3.5 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 transition-all whitespace-nowrap cursor-pointer shadow-lg hover:shadow-teal-500/20"
                >
                  <div className="w-4 h-4 flex items-center justify-center inline-flex mr-2">
                    <i className="ri-user-add-line text-sm" />
                  </div>
                  Create Free Account
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
                Also check out the <Link href="/guide/guard" className="text-teal-400 hover:text-teal-300 underline cursor-pointer">Guard Guide</Link> if you're a security professional.
              </p>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
