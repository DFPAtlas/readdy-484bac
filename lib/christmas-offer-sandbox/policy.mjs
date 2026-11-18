export const CHRISTMAS_OFFER = Object.freeze({
  id: 'christmas-2026-free-until-jan',
  version: 1,
  offerStartIso: '2026-11-24T00:00:00.000Z',
  offerEndIso: '2026-12-30T00:00:00.000Z',
  offerEndExclusive: true,
  firstChargeIso: '2027-01-01T00:00:00.000Z',
  firstChargeAt: 1798761600,
  stripeMinTrialLeadSeconds: 172800,
  stripeMinimumBoundaryIso: '2026-12-30T00:00:00.000Z',
  lastSupportedCheckoutIso: '2026-12-29T23:59:59.999Z',
  productionProjectRef: 'vnywjfpkepjgclkbcmsj',
  sandboxStripeAccountId: 'acct_1SYmuoIMkpwfAEDT',
  plans: Object.freeze({
    'guard-pro': Object.freeze({ accountType: 'guard', billingCycle: 'monthly', monthlyPricePence: 1900, label: 'Guard Pro' }),
    'client-pro': Object.freeze({ accountType: 'client', billingCycle: 'monthly', monthlyPricePence: 9900, label: 'Client Pro' }),
  }),
});

export const CHRISTMAS_SANDBOX_ENV = Object.freeze({
  enabled: 'CHRISTMAS_OFFER_SANDBOX_ENABLED',
  projectRef: 'CHRISTMAS_OFFER_SANDBOX_PROJECT_REF',
  stripeAccount: 'CHRISTMAS_OFFER_SANDBOX_STRIPE_ACCOUNT_ID',
});

export const TEST_ONLY_NOTICE = 'Sandbox test only. This draft never creates a live QuickGuard subscription, entitlement or charge.';

const BLOCKING_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'];

function toMillis(now) {
  if (now instanceof Date) return now.getTime();
  if (typeof now === 'number') return now;
  if (typeof now === 'string') return Date.parse(now);
  return Number.NaN;
}

function offerEnvelope() {
  return {
    offerId: CHRISTMAS_OFFER.id,
    offerVersion: CHRISTMAS_OFFER.version,
    offerStartIso: CHRISTMAS_OFFER.offerStartIso,
    offerEndIso: CHRISTMAS_OFFER.offerEndIso,
    offerEndExclusive: CHRISTMAS_OFFER.offerEndExclusive,
    firstChargeIso: CHRISTMAS_OFFER.firstChargeIso,
    stripeMinimumBoundaryIso: CHRISTMAS_OFFER.stripeMinimumBoundaryIso,
    lastSupportedCheckoutIso: CHRISTMAS_OFFER.lastSupportedCheckoutIso,
    testOnly: true,
  };
}

export function offerPlanList() {
  return Object.entries(CHRISTMAS_OFFER.plans).map(([slug, plan]) => ({ slug, ...plan }));
}

export function isOfferPlan(planId) {
  return Object.prototype.hasOwnProperty.call(CHRISTMAS_OFFER.plans, planId);
}

export function offerPlan(planId) {
  return isOfferPlan(planId) ? CHRISTMAS_OFFER.plans[planId] : null;
}

export function deriveProjectRef(supabaseUrl) {
  if (typeof supabaseUrl !== 'string' || !supabaseUrl) return null;
  let host;
  try {
    host = new URL(supabaseUrl).hostname;
  } catch {
    return null;
  }
  const match = /^([a-z0-9]{10,32})\.supabase\.(co|in)$/.exec(host);
  return match ? match[1] : null;
}

export function evaluateOfferTiming(now) {
  const at = toMillis(now);
  if (!Number.isFinite(at)) {
    return { ok: false, code: 'invalid_clock', message: 'The offer clock could not be read, so the sandbox offer stayed off.' };
  }
  if (at < Date.parse(CHRISTMAS_OFFER.offerStartIso)) {
    return { ok: false, code: 'offer_not_started', message: 'The Christmas offer has not started. It opens at 00:00 UK time on 24 November 2026.' };
  }
  if (at >= Date.parse(CHRISTMAS_OFFER.offerEndIso)) {
    return { ok: false, code: 'offer_ended', message: 'The Christmas offer closed at 00:00 UK time on 30 December 2026. 29 December 2026 was the last sign-up day.' };
  }
  if (at > Date.parse(CHRISTMAS_OFFER.lastSupportedCheckoutIso)) {
    return {
      ok: false,
      code: 'fixed_date_trial_unsupported',
      message: 'Stripe needs at least 48 hours between checkout and the agreed first charge on 1 January 2027, so this sign-up cannot use the fixed-date trial. The charge date has not been moved and no subscription was started.',
    };
  }
  return { ok: true, code: 'offer_active', message: 'The offer is open and the 1 January 2027 first charge date is still supported.' };
}

export function evaluateOfferPlan(input) {
  const plan = offerPlan(input?.planId);
  if (!plan) {
    return { ok: false, code: 'plan_not_eligible', message: 'The Christmas offer applies only to the monthly Guard Pro or Client Pro plan.' };
  }
  if (input?.accountType !== plan.accountType) {
    return { ok: false, code: 'account_type_mismatch', message: `${plan.label} is not available for this account type.` };
  }
  const billingCycle = input?.billingCycle == null ? 'monthly' : input.billingCycle;
  if (billingCycle !== plan.billingCycle) {
    return { ok: false, code: 'billing_cycle_not_eligible', message: 'The Christmas offer applies to monthly plans only. Annual plans keep their normal checkout.' };
  }
  return { ok: true, code: 'plan_eligible', message: `${plan.label} is eligible for the Christmas offer.` };
}

