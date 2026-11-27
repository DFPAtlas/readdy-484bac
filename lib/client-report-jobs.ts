import { readAllClientRows } from './client-job-list';

const assignmentFields = 'id, job_id, guard_id, status, assigned_at, completed_at, check_in_time, check_out_time, payment_status, payment_amount';
const profileFields = ['id', 'full_name', 'sia_licence_number', 'sia_expiry_date', 'sia_verified', 'licence_types', 'rating', 'total_reviews', 'is_active', 'verification_status'] as const;

/** Use the same owner-checked profile endpoint as booking details. Direct guard
 * joins can be hidden by profile RLS even when an historical assignment is visible. */
export async function loadClientReportJobs(db: any, clientId: string) {
  const jobs = await readAllClientRows(() => db.from('jobs').select('*')
    .eq('client_id', clientId).eq('is_deleted', false)
    .order('created_at', { ascending: false }).order('id', { ascending: true }));
  const jobIds = new Set(jobs.map(job => job.id));
  if (jobIds.size !== jobs.length || jobs.some(job => typeof job.id !== 'string' || !job.id || job.client_id !== clientId)) {
    throw new Error('Report job ownership could not be verified. Please retry.');
  }
  const assignments: any[] = [];
  for (let offset = 0; offset < jobs.length; offset += 100) {
    const ids = jobs.slice(offset, offset + 100).map(job => job.id);
    assignments.push(...await readAllClientRows(() => db.from('job_assignments').select(assignmentFields)
      .in('job_id', ids).order('id', { ascending: true })));
  }
  if (new Set(assignments.map(row => row.id)).size !== assignments.length || assignments.some(row =>
    typeof row.id !== 'string' || !row.id || !jobIds.has(row.job_id) || typeof row.guard_id !== 'string' || !row.guard_id)) {
    throw new Error('Report assignment identities could not be verified. Please retry.');
  }
  const byJob = new Map<string, any[]>();
  for (const row of assignments) {
    const rows = byJob.get(row.job_id) || [];
    rows.push(row);
    byJob.set(row.job_id, rows);
  }
  const hydrated = new Map<string, any>();
  const guards = new Map<string, any>();
  const assignedJobIds = [...byJob.keys()];
  // Bound concurrency and query only jobs actually containing assignments.
  for (let offset = 0; offset < assignedJobIds.length; offset += 4) {
    await Promise.all(assignedJobIds.slice(offset, offset + 4).map(async jobId => {
      const rows = byJob.get(jobId)!;
      const allowedIds = new Set(rows.map(row => row.guard_id));
      const { data, error } = await db.functions.invoke('get-client-assigned-guards', { body: { job_id: jobId } });
      if (error || !Array.isArray(data?.profiles)) throw new Error('Assigned guard details could not be loaded. Please retry.');
      const profiles = new Map<string, any>();
      for (const profile of data.profiles) {
        if (!profile || typeof profile.id !== 'string' || !allowedIds.has(profile.id) || profiles.has(profile.id)
          || (profile.full_name != null && typeof profile.full_name !== 'string')) {
          throw new Error('Assigned guard response could not be verified. Please retry.');
        }
        profiles.set(profile.id, {
          ...Object.fromEntries(profileFields.map(key => [key, profile[key] ?? null])),
          full_name: profile.full_name?.trim() || 'Guard name unavailable', profile_available: true,
        });
      }
      for (const row of rows) {
        // Retain historical shifts if a linked profile was deleted. Missing data
        // is explicit and must not become a verified/compliant guard.
        const profile = profiles.get(row.guard_id) || {
          id: row.guard_id, full_name: 'Guard name unavailable', profile_available: false,
          sia_verified: null, sia_expiry_date: null, licence_types: [], is_active: null,
        };
        hydrated.set(row.id, { ...row, guards: profile });
        if (!guards.get(profile.id)?.profile_available) guards.set(profile.id, profile);
      }
    }));
  }
  const jobAssignments = assignments.map(row => hydrated.get(row.id));
  return {
    jobs: jobs.map(job => ({ ...job, job_assignments: (byJob.get(job.id) || []).map(row => hydrated.get(row.id)) })),
    assignments: jobAssignments,
    guards: [...guards.values()],
  };
}
