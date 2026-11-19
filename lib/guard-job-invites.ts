export interface GuardJobInvite {
  id: string;
  guard_id: string;
  status: string | null;
  invited_at: string | null;
  responded_at: string | null;
  message: string | null;
  jobs: {
    id: string;
    job_title: string | null;
    venue_city: string | null;
    start_date: string | null;
    start_time: string | null;
    end_time: string | null;
    hourly_rate: number | string | null;
    clients: { company_name: string | null } | null;
  } | null;
}

// Keep RLS-hidden linked jobs/clients null. Never widen access to reconstruct
// them, and never discard the invitation merely because an embed is unavailable.
export async function loadGuardJobInvites(db: any, guardId: string, current: () => boolean): Promise<GuardJobInvite[] | null> {
  const records: GuardJobInvite[] = [];
  const seen = new Set<string>();
  for (let offset = 0; ; offset += 200) {
    if (!current()) return null;
    const { data, error } = await db.from('job_invites')
      .select('id, guard_id, status, invited_at, responded_at, message, jobs(id, job_title, venue_city, start_date, start_time, end_time, hourly_rate, clients(company_name))')
      .eq('guard_id', guardId).order('invited_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).range(offset, offset + 199);
    if (!current()) return null;
    if (error || !Array.isArray(data)) throw new Error('Invitations could not be loaded');
    const previous = seen.size;
    for (const row of data) {
      if (!row || typeof row.id !== 'string' || row.guard_id !== guardId || (row.status !== null && typeof row.status !== 'string') ||
        (row.jobs != null && (typeof row.jobs !== 'object' || Array.isArray(row.jobs) || typeof row.jobs.id !== 'string'))) throw new Error('Invalid invitation response');
      // Offset pages can overlap if a new invitation arrives during the read.
      // Do not render duplicate cards; Refresh retrieves the current snapshot.
      if (!seen.has(row.id)) {
        const text = (v: unknown) => typeof v === 'string' ? v : null;
        const job = row.jobs;
        if (job?.clients != null && (typeof job.clients !== 'object' || Array.isArray(job.clients))) throw new Error('Invalid client relationship');
        records.push({ id: row.id, guard_id: guardId, status: row.status, invited_at: text(row.invited_at), responded_at: text(row.responded_at), message: text(row.message),
          jobs: job ? { id: job.id, job_title: text(job.job_title), venue_city: text(job.venue_city), start_date: text(job.start_date), start_time: text(job.start_time), end_time: text(job.end_time),
            hourly_rate: typeof job.hourly_rate === 'number' || typeof job.hourly_rate === 'string' ? job.hourly_rate : null, clients: job.clients ? { company_name: text(job.clients.company_name) } : null } : null });
        seen.add(row.id);
      }
    }
    if (data.length < 200) return records;
    if (seen.size === previous) throw new Error('Invitation pagination did not advance');
  }
}

export function guardInviteRate(value: number | string | null | undefined): string {
  if (value == null || (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value)) || Number(value) < 0) return 'Rate not recorded';
  return `£${Number(value).toFixed(2)}/hr`;
}
export function guardInviteTimestamp(value: string | null, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-GB', { ...options, timeZone: 'Europe/London' }) : 'Date not recorded';
}
