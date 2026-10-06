// Subscription -> profile synchronisation (finding 8).
// app.guards and app.clients do not share a schema: only clients has
// subscription_tier. Writing a column a table lacks makes PostgREST reject the
// whole update (PGRST204), which silently left guard profiles unsynchronised.
// Build every profile update through this module so each account type only
// receives columns it actually has.

export type AccountType = 'guard' | 'client';

// Live schema, verified against app.guards / app.clients on 2026-10-05.
export const PROFILE_SUBSCRIPTION_COLUMNS: Record<AccountType, readonly string[]> = {
  guard: ['subscription_status', 'subscription_plan', 'plan_slug', 'plan_name', 'stripe_customer_id', 'stripe_subscription_id', 'current_period_end', 'profile_completed', 'onboarding_status', 'updated_at'],
  client: ['subscription_status', 'subscription_plan', 'subscription_tier', 'plan_slug', 'plan_name', 'stripe_customer_id', 'stripe_subscription_id', 'current_period_end', 'profile_completed', 'onboarding_status', 'updated_at'],
};

export function profileTable(accountType: AccountType): 'guards' | 'clients' {
  return accountType === 'guard' ? 'guards' : 'clients';
}

export function normaliseAccountType(value: unknown): AccountType | null {
  return value === 'guard' || value === 'client' ? value : null;
}

export interface ProfileSubscriptionFields {
  status?: string | null;
  planSlug?: string | null;
  planName?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  currentPeriodEnd?: string | null;
  activateProfile?: boolean;
  now?: string;
}

export function subscriptionProfileUpdate(accountType: AccountType, fields: ProfileSubscriptionFields): Record<string, unknown> {
  const update: Record<string, unknown> = { updated_at: fields.now || new Date().toISOString() };
  if (fields.status) update.subscription_status = fields.status;
  if (fields.planSlug) {
    update.subscription_plan = fields.planSlug;
    update.subscription_tier = fields.planSlug; // client-only column; filtered below for guards
    update.plan_slug = fields.planSlug;
    if (fields.planName) update.plan_name = fields.planName;
  }
  if (fields.customerId) update.stripe_customer_id = fields.customerId;
  if (fields.subscriptionId) update.stripe_subscription_id = fields.subscriptionId;
  if (fields.currentPeriodEnd) update.current_period_end = fields.currentPeriodEnd;
  if (fields.activateProfile) { update.profile_completed = true; update.onboarding_status = 'active'; }
  const allowed = new Set(PROFILE_SUBSCRIPTION_COLUMNS[accountType]);
  return Object.fromEntries(Object.entries(update).filter(([key]) => allowed.has(key)));
}

/** Throw on any write error so the caller returns a genuine failure (and Stripe retries). */
export async function requireWrite<T extends { error: unknown; data?: unknown }>(write: PromiseLike<T>, label: string, opts: { minRows?: number } = {}): Promise<T> {
  const result = await write;
  if (result.error) {
    const message = (result.error as any)?.message || String(result.error);
    throw new Error(`${label} failed: ${message}`);
  }
  if (opts.minRows !== undefined) {
    const rows = Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0;
    if (rows < opts.minRows) throw new Error(`${label} affected ${rows} row(s); expected at least ${opts.minRows}`);
  }
  return result;
}

/** Resolve a plan from a Stripe price id, monthly OR annual. */
export async function planForPrice(db: any, priceId: string | null | undefined) {
  if (!priceId) return null;
  if (!/^price_[A-Za-z0-9]+$/.test(priceId)) throw new Error('Invalid Stripe price id');
  const { data, error } = await db.from('plans')
    .select('slug, name, monthly_price_pence, features, stripe_price_id, stripe_annual_price_id')
    .or(`stripe_price_id.eq.${priceId},stripe_annual_price_id.eq.${priceId}`)
    .limit(2);
  if (error) throw new Error(`Plan lookup failed: ${error.message}`);
  if (!data?.length) return null;
  if (data.length > 1) throw new Error(`Stripe price ${priceId} matches more than one plan`);
  const plan = data[0];
  return { ...plan, billingCycle: plan.stripe_annual_price_id === priceId ? 'annual' : 'monthly' };
}
