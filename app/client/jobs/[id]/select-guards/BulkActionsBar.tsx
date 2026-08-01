"use client";

interface Props {
  checkedCount: number;
  onShortlist: () => void;
  onReject: () => void;
  onSelect: () => void;
  onClear: () => void;
  processing: boolean;
}

export default function BulkActionsBar({
  checkedCount,
  onShortlist,
  onReject,
  onSelect,
  onClear,
  processing,
}: Props) {
  if (checkedCount === 0) return null;

  return (
    <div className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-3 flex flex-wrap items-center gap-3 sticky bottom-2 z-30 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-200">
          {checkedCount} selected
        </span>
        <button
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
        >
          Clear
        </button>
      </div>
      <div className="h-5 w-px bg-[#1e2d4d] hidden sm:block"></div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onShortlist}
          disabled={processing}
          className="bg-violet-500/10 text-violet-400 px-3 py-2 rounded-lg text-sm font-medium hover:bg-violet-500/20 transition-colors cursor-pointer whitespace-nowrap border border-violet-500/25 disabled:opacity-50"
        >
          <i className="ri-bookmark-line mr-1.5"></i>
          Shortlist
        </button>
        <button
          onClick={onSelect}
          disabled={processing}
          className="bg-teal-500/10 text-teal-400 px-3 py-2 rounded-lg text-sm font-medium hover:bg-teal-500/20 transition-colors cursor-pointer whitespace-nowrap border border-teal-500/25 disabled:opacity-50"
        >
          <i className="ri-check-line mr-1.5"></i>
          Select
        </button>
        <button
          onClick={onReject}
          disabled={processing}
          className="bg-red-500/10 text-red-400 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors cursor-pointer whitespace-nowrap border border-red-500/25 disabled:opacity-50"
        >
          <i className="ri-close-circle-line mr-1.5"></i>
          Reject
        </button>
      </div>
      {processing && (
        <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin ml-auto"></div>
      )}
    </div>
  );
}