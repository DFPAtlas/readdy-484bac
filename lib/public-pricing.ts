export const QUICKGUARD_TAX_NOTE = 'QuickGuard is not VAT registered. No VAT is added to QuickGuard subscription or booking-service fees.';

export type PricingAudience = 'client' | 'guard';

export interface PublicPricingPlan {
  slug: string;
  name: string;
  audience: PricingAudience;
  monthly_price_pence: number;
  stripe_price_id: string | null;
  stripe_annual_price_id: string | null;
  description: string;
  features: string[];
  job_limit_per_month: number | null;
  bookingFee?: number;
  bookingFeeFixedPence?: number;
}

export interface PublicPricing {
  plans: PublicPricingPlan[];
  feesError: boolean;
  retrievedAt: string;
}

export function normalisePlanFeatures(value: unknown): string[] {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return []; }
  }
  return Array.isArray(value) ? value.filter((feature): feature is string => typeof feature === 'string') : [];
}

function numeric(value: unknown): number {
  return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;
}

export function buildPublicPricing(planRows: unknown, feeRows: unknown, feesFailed = false): PublicPricing {
  if (!Array.isArray(planRows) || planRows.length === 0) throw new Error('Current membership prices could not be loaded.');
  const fees = new Map<string, { percent: number; fixed: number }>();
  const seenFees = new Set<string>();
  for (const row of Array.isArray(feeRows) && !feesFailed ? feeRows : []) {
    if (!row || typeof row.plan_slug !== 'string') continue;
    if (seenFees.has(row.plan_slug)) { fees.delete(row.plan_slug); continue; }
    seenFees.add(row.plan_slug);
    const percent = numeric(row.platform_fee_percent);
    const fixed = numeric(row.platform_fee_fixed_pence);
    if (Number.isFinite(percent) && percent >= 0 && percent <= 100 && Number.isSafeInteger(fixed) && fixed >= 0) {
      fees.set(row.plan_slug, { percent, fixed });
    }
  }
  const slugs = new Set<string>();
  const plans = planRows.filter(row => row?.active !== false && !(row?.audience === 'guard' && row.slug !== 'guard_starter')).map(row => {
    const monthly = numeric(row?.monthly_price_pence);
    const limit = row?.job_limit_per_month;
    if (!row || typeof row.slug !== 'string' || !row.slug || slugs.has(row.slug)
      || typeof row.name !== 'string' || !row.name || !['client', 'guard'].includes(row.audience)
      || !Number.isSafeInteger(monthly) || monthly < 0 || !Number.isSafeInteger(monthly * 10)
      || (limit !== null && (!Number.isSafeInteger(limit) || limit < 0))) {
      throw new Error('Current membership configuration could not be confirmed.');
    }
    slugs.add(row.slug);
    const fee = row.audience === 'client' ? fees.get(row.slug) : undefined;
    return {
      slug: row.slug, name: row.name, audience: row.audience as PricingAudience,
      monthly_price_pence: monthly,
      stripe_price_id: typeof row.stripe_price_id === 'string' && row.stripe_price_id ? row.stripe_price_id : null,
      stripe_annual_price_id: typeof row.stripe_annual_price_id === 'string' && row.stripe_annual_price_id ? row.stripe_annual_price_id : null,
      description: typeof row.description === 'string' ? row.description : '',
      features: normalisePlanFeatures(row.features), job_limit_per_month: row.audience === 'guard' ? null : limit,
      bookingFee: fee?.percent, bookingFeeFixedPence: fee?.fixed,
    };
  }).sort((a, b) => a.monthly_price_pence - b.monthly_price_pence || a.slug.localeCompare(b.slug));
  if (plans.length === 0) throw new Error('No active membership plans are available.');
  return { plans, feesError: feesFailed || plans.some(plan => plan.audience === 'client' && plan.bookingFee === undefined), retrievedAt: new Date().toISOString() };
}

export async function fetchPublicPricing(client: { from: (table: string) => any; rpc: (name: string) => any }): Promise<PublicPricing> {
  const [plans, fees] = await Promise.all([
    client.from('plans').select('slug,name,audience,monthly_price_pence,stripe_price_id,stripe_annual_price_id,description,features,job_limit_per_month,active')
      .eq('active', true).order('monthly_price_pence', { ascending: true }),
    client.rpc('get_public_client_pricing_fees'),
  ]);
  if (plans.error) throw new Error('Current membership prices could not be loaded.');
  return buildPublicPricing(plans.data, fees.data, !!fees.error);
}

export function subscriptionPrice(plan: Pick<PublicPricingPlan, 'monthly_price_pence' | 'stripe_annual_price_id'>, cycle: 'monthly' | 'annual') {
  const monthly = plan.monthly_price_pence;
  if (!Number.isSafeInteger(monthly) || monthly < 0 || !Number.isSafeInteger(monthly * 10)) return null;
  if (cycle === 'annual' && monthly > 0 && !plan.stripe_annual_price_id) return null;
  // The checkout price validator requires an annual price of ten monthly payments.
  const billedPence = cycle === 'annual' ? monthly * 10 : monthly;
  return { billedPence, monthlyEquivalentPence: cycle === 'annual' ? billedPence / 12 : monthly,
    savingPercent: cycle === 'annual' && monthly > 0 ? Math.round((1 - billedPence / (monthly * 12)) * 100) : 0 };
}

export function pricingMoney(pence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

export function bookingFeeText(plan: Pick<PublicPricingPlan, 'bookingFee' | 'bookingFeeFixedPence'>): string {
  return plan.bookingFee === undefined ? 'Service fee unavailable' : `${plan.bookingFee}%${plan.bookingFeeFixedPence ? ` + ${pricingMoney(plan.bookingFeeFixedPence)} per guard` : ''}`;
}

export function planAllowanceText(plan: Pick<PublicPricingPlan, 'audience' | 'job_limit_per_month'>): string {
  if (plan.audience === 'guard') return 'Free applications with no monthly cap';
  const unit = 'job posting';
  const limit = plan.job_limit_per_month;
  if (limit === null) return `Unlimited ${unit}s per month`;
  if (!Number.isSafeInteger(limit) || limit < 0) return 'Monthly allowance shown in your account';
  return `${limit} ${unit}${limit === 1 ? '' : 's'} per month`;
}
