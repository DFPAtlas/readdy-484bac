'use client';

import { useState } from 'react';

export interface BulkAction {
  key: string;
  label: string;
  icon: string;
  variant: 'primary' | 'secondary' | 'danger' | 'neutral';
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationMessage?: string;
  confirmButtonText?: string;
  confirmButtonIcon?: string;
}

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  actions: BulkAction[];
  onAction: (actionKey: string) => void;
  processing: boolean;
  processingAction?: string;
  className?: string;
}

export default function BulkActionBar({
  selectedCount,
  totalCount,
  allSelected,
  onSelectAll,
  onClearSelection,
  actions,
  onAction,
  processing,
  processingAction,
  className = '',
}: BulkActionBarProps) {
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [showMobileActions, setShowMobileActions] = useState(false);

  if (selectedCount === 0) return null;

  const activeAction = actions.find((a) => a.key === confirmAction);

  const handleActionClick = (action: BulkAction) => {
    if (action.requiresConfirmation) {
      setConfirmAction(action.key);
    } else {
      onAction(action.key);
    }
  };

  const handleConfirm = () => {
    if (confirmAction) {
      onAction(confirmAction);
      setConfirmAction(null);
    }
  };

  const variantClasses: Record<string, string> = {
    primary: 'bg-teal-500/10 text-teal-400 border-teal-500/25 hover:bg-teal-500/20',
    secondary: 'bg-[#162036] text-slate-300 border-[#1e2d4d] hover:bg-[#1a2642]',
    danger: 'bg-red-500/10 text-red-400 border-red-500/25 hover:bg-red-500/20',
    neutral: 'bg-slate-500/10 text-slate-400 border-slate-500/25 hover:bg-slate-500/20',
  };

  return (
    <>
      {/* Desktop / Sticky bar */}
      <div
        className={`bg-[#111d35] border border-[#1e2d4d] rounded-xl p-3 flex flex-wrap items-center gap-3 sticky bottom-2 z-30 shadow-lg ${className}`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={allSelected ? onClearSelection : onSelectAll}
            className="w-5 h-5 flex items-center justify-center rounded border border-[#1e2d4d] bg-[#162036] cursor-pointer hover:border-teal-500/50 transition-colors"
            title={allSelected ? 'Deselect all' : 'Select all'}
          >
            {allSelected && <i className="ri-check-line text-teal-400 text-xs"></i>}
          </button>
          <span className="text-sm font-semibold text-slate-200">
            {selectedCount} selected
          </span>
          <button
            onClick={onClearSelection}
            className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
          >
            Clear
          </button>
        </div>

        <div className="h-5 w-px bg-[#1e2d4d] hidden sm:block"></div>

        {/* Desktop actions */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
          {actions.map((action) => (
            <button
              key={action.key}
              onClick={() => handleActionClick(action)}
              disabled={processing}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap border disabled:opacity-50 ${variantClasses[action.variant]}`}
            >
              {processing && processingAction === action.key ? (
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5 inline-block"></div>
              ) : (
                <i className={`${action.icon} mr-1.5`}></i>
              )}
              {action.label}
            </button>
          ))}
        </div>

        {/* Mobile actions toggle */}
        <div className="sm:hidden ml-auto">
          <button
            onClick={() => setShowMobileActions(!showMobileActions)}
            className="bg-[#162036] text-slate-300 px-3 py-2 rounded-lg text-sm font-medium border border-[#1e2d4d] cursor-pointer whitespace-nowrap"
          >
            <i className="ri-more-line mr-1.5"></i>
            Actions
          </button>
        </div>

        {processing && !processingAction && (
          <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin ml-auto"></div>
        )}
      </div>

      {/* Mobile action sheet */}
      {showMobileActions && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 bg-[#111d35] border-t border-[#1e2d4d] rounded-t-2xl shadow-2xl p-4 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-200">
              {selectedCount} selected
            </span>
            <button
              onClick={() => setShowMobileActions(false)}
              className="w-8 h-8 flex items-center justify-center text-slate-500 cursor-pointer"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {actions.map((action) => (
              <button
                key={action.key}
                onClick={() => {
                  handleActionClick(action);
                  setShowMobileActions(false);
                }}
                disabled={processing}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap border disabled:opacity-50 ${variantClasses[action.variant]}`}
              >
                {processing && processingAction === action.key ? (
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <i className={action.icon}></i>
                )}
                {action.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClearSelection}
            className="w-full mt-3 py-3 text-sm text-slate-500 font-medium cursor-pointer"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Mobile overlay */}
      {showMobileActions && (
        <div
          className="sm:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setShowMobileActions(false)}
        ></div>
      )}

      {/* Confirmation Modal */}
      {activeAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmAction(null)}></div>
          <div className="bg-[#111d35] rounded-2xl max-w-md w-full p-6 border border-[#1e2d4d] relative z-10 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/25">
                <i className="ri-error-warning-line text-xl text-red-400"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {activeAction.confirmationTitle || `Confirm ${activeAction.label}`}
                </h3>
                <p className="text-sm text-slate-500">
                  {activeAction.confirmationMessage || `Are you sure you want to ${activeAction.label.toLowerCase()} ${selectedCount} item${selectedCount !== 1 ? 's' : ''}?`}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={processing}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {processing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <i className={activeAction.confirmButtonIcon || 'ri-check-line'}></i>
                )}
                {activeAction.confirmButtonText || 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="px-6 py-3 border border-[#1e2d4d] text-slate-300 rounded-xl font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}