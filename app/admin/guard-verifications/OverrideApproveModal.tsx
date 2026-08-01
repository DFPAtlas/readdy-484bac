'use client';

interface OverrideApproveModalProps {
  open: boolean;
  guardName: string;
  blockerCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function OverrideApproveModal({ open, guardName, blockerCount, onCancel, onConfirm }: OverrideApproveModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-6">
      <div className="bg-[#111d35] rounded-2xl max-w-lg w-full p-8 border-2 border-red-500/40 shadow-2xl">
        <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-alert-line text-3xl text-red-400 w-8 h-8 flex items-center justify-center"></i>
        </div>
        <h3 className="text-xl font-bold text-white text-center mb-2">Override &amp; Force Approve</h3>
        <p className="text-slate-400 text-center mb-4">
          You are about to <strong className="text-red-400">override all checks</strong> and approve <strong className="text-white">{guardName}</strong>.
        </p>

        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center mt-0.5">
              <i className="ri-error-warning-line text-red-400 text-sm w-4 h-4 flex items-center justify-center"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-400 mb-2">Warnings:</p>
              <ul className="text-sm text-red-400/80 space-y-1">
                {blockerCount > 0 && (
                  <li className="flex items-start gap-2">
                    <i className="ri-arrow-right-line w-3.5 h-3.5 flex-shrink-0 mt-0.5 flex items-center justify-center"></i>
                    <span>{blockerCount} required item{blockerCount !== 1 ? 's are' : ' is'} missing or incomplete</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <i className="ri-arrow-right-line w-3.5 h-3.5 flex-shrink-0 mt-0.5 flex items-center justify-center"></i>
                  <span>Not all verification sections are confirmed</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-arrow-right-line w-3.5 h-3.5 flex-shrink-0 mt-0.5 flex items-center justify-center"></i>
                  <span>This will grant full platform access regardless of missing data</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-500 text-center mb-6">
          This action will be logged. Only use when you are absolutely certain.
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
            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-500 transition-colors whitespace-nowrap"
          >
            <span className="flex items-center justify-center gap-2">
              <i className="ri-shield-flash-line text-lg w-5 h-5 flex items-center justify-center"></i>
              Override &amp; Approve
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}