'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SelectGuardsClient from '../[id]/select-guards/SelectGuardsClient';

function JobRoute() {
  const jobId = useSearchParams().get('id');
  if (!jobId) return <div className="p-6">No job selected. <Link href="/client/jobs">Back to My Jobs</Link></div>;
  return <SelectGuardsClient jobId={jobId} />;
}

export default function Page() {
  return <Suspense fallback={<div className="p-6">Loading job…</div>}><JobRoute /></Suspense>;
}
