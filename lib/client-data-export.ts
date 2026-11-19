import { readAllClientRows } from './client-job-list';

export const CLIENT_EXPORT_CATEGORIES = [
  { key: 'profile', label: 'Company Profile' }, { key: 'jobs', label: 'Job History' },
  { key: 'guards', label: 'Selected Guards' }, { key: 'payments', label: 'Payments & Invoices' },
  { key: 'tickets', label: 'Support Tickets' }, { key: 'messages', label: 'Messages' },
  { key: 'sites', label: 'Saved Sites' }, { key: 'documents', label: 'Documents List' },
] as const;
export type ClientExportCategory = typeof CLIENT_EXPORT_CATEGORIES[number]['key'];
export type ClientExportRow = Record<string, any>;
export type ClientExportData = Partial<Record<ClientExportCategory, ClientExportRow[]>>;

const fields = {
  profile: 'id, user_id, company_name, first_name, last_name, email, phone, industry, company_size, address_line1, address_line2, city, postcode, website, description, vat_number, billing_email, company_registration_number, trading_name, billing_address_line1, billing_address_line2, billing_city, billing_postcode, subscription_tier, subscription_status, verified, verification_status, created_at, updated_at',
  contacts: 'id, contact_type, name, role, email, phone, is_default, created_at, updated_at',
  jobs: 'id, job_title, venue_name, venue_city, venue_postcode, start_date, end_date, start_time, end_time, status, number_of_guards, hourly_rate, urgency, assigned_count, applications_count, created_at, updated_at',
  assignments: 'id, job_id, guard_id, status, assigned_at, completed_at, payment_status, payment_amount',
  payments: 'id, transaction_type, status, amount, currency, created_at, completed_at, payment_status, refunded, refund_amount, refunded_at, job_id, assignment_id',
  subscriptions: 'id, subscription_id, amount, currency, status, created_at, paid_at, failed_at, refunded, refund_amount, refunded_at, period_start, period_end, billing_reason',
  tickets: 'id, ticket_reference, category, subject, description, priority, status, created_at, updated_at, resolved_at, resolution_notes, related_job_id',
  messages: 'id, job_id, sender_id, sender_type, receiver_id, receiver_type, message_text, read, topic, created_at',
  sites: 'id, site_name, address_line1, address_line2, city, postcode, site_contact_name, site_contact_phone, site_contact_email, emergency_contact_name, emergency_contact_phone, access_instructions, parking_details, risk_notes, status, archived, created_at, updated_at',
  documents: 'id, document_type, file_name, file_size, mime_type, description, expiry_date, created_at, updated_at',
};
const pick = (row: ClientExportRow, columns: string) => Object.fromEntries(columns.split(', ').map(key => [key, row[key] ?? null]));
const ordered = (query: any) => query.order('created_at', { ascending: false }).order('id', { ascending: true });
const read = async (makeQuery: () => any, columns: string) => (await readAllClientRows(makeQuery)).map(row => {
  if (!row || typeof row.id !== 'string' || !row.id) throw new Error('Export records could not be verified. Please retry.');
  return pick(row, columns);
});

/** Preview and download use this same category loader. All projections are
 * explicit; provider links, internal notes and private guard fields stay out. */
