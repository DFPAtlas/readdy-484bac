'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

function CancelledContent() {
  const searchParams = useSearchParams();
  const [userType, setUserType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const urlAccountType = searchParams.get('accountType');

  useEffect(() => {
    async function detectUserType() {
      if (urlAccountType) {
        setUserType(urlAccountType);
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: client } = await supabase
        .from('clients')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (client) {
        setUserType('client');
        setLoading(false);
        return;
      }

      const { data: guard } = await supabase
        .from('guards')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (guard) {
        setUserType('guard');
      }

      setLoading(false);
    }

    detectUserType();
  }, [urlAccountType]);

  const onboardingHref =
    userType === 'client'
      ? '/client/complete-profile-wizard'
      : userType === 'guard'
      ? '/guard/complete-profile-wizard'
      : '/pricing';

  const isGuard = userType === 'guard';

  return (
    <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6">
      <div className="text-center max-w-lg mx-auto">
        <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
          <i className="ri-close-line text-4xl text-amber-400" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-3">
          Payment Not Completed
        </h1>
        <p className="text-slate-400 mb-2">
          Your subscription payment was cancelled or not completed.
        </p>
        <p className="text-sm text-slate-500 mb-8">
          Don&apos;t worry, your profile information has been saved. You can finish setting up your plan whenever you&apos;re ready.
        </p>

        <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-5 mb-8 text-left">
          <h4 className="text-sm font-semibold text-white mb-3">What you can do next</h4>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-sm text-slate-400">
              <i className="ri-check-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0" />
              <span>Return to the onboarding wizard and select your plan again</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-400">
              <i className="ri-check-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0" />
              <span>All your profile details and uploaded documents are still saved</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-400">
              <i className="ri-check-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0" />
              <span>Choose a different plan if you changed your mind</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/pricing"
            className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap shadow-lg inline-flex items-center justify-center gap-2"
          >
            <i className="ri-refresh-line" />
            Try payment again
          </Link>
          <Link
            href={onboardingHref}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap backdrop-blur-sm inline-flex items-center justify-center gap-2"
          >
            <i className="ri-arrow-left-line" />
            Back to onboarding
          </Link>
        </div>

        {isGuard && (
          <div className="mt-6 bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
            <p className="text-sm text-teal-300 flex items-center justify-center gap-2">
              <i className="ri-shield-check-line" />
              Your guard profile and documents are saved. You won&apos;t need to re-upload them.
            </p>
          </div>
        )}

        {loading && !urlAccountType && (
          <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-sm">
            <i className="ri-loader-4-line animate-spin" />
            Detecting your account...
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentCancelled() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading...</p>
          </div>
        </div>
      }
    >
      <CancelledContent />
    </Suspense>
  );
}