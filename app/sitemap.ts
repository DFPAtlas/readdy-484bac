import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-static';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://quickguard.uk';

const CITIES = [
  'london',
  'manchester',
  'birmingham',
  'leeds',
  'liverpool',
  'glasgow',
  'edinburgh',
  'bristol',
  'cardiff',
];

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;

const STATIC_PAGES: Array<{ path: string; changeFrequency: ChangeFrequency; priority: number }> = [
  { path: '', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/how-it-works', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/how-it-works/clients', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/jobs', changeFrequency: 'daily', priority: 0.9 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/help', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/guide/client', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/guide/guard', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/security-guards', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/security-for-building-sites', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/security-for-events', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/security-for-nightclubs', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/security-for-shops', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/find-a-guard', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/post-job', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/guard/register', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/client/register', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/accessibility', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/cookie-policy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/founding-guards', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/founding-guards-offer', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/mobile-app', changeFrequency: 'monthly', priority: 0.6 },
];

async function fetchPublishedJobs(now: Date): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { db: { schema: 'app' } }
    );

    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, updated_at')
      .eq('is_deleted', false)
      .in('status', ['open', 'awaiting_guard_selection'])
      .limit(500);

    if (!jobs || jobs.length === 0) return [];

    return jobs.map((job) => ({
      url: `${BASE_URL}/jobs/${job.id}`,
      lastModified: job.updated_at ? new Date(job.updated_at) : now,
      changeFrequency: 'daily' as ChangeFrequency,
      priority: 0.6,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    url: `${BASE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  const cityEntries: MetadataRoute.Sitemap = CITIES.map((city) => ({
    url: `${BASE_URL}/security-guards/${city}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const jobEntries = await fetchPublishedJobs(now);

  return [...staticEntries, ...cityEntries, ...jobEntries];
}