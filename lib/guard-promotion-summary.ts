import { supabase } from '@/lib/supabase';

export interface GuardPromotionSummary {
  configured: true;
  isPaused: boolean;
  tier1Cap: number;
  tier2Cap: number;
  tier3Cap: number;
  tier1Remaining: number;
  tier2Remaining: number;
  tier3Active: boolean;
  tier3EndsAt: string;
}

export async function loadGuardPromotionSummary(): Promise<GuardPromotionSummary> {
  const { data, error } = await supabase.rpc('get_guard_promotion_summary');
  const counts = ['tier1Cap', 'tier2Cap', 'tier3Cap', 'tier1Remaining', 'tier2Remaining'];
  if (error || data?.configured !== true || counts.some(key => !Number.isSafeInteger(data[key]) || data[key] < 0)
    || typeof data.isPaused !== 'boolean' || typeof data.tier3Active !== 'boolean' || !Number.isFinite(Date.parse(data.tier3EndsAt))) {
    throw new Error('Promotion availability could not be confirmed');
  }
  return data as GuardPromotionSummary;
}
