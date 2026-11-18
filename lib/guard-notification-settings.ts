export interface NotificationPreferences {
  job_matches: boolean;
  application_updates: boolean;
  payment_notifications: boolean;
  messages: boolean;
  sia_reminders: boolean;
  email_frequency: string;
}

export interface GuardMatchPreferences {
  max_distance_miles: number;
  min_hourly_rate: number;
}

const alertKeys = ['job_matches', 'application_updates', 'payment_notifications', 'messages', 'sia_reminders'] as const;
const frequencies = ['instant', 'daily', 'weekly', 'none'];
const loadFailure = 'Your notification settings could not be loaded. Please retry before making changes.';

export async function loadGuardNotificationSettings(db: any) {
  const auth = await db.auth.getUser();
  if (auth.error) throw new Error(loadFailure);
  const userId = auth.data?.user?.id;
  if (!userId) return null;
  const [notificationResult, guardResult] = await Promise.all([
    db.from('notification_preferences')
      .select('user_id, job_matches, application_updates, payment_notifications, messages, sia_reminders, email_frequency, last_digest_sent_at, last_weekly_digest_sent_at')
      .eq('user_id', userId).maybeSingle(),
    db.from('guards').select('user_id, full_name, max_distance_miles, min_hourly_rate').eq('user_id', userId).maybeSingle(),
  ]);
  const row = notificationResult.data;
  const guard = guardResult.data;
  if (notificationResult.error || guardResult.error || !guard || guard.user_id !== userId ||
      (row !== null && (!row || row.user_id !== userId))) throw new Error(loadFailure);

  const preferences: NotificationPreferences = {
    job_matches: row?.job_matches ?? true,
    application_updates: row?.application_updates ?? true,
    payment_notifications: row?.payment_notifications ?? true,
    messages: row?.messages ?? true,
    sia_reminders: row?.sia_reminders ?? true,
    email_frequency: row?.email_frequency ?? 'instant',
  };
  const guardPreferences: GuardMatchPreferences = {
    max_distance_miles: Number(guard.max_distance_miles ?? 25),
    min_hourly_rate: Number(guard.min_hourly_rate ?? 10),
  };
  if (alertKeys.some(key => typeof preferences[key] !== 'boolean') || !frequencies.includes(preferences.email_frequency) ||
      Object.values(guardPreferences).some(value => !Number.isFinite(value) || value < 0)) throw new Error(loadFailure);
  return {
    userId, preferences, guardPreferences,
    displayName: guard.full_name || 'Guard',
    lastDigestSent: row?.last_digest_sent_at ?? null,
    lastWeeklyDigestSent: row?.last_weekly_digest_sent_at ?? null,
  };
}

export async function saveGuardNotificationSettings(
  db: any, userId: string, preferences: NotificationPreferences, guardPreferences: GuardMatchPreferences,
) {
  let notificationsSaved = false;
  try {
    if (alertKeys.some(key => typeof preferences[key] !== 'boolean') || !frequencies.includes(preferences.email_frequency) ||
        Object.values(guardPreferences).some(value => !Number.isFinite(value) || value < 0)) {
      return { success: false, message: 'Review your settings and enter valid job-match filters before saving.' };
    }
    const auth = await db.auth.getUser();
    if (auth.error || auth.data?.user?.id !== userId) {
      return { success: false, message: 'Your account could not be verified. Reload preferences before saving.' };
    }
    const notificationResult = await db.from('notification_preferences')
      .upsert({ user_id: userId, ...preferences, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select('user_id').maybeSingle();
    if (notificationResult.error || notificationResult.data?.user_id !== userId) throw new Error('notification save not confirmed');
    notificationsSaved = true;
    const guardResult = await db.from('guards').update(guardPreferences).eq('user_id', userId).select('user_id').maybeSingle();
    if (guardResult.error || guardResult.data?.user_id !== userId) throw new Error('filter save not confirmed');
    return { success: true, message: 'Notification settings saved successfully!' };
  } catch {
    return {
      success: false,
      message: notificationsSaved
        ? 'Alert and email preferences were saved, but job-match filters could not be confirmed. Keep these settings and try Save again.'
        : 'Notification preferences could not be confirmed as saved. Reload preferences before retrying. Job-match filters were not changed.',
    };
  }
}
