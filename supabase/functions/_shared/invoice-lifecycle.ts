export function stripeId(value: any): string | null {
  return typeof value === 'string' ? value : value?.id || null;
}

// Basil and later moved subscription/payment references off the invoice root.
export function invoiceReferences(invoice: any) {
  const payment = invoice.payments?.data?.find((entry: any) => entry.status === 'paid')?.payment
    || invoice.payments?.data?.[0]?.payment;
  return {
    subscriptionId: stripeId(invoice.parent?.subscription_details?.subscription) || stripeId(invoice.subscription),
    paymentIntentId: stripeId(invoice.payment_intent) || stripeId(payment?.payment_intent),
    chargeId: stripeId(invoice.charge) || stripeId(payment?.charge),
  };
}

export function invoiceOutcome(invoice: any) {
  // Current invoice state wins over delayed or retried event snapshots.
  if (invoice.status === 'paid') return 'succeeded';
  if (invoice.status === 'open' && invoice.attempted) return 'failed';
  return null;
}

export function subscriptionStatus(subscription: any) {
  return subscription.status === 'canceled' ? 'cancelled' : subscription.status;
}
