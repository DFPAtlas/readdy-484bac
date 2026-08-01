'use client';

import Link from 'next/link';
import { useGuardGuard } from '@/hooks/useGuardGuard';

export default function VerificationFailedPage() {
  const { loading: authLoading, allowed } = useGuardGuard();

  if (authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-2xl w-full">
          <div className="mb-6">
            <Link href="/guard/login" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap">
              <div className="w-8 h-8 flex items-center justify-center">
                <i className="ri-arrow-left-line text-lg"></i>
              </div>
              Back to Login
            </Link>
          </div>
          <div className="bg-[#111d35] rounded-2xl shadow-xl border border-[#1e2d4d] p-8 text-center">

            <div className="w-24 h-24 mx-auto mb-6 bg-red-500/15 rounded-full flex items-center justify-center">
              <i className="ri-close-circle-line text-5xl text-red-400 w-12 h-12 flex items-center justify-center"></i>
            </div>

            <h1 className="text-3xl font-bold text-white mb-4">SIA Verification Failed</h1>

            <p className="text-lg text-slate-300 mb-6">
              Unfortunately we were unable to verify your SIA licence with the official database.
            </p>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 mb-8 text-left">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <i className="ri-error-warning-line text-red-400 w-5 h-5 flex items-center justify-center"></i>
                Possible Reasons
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-slate-300">
                  <i className="ri-close-circle-line text-red-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                  <span>The licence number does not match SIA records</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-300">
                  <i className="ri-close-circle-line text-red-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                  <span>The name on your account does not match the licence</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-300">
                  <i className="ri-close-circle-line text-red-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                  <span>Your licence may be expired or revoked</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-center gap-4">
              <Link
                href="/guard/complete-profile-wizard"
                className="bg-teal-500 text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-teal-400 transition whitespace-nowrap cursor-pointer"
              >
                Update My Details
              </Link>
              <Link
                href="/contact"
                className="border border-[#1e2d4d] text-slate-300 px-6 py-3 rounded-xl font-semibold hover:bg-[#162036] transition whitespace-nowrap cursor-pointer"
              >
                Contact Support
              </Link>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
