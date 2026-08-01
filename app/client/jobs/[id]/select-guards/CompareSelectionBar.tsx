"use client";

interface Props {
  count: number;
  onCompare: () => void;
  onClear: () => void;
}

export default function CompareSelectionBar({ count, onCompare, onClear }: Props) {
  if (count < 2) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#111d35] border border-[#1e2d4d] rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 max-w-lg w-full mx-4">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 bg-teal-500/10 rounded-full flex items-center justify-center border border-teal-500/25 flex-shrink-0">
          <i className="ri-arrow-left-right-line text-teal-400 text-lg"></i>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-200">
            {count} guards selected
          </p>
          <p className="text-xs text-slate-500">Compare stats, rates & SIA details side-by-side</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onClear}
          className="bg-[#162036] text-slate-400 px-3 py-2 rounded-lg hover:bg-[#1a2642] transition-colors text-xs font-medium cursor-pointer whitespace-nowrap border border-[#1e2d4d]"
        >
          Clear
        </button>
        <button
          onClick={onCompare}
          className="bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap flex items-center gap-1.5"
        >
          <i className="ri-arrow-left-right-line"></i>
          Compare
        </button>
      </div>
    </div>
  );
}