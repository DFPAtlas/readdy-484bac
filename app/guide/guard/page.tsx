import Link from 'next/link';
import Footer from '@/components/Footer';
import NavSidebar from '@/components/NavSidebar';
import GuideNavPanel from './GuideNavPanel';
import GuardGuideFaq from './GuardGuideFaq';
import GuardGuideSchema from './GuardGuideSchema';
import type { Metadata } from 'next';
import {
  GUIDE_STEP_SUMMARY,
  ACCOUNT_STEP_ITEMS,
  ACCOUNT_REQUIRED_INFO,
  SIA_FLOW,
  SIA_TIPS,
  JOB_FACTORS,
  GUARD_PAYMENT_STEPS,
  PAYOUT_SUPPORT_TEXT,
  BEST_PRACTICES,
  KEY_REMINDERS,
} from './guardGuideContent';

const OG_IMAGE =
  'https://readdy.ai/api/search-image?query=professional%20SIA%20licensed%20security%20guard%20in%20uniform%20standing%20confidently%20at%20a%20modern%20UK%20venue%20entrance%2C%20daytime%2C%20dark%20navy%20blue%20and%20teal%20color%20accents%2C%20clean%20corporate%20building%20background%20with%20glass%20facade%2C%20trustworthy%20and%20professional%20appearance%2C%20high%20quality%20realistic%20photography%20style%2C%20simple%20uncluttered%20background&width=1200&height=630&seq=og-guide-guard-002&orientation=landscape';

