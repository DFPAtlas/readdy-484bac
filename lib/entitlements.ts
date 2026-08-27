import { supabase } from './supabase';

export interface Entitlement {
  user_id: string;
  plan_slug: string;
  plan_name: string;
  audience: string;
  features: string[];
  monthly_price_pence: number;
  subscription_status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  is_active: boolean;
  is_free_tier: boolean;
  stripe_subscription_id: string | null;
}

export type GuardFeatureKey =
  | 'guard.apply_job'
  | 'guard.view_jobs'
  | 'guard.create_profile'
  | 'guard.priority_profile'
  | 'guard.profile_boost'
  | 'guard.advanced_alerts'
  | 'guard.performance_analytics'
  | 'guard.priority_support'
  | 'guard.direct_contact'
  | 'guard.unlimited_applications';

export type ClientFeatureKey =
  | 'client.post_job'
  | 'client.view_guard_profiles'
  | 'client.advanced_matching'
  | 'client.priority_support'
  | 'client.job_templates'
  | 'client.analytics_dashboard'
  | 'client.direct_contact'
  | 'client.unlimited_jobs'
  | 'client.bulk_posting'
  | 'client.multi_site'
  | 'client.team_access'
  | 'client.custom_contracts'
  | 'client.api_access'
  | 'client.escrow_payments'
  | 'client.job_history'
  | 'client.job_tracker';

export type FeatureKey = GuardFeatureKey | ClientFeatureKey;

export const CLIENT_FEATURE_KEYS: ClientFeatureKey[] = [
  'client.post_job',
  'client.advanced_matching',
  'client.view_guard_profiles',
  'client.priority_support',
  'client.job_templates',
  'client.analytics_dashboard',
  'client.direct_contact',
  'client.multi_site',
  'client.unlimited_jobs',
  'client.bulk_posting',
  'client.team_access',
  'client.custom_contracts',
  'client.api_access',
  'client.escrow_payments',
  'client.job_history',
  'client.job_tracker',
];

const entitlementCache = new Map<string, { data: Entitlement | null; ts: number }>();
const CACHE_TTL = 60_000;

export function clearEntitlementCache(userId?: string) {
  if (userId) {
    entitlementCache.delete(userId);
  } else {
    entitlementCache.clear();
  }
}

export async function getUserEntitlements(userId: string): Promise<Entitlement | null> {
  if (!userId) return null;

  const cached = entitlementCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const { data, error } = await supabase
    .from('user_entitlements_data')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[entitlements] getUserEntitlements query error:', error.message);
  }
  const result = (error || !data) ? null : (data as Entitlement);
  entitlementCache.set(userId, { data: result, ts: Date.now() });
  return result;
}

export async function hasFeature(userId: string, featureKey: FeatureKey): Promise<boolean> {
  if (!userId) return false;

  const ent = await getUserEntitlements(userId);
  let features: string[] = [];
  if (ent && ent.is_active) {
    features = ent.features || [];
  }

  if (features.length === 0) {
    try {
      const { data: clientRow } = await supabase
        .from('clients')
        .select('subscription_plan, plan_slug')
        .eq('user_id', userId)
        .maybeSingle();

      const planSlug = clientRow?.plan_slug || clientRow?.subscription_plan;
      if (planSlug) {
        const { data: plan } = await supabase
          .from('plans')
          .select('features')
          .eq('slug', planSlug)
          .eq('active', true)
          .maybeSingle();

        if (plan?.features && Array.isArray(plan.features)) {
          features = plan.features;
        }
      }
    } catch {}
  }

  if (features.includes(featureKey)) return true;

  const { data: teamConfig } = await supabase
    .schema('public')
    .from('team_member_configs')
    .select('admin_user_id, enabled_features')
    .eq('member_user_id', userId)
    .maybeSingle();

  if (teamConfig?.enabled_features && Array.isArray(teamConfig.enabled_features)) {
    if (teamConfig.enabled_features.includes(featureKey)) {
      const adminId = teamConfig.admin_user_id;
      if (adminId) {
        const adminEnt = await getUserEntitlements(adminId);
        if (adminEnt && adminEnt.is_active) {
          const adminFeatures: string[] = adminEnt.features || [];
          if (adminFeatures.includes(featureKey)) return true;
        }
      }
    }
  }

  return false;
}

export async function requireFeature(userId: string, featureKey: FeatureKey): Promise<void> {
  const ok = await hasFeature(userId, featureKey);
  if (!ok) {
    throw new MissingEntitlementError(featureKey);
  }
}

