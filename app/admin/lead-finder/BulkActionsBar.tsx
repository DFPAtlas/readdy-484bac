'use client';

interface Props {
  selectedCount: number;
  onMarkContacted: () => void;
  onMarkNotSuitable: () => void;
  onExportCSV: () => void;
  onClear: () => void;
  loading: string | null;
}

export default function BulkActionsBar({ selectedCount, onMarkContacted, onMarkNotSuitable, onExportCSV, onClear, loading }: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-teal-500/5 border border-teal-500/20 rounded-2xl px-5 py-3 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-teal-400">
          {selectedCount} lead{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <button
          onClick={onClear}
          className="text-xs font-medium text-teal-400/70 hover:text-teal-300 cursor-pointer whitespace-nowrap transition"
        >
          Clear
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onMarkContacted}
          disabled={loading !== null}
          className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition cursor-pointer whitespace-nowrap disabled:opacity-50"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className={`${loading === 'contacted' ? 'ri-loader-4-line animate-spin' : 'ri-phone-line'}`}></i>
          </div>
          Mark Contacted
        </button>
        <button
          onClick={onMarkNotSuitable}
          disabled={loading !== null}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-500/10 border border-slate-500/20 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-500/20 transition cursor-pointer whitespace-nowrap disabled:opacity-50"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className={`${loading === 'not_suitable' ? 'ri-loader-4-line animate-spin' : 'ri-close-circle-line'}`}></i>
          </div>
          Not Suitable
        </button>
        <button
          onClick={onExportCSV}
          disabled={loading !== null}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#1a2b4a] border border-[#243a5e] rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#243a5e] transition cursor-pointer whitespace-nowrap disabled:opacity-50"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-download-line"></i>
          </div>
          Export CSV
        </button>
      </div>
    </div>
  );
}