export const metadata: Metadata = {
  title: 'Guard Guide: Free Security Guard Jobs & Applications',
  description:
    'Free guard account with no application cap and no paid job tiers. How SIA licence review works, how to browse and apply for security jobs, and how shift payouts move through Stripe on QuickGuard.',
  keywords:
    'security guard jobs UK, free guard account, SIA licence review, apply for security jobs, QuickGuard guard guide, security guard payouts, door supervisor jobs UK',
  alternates: {
    canonical: 'https://quickguard.uk/guide/guard',
  },
  openGraph: {
    title: 'Guard Guide | Free Security Guard Jobs & Applications | QuickGuard',
    description:
      'Create a free guard account, complete SIA licence review, apply for security jobs and follow each shift payment step through Stripe.',
    url: 'https://quickguard.uk/guide/guard',
    siteName: 'QuickGuard',
    type: 'article',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'QuickGuard Guard Guide — Free Security Guard Account and Applications',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Guard Guide | Free Security Guard Jobs & Applications | QuickGuard',
    description:
      'Create a free guard account, complete SIA licence review, apply for security jobs and follow each shift payment step through Stripe.',
    images: [OG_IMAGE],
  },
};

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
              Registering, browsing jobs and applying are free, with no monthly application cap. This guide covers licence review,
              applying, working a shift and how pay moves through Stripe.
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
                { value: 'Free', label: 'Guard account and applications' },
                { value: 'No cap', label: 'Monthly application limit' },
                { value: 'Stripe', label: 'Payouts to your account' },
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
            {GUIDE_STEP_SUMMARY.map((step) => (
              <div
                key={step.number}
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
          <div id="step-01" className="grid grid-cols-2 gap-10 items-start bg-[#111d35] rounded-3xl border border-slate-700/50 p-10">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-2xl">
                  <i className="ri-user-add-line text-teal-400 text-2xl" />
                </div>
                <div>
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Step 01</span>
                  <h2 className="text-2xl font-bold text-white">Create Your Free Account</h2>
                </div>
              </div>
              <p className="text-slate-400 mb-6">
                Sign up as a guard and build the profile clients see when they review applications. There is no charge to register,
                browse jobs or apply.
              </p>
              <ul className="space-y-3">
                {ACCOUNT_STEP_ITEMS.map((item, i) => (
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
                {ACCOUNT_REQUIRED_INFO.map((item, i) => (
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

          <div id="step-02" className="grid grid-cols-2 gap-10 items-start bg-[#111d35] rounded-3xl border border-slate-700/50 p-10">
            <div className="bg-[#0e1628] rounded-2xl p-8 border border-slate-700/50 order-1">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-lightbulb-flash-line text-teal-400 text-xl" />
                </div>
                <h3 className="font-bold text-white">Verification Tips</h3>
              </div>
              <div className="space-y-3">
                {SIA_TIPS.map((item, i) => (
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
                  <span className="text-teal-400 text-sm font-semibold">Review timing varies and may require manual checks</span>
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
                  <h2 className="text-2xl font-bold text-white">SIA Licence Review</h2>
                </div>
              </div>
              <p className="text-slate-400 mb-4">
                Your account is reviewed before you can take work, and your licence must stay valid while you apply and work.
                Free applications do not remove licence or account requirements.
              </p>
              <div className="space-y-3">
                {SIA_FLOW.map((item, i) => (
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

          <div id="step-03" className="bg-[#111d35] rounded-3xl border border-slate-700/50 p-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-2xl">
                <i className="ri-search-line text-teal-400 text-2xl" />
              </div>
              <div>
                <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Step 03</span>
                <h2 className="text-2xl font-bold text-white">Browse & Apply for Jobs</h2>
              </div>
            </div>
            <p className="text-slate-400 mb-8 max-w-3xl">
              Once your account is approved, browse open jobs and apply to the ones that fit your licence and availability.
              Applying is free with no monthly application cap, and there are no paid applicant tiers or paid priority placement.
            </p>

            <div className="grid grid-cols-4 gap-5 mb-8">
              {JOB_FACTORS.map((card, i) => (
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
                  <h4 className="font-bold text-white mb-1">Applications Are Reviewed</h4>
                  <p className="text-sm text-slate-400">
                    Your application shows in your guard dashboard. The client reviews applicants and selects guards, so applying
                    does not guarantee selection or work.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-5 bg-amber-500/5 rounded-2xl border border-amber-400/10">
                <div className="w-10 h-10 flex items-center justify-center bg-amber-500/10 border border-amber-400/20 rounded-xl flex-shrink-0">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-notification-3-line text-amber-400 text-xl" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">Job Match Emails</h4>
                  <p className="text-sm text-slate-400">
                    With job-match emails enabled, you may be emailed when a posted job matches your licence type, rate and travel
                    distance. Alerts do not reserve a job for you.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div id="step-04" className="grid grid-cols-2 gap-10 items-start bg-[#111d35] rounded-3xl border border-slate-700/50 p-10">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-2xl">
                  <i className="ri-money-pound-circle-line text-teal-400 text-2xl" />
                </div>
                <div>
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Step 04</span>
                  <h2 className="text-2xl font-bold text-white">Work Shifts & Get Paid</h2>
                </div>
              </div>
              <p className="text-slate-400 mb-6">
                Guard accounts, job browsing and applications are free, and paid guard memberships are no longer sold. Any
                QuickGuard service fee is charged to the client on top of the agreed guard pay, so the agreed gross guard pay on a
                new booking is not reduced by a QuickGuard booking commission.
              </p>
              <div className="space-y-4">
                {GUARD_PAYMENT_STEPS.map((ps, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 flex items-center justify-center bg-teal-500/10 border border-teal-400/20 rounded-full flex-shrink-0">
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className={`${ps.icon} text-teal-400 text-sm`} />
                        </div>
                      </div>
                      {i < GUARD_PAYMENT_STEPS.length - 1 && (
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
                <h3 className="font-bold text-white mb-2">If completion or payment is delayed</h3>
                <p className="text-slate-400 text-sm">{PAYOUT_SUPPORT_TEXT}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-teal-400">
                  <Link href="/guard/bank-settings" className="underline">Bank Settings</Link>
                  <Link href="/guard/earnings" className="underline">Earnings and bank deposits</Link>
                  <Link href="/guard/support" className="underline">Guard support</Link>
                </div>
              </div>
              <div className="bg-[#0e1628] rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-shield-check-line text-teal-400 text-2xl" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-2">Payment Security</h4>
                    <p className="text-slate-400 text-sm">
                      Payments run through Stripe. Your bank details are never shared with clients, and eligible pay is transferred
                      to your connected Stripe account after the client approves completion and the applicable checks pass.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-[#0e1628] rounded-2xl p-6 border border-slate-700/50">
                <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-history-line text-slate-500" />
                  </div>
                  Earnings Records
                </h4>
                <ul className="space-y-2">
                  {[
                    'Full payment history for your shifts',
                    'Pending and released payment tracking',
                    'Reference for every recorded payout',
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
              <div className="bg-[#0e1628] rounded-2xl p-6 border border-slate-700/50">
                <h4 className="font-bold text-white mb-2">Legacy guard memberships</h4>
                <p className="text-slate-400 text-sm">
                  Existing membership and invoice records are retained in your account. If you hold an active legacy subscription,
                  manage or cancel it from the membership card in your guard dashboard, or contact billing support for a review.
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-teal-400">
                  <Link href="/guard/dashboard#guard-membership" className="underline">Membership records</Link>
                  <Link href="/guard/support" className="underline">Billing support</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="best-practices" className="bg-[#0e1628] border-y border-slate-800/60 py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/20 text-teal-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-star-line text-sm" />
                </div>
                Best Practices
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-3">Tips for Building a Reliable Guard Record</h2>
              <p className="text-slate-400 max-w-xl mx-auto">Follow these guidelines to keep your profile accurate and your shift record strong.</p>
            </div>
            <div className="grid grid-cols-3 gap-6">
              {BEST_PRACTICES.map((bp, i) => (
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

        <section id="key-reminders" className="max-w-6xl mx-auto px-6 pt-16 pb-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-400/20 text-red-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-alarm-warning-line text-sm" />
              </div>
              Important
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-3">Key Reminders</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Keep these in mind so your account stays approved and your applications stay accurate.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {KEY_REMINDERS.map((r, i) => (
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
          <div className="mt-6 p-5 bg-[#111d35] rounded-2xl border border-slate-700/50">
            <p className="text-sm text-slate-400">
              QuickGuard does not guarantee work, earnings or a fixed payout date, and does not provide legal or compliance advice.
              Licence requirements, client selection and Stripe account checks all apply.
            </p>
          </div>
        </section>

        <GuardGuideFaq />

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
              <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">Create your free guard profile and explore security jobs across the UK with QuickGuard.</p>
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