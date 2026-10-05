import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import JobDetailClient from './JobDetailClient';

export async function generateStaticParams() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { db: { schema: 'app' } }
    );
    const { data: jobRows } = await supabase.rpc('get_public_jobs').select('id').eq('is_deleted', false).limit(200);
    const jobs = Array.isArray(jobRows) ? jobRows : [];
    if (jobs && jobs.length > 0) return jobs.map((job) => ({ id: job.id }));
  } catch (_) { /* fallback for static export */ }
  return [{ id: '1' }, { id: '2' }, { id: '3' }];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { db: { schema: 'app' } }
    );
    const { data: job } = await supabase
      .rpc('get_public_jobs')
      .select('job_title, job_description, venue_city')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle();
    if (job) {
      const title = `${job.job_title} | QuickGuard UK`;
      const description = job.job_description
        ? job.job_description.slice(0, 160)
        : `Security guard job in ${job.venue_city}. Apply now on QuickGuard.`;
      return {
        title,
        description,
        alternates: { canonical: `https://quickguard.uk/jobs/detail?id=${encodeURIComponent(id)}` },
        openGraph: {
          title,
          description,
          url: `https://quickguard.uk/jobs/detail?id=${encodeURIComponent(id)}`,
          siteName: 'QuickGuard',
          type: 'website',
        },
      };
    }
  } catch (_) { /* fallback */ }
  return {
    title: 'Security Guard Job | QuickGuard UK',
    description: 'Find SIA-licensed security guard jobs across the UK on QuickGuard.',
    alternates: { canonical: `https://quickguard.uk/jobs/detail?id=${encodeURIComponent(id)}` },
  };
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobDetailClient jobId={id} />;
}