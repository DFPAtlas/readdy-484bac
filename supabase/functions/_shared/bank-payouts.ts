export const bankPayoutEventTypes = ['payout.created','payout.updated','payout.paid','payout.failed','payout.canceled'];

export async function recordBankPayout(db: any, stripe: any, accountId: string, payoutId: string, eventId: string | null = null) {
  if (!accountId?.startsWith('acct_') || !payoutId?.startsWith('po_')) throw new Error('Invalid bank payout reference');
  // Never let a delayed event snapshot overwrite Stripe's current payout state.
  const payout = await stripe.payouts.retrieve(payoutId, {expand:['destination']}, {stripeAccount:accountId});
  const destination = typeof payout.destination === 'object' ? payout.destination : null;
  const {data,error} = await db.rpc('record_guard_bank_payout', {
    p_account_id:accountId, p_event_id:eventId,
    p_payout:{id:payout.id,amount:payout.amount,currency:payout.currency,status:payout.status,
      created:payout.created,arrival_date:payout.arrival_date,livemode:payout.livemode,
      bank_last4:destination?.object === 'bank_account' ? destination.last4 : null,
      failure_code:payout.failure_code,failure_message:payout.failure_message},
  });
  if(error) throw new Error(`Bank payout record failed: ${error.message}`);
  return data;
}
