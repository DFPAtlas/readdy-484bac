export function canonicalClientPlan(slug: string): string {
  const aliases: Record<string, string> = { free: 'client_free', payg: 'client_free', 'client-free': 'client_free' };
  return aliases[slug] || slug;
}

export async function getBookingPolicy(db: any, userId: string) {
  const { data: sub, error } = await db.from('subscriptions').select('plan_slug, status')
    .eq('user_id', userId).eq('account_type', 'client').in('status', ['active', 'trialing']).maybeSingle();
  if (error) throw new Error('Unable to verify subscription');
  const planSlug = sub ? canonicalClientPlan(sub.plan_slug || '') : 'client_free';
  if (!['client_free', 'client-starter', 'client-pro', 'client-enterprise'].includes(planSlug)) {
    throw new Error('Unknown client billing plan');
  }
  const { data: rules, error: ruleError } = await db.from('plan_fee_rules').select('*').eq('plan_slug', planSlug).maybeSingle();
  if (ruleError || !rules) throw new Error('Booking fee configuration unavailable');
  const feePercent = Number(rules.platform_fee_percent);
  const feeFixedPence = Number(rules.platform_fee_fixed_pence);
  if (rules.platform_fee_percent == null || rules.platform_fee_fixed_pence == null || !Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100 || !Number.isInteger(feeFixedPence) || feeFixedPence < 0) {
    throw new Error('Invalid booking fee configuration');
  }
  return { feePercent, feeFixedPence, planSlug, isSubscribed: !!sub,
    stripeFeePayer: 'quickguard', stripeFeePct: Number(rules.stripe_fee_estimate_percent ?? 1.5),
    payoutDelay: Number(rules.payout_delay_days), autoRelease: Number(rules.auto_release_hours),
    disputeWindow: Number(rules.dispute_window_hours) };
}

export function applyClientPromotion(policy: any, client: any, now = new Date()) {
  let feePercent = policy.feePercent;
  let promoApplied = false;
  let promoLabel = '';
  let jobsRemainingAfter: number | null = null;
  if (!policy.isSubscribed && client.client_type !== 'security_company' && client.client_signup_number != null) {
    if (client.client_promo_tier === 'launch_client' && client.client_promo_jobs_remaining > 0) {
      feePercent = 0; promoApplied = true; promoLabel = 'Launch promotion';
      jobsRemainingAfter = client.client_promo_jobs_remaining - 1;
    } else if (client.client_promo_ends_at && now < new Date(client.client_promo_ends_at)) {
      feePercent = 0; promoApplied = true; promoLabel = 'Introductory promotion';
    } else if (client.client_lifetime_fee_discount != null) {
      const discount = Number(client.client_lifetime_fee_discount);
      if (!Number.isFinite(discount) || discount < 0 || discount > 1) throw new Error('Invalid promotion');
      feePercent *= 1 - discount; promoApplied = true; promoLabel = 'Lifetime service fee discount';
    }
  }
  return { ...policy, feePercent, promoApplied, promoLabel, jobsRemainingAfter };
}

export function bookingAmounts(grossPence: number, feePercent: number, fixedPence = 0) {
  if (!Number.isSafeInteger(grossPence) || grossPence <= 0 || !Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100 || !Number.isSafeInteger(fixedPence) || fixedPence < 0) {
    throw new Error('Invalid booking amount');
  }
  const platformFeePence = Math.round(grossPence * feePercent / 100) + fixedPence;
  return { grossGuardPence: grossPence, platformFeePence, guardServiceFeePence: 0,
    stripeFeePence: 0, guardNetPence: grossPence, clientTotalPence: grossPence + platformFeePence };
}