import { readAllClientRows } from './client-job-list';
import { londonCalendarDate, dateOnlyToUtcDate } from './date-only';

export interface ClientActivityEntry {
  id: string;
  client_id: string;
  action_type: string;
  action_description: string;
  category: string;
  created_at: string;
  related_job_id: string | null;
  related_payment_id: string | null;
  related_ticket_id: string | null;
  related_guard_id: string | null;
  related_site_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  job_title?: string | null;
  ticket_subject?: string | null;
  guard_name?: string | null;
  site_name?: string | null;
}

export async function loadClientActivityRows(db: any, clientId: string): Promise<ClientActivityEntry[]> {
  if (!clientId) throw new Error('Client account is unavailable.');
  const rows = await readAllClientRows(() => db.from('client_activity_log')
    .select('id, client_id, action_type, action_description, category, created_at, related_job_id, related_payment_id, related_ticket_id, related_guard_id, related_site_id, metadata, ip_address')
    .eq('client_id', clientId).order('created_at', { ascending: false }).order('id', { ascending: true }));
  const ids = new Set<string>();
  for (const row of rows) {
    if (!row.id || ids.has(row.id) || row.client_id !== clientId ||
        typeof row.action_description !== 'string' || typeof row.action_type !== 'string' ||
        typeof row.category !== 'string' || !row.created_at || !Number.isFinite(Date.parse(row.created_at))) {
      throw new Error('Activity records could not be verified. Please retry.');
    }
    ids.add(row.id);
  }
  return rows;
}

export interface ActivitySelection {
  search?: string; category?: string; action?: string; from?: string; to?: string; jobId?: string;
}

export function filterClientActivity(rows: ClientActivityEntry[], selection: ActivitySelection = {}) {
  const { category, action, from, to, jobId } = selection;
  const search = selection.search?.trim().toLowerCase();
  if ((from && !dateOnlyToUtcDate(from)) || (to && !dateOnlyToUtcDate(to)) || (from && to && from > to)) return [];
  return rows.filter(row => {
    if (category && category !== 'all' && row.category !== category) return false;
    if (action && action !== 'all' && row.action_type !== action) return false;
    if (jobId && row.related_job_id !== jobId) return false;
    const day = londonCalendarDate(new Date(row.created_at));
    if ((from && day < from) || (to && day > to)) return false;
    return !search || [row.action_description, row.job_title, row.ticket_subject, row.guard_name, row.site_name]
      .some(value => value?.toLowerCase().includes(search));
  });
}

/** All cards describe the same filtered records; dates use the UK calendar. */
export function clientActivitySummary(rows: ClientActivityEntry[], now = new Date()) {
  const today = londonCalendarDate(now);
  const weekStart = dateOnlyToUtcDate(today)!;
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const firstDay = weekStart.toISOString().slice(0, 10);
  return {
    total: rows.length,
    today: rows.filter(row => londonCalendarDate(new Date(row.created_at)) === today).length,
    thisWeek: rows.filter(row => {
      const day = londonCalendarDate(new Date(row.created_at));
      return day >= firstDay && day <= today;
    }).length,
    jobsUpdated: rows.filter(row => row.category === 'job').length,
    paymentsUpdated: rows.filter(row => row.category === 'payment').length,
    supportUpdates: rows.filter(row => row.category === 'support').length,
  };
}
