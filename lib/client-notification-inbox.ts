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

export async function loadClientNotificationInbox(db: any, filters: InboxFilters): Promise<
  { redirect: string } |
  { userId: string; clientId: string; companyName: string; notifications: ClientNotification[] }
> {
  const auth = await db.auth.getUser();
  if (auth.error) throw new Error('Unable to verify your account.');
  const userId = auth.data?.user?.id;
  if (!userId) return { redirect: '/client/login' } as const;

  const client = await db.from('clients').select('id, company_name').eq('user_id', userId).maybeSingle();
  if (client.error) throw new Error('Unable to load your client profile.');
  if (client.data === null) return { redirect: '/client/complete-profile-wizard' } as const;
  if (!client.data?.id) throw new Error('Unable to load your client profile.');

  let query = db.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (filters.category !== 'all') query = query.eq('category', filters.category);
  if (filters.priority !== 'all') query = query.eq('priority', Number(filters.priority));
  if (filters.status !== 'all') query = query.eq('is_read', filters.status === 'read');
  // Quote the whole PostgREST value so punctuation in a search cannot become filter syntax.
  if (filters.search.trim()) {
    const value = JSON.stringify(`%${filters.search.trim()}%`);
    query = query.or(`title.ilike.${value},message.ilike.${value}`);
  }
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59.999');
  const result = await query.limit(100);
  if (result.error || !Array.isArray(result.data)) throw new Error('Unable to load notifications.');
  return {
    userId,
    clientId: client.data.id as string,
    companyName: (client.data.company_name || 'Client') as string,
    notifications: result.data as ClientNotification[],
  };
}

export async function changeClientNotifications(db: any, userId: string, ids: string[], action: InboxAction) {
  const requested = [...new Set(ids)];
  if (!userId || requested.length === 0) throw new Error('No notifications selected.');
  const auth = await db.auth.getUser();
  if (auth.error || auth.data?.user?.id !== userId) throw new Error('Unable to verify the notification owner.');
  const table = db.from('notifications');
  const isRead = action === 'mark_read';
  const query = action === 'delete' ? table.delete() : table.update({ is_read: isRead, read: isRead });
  const result = await query.eq('user_id', userId).in('id', requested).select('id, user_id, is_read, read');
  if (result.error || !Array.isArray(result.data)) throw new Error('Notification changes could not be confirmed.');
  const confirmedIds = result.data.filter((row: any) =>
    row.user_id === userId && requested.includes(row.id) &&
    (action === 'delete' || (row.is_read === isRead && row.read === isRead)),
  ).map((row: any) => row.id as string);
  return { confirmedIds, complete: requested.every(id => confirmedIds.includes(id)) };
}
