import type { SupabaseClient } from '@supabase/supabase-js';

/** Assigned profiles are owner-checked by the backend, independently of applicant visibility. */
export async function loadClientJobAssignments(db: SupabaseClient<any, any, any, any, any>, jobId: string) {
  const { data, error } = await db.from('job_assignments').select('*').eq('job_id', jobId);
  if (error) throw error;
  const assignments = data || [];
  const guardIds = [...new Set(assignments.map(row => row.guard_id).filter(Boolean))];
  if (guardIds.length === 0) return assignments;
  const { data: result, error: profileError } = await db.functions.invoke('get-client-assigned-guards', { body: { job_id: jobId } });
  if (profileError || !Array.isArray(result?.profiles)) throw new Error('Assigned guard profiles could not be loaded. Please try again.');
  const guardMap = new Map(result.profiles.map((profile: any) => [profile.id, {
    ...profile,
    profile_photo_url: profile.profile_image_url,
    average_rating: profile.rating,
    phone: null,
    sia_licence_front_url: null,
    sia_licence_back_url: null,
    licence_documents_private: true,
  }]));
  if (guardIds.some(id => !guardMap.has(id))) throw new Error('An assigned guard profile is unavailable. Please contact support.');
  return assignments.map(row => ({ ...row, guards: guardMap.get(row.guard_id) }));
}
