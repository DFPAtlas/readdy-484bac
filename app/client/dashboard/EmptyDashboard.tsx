'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface EmptyDashboardProps {
  onPostJob: () => void;
  onCompleteProfile: () => void;
  onContactSupport: () => void;
  isTrialActive: boolean;
  trialDaysLeft: number | null;
}

export default function EmptyDashboard({
  onPostJob,
  onCompleteProfile,
  onContactSupport,
  isTrialActive,
  trialDaysLeft,
}: EmptyDashboardProps) {
  const router = useRouter();

  return (
    <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] shadow-sm p-6 mb-6">
      <div className="max-w-2xl mx-auto text-center py-8">
        <div className="w-20 h-20 bg-teal-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-teal-500/20">
          <i className="ri-shield-star-line text-teal-500 text-3xl"></i>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Welcome to QuickGuard
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
          You are set up and ready to hire SIA-licensed security guards. Post your first job and start receiving applications from verified guards.
        </p>

        {isTrialActive && trialDaysLeft !== null && (
          <div className="inline-flex items-center gap-2 bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 rounded-xl px-4 py-2 mb-6">
            <i className="ri-gift-line text-violet-500"></i>
            <span className="text-sm font-semibold">
              Your trial is active — {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <button
            onClick={() => router.push('/client/post-job')}
            className="flex flex-col items-center gap-3 p-5 rounded-xl bg-teal-500 text-white hover:bg-teal-600 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <i className="ri-add-circle-line text-xl"></i>
            </div>
            <div>
              <p className="text-sm font-semibold">Post Your First Job</p>
              <p className="text-xs text-white/70 mt-0.5">Takes about 2 minutes</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/client/profile')}
            className="flex flex-col items-center gap-3 p-5 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2642] transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 bg-teal-500/10 rounded-lg flex items-center justify-center">
              <i className="ri-user-settings-line text-teal-500 text-xl"></i>
            </div>
            <div>
              <p className="text-sm font-semibold">Complete Profile</p>
              <p className="text-xs text-slate-500 mt-0.5">Add company details</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/client/support')}
            className="flex flex-col items-center gap-3 p-5 rounded-xl bg-slate-50 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2642] transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 bg-teal-500/10 rounded-lg flex items-center justify-center">
              <i className="ri-customer-service-2-line text-teal-500 text-xl"></i>
            </div>
            <div>
              <p className="text-sm font-semibold">Contact Support</p>
              <p className="text-xs text-slate-500 mt-0.5">We are here to help</p>
            </div>
          </button>
        </div>

        <div className="text-left bg-slate-50 dark:bg-[#162036] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 text-center">How QuickGuard Works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: 'ri-file-add-line', step: '1', title: 'Post a Job', desc: 'Describe your security needs, shift times, and location' },
              { icon: 'ri-user-search-line', step: '2', title: 'Review Applicants', desc: 'Verified SIA-licensed guards apply within hours' },
              { icon: 'ri-shield-check-line', step: '3', title: 'Hire & Pay', desc: 'Select your guards, pay securely, and track the shift' },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-7 h-7 bg-teal-500/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-teal-500/20">
                  <i className={`${item.icon} text-teal-500 text-xs`}></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}