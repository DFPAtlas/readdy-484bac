const opensAt = Date.parse('2026-12-01T00:00:00Z');
const closesAt = Date.parse('2026-12-30T00:00:00Z');
const firstChargeAt = 1798761600;
const stripeMinimumLeadMs = 48 * 60 * 60 * 1000;
const offerId = 'christmas-2026-free-until-jan';
const freePlanSlugs = ['client_free', 'guard_starter'];
const ineligibleStatuses = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused', 'founding'];

/**
 * @param {{ enabled: boolean, accountType: string, planId: string, billingCycle?: string | null }} checkout
 * @param {number} [now]
 */
export function christmasOfferAmount({ enabled, accountType, planId, billingCycle }, now = Date.now()) {
  if (!enabled || !Number.isFinite(now) || now < opensAt || now >= closesAt ||
      firstChargeAt * 1000 - now < stripeMinimumLeadMs ||
      (billingCycle != null && billingCycle !== 'monthly')) return null;

  if (accountType === 'guard' && planId === 'guard-pro') return 1900;
  if (accountType === 'client' && planId === 'client-pro') return 9900;
  return null;
}

/** @param {{ stripe_subscription_id?: string | null, status?: string | null, plan_slug?: string | null } | null} subscription */
export function canUseChristmasOffer(subscription) {
  if (!subscription) return true;
  if (subscription.stripe_subscription_id || subscription.plan_slug?.toLowerCase().includes('founding')) return false;
  if (subscription.status === 'active' && freePlanSlugs.includes(subscription.plan_slug ?? '')) return true;
  return !ineligibleStatuses.includes(subscription.status ?? '');
}

/**
 * @param {{ active: boolean, currency: string, unit_amount: number | null, recurring: { interval: string, interval_count: number, usage_type: string } | null }} price
 * @param {number} amount
 */
export function isChristmasOfferPrice(price, amount) {
  return price.active && price.currency === 'gbp' && price.unit_amount === amount &&
    price.recurring?.interval === 'month' && price.recurring.interval_count === 1 &&
    price.recurring.usage_type === 'licensed';
}

/** @param {number} amount */
export function christmasOfferCheckoutParams(amount) {
  return /** @type {const} */ ({
    payment_method_collection: 'always',
    custom_text: {
      submit: {
        message: `£0 today. £${(amount / 100).toFixed(2)} per month from 1 January 2027 unless cancelled before then.`,
      },
    },
    subscription_data: {
      trial_end: firstChargeAt,
      metadata: { offer_id: offerId },
    },
  });
}