export class MissingEntitlementError extends Error {
  public featureKey: FeatureKey;
  constructor(featureKey: FeatureKey) {
    super(`Missing entitlement: ${featureKey}`);
    this.name = 'MissingEntitlementError';
    this.featureKey = featureKey;
  }
}

export async function getActivePlan(userId: string) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('user_entitlements_data')
    .select('plan_slug, plan_name, audience, features, subscription_status, current_period_end, is_active, is_free_tier')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function getUserAudience(userId: string): Promise<'client' | 'guard' | null> {
  const { data } = await supabase
    .from('users')
    .select('user_type')
    .eq('id', userId)
    .maybeSingle();

  const type = data?.user_type;
  if (type === 'client' || type === 'guard') return type;
  return null;
}

export async function getPlansForAudience(audience: 'client' | 'guard') {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('audience', audience)
    .eq('active', true)
    .order('monthly_price_pence', { ascending: true });

  if (error) return [];
  return data || [];
}

export async function ensureEntitlement(userId: string, audience?: 'guard' | 'client'): Promise<Entitlement | null> {
  if (!userId) return null;

  const existing = await getUserEntitlements(userId);
  if (existing) return existing;

  const resolvedAudience = audience || await getUserAudience(userId);
  if (!resolvedAudience) return null;

  const freeSlug = resolvedAudience === 'guard' ? 'guard_starter' : 'client_free';

  const { data: plan } = await supabase
    .from('plans')
    .select('slug, name, audience, features, monthly_price_pence')
    .eq('slug', freeSlug)
    .eq('active', true)
    .maybeSingle();

  if (!plan) return null;

  const { error: insertError } = await supabase
    .from('user_entitlements_data')
    .insert({
      user_id: userId,
      plan_slug: plan.slug,
      plan_name: plan.name,
      audience: plan.audience,
      features: plan.features,
      monthly_price_pence: plan.monthly_price_pence,
      subscription_status: 'active',
      current_period_end: null,
      cancel_at_period_end: false,
      stripe_subscription_id: null,
    });

  if (insertError) {
    console.warn('[auto-heal] Could not create entitlement for', userId, insertError.message);
    return null;
  }

  const newEnt = await getUserEntitlements(userId);
  clearEntitlementCache(userId);
  console.log('[auto-heal] Created missing entitlement for', userId, plan.slug);
  return newEnt;
}

export async function getAllClientFeatures(userId: string): Promise<Record<string, boolean>> {
  const ent = await getUserEntitlements(userId);
  return getAllClientFeaturesFromEntitlement(userId, ent);
}

export async function getAllClientFeaturesFromEntitlement(
  userId: string,
  ent: Entitlement | null
): Promise<Record<string, boolean>> {
  const flags: Record<string, boolean> = {};
  if (!userId) {
    for (const key of CLIENT_FEATURE_KEYS) flags[key] = false;
    return flags;
  }

  let entFeatures: string[] = [];

  if (ent && ent.is_active) {
    entFeatures = ent.features || [];
  }

  if (entFeatures.length === 0) {
    try {
      const { data: clientRow } = await supabase
        .from('clients')
        .select('subscription_plan, plan_slug')
        .eq('user_id', userId)
        .maybeSingle();

      const planSlug = clientRow?.plan_slug || clientRow?.subscription_plan;
      if (planSlug) {
        const { data: plan } = await supabase
          .from('plans')
          .select('features')
          .eq('slug', planSlug)
          .eq('active', true)
          .maybeSingle();

        if (plan?.features && Array.isArray(plan.features)) {
          entFeatures = plan.features;
        }
      }
    } catch {}
  }

  let teamFeatures: string[] = [];
  try {
    const { data: teamConfig } = await supabase
      .schema('public')
      .from('team_member_configs')
      .select('admin_user_id, enabled_features')
      .eq('member_user_id', userId)
      .maybeSingle();

    if (teamConfig?.enabled_features && Array.isArray(teamConfig.enabled_features)) {
      const adminId = teamConfig.admin_user_id;
      if (adminId) {
        const adminEnt = await getUserEntitlements(adminId);
        if (adminEnt && adminEnt.is_active) {
          teamFeatures = adminEnt.features || [];
        }
      }
    }
  } catch {}

  for (const key of CLIENT_FEATURE_KEYS) {
    if (entFeatures.includes(key)) {
      flags[key] = true;
    } else if (teamFeatures.includes(key)) {
      flags[key] = true;
    } else {
      flags[key] = false;
    }
  }

  return flags;
}