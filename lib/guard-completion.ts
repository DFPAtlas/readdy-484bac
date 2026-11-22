import type { SupabaseClient } from '@supabase/supabase-js';
import { withRequestDeadline } from './request-deadline';

export async function submitGuardCompletion(
  client: Pick<SupabaseClient, 'auth' | 'functions'>,
  ownerUserId: string,
  assignmentId: string,
  jobId: string,
  isCurrent: () => boolean,
): Promise<string> {
  const before = await withRequestDeadline(client.auth.getUser());
  if (!isCurrent() || before.error || before.data.user?.id !== ownerUserId) throw new Error('Account unavailable');
  const result = await withRequestDeadline(client.functions.invoke('request-job-completion', {
    body: { assignmentId, jobId },
  }));
  const after = await withRequestDeadline(client.auth.getUser());
  if (!isCurrent() || after.error || after.data.user?.id !== ownerUserId || result.error) throw new Error('Completion not confirmed');
  const data: unknown = result.data;
  if (!data || typeof data !== 'object' || !('success' in data) || data.success !== true ||
      !('requestId' in data) || typeof data.requestId !== 'string' || !data.requestId.trim()) {
    throw new Error('Completion not confirmed');
  }
  return data.requestId;
}