export async function loadClientDataExport(db: any, clientId: string, userId: string, requested: readonly ClientExportCategory[]): Promise<ClientExportData> {
  const keys = CLIENT_EXPORT_CATEGORIES.map(c => c.key).filter(key => requested.includes(key));
  if (!keys.length || requested.some(key => !CLIENT_EXPORT_CATEGORIES.some(c => c.key === key))) throw new Error('Select a valid export category.');
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth?.user || auth.user.id !== userId) throw new Error('Your session changed. Reopen the export.');
  const { data: owner, error: ownerError } = await db.from('clients').select(keys.includes('profile') ? fields.profile : 'id, user_id')
    .eq('id', clientId).eq('user_id', auth.user.id).maybeSingle();
  if (ownerError || !owner || owner.id !== clientId || owner.user_id !== userId) throw new Error('Your company records could not be loaded. Please retry.');
  const result: ClientExportData = {};
  let jobs: ClientExportRow[] = [];
  const assignments: ClientExportRow[] = [];
  if (keys.includes('jobs') || keys.includes('guards')) {
    jobs = await read(() => ordered(db.from('jobs').select(fields.jobs).eq('client_id', clientId).or('is_deleted.is.null,is_deleted.eq.false')), fields.jobs);
    for (let offset = 0; offset < jobs.length; offset += 100) {
      const ids = jobs.slice(offset, offset + 100).map(job => job.id);
      assignments.push(...await read(() => db.from('job_assignments').select(fields.assignments).in('job_id', ids).order('id', { ascending: true }), fields.assignments));
    }
    if (assignments.some(row => !jobs.some(job => job.id === row.job_id))) throw new Error('Assignment ownership could not be verified.');
    if (keys.includes('jobs')) result.jobs = jobs.map(job => ({ ...job, recorded_assigned_count: job.assigned_count,
      assigned_count: new Set(assignments.filter(row => row.job_id === job.id && row.status !== 'cancelled' && row.guard_id).map(row => row.guard_id)).size }));
  }
  if (keys.includes('profile')) {
    const contacts = await read(() => ordered(db.from('client_contacts').select(fields.contacts).eq('client_id', clientId)), fields.contacts);
    result.profile = [{ ...pick(owner, fields.profile), site_contacts: contacts }];
  }
  if (keys.includes('guards')) {
    const profiles = new Map<string, ClientExportRow>();
    const jobsWithAssignments = [...new Set(assignments.map(row => row.job_id))];
    for (const jobId of jobsWithAssignments) {
      const { data, error } = await db.functions.invoke('get-client-assigned-guards', { body: { job_id: jobId } });
      if (error || !Array.isArray(data?.profiles)) throw new Error('Assigned guard details could not be loaded. Please retry.');
      const allowed = new Set(assignments.filter(row => row.job_id === jobId).map(row => row.guard_id));
      for (const profile of data.profiles) {
        if (!profile || typeof profile.id !== 'string' || !allowed.has(profile.id)) throw new Error('Assigned guard response could not be verified.');
        profiles.set(`${jobId}:${profile.id}`, profile);
      }
    }
    result.guards = assignments.map(row => {
      const profile = profiles.get(`${row.job_id}:${row.guard_id}`);
      return { assignment_id: row.id, job_id: row.job_id, guard_id: row.guard_id,
        profile_availability: profile ? 'available' : 'unavailable', guard_name: profile?.full_name ?? null,
        guard_account_active: typeof profile?.is_active === 'boolean' ? profile.is_active : null,
        sia_licence_number: profile?.sia_licence_number ?? null,
        sia_verified: typeof profile?.sia_verified === 'boolean' ? profile.sia_verified : null,
        sia_expiry_date: profile?.sia_expiry_date ?? null, licence_types: profile?.licence_types ?? null,
        rating: profile?.rating ?? null, status: row.status, assigned_at: row.assigned_at,
        completed_at: row.completed_at, payment_status: row.payment_status, payment_amount: row.payment_amount };
    });
  }
  if (keys.includes('payments')) {
    const txs = await read(() => ordered(db.from('transactions').select(fields.payments).eq('client_id', clientId)), fields.payments);
    const subs = await read(() => ordered(db.from('subscription_payments').select(fields.subscriptions).eq('user_id', userId)), fields.subscriptions);
    result.payments = [...txs.map(row => ({ ...row, type: 'job' })), ...subs.map(row => ({ ...row, type: 'subscription' }))];
  }
  if (keys.includes('tickets')) result.tickets = await read(() => ordered(db.from('support_tickets').select(fields.tickets).eq('client_id', clientId).or('is_deleted.is.null,is_deleted.eq.false')), fields.tickets);
  if (keys.includes('messages')) result.messages = await read(() => ordered(db.from('messages').select(fields.messages).or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)), fields.messages);
  if (keys.includes('sites')) result.sites = await read(() => ordered(db.from('saved_sites').select(fields.sites).eq('client_id', clientId).is('deleted_at', null)), fields.sites);
  if (keys.includes('documents')) result.documents = await read(() => ordered(db.from('client_documents').select(fields.documents).eq('client_id', clientId)), fields.documents);
  return Object.fromEntries(keys.map(key => [key, result[key] || []]));
}

export function buildClientExport(data: ClientExportData, clientId: string, userId: string, companyName: string, now = new Date()) {
  return { export_metadata: { exported_by: companyName, exported_at: now.toISOString(), client_id: clientId, user_id: userId,
    categories: Object.keys(data), record_counts: Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length])),
    scope: 'Jobs and assignments exclude deleted jobs; payments retain owned ledger history; deleted tickets/sites are excluded, archived sites remain. Documents are metadata only. Private guard contacts/documents, internal notes and provider/file access links are excluded. Null means unavailable or not recorded; false is a recorded false value.' }, ...data };
}

const cell = (value: any) => {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
};
/** One rectangular CSV, including a category and explicit empty-category rows.
 * A union of columns preserves subscription-only fields and nested JSON values. */
export function clientExportCSV(data: ClientExportData): string {
  const rows = Object.entries(data).flatMap(([category, records]) => records.length
    ? records.map(row => ({ ...row, export_category: category, export_row_type: 'record' }))
    : [{ export_category: category, export_row_type: 'empty_category' }]);
  const columns = ['export_category', 'export_row_type', ...new Set(Object.values(data).flatMap(records => records.flatMap(row => Object.keys(row))))];
  return '\uFEFF' + [columns.map(cell).join(','), ...rows.map(row => columns.map(key => cell((row as ClientExportRow)[key])).join(','))].join('\r\n') + '\r\n';
}

export function clientExportPreview(key: ClientExportCategory, rows: ClientExportRow[]) {
  return JSON.stringify({ category: key, record_count: rows.length, sample: rows.slice(0, 5), more_records: Math.max(0, rows.length - 5) }, null, 2);
}
