import { supabase } from '@/lib/supabase';

export const cleanupTargetNames = ['email_send_log', 'admin_registration_audit', 'email_queue',
  'rate_limit_events', 'notifications', 'processed_stripe_events'] as const;
type TargetName = typeof cleanupTargetNames[number];
export interface CleanupInventoryTarget {
  table_name: TargetName;
  target_relation: string;
  relation_type: 'table' | 'view';
  retention_days: number;
  total_rows: number;
  eligible_rows: number;
}
export interface CleanupInventory {
  sampled_at: string;
  targets: CleanupInventoryTarget[];
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function isCleanupInventory(value: unknown): value is CleanupInventory {
  if (!isRecord(value) || typeof value.sampled_at !== 'string' || !Array.isArray(value.targets) ||
      value.targets.length !== cleanupTargetNames.length) return false;
  const age = Date.now() - Date.parse(value.sampled_at);
  if (!Number.isFinite(age) || age < -30000 || age > 5 * 60 * 1000) return false;
  const seen = new Set<string>();
  for (const target of value.targets) {
    if (!isRecord(target) || typeof target.table_name !== 'string' ||
        !cleanupTargetNames.some(name => name === target.table_name) || seen.has(target.table_name) ||
        target.target_relation !== `public.${target.table_name}` ||
        (target.relation_type !== 'table' && target.relation_type !== 'view') ||
        !isCount(target.retention_days) || target.retention_days === 0 ||
        !isCount(target.total_rows) || !isCount(target.eligible_rows) ||
        target.eligible_rows > target.total_rows) return false;
    seen.add(target.table_name);
  }
  return true;
}

export async function loadAdminCleanupInventory(): Promise<CleanupInventory> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token || !session.user?.id) {
    throw new Error('Admin session expired. Sign in again.');
  }
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-system-status?section=cleanup-inventory`,
    { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
      signal: AbortSignal.timeout(10000) },
  );
  const data: unknown = await response.json();
  if (!response.ok || !isCleanupInventory(data)) throw new Error('Unable to verify cleanup inventory. Please retry.');
  const { data: current, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || current.session?.user?.id !== session.user.id) {
    throw new Error('Admin session changed. Please retry.');
  }
  return data;
}
