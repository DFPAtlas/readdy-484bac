'use client';

interface RefundEligibilityPanelProps {
  job: any;
  transaction: any;
  cancellation: any;
  refundRequests: any[];
  onRequestRefund: () => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pending', color: 'text-orange-400', icon: 'ri-hourglass-line' },
  approved: { label: 'Approved', color: 'text-emerald-400', icon: 'ri-check-double-line' },
  rejected: { label: 'Rejected', color: 'text-rose-400', icon: 'ri-forbid-line' },
  processed: { label: 'Processed', color: 'text-teal-400', icon: 'ri-checkbox-circle-line' },
  credit_issued: { label: 'Credit Issued', color: 'text-violet-400', icon: 'ri-coupon-line' },
};

export default function RefundEligibilityPanel({ job, transaction, cancellation, refundRequests, onRequestRefund }: RefundEligibilityPanelProps) {
  const paidAmount = transaction?.amount || 0;
  const isRefunded = transaction?.refunded || false;
  const refundAmount = transaction?.refund_amount || 0;
  const isCancelled = job.status === 'cancelled';
  const hasPendingRefund = refundRequests.some((r) => r.status === 'pending');
  const hasApprovedRefund = refundRequests.some((r) => r.status === 'approved' || r.status === 'processed');

  const platformFee = paidAmount * 0.15;
  const estimatedRefundable = Math.max(0, paidAmount - platformFee);

  const startDate = job.start_date ? new Date(job.start_date) : null;
  const now = new Date();
  const hoursUntilStart = startDate ? Math.max(0, (startDate.getTime() - now.getTime()) / (1000 * 60 * 60)) : 0;

  // TODO: Replace with actual backend refund policy when available
  let policyNote = 'Refund policy is reviewed case by case.';
  if (hoursUntilStart >= 48) policyNote = 'Cancellations 48+ hours before start may be eligible for full refund minus platform fees.';
  else if (hoursUntilStart >= 24) policyNote = 'Cancellations 24-48 hours before start may be eligible for partial refund.';
  else if (hoursUntilStart > 0) policyNote = 'Cancellations within 24 hours of start may be subject to limited refund.';
  else policyNote = 'This job has already started. Refund requests are handled on a case-by-case basis.';

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center">
          <i className="ri-refund-line text-violet-400 text-xl"></i>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Refund Status</h3>
          <p className="text-xs text-slate-500">Payment & refund eligibility</p>
        </div>
      </div>

      {/* Payment summary */}
      <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4 mb-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Payment Status</span>
            <span className={`font-semibold ${isRefunded ? 'text-slate-400' : transaction?.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isRefunded ? 'Refunded' : transaction?.status === 'completed' ? 'Paid' : transaction?.status || 'Pending'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Amount Paid</span>
            <span className="text-slate-200 font-semibold">£{paidAmount.toFixed(2)}</span>
          </div>
          {isRefunded && (
            <div className="flex justify-between">
              <span className="text-slate-500">Refunded Amount</span>
              <span className="text-emerald-400 font-semibold">£{refundAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Platform Fee</span>
            <span className="text-slate-200">£{platformFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-[#1e2d4d]">
            <span className="text-white font-semibold">Estimated Refundable</span>
            <span className="text-teal-400 font-bold">£{estimatedRefundable.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Policy note */}
      <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 mb-4">
        <p className="text-xs text-blue-400 flex items-start gap-2">
          <i className="ri-information-line mt-0.5"></i>
          <span>{policyNote}</span>
        </p>
      </div>

      {/* Refund requests list */}
      {refundRequests.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Refund Requests</p>
          {refundRequests.map((req) => {
            const cfg = statusConfig[req.status] || statusConfig.pending;
            return (
              <div key={req.id} className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">£{req.requested_amount?.toFixed(2)}</span>
                    <span className="text-xs text-slate-500 capitalize">{req.type}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{req.reason}</p>
                </div>
                <span className={`flex items-center gap-1 text-xs font-semibold ${cfg.color}`}>
                  <i className={cfg.icon}></i>
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation status */}
      {cancellation && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 mb-4">
          <p className="text-xs text-amber-400 font-semibold mb-1">Cancellation Status</p>
          <p className="text-xs text-amber-400/80">Cancelled on {new Date(cancellation.cancelled_at || cancellation.created_at).toLocaleDateString('en-GB')}</p>
          <p className="text-xs text-amber-400/80">Reason: {cancellation.reason || 'Not specified'}</p>
          {cancellation.platform_fee_refunded && (
            <p className="text-xs text-emerald-400 mt-1"><i className="ri-check-line mr-1"></i>Platform fee refunded</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!isRefunded && !hasPendingRefund && !hasApprovedRefund && isCancelled && (
          <button
            onClick={onRequestRefund}
            className="flex-1 bg-violet-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-600 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-refund-line"></i>
            Request Refund
          </button>
        )}
        {hasPendingRefund && (
          <div className="flex-1 bg-orange-500/10 text-orange-400 py-2.5 rounded-xl text-sm font-semibold border border-orange-500/25 text-center flex items-center justify-center gap-2">
            <i className="ri-hourglass-line"></i>
            Refund Pending
          </div>
        )}
        {hasApprovedRefund && (
          <div className="flex-1 bg-emerald-500/10 text-emerald-400 py-2.5 rounded-xl text-sm font-semibold border border-emerald-500/25 text-center flex items-center justify-center gap-2">
            <i className="ri-check-double-line"></i>
            Refund Approved
          </div>
        )}
        <button
          onClick={() => window.location.href = `/client/support?new=refund_request&job=${job.id}`}
          className="px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-customer-service-2-line"></i>
        </button>
      </div>
    </div>
  );
}