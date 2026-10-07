import type { SupabaseClient } from '@supabase/supabase-js';

type GuardHistoryClient = Pick<SupabaseClient<any, any, any>, 'functions'>;

// Confirmed jobs are deliberately hidden by the public jobs SELECT policy.
// This authenticated endpoint resolves only the signed-in guard's own history.
export async function loadGuardHistoryJobs(client: GuardHistoryClient, guardId: string): Promise<any[]> {
  const { data, error } = await client.functions.invoke('get-guard-job-history', { body: {} });
  if (error || data?.error) throw new Error('Unable to load guard bookings');
  if (data?.guard?.id !== guardId || !Array.isArray(data?.jobs)) {
    throw new Error('Invalid guard booking response');
  }
  return data.jobs.map((job: any) => ({
    ...job,
    id: job.job_id,
    status: job.job_status,
    location: job.venue_city,
    postcode: job.venue_postcode,
    clients: { company_name: job.client_name },
    disputed: ['open', 'under_review'].includes(job.dispute_status),
  }));
}

export async function hydrateGuardJobRows(client: GuardHistoryClient, guardId: string, rows: any[]): Promise<any[]> {
  if (rows.length === 0) return [];
  const jobs = await loadGuardHistoryJobs(client, guardId);
  const jobMap = new Map(jobs.map(job => [job.id, job]));
  return rows.map(row => {
    const job = jobMap.get(row.job_id);
    // A failed/missing history result must not look like an empty schedule.
    if (!job) throw new Error('Unable to load a linked guard booking');
    return { ...row, jobs: job };
  });
}
