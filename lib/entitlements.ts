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

function normaliseFeatures(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((feature): feature is string => typeof feature === 'string');
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((feature): feature is string => typeof feature === 'string');
      }
    } catch {
      return [];
    }
  }

  return [];
}

function normalisePlanSlug(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value === 'free') return 'client_free';
  return value;
}

const entitlementCache = new Map<string, { data: Entitlement | null; ts: number }>();
const CACHE_TTL = 60_000;

// Team rights come from the caller-bound database function, never a cached
// owner's private entitlement. Check context again after asynchronous work.
async function sessionContextFor(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    const session = data.session;
    if (error || session?.user.id !== userId || !session.access_token) return null;
    // session_id survives normal token refresh but changes on a new sign-in.
    // This is a browser lifetime check, not JWT authorization (the RPC does that).
    try {
      const base64 = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const claim = JSON.parse(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)));
      if (typeof claim.session_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claim.session_id)) {
        return `${userId}:${claim.session_id}`;
      }
    } catch { /* Legacy/malformed claims use the full token as the context. */ }
    return session.access_token;
  } catch { return null; }
}

async function readMyTeamFeatures(): Promise<string[]> {
  try {
    const { data, error } = await supabase.schema('app').rpc('get_my_team_features');
    if (error || !Array.isArray(data)) return [];
    return [...new Set(data.filter((key): key is ClientFeatureKey =>
      typeof key === 'string' && CLIENT_FEATURE_KEYS.includes(key as ClientFeatureKey)))];
  } catch { return []; }
}

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
  const token = await sessionContextFor(userId);
  if (!token) return false;

  const ent = await getUserEntitlements(userId);
  let features: string[] = [];
  if (ent?.user_id === userId && ent.is_active) {
    features = normaliseFeatures(ent.features);
  }

  if (features.length === 0) {
    try {
      const { data: clientRow } = await supabase
        .from('clients')
        .select('subscription_plan, plan_slug')
        .eq('user_id', userId)
        .maybeSingle();

      const planSlug = normalisePlanSlug(clientRow?.plan_slug || clientRow?.subscription_plan);
      if (planSlug) {
        const { data: plan } = await supabase
          .from('plans')
          .select('features')
          .eq('slug', planSlug)
          .eq('active', true)
          .maybeSingle();

        features = normaliseFeatures(plan?.features);
      }
    } catch {}
  }

  const own = features.includes(featureKey);
  const delegated = !own && featureKey.startsWith('client.')
    && (await readMyTeamFeatures()).includes(featureKey);
  return token === await sessionContextFor(userId) && (own || delegated);
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

export async function ensureEntitlement(userId: string, _audience?: 'guard' | 'client'): Promise<Entitlement | null> {
  void _audience;
  if (!userId) return null;

  const existing = await getUserEntitlements(userId);
  if (existing) return existing;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || user?.id !== userId) return null;

  const { data, error } = await supabase.rpc('ensure_my_free_entitlement');
  if (error) {
    console.warn('[auto-heal] Could not create free entitlement:', error.message);
    return null;
  }

  clearEntitlementCache(userId);
  const entitlement = Array.isArray(data) ? data[0] : null;
  return entitlement ? (entitlement as Entitlement) : null;
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
  const token = userId ? await sessionContextFor(userId) : null;
  if (!token) {
    for (const key of CLIENT_FEATURE_KEYS) flags[key] = false;
    return flags;
  }

  let entFeatures: string[] = [];

  if (ent?.user_id === userId && ent.is_active) {
    entFeatures = normaliseFeatures(ent.features);
  }

  if (entFeatures.length === 0) {
    try {
      const { data: clientRow } = await supabase
        .from('clients')
        .select('subscription_plan, plan_slug')
        .eq('user_id', userId)
        .maybeSingle();

      const planSlug = normalisePlanSlug(clientRow?.plan_slug || clientRow?.subscription_plan);
      if (planSlug) {
        const { data: plan } = await supabase
          .from('plans')
          .select('features')
          .eq('slug', planSlug)
          .eq('active', true)
          .maybeSingle();

        entFeatures = normaliseFeatures(plan?.features);
      }
    } catch {}
  }

  const teamFeatures = await readMyTeamFeatures();
  const current = token === await sessionContextFor(userId);

  for (const key of CLIENT_FEATURE_KEYS) {
    if (!current) {
      flags[key] = false;
    } else if (entFeatures.includes(key)) {
      flags[key] = true;
    } else if (teamFeatures.includes(key)) {
      flags[key] = true;
    } else {
      flags[key] = false;
    }
  }

  return flags;
}
