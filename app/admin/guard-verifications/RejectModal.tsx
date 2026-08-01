'use client';

interface RejectModalProps {
  open: boolean;
  processing: boolean;
  reason: string;
  onReasonChange: (val: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function RejectModal({ open, processing, reason, onReasonChange, onCancel, onConfirm }: RejectModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-6">
      <div className="bg-[#111d35] rounded-2xl max-w-lg w-full p-8 border border-[#1a2b4a]">
        <h3 className="text-xl font-bold text-white mb-4">Reject Application</h3>
        <p className="text-slate-400 mb-6">
          Please provide a reason for rejecting this application. The guard will receive this information via email.
        </p>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={4}
          maxLength={500}
          className="w-full px-4 py-3 border border-[#1a2b4a] bg-[#0a1628] text-white placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm resize-none mb-2"
          placeholder="e.g., SIA license could not be verified, incomplete information, etc."
        ></textarea>
        <p className="text-xs text-slate-500 text-right mb-6">{reason.length}/500 characters</p>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 px-6 py-3 bg-[#1a2b4a] text-slate-300 rounded-lg font-medium hover:bg-[#243452] transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!reason.trim() || processing}
            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {processing ? 'Processing...' : 'Confirm Rejection'}
          </button>
        </div>
      </div>
    </div>
  );
}