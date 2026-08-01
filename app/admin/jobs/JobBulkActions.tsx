'use client';

import { useState } from 'react';

interface JobBulkActionsProps {
  selectedCount: number;
  processing: boolean;
  onApply: (action: string) => void;
  onClear: () => void;
}

export default function JobBulkActions({ selectedCount, processing, onApply, onClear }: JobBulkActionsProps) {
  const [bulkAction, setBulkAction] = useState('');

  return (
    <div className="bg-teal-500/10 border border-teal-500/25 rounded-2xl p-4 mb-6 flex items-center gap-4 flex-wrap">
      <span className="text-sm font-bold text-teal-400">{selectedCount} selected</span>
      <div className="relative">
        <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}
          className="pl-4 pr-8 py-2 rounded-xl border border-teal-500/25 text-sm font-medium text-teal-400 bg-[#0a1527] appearance-none cursor-pointer">
          <option value="">Choose action...</option>
          <option value="open">Reopen</option>
          <option value="pause">Pause</option>
          <option value="close">Close</option>
          <option value="flag">Flag</option>
          <option value="delete">Delete</option>
        </select>
        <div className="w-4 h-4 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 pointer-events-none">
          <i className="ri-arrow-down-s-line text-sm"></i>
        </div>
      </div>
      <button onClick={() => { onApply(bulkAction); setBulkAction(''); }}
        disabled={!bulkAction || processing}
        className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer">
        {processing ? 'Processing...' : 'Apply'}
      </button>
      <button onClick={onClear}
        className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white transition-all whitespace-nowrap cursor-pointer">Clear</button>
    </div>
  );
}