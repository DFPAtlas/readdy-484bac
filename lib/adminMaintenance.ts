import { supabase } from '@/lib/supabase';

export interface CleanupLog {
  id: string;
  table_name: string;
  rows_removed: number | null;
  retention_days: number | null;
  started_at: string;
  finished_at: string | null;
  status: string;
  error_message: string | null;
}

export async function loadAdminCleanupLogs(offset = 0, limit = 20) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Admin session expired. Sign in again.');
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-system-status?section=maintenance&cleanup_offset=${offset}&cleanup_limit=${limit}`,
    { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' },
  );
  const data: { error?: string; cleanup?: { logs: CleanupLog[] | null; total_count: number | null } } = await response.json();
  if (!response.ok || data.error || !Array.isArray(data.cleanup?.logs) ||
      typeof data.cleanup?.total_count !== 'number') {
    throw new Error('Unable to load cleanup activity. Please retry.');
  }
  return { logs: data.cleanup.logs, totalCount: data.cleanup.total_count };
}
