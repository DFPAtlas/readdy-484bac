type NotificationSource = { type?: string | null; category?: string | null; title?: string | null };
const aliases: Record<string, string> = {
  payment: 'payment', payout: 'payment', payout_sent: 'payment', payout_paid: 'payment', client_approved: 'payment',
  payment_received: 'payment', payment_released: 'payment', refund: 'payment',
  job_match: 'job_match', job_offer: 'job_offer', application_update: 'application_update',
  application_submitted: 'application_update', verification: 'verification', message: 'message',
};

/** Modern semantic types win; only legacy presentation types use known titles. */
export function guardNotificationCategory(notification: NotificationSource): string {
  const type = (notification.type || '').toLowerCase();
  const category = (notification.category || '').toLowerCase();
  if (aliases[category]) return aliases[category];
  if (aliases[type]) return aliases[type];
  if (!['', 'info', 'success', 'warning', 'error', 'notification'].includes(type)) return type;
  const title = (notification.title || '').trim();
  if (/^(payout (sent|paid|failed|pending)|client approved|payment (received|released|failed|successful|pending)|funds released|refund (issued|processed))\b/i.test(title)) return 'payment';
  if (/^application (submitted|selected|accepted|declined|rejected|reviewed|update)\b/i.test(title)) return 'application_update';
  if (/^(sia |licen[cs]e |verification )/i.test(title)) return 'verification';
  if (/^new (job match|matching job)\b/i.test(title)) return 'job_match';
  if (/^(new message|message from)\b/i.test(title)) return 'message';
  return type || 'notification';
}
