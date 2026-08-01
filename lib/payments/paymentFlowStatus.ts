export type FlowStage = 'complete' | 'pending' | 'failed' | 'not_started';

export interface PaymentFlowStatus {
  job_secured: {
    status: FlowStage;
    label: string;
    amount: number | null;
    currency: string;
    timestamp: string | null;
    tooltip: string;
  };
  client_released: {
    status: FlowStage;
    label: string;
    timestamp: string | null;
    tooltip: string;
  };
  guard_paid: {
    status: FlowStage;
    label: string;
    amount: number | null;
    timestamp: string | null;
    tooltip: string;
    failure_reason: string | null;
  };
  requires_action: string | null;
  action_type: 'contact_support' | 'update_bank' | null;
}

const STAGE1_COMPLETE = ['paid', 'succeeded', 'complete', 'completed', 'funded'];
const STAGE1_PENDING = ['pending', 'processing', 'payment_pending', 'awaiting_payment'];
const STAGE1_FAILED = ['failed', 'cancelled', 'refunded'];

const STAGE2_COMPLETE = ['approved', 'confirmed', 'client_released', 'released'];
const STAGE2_PENDING = ['awaiting_client_release', 'pending'];
const STAGE2_FAILED = ['disputed'];

const STAGE3_COMPLETE = ['paid_out', 'succeeded', 'transferred', 'completed', 'payout_paid'];
const STAGE3_PENDING = ['pending', 'processing', 'payout_processing', 'transfer_pending', 'payout_pending', 'awaiting'];
const STAGE3_FAILED = ['failed', 'cancelled', 'reversed'];

function normalizeStatus(status: string | null | undefined, completeList: string[], pendingList: string[], failedList: string[]): FlowStage {
  if (!status) return 'not_started';
  const s = status.toLowerCase().replace(/[\s_-]+/g, '_');
  if (completeList.some(c => s.includes(c))) return 'complete';
  if (failedList.some(f => s.includes(f))) return 'failed';
  if (pendingList.some(p => s.includes(p))) return 'pending';
  return 'pending';
}

export interface FlowSourceData {
  assignmentStatus: string | null;
  assignmentPaymentStatus: string | null;
  assignmentPaymentAmount: number | null;
  assignmentPayoutReleased: boolean | null;
  assignmentPayoutReleasedAt: string | null;
  assignmentPayoutId: string | null;
  jobPaymentStatus: string | null;
  jobCompletionStatus: string | null;
  jobDisputed: boolean | null;
  jobAgreedAmount: number | null;
  jobCurrency: string | null;
  jobGuardPayoutAmount: number | null;
  completionRequestStatus: string | null;
  completionRequestClientApprovedAt: string | null;
  completionRequestClientDisputedAt: string | null;
  completionRequestDisputeReason: string | null;
  payoutStatus: string | null;
  payoutAmount: number | null;
  payoutNetAmount: number | null;
  payoutStripeTransferStatus: string | null;
  payoutFailureReason: string | null;
  payoutCompletedDate: string | null;
  payoutExpectedDate: string | null;
}

export function getPaymentFlowStatus(data: FlowSourceData): PaymentFlowStatus {
  const currency = data.jobCurrency || 'GBP';
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';

  const stage1Stat = normalizeStatus(
    data.jobPaymentStatus || data.assignmentPaymentStatus,
    STAGE1_COMPLETE,
    STAGE1_PENDING,
    STAGE1_FAILED
  );

  const stage2Stat = data.completionRequestStatus
    ? normalizeStatus(data.completionRequestStatus, STAGE2_COMPLETE, STAGE2_PENDING, STAGE2_FAILED)
    : data.jobCompletionStatus
      ? normalizeStatus(data.jobCompletionStatus, STAGE2_COMPLETE, STAGE2_PENDING, STAGE2_FAILED)
      : data.assignmentPayoutReleased
        ? 'complete'
        : data.jobDisputed || data.completionRequestClientDisputedAt
          ? 'failed'
          : (data.assignmentPaymentStatus === 'awaiting_client_release' || data.assignmentPaymentStatus === 'client_released'
            ? (data.assignmentPaymentStatus === 'client_released' ? 'complete' : 'pending')
            : 'not_started');

  const stage3Stat = data.payoutStatus
    ? normalizeStatus(data.payoutStatus, STAGE3_COMPLETE, STAGE3_PENDING, STAGE3_FAILED)
    : data.payoutStripeTransferStatus
      ? normalizeStatus(data.payoutStripeTransferStatus, STAGE3_COMPLETE, STAGE3_PENDING, STAGE3_FAILED)
      : 'not_started';

  let requiresAction: string | null = null;
  let actionType: 'contact_support' | 'update_bank' | null = null;

  if (stage1Stat === 'failed') {
    requiresAction = 'Client payment failed. QuickGuard will contact the client.';
    actionType = 'contact_support';
  } else if (stage2Stat === 'failed') {
    requiresAction = 'Payment release needs review. Contact support.';
    actionType = 'contact_support';
  } else if (stage3Stat === 'failed') {
    requiresAction = data.payoutFailureReason || 'Payout failed. Check your bank details or contact support.';
    actionType = 'update_bank';
  }

  const stage1Amount = data.jobAgreedAmount || data.assignmentPaymentAmount || data.jobGuardPayoutAmount;
  const stage3Amount = data.payoutNetAmount || data.payoutAmount || data.jobGuardPayoutAmount || stage1Amount;

  const stage1Tooltips: Record<FlowStage, string> = {
    complete: 'Client payment received and held by QuickGuard.',
    pending: 'Payment is being processed or awaiting client action.',
    failed: 'Client payment was not successful.',
    not_started: 'Guard has not been assigned or client has not paid yet.',
  };

  const stage2Tooltips: Record<FlowStage, string> = {
    complete: 'Client has confirmed the job and released payment.',
    pending: 'Job is complete; waiting for client to release payment.',
    failed: 'Client has disputed or payment release was blocked.',
    not_started: 'Job has not been completed yet.',
  };

  const stage3Tooltips: Record<FlowStage, string> = {
    complete: 'Money has been sent to your bank account.',
    pending: 'Payout is being processed.',
    failed: 'Payout did not succeed. Please check your bank details.',
    not_started: 'Payment has not been released to your account yet.',
  };

  return {
    job_secured: {
      status: stage1Stat,
      label: 'Job Secured',
      amount: stage1Amount,
      currency,
      timestamp: null,
      tooltip: stage1Tooltips[stage1Stat],
    },
    client_released: {
      status: stage2Stat,
      label: 'Client Released',
      timestamp: data.completionRequestClientApprovedAt || data.assignmentPayoutReleasedAt || null,
      tooltip: stage2Tooltips[stage2Stat],
    },
    guard_paid: {
      status: stage3Stat,
      label: 'Guard Paid',
      amount: stage3Amount,
      timestamp: data.payoutCompletedDate || null,
      tooltip: stage3Tooltips[stage3Stat],
      failure_reason: data.payoutFailureReason || null,
    },
    requires_action: requiresAction,
    action_type: actionType,
  };
}

export function formatFlowAmount(amount: number | null, currency: string): string {
  if (amount === null || amount === undefined) return '—';
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
  return `${symbol}${Number(amount).toFixed(2)}`;
}