export function evaluateOfferSubscription(existing) {
  if (!existing) {
    return { ok: true, code: 'no_existing_subscription', message: 'This account has no existing subscription.' };
  }
  const status = typeof existing.status === 'string' ? existing.status.toLowerCase() : null;
  const planSlug = existing.planSlug ?? existing.plan_slug ?? null;
  const stripeSubscriptionId = existing.stripeSubscriptionId ?? existing.stripe_subscription_id ?? null;
  if (typeof planSlug === 'string' && /founding/i.test(planSlug)) {
    return { ok: false, code: 'existing_founding_offer', message: 'This account already holds a founding offer, which is not part of the Christmas offer.' };
  }
  if (stripeSubscriptionId && BLOCKING_STATUSES.includes(status)) {
    return { ok: false, code: 'existing_paid_or_trialing', message: 'Existing paid or Stripe-trialling accounts cannot use the Christmas offer. Their normal plan management is unchanged.' };
  }
  if (planSlug && (status === 'active' || status === 'trialing')) {
    return { ok: false, code: 'existing_paid_or_trialing', message: 'This account is already subscribed to a plan.' };
  }
  return { ok: true, code: 'no_active_subscription', message: 'This account can start the Christmas offer.' };
}

export function sandboxDisabled(code, message) {
  return { enabled: false, code, message, testOnly: true };
}

export function evaluateSandboxConfig(input) {
  if (input?.enabledFlag !== 'true') {
    return sandboxDisabled('promo_disabled', 'The Christmas sandbox offer is switched off. It stays off unless an isolated test project explicitly sets CHRISTMAS_OFFER_SANDBOX_ENABLED=true.');
  }
  const configuredProjectRef = input?.configuredProjectRef;
  if (!configuredProjectRef) {
    return sandboxDisabled('missing_sandbox_project_ref', 'No sandbox project reference is configured, so the test path stays off.');
  }
  if (configuredProjectRef === CHRISTMAS_OFFER.productionProjectRef) {
    return sandboxDisabled('production_project_ref_rejected', 'The configured reference is the live QuickGuard project. The Christmas sandbox offer cannot run there.');
  }
  if (!input?.runningProjectRef) {
    return sandboxDisabled('missing_running_project_ref', 'The running backend reference could not be read, so the test path stays off.');
  }
  if (configuredProjectRef !== input.runningProjectRef) {
    return sandboxDisabled('project_ref_mismatch', 'The configured sandbox reference does not match the running backend. The test path stays off.');
  }
  if (!input?.stripeAccountId) {
    return sandboxDisabled('stripe_account_unverified', 'Stripe verification did not return an account id, so the test path stays off.');
  }
  if (input.stripeAccountId !== CHRISTMAS_OFFER.sandboxStripeAccountId) {
    return sandboxDisabled('stripe_account_mismatch', 'Stripe returned a different account than the QuickGuard sandbox account. The test path stays off.');
  }
  if (input?.stripeLivemode !== false) {
    return sandboxDisabled('stripe_mode_unverified', 'Stripe did not confirm test mode, so the test path stays off.');
  }
  return { enabled: true, code: 'sandbox_ready', message: 'Isolated test project and the QuickGuard sandbox Stripe account confirmed in test mode.', testOnly: true };
}

export function evaluateChristmasOffer(input) {
  const sandbox = input?.sandbox;
  if (!sandbox || sandbox.enabled !== true) {
    return {
      eligible: false,
      code: sandbox?.code || 'not_eligible',
      message: sandbox?.message || 'The Christmas sandbox offer is not enabled in this environment.',
      ...offerEnvelope(),
    };
  }
  const checks = [
    evaluateOfferTiming(input?.now),
    evaluateOfferPlan({ planId: input?.planId, accountType: input?.accountType, billingCycle: input?.billingCycle }),
    evaluateOfferSubscription(input?.subscription),
  ];
  const failure = checks.find((check) => !check.ok);
  if (failure) {
    return { eligible: false, code: failure.code, message: failure.message, ...offerEnvelope() };
  }
  return { eligible: true, code: 'eligible', message: 'Eligible for the sandbox Christmas offer.', ...offerEnvelope() };
}

export function trialEndOutsideStripeMinimum(now) {
  const at = toMillis(now);
  if (!Number.isFinite(at)) return true;
  return CHRISTMAS_OFFER.firstChargeAt - Math.floor(at / 1000) < CHRISTMAS_OFFER.stripeMinTrialLeadSeconds;
}

export function buildOfferCheckoutMetadata(input) {
  return {
    paymentType: 'subscription',
    offer_id: CHRISTMAS_OFFER.id,
    offer_version: String(CHRISTMAS_OFFER.version),
    offer_source: 'christmas_offer_sandbox',
    sandbox_only: 'true',
    sandbox_project_ref: String(input?.projectRef || ''),
    first_charge_at: CHRISTMAS_OFFER.firstChargeIso,
    user_id: String(input?.userId || ''),
    account_type: String(input?.accountType || ''),
    plan_id: String(input?.planId || ''),
    plan_slug: String(input?.planId || ''),
    plan_name: String(input?.planName || ''),
    billing_cycle: 'monthly',
  };
}