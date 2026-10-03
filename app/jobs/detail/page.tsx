'use client';
import {Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import JobDetailClient from '../[id]/JobDetailClient';
function JobDetailQuery() {
  const id=useSearchParams().get('id');
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return <main className="p-8"><h1>Job not found</h1><p>A valid job reference is required.</p></main>;
  return <JobDetailClient jobId={id} />;
}
export default function JobDetailPage(){return <Suspense fallback={<p className="p-8">Loading job…</p>}><JobDetailQuery /></Suspense>;}
