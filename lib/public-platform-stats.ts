import type { SupabaseClient } from '@supabase/supabase-js';

export interface PublicPlatformStats {
  totalGuards: number | null;
  completedJobs: number | null;
  activeClients: number | null;
  successRate: number | null;
}

export const EMPTY_PUBLIC_PLATFORM_STATS: PublicPlatformStats = {
  totalGuards: null,
  completedJobs: null,
  activeClients: null,
  successRate: null,
};

// These are explicitly published metrics, not counts of private account rows.
const PUBLIC_STAT_KEYS = {
  total_guard_profiles: 'totalGuards',
  total_completed_jobs: 'completedJobs',
  total_active_clients: 'activeClients',
  completed_assignment_rate: 'successRate',
} as const;

export async function loadPublicPlatformStats(
  client: Pick<SupabaseClient, 'from'>,
): Promise<PublicPlatformStats> {
  const { data, error } = await client.from('qg_launch_public_stats')
    .select('key,value')
    .eq('is_public', true)
    .in('key', Object.keys(PUBLIC_STAT_KEYS));
  if (error || !Array.isArray(data)) throw new Error('Public statistics could not be loaded');

  const result = { ...EMPTY_PUBLIC_PLATFORM_STATS };
  for (const row of data) {
    if (!row || typeof row.key !== 'string' || typeof row.value !== 'number'
      || !Number.isFinite(row.value) || row.value < 0) continue;
    const entry = Object.entries(PUBLIC_STAT_KEYS).find(([key]) => key === row.key);
    if (!entry) continue;
    const field = entry[1];
    if (field === 'successRate' ? row.value > 100 : !Number.isSafeInteger(row.value)) continue;
    result[field] = row.value;
  }
  return result;
}
