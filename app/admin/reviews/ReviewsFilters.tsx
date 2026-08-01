'use client';

interface Props {
  search: string;
  onSearch: (v: string) => void;
  ratingFilter: string;
  onRatingFilter: (v: string) => void;
  statusFilter: string;
  onStatusFilter: (v: string) => void;
}

export default function ReviewsFilters({ search, onSearch, ratingFilter, onRatingFilter, statusFilter, onStatusFilter }: Props) {
  const ratings = ['All', '5', '4', '3', '2', '1'];
  const statuses = ['All', 'published', 'hidden'];

  return (
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      <div className="relative flex-1 min-w-64">
        <div className="w-5 h-5 flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <i className="ri-search-line text-sm"></i>
        </div>
        <input
          type="text"
          placeholder="Search by guard name, client or job..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#1a2b4a] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50 bg-[#111d35] text-slate-200 placeholder:text-slate-500"
        />
      </div>

      <div className="flex items-center gap-1 bg-[#111d35] border border-[#1a2b4a] rounded-lg p-1">
        {ratings.map((r) => (
          <button
            key={r}
            onClick={() => onRatingFilter(r)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition cursor-pointer whitespace-nowrap ${
              ratingFilter === r ? 'bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/30' : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
            }`}
          >
            {r === 'All' ? 'All Stars' : `${r}★`}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 bg-[#111d35] border border-[#1a2b4a] rounded-lg p-1">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => onStatusFilter(s)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition cursor-pointer whitespace-nowrap capitalize ${
              statusFilter === s ? 'bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/30' : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
            }`}
          >
            {s === 'All' ? 'All Status' : s}
          </button>
        ))}
      </div>
    </div>
  );
}