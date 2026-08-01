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
  return <PaymentClient jobId={id} />;
}