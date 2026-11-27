// Billing records describe a subscription; entitlements describe effective access.
// They may deliberately differ (for example a separately granted QA allowance).
export interface ClientAccessPlan {
  plan_slug: string;
  plan_name: string;
  is_active?: boolean;
  is_free_tier?: boolean;
  subscription_status?: string;
  current_period_end?: string;
}

export interface ClientBillingPlan {
  plan_slug: string;
  plan_name?: string | null;
  status?: string | null;
  plan_amount?: number | null;
  currency?: string | null;
  billing_cycle?: string | null;
  billing_interval?: string | null;
  stripe_subscription_id?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
}

interface Plan {
  slug: string;
  name: string;
  monthly_price_pence: number;
}

export function clientPlanPresentation(access: ClientAccessPlan | null, billing: ClientBillingPlan | null, plans: Plan[]) {
  const differs = Boolean(access?.plan_slug && billing?.plan_slug && access.plan_slug !== billing.plan_slug);
  const catalogue = plans.find(plan => plan.slug === billing?.plan_slug);
  const cycle = billing?.billing_cycle || billing?.billing_interval;
  const unit = cycle === 'annual' || cycle === 'yearly' || cycle === 'year' ? 'year'
    : cycle === 'monthly' || cycle === 'month' ? 'month' : null;
  const amount = billing?.plan_amount;
  const priceLabel = typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0
    && billing?.currency && /^[a-z]{3}$/i.test(billing.currency) && unit
    ? `${new Intl.NumberFormat('en-GB', { style: 'currency', currency: billing.currency.toUpperCase() }).format(amount / 100)}/${unit}`
    : 'Subscription price unavailable';
  const subscription = billing ? {
    plan_slug: billing.plan_slug,
    plan_name: billing.plan_name || catalogue?.name || 'Subscription plan unavailable',
    status: billing.status || 'unknown',
    current_period_end: billing.current_period_end || '',
    cancel_at_period_end: billing.cancel_at_period_end === true,
    // Used only for catalogue comparisons, never as a substitute invoice amount.
    monthly_price_pence: catalogue?.monthly_price_pence ?? 0,
    stripe_subscription_id: billing.stripe_subscription_id || null,
    priceLabel,
  } : access?.is_free_tier ? {
    plan_slug: access.plan_slug,
    plan_name: access.plan_name,
    status: access.subscription_status || 'unknown',
    current_period_end: access.current_period_end || '',
    cancel_at_period_end: false,
    monthly_price_pence: 0,
    stripe_subscription_id: null,
    priceLabel: 'Free',
  } : null;
  return {
    subscription,
    differs,
    accessName: access?.plan_name || access?.plan_slug || 'Unavailable',
    // A mismatched/unknown access record cannot justify selling a missing feature.
    canRecommendPlanChange: Boolean(access?.is_active && catalogue && access.plan_slug === billing?.plan_slug),
  };
}
