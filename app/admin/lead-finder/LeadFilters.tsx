'use client';

interface Props {
  search: string;
  onSearch: (s: string) => void;
  sectorFilter: string;
  onSector: (s: string) => void;
  statusFilter: string;
  onStatus: (s: string) => void;
  emailStatusFilter: string;
  onEmailStatus: (s: string) => void;
  scoreMin: string;
  onScoreMin: (s: string) => void;
  optOutFilter: string;
  onOptOut: (s: string) => void;
  onExport: () => void;
  sectors: string[];
}

const selectCls = 'px-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm text-slate-300 bg-[#111d35] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 cursor-pointer pr-8';

export default function LeadFilters({
  search, onSearch,
  sectorFilter, onSector,
  statusFilter, onStatus,
  emailStatusFilter, onEmailStatus,
  scoreMin, onScoreMin,
  optOutFilter, onOptOut,
  onExport,
  sectors,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-500">
            <i className="ri-search-line text-sm"></i>
          </div>
          <input
            type="text"
            placeholder="Search company, email, phone or location..."
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm bg-[#111d35] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50"
          />
        </div>

        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition cursor-pointer whitespace-nowrap"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-download-line"></i>
          </div>
          Export
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={e => onStatus(e.target.value)}
          className={selectCls}
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="not_suitable">Not Suitable</option>
          <option value="converted">Converted</option>
          <option value="archived">Archived</option>
        </select>

        <select
          value={emailStatusFilter}
          onChange={e => onEmailStatus(e.target.value)}
          className={selectCls}
        >
          <option value="all">All Email Statuses</option>
          <option value="not_sent">Not Sent</option>
          <option value="queued">Queued</option>
          <option value="sent">Sent</option>
          <option value="replied">Replied</option>
          <option value="bounced">Bounced</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>

        <select
          value={sectorFilter}
          onChange={e => onSector(e.target.value)}
          className={selectCls}
        >
          <option value="all">All Sectors</option>
          {sectors.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={scoreMin}
          onChange={e => onScoreMin(e.target.value)}
          className={selectCls}
        >
          <option value="0">Min Score: Any</option>
          <option value="50">50+</option>
          <option value="60">60+</option>
          <option value="70">70+</option>
          <option value="80">80+</option>
          <option value="90">90+</option>
        </select>

        <select
          value={optOutFilter}
          onChange={e => onOptOut(e.target.value)}
          className={selectCls}
        >
          <option value="all">Opt-out: All</option>
          <option value="false">Not Opted Out</option>
          <option value="true">Opted Out</option>
        </select>

        <button
          onClick={() => { onSearch(''); onStatus('all'); onEmailStatus('all'); onSector('all'); onScoreMin('0'); onOptOut('all'); }}
          className="px-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition cursor-pointer whitespace-nowrap"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}