export function matchesSubscriptionPrice(price: any, plan: any, billingCycle: string) {
  const interval = billingCycle === 'annual' ? 'year' : 'month';
  const productId = typeof price.product === 'string' ? price.product : price.product?.id;
  const amount = Number(plan.monthly_price_pence) * (billingCycle === 'annual' ? 10 : 1);
  return ['monthly', 'annual'].includes(billingCycle) && price.active === true && price.currency === 'gbp'
    && price.recurring?.interval === interval && price.recurring?.interval_count === 1
    && productId === plan.stripe_product_id && price.unit_amount === amount;
}
