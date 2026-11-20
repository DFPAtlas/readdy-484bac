export interface ClientNotification {
  id: string;
  title: string;
  message: string;
  category: string;
  type: string;
  priority: number;
  is_read: boolean;
  created_at: string;
  link: string | null;
  data: { job_title?: string } | null;
  read: boolean;
}

export interface InboxFilters {
  category: string;
  priority: string;
  status: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

export type InboxAction = 'mark_read' | 'mark_unread' | 'delete';

async function verifyNotificationOwner(db: any, userId: string) {
  const auth = await db.auth.getUser();
  if (auth.error || auth.data?.user?.id !== userId) throw new Error('Unable to verify the notification owner.');
}

export async function loadClientNotificationInbox(db: any, filters: InboxFilters, expectedUserId?: string, current = () => true): Promise<
  { redirect: string } |
  { userId: string; clientId: string; companyName: string; notifications: ClientNotification[] }
> {
  const live = () => { if (!current()) throw new Error('Notification request retired.'); };
  live();
  const auth = await db.auth.getUser();
  live();
  if (auth.error) throw new Error('Unable to verify your account.');
  const userId = auth.data?.user?.id;
  if (!userId) return { redirect: '/client/login' } as const;
  if (expectedUserId && expectedUserId !== userId) throw new Error('Unable to verify the notification owner.');

  const client = await db.from('clients').select('id, company_name').eq('user_id', userId).maybeSingle();
  live();
  await verifyNotificationOwner(db, userId);
  live();
  if (client.error) throw new Error('Unable to load your client profile.');
  if (client.data === null) return { redirect: '/client/complete-profile-wizard' } as const;
  if (!client.data?.id) throw new Error('Unable to load your client profile.');

  const notifications: ClientNotification[] = [];
  const seen = new Set<string>();
  let total: number | undefined;
  while (true) {
    live();
    let query = db.from('notifications').select('*', { count: 'exact' }).eq('user_id', userId)
      .order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false });
    if (filters.category !== 'all') query = query.eq('category', filters.category);
    if (filters.priority !== 'all') query = query.eq('priority', Number(filters.priority));
    if (filters.status !== 'all') query = query.eq('is_read', filters.status === 'read');
    // Quote the whole PostgREST value so punctuation cannot become filter syntax.
    if (filters.search.trim()) {
      const value = JSON.stringify(`%${filters.search.trim()}%`);
      query = query.or(`title.ilike.${value},message.ilike.${value}`);
    }
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59.999');
    const result = await query.range(notifications.length, notifications.length + 99);
    live();
    await verifyNotificationOwner(db, userId);
    live();
    if (result.error || !Array.isArray(result.data) || result.data.length > 100 ||
        !Number.isSafeInteger(result.count) || result.count < 0 || (total !== undefined && result.count !== total)) {
      throw new Error('Unable to load complete notifications.');
    }
    total = result.count as number;
    for (const row of result.data) {
      if (!row || typeof row.id !== 'string' || !row.id || row.user_id !== userId || seen.has(row.id)) {
        throw new Error('Unable to verify notification history.');
      }
      seen.add(row.id);
      notifications.push(row);
    }
    if (notifications.length === total) break;
    if (notifications.length > total || result.data.length === 0) throw new Error('Unable to load complete notifications.');
  }
  return {
    userId,
    clientId: client.data.id as string,
    companyName: (client.data.company_name || 'Client') as string,
    notifications,
  };
}

export async function changeClientNotifications(db: any, userId: string, ids: string[], action: InboxAction) {
  const requested = [...new Set(ids)];
  if (!userId || requested.length === 0) throw new Error('No notifications selected.');
  await verifyNotificationOwner(db, userId);
  const table = db.from('notifications');
  const isRead = action === 'mark_read';
  const query = action === 'delete' ? table.delete() : table.update({ is_read: isRead, read: isRead });
  const result = await query.eq('user_id', userId).in('id', requested).select('id, user_id, is_read, read');
  if (result.error || !Array.isArray(result.data)) throw new Error('Notification changes could not be confirmed.');
  await verifyNotificationOwner(db, userId);
  const confirmedIds = result.data.filter((row: any) =>
    row.user_id === userId && requested.includes(row.id) &&
    (action === 'delete' || (row.is_read === isRead && row.read === isRead)),
  ).map((row: any) => row.id as string);
  return { confirmedIds, complete: requested.every(id => confirmedIds.includes(id)) };
}
