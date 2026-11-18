function rows(result: any, message: string): any[] {
  if (result.error || !Array.isArray(result.data)) throw new Error(message);
  return result.data;
}

export async function loadOwnedSupportInbox(db: any, kind: 'guard' | 'client') {
  const auth = await db.auth.getUser();
  if (auth.error) throw new Error('Your support account could not be confirmed.');
  const user = auth.data?.user;
  if (!user) return null;
  const profileResult = await db.from(kind === 'guard' ? 'guards' : 'clients')
    .select(kind === 'guard' ? 'id, full_name, verification_status' : 'id, company_name, subscription_tier')
    .eq('user_id', user.id).maybeSingle();
  if (profileResult.error || !profileResult.data) throw new Error('Your support profile could not be loaded.');
  const profile = profileResult.data;
  const [ticketResult, jobResult] = await Promise.all([
    db.from('support_tickets').select('*').eq(`${kind}_id`, profile.id).eq('is_deleted', false).order('created_at', { ascending: false }),
    kind === 'client' ? db.from('jobs').select('id, job_title, venue_city, start_date, status')
      .eq('client_id', profile.id).eq('is_deleted', false).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  const tickets = rows(ticketResult, 'Support tickets could not be loaded.');
  const jobs = rows(jobResult, 'Related support jobs could not be loaded.');
  const jobMap = new Map(jobs.map((job: any) => [job.id, job]));
  return { profile, userId: user.id, jobs, tickets: kind === 'guard' ? tickets : tickets.map((ticket: any) => ({
    ...ticket, job_title: jobMap.get(ticket.related_job_id)?.job_title || null,
  })) };
}

export async function loadAdminSupportInbox(db: any): Promise<any[]> {
  const tickets = rows(await db.from('support_tickets').select('*').eq('is_deleted', false)
    .order('created_at', { ascending: false }), 'Support tickets could not be loaded.');
  const ids = (field: string) => [...new Set(tickets.map(ticket => ticket[field]).filter(Boolean))];
  const clientIds = ids('client_id'), guardIds = ids('guard_id'), jobIds = ids('related_job_id');
  const [clientResult, guardResult, jobResult] = await Promise.all([
    clientIds.length ? db.from('clients').select('id, company_name, contact_name, email').in('id', clientIds) : Promise.resolve({ data: [], error: null }),
    guardIds.length ? db.from('guards').select('id, full_name, email').in('id', guardIds) : Promise.resolve({ data: [], error: null }),
    jobIds.length ? db.from('jobs').select('id, job_title').in('id', jobIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const clients = new Map(rows(clientResult, 'Ticket requesters could not be loaded.').map(row => [row.id, row]));
  const guards = new Map(rows(guardResult, 'Ticket requesters could not be loaded.').map(row => [row.id, row]));
  const jobs = new Map(rows(jobResult, 'Related support jobs could not be loaded.').map(row => [row.id, row]));
  return tickets.map(ticket => {
    const client = clients.get(ticket.client_id), guard = guards.get(ticket.guard_id);
    return { ...ticket,
      client_name: client?.company_name || client?.contact_name || 'Unknown client', client_email: client?.email || '',
      guard_name: guard?.full_name || null,
      requester_name: ticket.client_id ? client?.company_name || client?.contact_name || 'Unknown client' : guard?.full_name || 'Guard',
      requester_email: ticket.client_id ? client?.email || '' : guard?.email || '',
      job_title: jobs.get(ticket.related_job_id)?.job_title || null,
    };
  });
}
