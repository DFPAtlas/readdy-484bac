import { supabase } from '@/lib/supabase';
import { cleanupTargetNames, isCleanupInventory, type CleanupInventory } from '@/lib/adminCleanupInventory';

export interface CleanupPreview {
  status: 'previewed'; request_id: string; expires_at: string; inventory: CleanupInventory;
}
export interface CleanupReceipt {
  status: 'completed'; request_id: string; completed_at: string; total_removed: number;
  results: { table_name: string; rows_removed: number; retention_days: number; cleanup_log_id: string }[];
}
export class CleanupResponseError extends Error {
  constructor(public readonly code: string) { super('Cleanup could not be confirmed. Check the saved request result.'); }
}
export type CleanupReply = CleanupPreview | CleanupReceipt | { status: 'preview_expired'; request_id: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
function isReply(v: unknown): v is CleanupReply {
  if (!isRecord(v) || typeof v.request_id !== 'string' || !uuid.test(v.request_id)) return false;
  if (v.status === 'preview_expired') return true;
  if (v.status === 'previewed') return typeof v.expires_at === 'string' &&
    Number.isFinite(Date.parse(v.expires_at)) && isCleanupInventory(v.inventory);
  if (v.status !== 'completed' || typeof v.completed_at !== 'string' || !Number.isFinite(Date.parse(v.completed_at)) ||
      !count(v.total_removed) || !Array.isArray(v.results) || v.results.length !== cleanupTargetNames.length) return false;
  const seen = new Set<string>(); const logs = new Set<string>(); let total = 0;
  for (const result of v.results) {
    if (!isRecord(result) || typeof result.table_name !== 'string' ||
      !cleanupTargetNames.some(name => name === result.table_name) || seen.has(result.table_name) ||
      !count(result.rows_removed) || !count(result.retention_days) || result.retention_days === 0 ||
      typeof result.cleanup_log_id !== 'string' || !uuid.test(result.cleanup_log_id) || logs.has(result.cleanup_log_id)) return false;
    seen.add(result.table_name); logs.add(result.cleanup_log_id); total += result.rows_removed;
  }
  return Number.isSafeInteger(total) && total === v.total_removed;
}

export async function requestAdminCleanup(action: 'preview' | 'execute' | 'status', requestId?: string, confirmed = false): Promise<CleanupReply> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token || !session.user?.id) throw new Error('Admin sign-in is required.');
  if (action !== 'preview' && (!requestId || !uuid.test(requestId))) throw new Error('A saved cleanup request is required.');
  if (action === 'execute' && confirmed !== true) throw new Error('Explicit confirmation is required.');
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-run-cleanup`, {
    method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...(action === 'preview' ? {} : { requestId }), ...(action === 'execute' ? { confirmed: true } : {}) }),
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  const data: unknown = await response.json();
  if (!response.ok) throw new CleanupResponseError(isRecord(data) && typeof data.code === 'string' ? data.code : 'UNCONFIRMED');
  if (!isReply(data) || (action !== 'preview' && data.request_id !== requestId) ||
      (action === 'preview' && data.status !== 'previewed') || (action === 'execute' && data.status !== 'completed')) {
    throw new Error('Cleanup could not be confirmed. Check the saved request result.');
  }
  const { data: current, error: currentError } = await supabase.auth.getSession();
  if (currentError || current.session?.user?.id !== session.user.id) throw new Error('Admin session changed. Check the saved request after signing in.');
  return data;
}
