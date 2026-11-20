export const CLIENT_ALERT_KEYS = ['new_applicants', 'guard_confirmations', 'payment_updates', 'job_reminders', 'support_tickets', 'messages', 'in_app_alerts', 'sms_notifications'] as const;
export const CLIENT_EMAIL_FREQUENCIES = ['instant', 'daily', 'weekly', 'none'] as const;
export type ClientNotificationPreferences = Record<typeof CLIENT_ALERT_KEYS[number], boolean> & { email_frequency: string };
export const CLIENT_NOTIFICATION_DEFAULTS: ClientNotificationPreferences = {
  new_applicants: true, guard_confirmations: true, payment_updates: true, job_reminders: true,
  support_tickets: true, messages: true, in_app_alerts: true, sms_notifications: false, email_frequency: 'instant',
};
export const CLIENT_NOTIFICATION_FIELDS = `id, user_id, ${CLIENT_ALERT_KEYS.join(', ')}, email_frequency`;
export interface ClientNotificationSnapshot { exists: boolean; preferences: ClientNotificationPreferences; }
export class ClientNotificationError extends Error {}
const loadFailure = 'Notification preferences could not be loaded. Please retry before making changes.';
const saveFailure = 'The save could not be confirmed. Your choices are kept; retry or reload saved preferences.';
function live(current: () => boolean) { if (!current()) throw new ClientNotificationError('Preference request retired.'); }
function values(input: any, fromStorage = false): ClientNotificationPreferences {
  if (!input || typeof input !== 'object') throw new ClientNotificationError(loadFailure);
  const result = { ...CLIENT_NOTIFICATION_DEFAULTS };
  for (const key of CLIENT_ALERT_KEYS) {
    const value = input[key];
    if (typeof value === 'boolean') result[key] = value;
    else if (!fromStorage || value != null) throw new ClientNotificationError('Review the alert choices before saving.');
  }
  // Older client UI wrote "immediate". Display it as Immediate, but persist
  // the same "instant" value used by the existing email services/guard UI.
  const frequency = fromStorage && input.email_frequency === 'immediate' ? 'instant' : input.email_frequency;
  result.email_frequency = fromStorage && frequency == null ? 'instant' : frequency;
  if (!CLIENT_EMAIL_FREQUENCIES.includes(result.email_frequency as typeof CLIENT_EMAIL_FREQUENCIES[number])) throw new ClientNotificationError('Email frequency could not be verified.');
  return result;
}
async function owner(db: any, clientId: string, userId: string, current: () => boolean) {
  live(current);
  const auth = await db.auth.getUser(); live(current);
  if (auth.error || !userId || auth.data?.user?.id !== userId) throw new ClientNotificationError('Sign in again to manage your preferences.');
  const result = await db.from('clients').select('id, user_id, is_active').eq('id', clientId).eq('user_id', userId).maybeSingle(); live(current);
  if (result.error || !result.data || result.data.id !== clientId || result.data.user_id !== userId || result.data.is_active === false) throw new ClientNotificationError('Your company preferences are unavailable.');
}
async function sameUser(db: any, userId: string, current: () => boolean) {
  live(current); const auth = await db.auth.getUser(); live(current);
  if (auth.error || auth.data?.user?.id !== userId) throw new ClientNotificationError('Your session changed. Reload preferences before retrying.');
}
function row(data: any, userId: string) {
  if (!data || typeof data.id !== 'string' || !data.id || data.user_id !== userId) throw new ClientNotificationError(loadFailure);
  return { id: data.id, preferences: values(data, true) };
}
async function read(db: any, userId: string, current: () => boolean) {
  const result = await db.from('notification_preferences').select(CLIENT_NOTIFICATION_FIELDS).eq('user_id', userId).maybeSingle(); live(current);
  if (result.error || result.data === undefined) throw new ClientNotificationError(loadFailure);
  return result.data === null ? null : row(result.data, userId);
}
export async function loadClientNotificationPreferences(db: any, clientId: string, userId: string, current = () => true): Promise<ClientNotificationSnapshot> {
  await owner(db, clientId, userId, current);
  const saved = await read(db, userId, current);
  await sameUser(db, userId, current);
  return { exists: saved !== null, preferences: saved?.preferences || { ...CLIENT_NOTIFICATION_DEFAULTS } };
}
export async function saveClientNotificationPreferences(db: any, clientId: string, userId: string, input: ClientNotificationPreferences, current = () => true): Promise<ClientNotificationSnapshot> {
  const submitted = values(input);
  await owner(db, clientId, userId, current);
  // An errored lookup must never become an insert/default overwrite. The
  // explicit update payload excludes guard-only and digest bookkeeping fields.
  const existing = await read(db, userId, current); live(current);
  const payload = { ...submitted, updated_at: new Date().toISOString() };
  const query = existing ? db.from('notification_preferences').update(payload).eq('id', existing.id).eq('user_id', userId)
    : db.from('notification_preferences').insert({ user_id: userId, ...payload });
  const result = await query.select(CLIENT_NOTIFICATION_FIELDS).maybeSingle(); live(current);
  if (!existing && result.error?.code === '23505') {
    const replay = await read(db, userId, current);
    if (!replay || Object.entries(submitted).some(([key, value]) => replay.preferences[key as keyof ClientNotificationPreferences] !== value)) throw new ClientNotificationError(saveFailure);
    await sameUser(db, userId, current); return { exists: true, preferences: replay.preferences };
  }
  if (result.error || !result.data) throw new ClientNotificationError(saveFailure);
  const saved = row(result.data, userId);
  if ((existing && saved.id !== existing.id) || Object.entries(submitted).some(([key, value]) => saved.preferences[key as keyof ClientNotificationPreferences] !== value)) throw new ClientNotificationError(saveFailure);
  await sameUser(db, userId, current);
  return { exists: true, preferences: saved.preferences };
}
