'use client';

interface DisputeResolveModalProps {
  jobTitle: string;
  venueCity: string | undefined;
  clientName: string;
  guardName: string;
  amount: number;
  createdAt: string;
  reason: string;
  details: string | null;
  adminNotes: string;
  refundAmount: string;
  resolving: boolean;
  onAdminNotesChange: (v: string) => void;
  onRefundAmountChange: (v: string) => void;
  onResolve: (resolution: string) => void;
  onClose: () => void;
}

export default function DisputeResolveModal({
  jobTitle, venueCity, clientName, guardName, amount, createdAt,
  reason, details, adminNotes, refundAmount, resolving,
  onAdminNotesChange, onRefundAmountChange, onResolve, onClose,
}: DisputeResolveModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111d35] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-[#1e2d4d] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Resolve Dispute</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-[#0a1527] rounded-xl p-4 border border-[#1e2d4d]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-teal-500/15 rounded-lg flex items-center justify-center">
                <i className="ri-briefcase-line text-teal-400"></i>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{jobTitle}</p>
                <p className="text-xs text-slate-500">{venueCity}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-400 mt-3">
              <div className="flex items-center gap-2"><i className="ri-building-line"></i> {clientName}</div>
              <div className="flex items-center gap-2"><i className="ri-user-line"></i> {guardName}</div>
              <div className="flex items-center gap-2"><i className="ri-money-pound-circle-line"></i> £{amount.toFixed(2)}</div>
              <div className="flex items-center gap-2"><i className="ri-calendar-line"></i> {new Date(createdAt).toLocaleDateString('en-GB')}</div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-white mb-1">Reason</p>
            <p className="text-sm text-slate-400 bg-[#0a1527] rounded-lg p-3 border border-[#1e2d4d]">{reason}</p>
          </div>

          {details && (
            <div>
              <p className="text-sm font-semibold text-white mb-1">Details</p>
              <p className="text-sm text-slate-400 bg-[#0a1527] rounded-lg p-3 border border-[#1e2d4d]">{details}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Admin Notes</label>
            <textarea
              value={adminNotes}
              onChange={(e) => onAdminNotesChange(e.target.value)}
              placeholder="Add your review notes here..."
              maxLength={500}
              className="w-full px-4 py-3 bg-[#0a1527] border border-[#1e2d4d] rounded-lg text-sm text-white min-h-[80px] placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500 mt-1">{adminNotes.length}/500</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Refund Amount (if applicable)</label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">£</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={refundAmount}
                onChange={(e) => onRefundAmountChange(e.target.value)}
                placeholder="0.00"
                className="w-40 px-4 py-3 bg-[#0a1527] border border-[#1e2d4d] rounded-lg text-sm font-semibold text-white"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onResolve('resolved_guard')}
            disabled={resolving}
            className="px-4 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-check-line"></i>
            Release to Guard
          </button>
          <button
            onClick={() => onResolve('resolved_client_refund')}
            disabled={resolving}
            className="px-4 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-refund-line"></i>
            Full Refund
          </button>
          <button
            onClick={() => onResolve('resolved_client_partial')}
            disabled={resolving}
            className="px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-refund-line"></i>
            Partial Refund
          </button>
          <button
            onClick={() => onResolve('resolved_cancelled')}
            disabled={resolving}
            className="px-4 py-3 bg-slate-500 text-white rounded-xl font-semibold hover:bg-slate-600 disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-close-line"></i>
            Cancel Dispute
          </button>
        </div>
      </div>
    </div>
  );
}