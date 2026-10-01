'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PaymentClient from '../[id]/payment/PaymentClient';

function JobPaymentRoute() {
  const jobId = useSearchParams().get('id');
  if (!jobId) return <div className="p-6">No job selected. <Link href="/client/jobs">Back to My Jobs</Link></div>;
  return <PaymentClient jobId={jobId} />;
}

export default function Page() {
  return <Suspense fallback={<div className="p-6">Loading payment details…</div>}><JobPaymentRoute /></Suspense>;
}
