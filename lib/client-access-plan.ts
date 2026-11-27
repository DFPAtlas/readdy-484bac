import { supabase } from './supabase';
import { getUserEntitlements } from './entitlements';
import { planLabel } from './client-journey';

export type ClientAccessStatus = 'loading' | 'ready' | 'inactive' | 'unavailable';

export interface ClientAccessPlan {
  status: ClientAccessStatus;
  planName: string | null;
  planSlug: string | null;
}

export const CLIENT_ACCESS_LOADING: ClientAccessPlan = {
  status: 'loading',
  planName: null,
  planSlug: null,
};

export function stripAccessPrefix(value?: string | null): string {
  return (value || '').replace(/^\s*access\s*:\s*/i, '').trim();
}

export function clientAccessUnavailable(): ClientAccessPlan {
  return { status: 'unavailable', planName: null, planSlug: null };
}

export function clientAccessLabel(plan?: ClientAccessPlan | null): string {
  if (!plan) return 'Access: Loading…';
  if (plan.status === 'loading') return 'Access: Loading…';
  if (plan.status === 'inactive') return 'Access: Inactive';
  if (plan.status === 'ready') {
    const name = stripAccessPrefix(plan.planName) || stripAccessPrefix(plan.planSlug);
    if (!name) return 'Access: Unavailable';
    return `Access: ${planLabel(name)}`;
  }
  return 'Access: Unavailable';
}

export async function resolveClientAccessPlan(
  suppliedUserId?: string | null
): Promise<ClientAccessPlan> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return clientAccessUnavailable();
    const authUserId = data?.user?.id;
    if (!authUserId) return clientAccessUnavailable();
    if (suppliedUserId && suppliedUserId !== authUserId) return clientAccessUnavailable();

    const entitlement = await getUserEntitlements(authUserId);
    if (!entitlement || entitlement.user_id !== authUserId) return clientAccessUnavailable();

    const audience = typeof entitlement.audience === 'string'
      ? entitlement.audience.trim().toLowerCase()
      : '';
    if (audience !== 'client') return clientAccessUnavailable();

    const isActive = (entitlement as { is_active?: unknown }).is_active;
    if (isActive !== true && isActive !== false) return clientAccessUnavailable();

    const planName = typeof entitlement.plan_name === 'string'
      ? stripAccessPrefix(entitlement.plan_name) || null
      : null;
    const planSlug = typeof entitlement.plan_slug === 'string'
      ? stripAccessPrefix(entitlement.plan_slug) || null
      : null;
    if (isActive && !planName && !planSlug) return clientAccessUnavailable();

    const { data: confirmed, error: confirmError } = await supabase.auth.getUser();
    if (confirmError) return clientAccessUnavailable();
    if (confirmed?.user?.id !== authUserId) return clientAccessUnavailable();

    if (!isActive) return { status: 'inactive', planName, planSlug };
    return { status: 'ready', planName, planSlug };
  } catch {
    return clientAccessUnavailable();
  }
}