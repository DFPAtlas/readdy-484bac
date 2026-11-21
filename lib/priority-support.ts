export { HUMAN_SUPPORT_HOURS } from './customer-guidance';
export function humanSupportAvailable(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const day = parts.find(part => part.type === 'weekday')?.value;const hour = Number(parts.find(part => part.type === 'hour')?.value);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(day || '') && hour >= 8 && hour < 17;
}
interface QueueTicket { id: string; priority: string; support_tier?: string; created_at: string; status?: string; }
export function sortSupportQueue<T extends QueueTicket>(tickets: T[]): T[] {
  const rank: Record<string, number> = { urgent: 0, high: 1, normal: 2, medium: 2, low: 3 };
  return [...tickets].sort((a, b) => (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2)
    || Number(b.support_tier === 'priority') - Number(a.support_tier === 'priority')
    || String(a.created_at || '').localeCompare(String(b.created_at || '')) || a.id.localeCompare(b.id));
}
