import type { SupabaseClient } from '@supabase/supabase-js';
import { canClientReviewAssignment, CLIENT_REVIEWABLE_STATUSES } from './client-job-actions';

export interface ReviewItem {
  id: string; job_id: string; guard_id: string; rating: number;
  review_text?: string; review_status: string; issue_reported: boolean;
  issue_category?: string; punctuality?: number | null; professionalism?: number | null;
  communication?: number | null; appearance?: number | null; reliability?: number | null;
  would_hire_again?: boolean | null; attendance_status?: string | null;
  site_instructions_followed?: boolean | null; created_at: string;
  guards: { full_name: string; profile_photo_url?: string } | null;
  jobs: { job_title: string; start_date: string } | null;
}
export interface PendingReview {
  job_id: string; job_title: string; start_date: string;
  guard_id: string; guard_name: string; profile_photo_url?: string;
}
const PAGE_SIZE = 200;
const reviewFields = 'id, job_id, guard_id, rating, review_text, review_status, issue_reported, issue_category, punctuality, professionalism, communication, appearance, reliability, would_hire_again, attendance_status, site_instructions_followed, created_at';

async function readAll(makeQuery: () => any): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await makeQuery().range(offset, offset + PAGE_SIZE - 1);
    if (error || !Array.isArray(data)) throw new Error('Review records could not be loaded.');
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

/** All data remains client-scoped; historical profiles use the owner-checked endpoint. */
export async function loadClientReviews(db: SupabaseClient<any, any, any, any, any>, clientId: string) {
  const jobs = await readAll(() => db.from('jobs').select('id, job_title, start_date, status, is_deleted')
    .eq('client_id', clientId).eq('is_deleted', false).order('id', { ascending: true }));
  const jobMap = new Map(jobs.map(job => [job.id, job]));
  // Reviews of closed jobs must remain visible after the last review closes a job.
  const history = (await readAll(() => db.from('reviews').select(reviewFields).eq('client_id', clientId)
    .order('created_at', { ascending: false }).order('id', { ascending: true }))).filter(review => jobMap.has(review.job_id));
  const eligibleIds = jobs.filter(job => (CLIENT_REVIEWABLE_STATUSES as readonly string[]).includes(job.status)).map(job => job.id);
  const assignments: any[] = [];
  for (let offset = 0; offset < eligibleIds.length; offset += PAGE_SIZE) {
    assignments.push(...await readAll(() => db.from('job_assignments').select('id, job_id, guard_id, status, payment_status')
      .in('job_id', eligibleIds.slice(offset, offset + PAGE_SIZE)).eq('status', 'completed').eq('payment_status', 'paid_out').order('id', { ascending: true })));
  }
  const neededJobs = new Set([...history, ...assignments].map(row => row.job_id));
  const profiles = new Map<string, { full_name: string; profile_photo_url?: string }>();
  for (const jobId of neededJobs) {
    const { data, error } = await db.functions.invoke('get-client-assigned-guards', { body: { job_id: jobId } });
    if (error || !Array.isArray(data?.profiles)) throw new Error('Assigned guard profiles could not be loaded.');
    for (const profile of data.profiles) {
      if (typeof profile.id !== 'string') continue;
      profiles.set(`${jobId}:${profile.id}`, {
        full_name: typeof profile.full_name === 'string' && profile.full_name.trim()
          ? `${profile.full_name}${profile.is_active === false ? ' (inactive account)' : ''}` : 'Guard profile unavailable',
        profile_photo_url: typeof profile.profile_image_url === 'string' ? profile.profile_image_url : undefined,
      });
    }
  }
  const reviews: ReviewItem[] = history.map(review => ({ ...review,
    review_status: review.review_status || 'reviewed', issue_reported: review.issue_reported === true,
    guards: profiles.get(`${review.job_id}:${review.guard_id}`) || null,
    jobs: { job_title: jobMap.get(review.job_id).job_title, start_date: jobMap.get(review.job_id).start_date },
  }));
  const reviewed = new Set(history.map(review => `${review.job_id}:${review.guard_id}`));
  const pendingReviews: PendingReview[] = [];
  for (const assignment of assignments) {
    const job = jobMap.get(assignment.job_id);
    const pair = `${assignment.job_id}:${assignment.guard_id}`;
    if (!job || !assignment.guard_id || !canClientReviewAssignment(job, assignment) || reviewed.has(pair)) continue;
    reviewed.add(pair);
    const profile = profiles.get(pair);
    pendingReviews.push({ job_id: job.id, job_title: job.job_title, start_date: job.start_date,
      guard_id: assignment.guard_id, guard_name: profile?.full_name || 'Guard profile unavailable',
      profile_photo_url: profile?.profile_photo_url });
  }
  return { reviews, pendingReviews };
}
