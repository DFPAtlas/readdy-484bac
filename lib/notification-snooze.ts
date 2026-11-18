export async function saveGuardNotificationSnooze(
  db: any, owner: string, id: string, until: string | null,
) {
  const timestamp = until === null ? null : Date.parse(until);
  if (!owner || !id || (until !== null && (typeof until !== 'string' || !Number.isFinite(timestamp) || timestamp! <= Date.now()))) {
    throw new Error('Choose a future snooze time.');
  }
  const auth = await db.auth.getUser();
  if (auth.error || auth.data?.user?.id !== owner) throw new Error('Unable to verify the notification owner.');
  const canonical = timestamp === null ? null : new Date(timestamp).toISOString();
  const result = await db.from('notifications').update({ snoozed_until: canonical })
    .eq('user_id', owner).eq('user_type', 'guard').eq('id', id)
    .select('id, user_id, snoozed_until').maybeSingle();
  const row = result.data;
  const matches = canonical === null
    ? row?.snoozed_until === null
    : typeof row?.snoozed_until === 'string' && Date.parse(row.snoozed_until) === timestamp;
  if (result.error || row?.id !== id || row?.user_id !== owner || !matches) {
    throw new Error('Snooze changes could not be confirmed.');
  }
  return { snoozedUntil: canonical };
}
