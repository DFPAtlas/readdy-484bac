'use client';

import Link from 'next/link';
import { useGuardSiaStatus } from './useGuardSiaStatus';
import PendingCard from './PendingCard';
import ApprovedCard from './ApprovedCard';
import RejectedCard from './RejectedCard';
import ReviewCard from './ReviewCard';
import RestrictedCard from './RestrictedCard';

export default function GuardOnboardingPage() {
  const { state, rejectionReason, restrictedStatus } = useGuardSiaStatus();
  const showSupportLink = state !== 'loading' && state !== 'approved';

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        {state === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-slate-400">Loading your status…</p>
          </div>
        )}

        {state === 'pending' && <PendingCard />}
        {state === 'approved' && <ApprovedCard />}
        {state === 'rejected' && <RejectedCard reason={rejectionReason} />}
        {state === 'review' && <ReviewCard />}
        {state === 'restricted' && <RestrictedCard status={restrictedStatus} />}

        {showSupportLink && (
          <p className="text-center mt-6 text-sm text-slate-500">
            Need help?{' '}
            <Link href="/contact" className="text-teal-400 hover:text-teal-300 font-medium">
              Contact support
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}