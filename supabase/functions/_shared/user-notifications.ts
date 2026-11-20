/** Service-only canonical writer. Stable source keys make uncertain retries safe. */
export async function persistUserNotifications(db: any, eventKey: string, notifications: any[]) {
  const ids: (string | null)[] = [];
  for (const notification of notifications) {
    if (!notification.user_id) throw new Error('Notification recipient is missing');
    const { data, error } = await db.rpc('emit_user_notification', {
      p_event_key: `${eventKey}:${notification.user_id}`, p_user_id: notification.user_id,
      p_type: notification.type || notification.category || 'general', p_title: notification.title,
      p_message: notification.message, p_link: notification.link || null,
      p_category: notification.category || null, p_priority: notification.priority ?? 1,
      p_data: { ...(notification.data || {}), ...(notification.related_id ? { job_id: notification.related_id } : {}) },
    });
    if (error || (data !== null && (typeof data !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)))) throw new Error('Notification write was not confirmed');
    ids.push(data);
  }
  return ids;
}
