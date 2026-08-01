import { Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';
import BookingConfirmationClient from './BookingConfirmationClient';

export async function generateStaticParams() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { db: { schema: 'app' } }
    );
    const { data: jobs } = await supabase.from('jobs').select('id');
    if (jobs && jobs.length > 0) return jobs.map((job) => ({ id: job.id }));
  } catch (_) { /* fallback for static export */ }
  return [{ id: '1' }, { id: '2' }, { id: '3' }];
}

export default async function BookingConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">Loading booking confirmation...</p>
        </div>
      </div>
    }>
      <BookingConfirmationClient jobId={id} />
    </Suspense>
  );
}