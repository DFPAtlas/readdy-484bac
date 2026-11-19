import { readAllClientRows } from './client-job-list';
import { isOperationalSafetyJob, buildSafetyWarnings, safetyCounts } from './client-safety';

export async function loadClientSafetyData(db: any) {
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) throw new Error('Sign in to load safety records.');
  const { data: client, error: clientError } = await db.from('clients').select('id, company_name, contact_name')
    .eq('user_id', user.id).maybeSingle();
  if (clientError || !client) throw new Error('Client safety records could not be loaded.');
  const [jobs, safety, incidents] = await Promise.all([
    readAllClientRows(() => db.from('jobs').select('*').eq('client_id', client.id).eq('is_deleted', false)
      .order('created_at', { ascending: false }).order('id', { ascending: true })),
    readAllClientRows(() => db.from('job_safety_checks').select('*').eq('client_id', client.id).order('id', { ascending: true })),
    readAllClientRows(() => db.from('support_tickets')
      .select('id, ticket_reference, job_id:related_job_id, category, subject, priority, status, created_at, resolved_at, description')
      .eq('client_id', client.id).eq('is_deleted', false).order('created_at', { ascending: false }).order('id', { ascending: true })),
  ]);
  const checks = new Map(safety.map(check => [check.job_id, check]));
  return { client, jobs: jobs.map(job => ({ ...job, safety_check: checks.get(job.id) })), incidents };
}

export async function loadSafetyAssignments(db: any, jobs: any[]) {
  const assignments: Record<string, any[]> = {};
  for (const job of jobs.filter(isOperationalSafetyJob)) {
    const rows = (await readAllClientRows(() => db.from('job_assignments').select('id, job_id, guard_id, status')
      .eq('job_id', job.id).order('id', { ascending: true })))
      .filter(row => !['cancelled', 'completed'].includes(row.status));
    assignments[job.id] = [];
    if (!rows.length) continue;
    const { data, error } = await db.functions.invoke('get-client-assigned-guards', { body: { job_id: job.id } });
    if (error || !Array.isArray(data?.profiles)) throw new Error('Assigned guard compliance could not be loaded.');
    const profiles = new Map<string, any>(data.profiles.map((profile: any) => [profile.id, profile]));
    if (rows.some(row => !profiles.has(row.guard_id))) throw new Error('Assigned guard compliance is unavailable.');
    assignments[job.id] = rows.map(row => {
      const profile = profiles.get(row.guard_id);
      return { ...row, guards: {
        id: profile.id, full_name: profile.full_name, sia_verified: profile.sia_verified,
        sia_expiry_date: profile.sia_expiry_date, licence_types: profile.licence_types,
        sia_licence_type: null, sia_licence_number: null,
      } };
    });
  }
  return assignments;
}

export async function loadClientSafetySummary(db: any, clientId: string, jobs: any[]) {
  const checks = await readAllClientRows(() => db.from('job_safety_checks').select('*').eq('client_id', clientId).order('id', { ascending: true }));
  const checkMap = new Map(checks.map(check => [check.job_id, check]));
  const hydrated = jobs.map(job => ({ ...job, safety_check: checkMap.get(job.id) }));
  const assignments = await loadSafetyAssignments(db, hydrated);
  return safetyCounts(hydrated, [], buildSafetyWarnings(hydrated, assignments));
}
