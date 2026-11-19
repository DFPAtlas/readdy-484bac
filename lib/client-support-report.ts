import { readAllClientRows } from './client-job-list';
import { ukPaymentDay as ukRecordDay } from './client-finance';

export type SupportSource = 'ticket' | 'complaint' | 'dispute';
export interface SupportReportRecord {
  key: string;
  source: SupportSource;
  id: string;
  reference: string;
  jobId: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  createdAt: string;
  resolvedAt: string | null;
  resolution: string;
}
export const SUPPORT_SOURCE_LABELS = { ticket: 'Support ticket', complaint: 'Complaint', dispute: 'Job dispute' };
export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  open: 'Open', awaiting_client: 'Awaiting client reply', under_review: 'Under review', escalated: 'Escalated', resolved: 'Resolved', closed: 'Closed',
  resolved_guard: 'Resolved — guard', resolved_client_refund: 'Resolved — client refund', resolved_client_partial: 'Resolved — client partial refund', resolved_cancelled: 'Resolved — cancelled',
};
export const isResolvedSupportRecord = (row: SupportReportRecord) => row.status === 'resolved' || row.status.startsWith('resolved_');
const isFinished = (row: SupportReportRecord) => isResolvedSupportRecord(row) || row.status === 'closed';

function normalise(source: SupportSource, row: any): SupportReportRecord {
  const textFields = ['ticket_reference', 'complaint_id', 'related_job_id', 'job_id', 'subject', 'category', 'severity', 'priority', 'description', 'details', 'reason', 'resolution', 'resolution_notes'];
  if (typeof row.id !== 'string' || !row.id || typeof row.status !== 'string' || typeof row.created_at !== 'string' || !ukRecordDay(row.created_at) || (row.resolved_at && !ukRecordDay(row.resolved_at)) || textFields.some(key => row[key] != null && typeof row[key] !== 'string')) throw new Error('Support report records could not be loaded. Please retry.');
  return {
    key: `${source}:${row.id}`, source, id: row.id,
    reference: (source === 'ticket' ? row.ticket_reference : source === 'complaint' ? row.complaint_id : null) || row.id,
    jobId: (source === 'dispute' ? row.job_id : row.related_job_id) || null,
    subject: source === 'ticket' ? row.subject || 'Support ticket' : source === 'complaint' ? 'Complaint' : row.reason || 'Job dispute',
    category: (source === 'dispute' ? row.reason : row.category) || 'Not recorded',
    priority: (source === 'ticket' ? row.priority : source === 'complaint' ? row.severity : null) || 'not_recorded',
    status: row.status, description: (source === 'dispute' ? row.details : row.description) || '',
    createdAt: new Date(row.created_at).toISOString(), resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    resolution: (source === 'dispute' ? row.resolution : row.resolution_notes) || '',
  };
}

/** Retained records are scoped independently of job-list visibility. Never read admin notes. */
export async function loadClientSupportReport(db: any, clientId: string, userId: string): Promise<SupportReportRecord[]> {
  const [tickets, complaints, disputes] = await Promise.all([
    readAllClientRows(() => db.from('support_tickets').select('id, ticket_reference, related_job_id, category, subject, description, priority, status, created_at, resolved_at, resolution_notes')
      .eq('client_id', clientId).eq('is_deleted', false).order('created_at', { ascending: false }).order('id', { ascending: false })),
    readAllClientRows(() => db.from('complaints').select('id, complaint_id, related_job_id, category, severity, description, status, created_at, resolved_at, resolution_notes')
      .eq('filed_by_id', userId).eq('filed_by_type', 'client').order('created_at', { ascending: false }).order('id', { ascending: false })),
    readAllClientRows(() => db.from('disputes').select('id, job_id, reason, details, status, resolution, created_at, resolved_at')
      .eq('client_id', clientId).order('created_at', { ascending: false }).order('id', { ascending: false })),
  ]);
  return [...tickets.map(row => normalise('ticket', row)), ...complaints.map(row => normalise('complaint', row)), ...disputes.map(row => normalise('dispute', row))]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.key.localeCompare(b.key));
}

export interface SupportReportFilters { from?: string; to?: string; source?: string; status?: string; priority?: string; }
export function filterSupportReport(rows: SupportReportRecord[], filters: SupportReportFilters = {}) {
  return rows.filter(row => {
    const day = ukRecordDay(row.createdAt);
    return !!day && (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to) &&
      (!filters.source || filters.source === 'all' || row.source === filters.source) &&
      (!filters.status || filters.status === 'all' || (filters.status === 'resolved' ? isResolvedSupportRecord(row) : row.status === filters.status)) &&
      (!filters.priority || filters.priority === 'all' || row.priority === filters.priority);
  });
}
export function supportReportSummary(rows: SupportReportRecord[]) {
  return {
    total: rows.length, tickets: rows.filter(r => r.source === 'ticket').length, complaints: rows.filter(r => r.source === 'complaint').length, disputes: rows.filter(r => r.source === 'dispute').length,
    open: rows.filter(r => r.status === 'open').length, openTickets: rows.filter(r => r.source === 'ticket' && r.status === 'open').length,
    awaitingClient: rows.filter(r => r.status === 'awaiting_client').length, underReview: rows.filter(r => r.status === 'under_review').length,
    resolved: rows.filter(isResolvedSupportRecord).length, closed: rows.filter(r => r.status === 'closed').length,
    urgent: rows.filter(r => ['urgent', 'critical'].includes(r.priority) && !isFinished(r)).length,
    activeDisputes: rows.filter(r => r.source === 'dispute' && !isFinished(r)).length,
  };
}

function csvCell(value: string | null) {
  let text = value || '';
  if (/^[\u0000-\u0020]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function supportReportCsv(rows: SupportReportRecord[]) {
  const headers = ['Source', 'Record ID', 'Reference', 'Related Job ID', 'Subject', 'Category', 'Priority / Severity', 'Status', 'Description', 'Created At (UTC)', 'Resolved At (UTC)', 'Resolution Notes'];
  const values = rows.map(r => [SUPPORT_SOURCE_LABELS[r.source], r.id, r.reference, r.jobId, r.subject, r.category, r.priority, r.status, r.description, r.createdAt, r.resolvedAt, r.resolution]);
  return '\uFEFF' + [headers, ...values].map(row => row.map(csvCell).join(',')).join('\r\n');
}
