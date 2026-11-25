export const GUARD_PAYOUT_SETUP_GUIDANCE = 'Open Bank Settings in your guard account to set up your Stripe payout account, add your bank details and complete any verification Stripe requests.';

export const GUARD_COMPLETION_GUIDANCE = 'Finish the shift and check out, then select Mark Complete on your dashboard, or Request Completion on mobile, to submit the shift for client review.';

export const GUARD_BANK_DEPOSIT_GUIDANCE = 'Release to your connected Stripe account and payment into your bank are separate stages. Stripe processes bank deposits according to your available balance, payout schedule and account requirements. Bank processing and verification can affect arrival; a submitted transfer does not confirm a paid bank deposit.';

export const GUARD_PAYOUT_SUPPORT_GUIDANCE = 'If the client has not confirmed completion, your payout is delayed or Stripe asks for more information, check your job status, Bank Settings and Earnings. Contact QuickGuard support with the booking reference if you need help. We do not promise instant payouts or a fixed bank-arrival deadline.';

export const GUARD_PAYMENT_STEPS = [
  { icon: 'ri-bank-line', label: 'Set up your payout account', desc: GUARD_PAYOUT_SETUP_GUIDANCE },
  { icon: 'ri-bank-card-line', label: 'Client funds the booking', desc: 'The client pays securely through Stripe before the booking is confirmed. The booking payment is held pending completion and release checks.' },
  { icon: 'ri-briefcase-line', label: 'Work the shift and request completion', desc: GUARD_COMPLETION_GUIDANCE },
  { icon: 'ri-checkbox-circle-line', label: 'Completion is reviewed', desc: 'The client reviews your completion request and can approve it or raise a dispute. An open dispute or payment issue can delay release while it is reviewed.' },
  { icon: 'ri-secure-payment-line', label: 'Eligible pay is released to Stripe', desc: 'After completion approval and the applicable payment, dispute and Stripe account checks, eligible earnings are transferred to your connected Stripe account.' },
  { icon: 'ri-money-pound-circle-line', label: 'Stripe processes your bank deposit', desc: GUARD_BANK_DEPOSIT_GUIDANCE },
];
