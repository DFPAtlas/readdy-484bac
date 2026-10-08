import type { SupabaseClient } from '@supabase/supabase-js';

/** Read assigned guard display data through the client-safe, job-scoped view. */
export async function loadClientJobAssignments(db: SupabaseClient<any, any, any, any, any>, jobId: string) {
  const { data, error } = await db.from('job_assignments').select('*').eq('job_id', jobId);
  if (error) throw error;
  const assignments = data || [];
  const guardIds = [...new Set(assignments.map(row => row.guard_id).filter(Boolean))];
  if (guardIds.length === 0) return assignments;
  const { data: profiles, error: profileError } = await db
    .from('client_applicant_profiles')
    .select('id:guard_id, full_name, profile_photo_url:profile_image_url, hourly_rate, sia_verified, sia_licence_number, licence_types, average_rating:rating, total_reviews, total_jobs_completed')
    .eq('job_id', jobId)
    .in('guard_id', guardIds);
  if (profileError) throw profileError;
  const guardMap = new Map((profiles || []).map(profile => [profile.id, profile]));
  return assignments.map(row => ({ ...row, guards: guardMap.get(row.guard_id) || null }));
}
