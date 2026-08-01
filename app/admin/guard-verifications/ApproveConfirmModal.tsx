'use client';

interface ApproveConfirmModalProps {
  open: boolean;
  guardName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ApproveConfirmModal({ open, guardName, onCancel, onConfirm }: ApproveConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-6">
      <div className="bg-[#111d35] rounded-2xl max-w-lg w-full p-8 border border-[#1a2b4a]">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-checkbox-circle-line text-3xl text-emerald-400 w-8 h-8 flex items-center justify-center"></i>
        </div>
        <h3 className="text-xl font-bold text-white text-center mb-2">Approve Guard Application</h3>
        <p className="text-slate-400 text-center mb-6">
          Are you sure you want to approve <strong className="text-white">{guardName}</strong>? They will receive a welcome email and gain full access to the platform.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-[#1a2b4a] text-slate-300 rounded-lg font-medium hover:bg-[#243452] transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 transition-colors whitespace-nowrap"
          >
            <span className="flex items-center justify-center gap-2">
              <i className="ri-checkbox-circle-line text-lg w-5 h-5 flex items-center justify-center"></i>
              Approve Guard
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}