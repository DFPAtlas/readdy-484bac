'use client';

import { useState } from 'react';

interface BulkActionsBarProps {
  selectedCount: number;
  accountType: 'clients' | 'guards';
  onAction: (action: string) => void;
  onClearSelection: () => void;
  onEmail: () => void;
  isProcessing: boolean;
}

export default function BulkActionsBar({
  selectedCount,
  accountType,
  onAction,
  onClearSelection,
  onEmail,
  isProcessing,
}: BulkActionsBarProps) {
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  const handleAction = (action: string) => {
    setShowConfirm(action);
  };

  const confirmAction = () => {
    if (showConfirm) {
      onAction(showConfirm);
      setShowConfirm(null);
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      verify: 'Verify',
      unverify: 'Remove Verification',
      suspend: 'Suspend',
      reactivate: 'Reactivate',
      approve: 'Approve',
      reject: 'Reject',
      verify_sia: 'Verify SIA',
      unverify_sia: 'Remove SIA Verification',
    };
    return labels[action] || action;
  };

  const getActionDescription = (action: string) => {
    const descriptions: Record<string, string> = {
      verify: `verify ${selectedCount} ${accountType}`,
      unverify: `remove verification from ${selectedCount} ${accountType}`,
      suspend: `suspend ${selectedCount} ${accountType}`,
      reactivate: `reactivate ${selectedCount} ${accountType}`,
      approve: `approve ${selectedCount} ${accountType}`,
      reject: `reject ${selectedCount} ${accountType}`,
      verify_sia: `verify SIA for ${selectedCount} ${accountType}`,
      unverify_sia: `remove SIA verification from ${selectedCount} ${accountType}`,
    };
    return descriptions[action] || action;
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50 animate-slide-up">
        <div className="flex items-center gap-2 pr-4 border-r border-slate-700">
          <div className="w-8 h-8 flex items-center justify-center bg-teal-600 rounded-full text-sm font-bold">
            {selectedCount}
          </div>
          <span className="text-sm font-medium whitespace-nowrap">selected</span>
        </div>

        <div className="flex items-center gap-2">
          {accountType === 'clients' ? (
            <>
              <button
                onClick={() => handleAction('verify')}
                disabled={isProcessing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-checkbox-circle-line"></i></div>
                Verify
              </button>
              <button
                onClick={() => handleAction('unverify')}
                disabled={isProcessing}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-checkbox-blank-circle-line"></i></div>
                Unverify
              </button>
              <button
                onClick={() => handleAction('suspend')}
                disabled={isProcessing}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-forbid-line"></i></div>
                Suspend
              </button>
              <button
                onClick={() => handleAction('reactivate')}
                disabled={isProcessing}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
                Reactivate
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleAction('approve')}
                disabled={isProcessing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-check-line"></i></div>
                Approve
              </button>
              <button
                onClick={() => handleAction('reject')}
                disabled={isProcessing}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-close-line"></i></div>
                Reject
              </button>
              <button
                onClick={() => handleAction('suspend')}
                disabled={isProcessing}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-forbid-line"></i></div>
                Suspend
              </button>
              <button
                onClick={() => handleAction('reactivate')}
                disabled={isProcessing}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
                Reactivate
              </button>
              <button
                onClick={() => handleAction('verify_sia')}
                disabled={isProcessing}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-verified-badge-line"></i></div>
                Verify SIA
              </button>
            </>
          )}

          <div className="w-px h-8 bg-slate-700 mx-1"></div>

          <button
            onClick={onEmail}
            disabled={isProcessing}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-mail-send-line"></i></div>
            Email
          </button>
        </div>

        <button
          onClick={onClearSelection}
          className="ml-2 p-2 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          title="Clear selection"
        >
          <div className="w-5 h-5 flex items-center justify-center"><i className="ri-close-line text-lg"></i></div>
        </button>

        {isProcessing && (
          <div className="flex items-center gap-2 pl-4 border-l border-slate-700">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Processing...</span>
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowConfirm(null)}>
          <div className="bg-[#0a1628] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-[#1a2b4a]" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 flex items-center justify-center bg-amber-500/10 rounded-full mx-auto mb-4 ring-1 ring-amber-500/20">
              <div className="w-6 h-6 flex items-center justify-center">
                <i className="ri-alert-line text-2xl text-amber-400"></i>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white text-center mb-2">Confirm Bulk Action</h3>
            <p className="text-slate-400 text-center mb-6">
              Are you sure you want to <span className="font-medium">{getActionDescription(showConfirm)}</span>?
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-[#1a2b4a] rounded-xl text-slate-300 font-medium hover:bg-[#1a2b4a] transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                {getActionLabel(showConfirm)}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
