import { TRACKER_FILTER_STATUSES } from './client-job-tracker';

export const CLIENT_JOB_LIST_STATUSES: Record<string, string[]> = {
  all: [], drafts: ['draft'], wizard_drafts: [], featured: [], scheduled: ['draft'],
  posted: ['open', 'pending'], applications_open: ['awaiting_guard_selection'],
  awaiting_payment: ['awaiting_payment'], confirmed: ['funded', 'confirmed'],
  active: ['in_progress'], completed: TRACKER_FILTER_STATUSES.completed, cancelled: ['cancelled'],
};
export const isCompletedClientJob = (job: { status: string }) => CLIENT_JOB_LIST_STATUSES.completed.includes(job.status);
export const isScheduledDraftJob = (job: { status: string; is_draft?: boolean; publish_at?: string | null }, now = new Date()) =>
  job.status === 'draft' && job.is_draft === true && !!job.publish_at && Date.parse(job.publish_at) > now.getTime();

export async function readAllClientRows(makeQuery: () => any): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await makeQuery().range(offset, offset + 199);
    if (error || !Array.isArray(data)) throw new Error('Client records could not be loaded. Please retry.');
    rows.push(...data);
    if (data.length < 200) return rows;
  }
}
export function loadClientJobSummary(db: any, clientId: string) {
  return readAllClientRows(() => db.from('jobs')
    .select('id, status, applications_count, assigned_count, number_of_guards, is_featured, is_draft, publish_at, start_date, start_time, special_instructions')
    .eq('client_id', clientId).eq('is_deleted', false).order('id', { ascending: true }));
}
export function loadClientWizardDrafts(db: any, clientId: string) {
  return readAllClientRows(() => db.schema('app').from('job_drafts').select('id, draft_name, last_saved_at')
    .eq('client_id', clientId).order('last_saved_at', { ascending: false }).order('id', { ascending: true }));
}
