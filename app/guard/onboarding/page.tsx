'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useGuardSiaStatus } from './useGuardSiaStatus';
import PendingCard from './PendingCard';
import ApprovedCard from './ApprovedCard';
import RejectedCard from './RejectedCard';
import ReviewCard from './ReviewCard';
import RestrictedCard from './RestrictedCard';

export default function GuardOnboardingPage() {
  const { state, rejectionReason, restrictedStatus } = useGuardSiaStatus();
  const showSupportLink = state !== 'loading' && state !== 'approved';

  const [queue, setQueue] = useState<'idle' | 'failed' | 'retrying' | 'queued' | 'unavailable'>('idle');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('documentCheck') === 'retry') setQueue('failed');
  }, []);
  async function retryDocumentCheck() {
    setQueue('retrying');
    try {
      const { data, error } = await supabase.functions.invoke('request-document-check', { body: { queue_version: 2 } });
      setQueue(error ? 'failed' : data?.queued ? 'queued' : 'unavailable');
    } catch { setQueue('failed'); }
  }

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

        {(state === 'pending' || state === 'review') && (
          <section className="mt-4 rounded-xl border border-slate-700 p-4 text-sm text-slate-200">
            <p role="status">{queue === 'failed' ? 'Your profile was saved. The document check could not be queued.'
              : queue === 'queued' ? 'The current document check is queued.'
              : queue === 'retrying' ? 'Checking the queue…'
              : queue === 'unavailable' ? 'An automated check is unavailable. An administrator can review your documents.'
              : 'Document review is part of your application.'}</p>
            {queue !== 'queued' && <button type="button" disabled={queue === 'retrying'}
              onClick={() => void retryDocumentCheck()} className="mt-2 rounded border px-3 py-2">Retry document check</button>}
          </section>
        )}

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