import { createClient } from '@supabase/supabase-js';
import SelectGuardsClient from './SelectGuardsClient';

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

export default async function SelectGuardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SelectGuardsClient jobId={id} />;
}