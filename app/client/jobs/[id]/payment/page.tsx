import { Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';
import PaymentClient from './PaymentClient';

export async function generateStaticParams() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { db: { schema: 'app' } }
    );
    const { data: jobs } = await supabase.from('jobs').select('id');
    if (jobs && jobs.length > 0) {
      return jobs.map((job: { id: string }) => ({ id: job.id }));
    }
  } catch (_) { /* use mock fallback */ }
  return [{ id: '1' }, { id: '2' }, { id: '3' }];
}

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading payment details...</p>
          </div>
        </div>
      }
    >
      <PaymentClient jobId={id} />
    </Suspense>
  );
}