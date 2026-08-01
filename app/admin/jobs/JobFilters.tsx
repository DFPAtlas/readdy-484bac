'use client';

interface JobFiltersProps {
  search: string;
  filterStatus: string;
  filterUrgency: string;
  filterCity: string;
  filterSia: boolean;
  filterFlagged: boolean;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  cities: string[];
  loading: boolean;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onFilterChange: (key: string, value: string | boolean) => void;
  onDateChange: (key: 'dateFrom' | 'dateTo', value: string) => void;
  onClearFilters: () => void;
}

export default function JobFilters({
  search, filterStatus, filterUrgency, filterCity, filterSia, filterFlagged,
  dateFrom, dateTo, sortBy, cities, loading, onRefresh,
  onSearchChange, onFilterChange, onDateChange, onClearFilters,
}: JobFiltersProps) {
  const hasActiveFilters = filterStatus !== 'all' || filterUrgency !== 'all' || filterCity !== 'all' || filterSia || filterFlagged || dateFrom || dateTo || search;

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-5 mb-6">
      <div className="flex flex-col lg:flex-row gap-4 mb-4">
        <div className="flex-1 relative">
          <div className="w-5 h-5 flex items-center justify-center absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
            <i className="ri-search-line text-lg"></i>
          </div>
          <input
            type="text"
            placeholder="Search jobs, clients, or locations..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#1e2d4d] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-medium text-white placeholder:text-slate-500 bg-[#0a1527] transition-all"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <div className="w-4 h-4 flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <i className="ri-calendar-line text-sm"></i>
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateChange('dateFrom', e.target.value)}
              className="pl-9 pr-3 py-3 rounded-xl border border-[#1e2d4d] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-medium text-white bg-[#0a1527] transition-all [color-scheme:dark]"
            />
          </div>
          <span className="text-slate-400 text-sm">to</span>
          <div className="relative">
            <div className="w-4 h-4 flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <i className="ri-calendar-line text-sm"></i>
            </div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateChange('dateTo', e.target.value)}
              className="pl-9 pr-3 py-3 rounded-xl border border-[#1e2d4d] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-medium text-white bg-[#0a1527] transition-all [color-scheme:dark]"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { onDateChange('dateFrom', ''); onDateChange('dateTo', ''); }} className="px-3 py-3 text-sm text-slate-400 hover:text-white transition-colors whitespace-nowrap">
              Clear
            </button>
          )}
          <button onClick={onRefresh} disabled={loading} className="px-4 py-2 bg-teal-500/10 text-teal-400 rounded-xl text-sm font-semibold hover:bg-teal-500/20 flex items-center gap-2 whitespace-nowrap disabled:opacity-50 cursor-pointer">
            <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select value={filterStatus} onChange={(e) => onFilterChange('filterStatus', e.target.value)}
            className="pl-4 pr-8 py-2.5 rounded-xl border border-[#1e2d4d] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-medium text-white bg-[#0a1527] transition-all appearance-none cursor-pointer">
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="paused">Paused</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="awaiting_payment">Awaiting Payment</option>
            <option value="awaiting_guard_selection">Awaiting Selection</option>
            <option value="flagged">Flagged</option>
          </select>
          <div className="w-4 h-4 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            <i className="ri-arrow-down-s-line text-sm"></i>
          </div>
        </div>

        <div className="relative">
          <select value={filterUrgency} onChange={(e) => onFilterChange('filterUrgency', e.target.value)}
            className="pl-4 pr-8 py-2.5 rounded-xl border border-[#1e2d4d] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-medium text-white bg-[#0a1527] transition-all appearance-none cursor-pointer">
            <option value="all">All Urgency</option>
            <option value="immediate">Immediate</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="standard">Standard</option>
          </select>
          <div className="w-4 h-4 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            <i className="ri-arrow-down-s-line text-sm"></i>
          </div>
        </div>

        <div className="relative">
          <select value={filterCity} onChange={(e) => onFilterChange('filterCity', e.target.value)}
            className="pl-4 pr-8 py-2.5 rounded-xl border border-[#1e2d4d] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-medium text-white bg-[#0a1527] transition-all appearance-none cursor-pointer">
            <option value="all">All Cities</option>
            {cities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
          <div className="w-4 h-4 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            <i className="ri-arrow-down-s-line text-sm"></i>
          </div>
        </div>

        <div className="relative">
          <select value={sortBy} onChange={(e) => onFilterChange('sortBy', e.target.value)}
            className="pl-4 pr-8 py-2.5 rounded-xl border border-[#1e2d4d] focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-medium text-white bg-[#0a1527] transition-all appearance-none cursor-pointer">
            <option value="created_desc">Newest First</option>
            <option value="created_asc">Oldest First</option>
            <option value="pay_desc">Highest Pay</option>
            <option value="pay_asc">Lowest Pay</option>
            <option value="start_soon">Starting Soon</option>
            <option value="urgency">Urgency</option>
          </select>
          <div className="w-4 h-4 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            <i className="ri-arrow-down-s-line text-sm"></i>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#1e2d4d] bg-[#0a1527] cursor-pointer text-sm font-medium text-white">
          <input type="checkbox" checked={filterSia} onChange={(e) => onFilterChange('filterSia', e.target.checked)}
            className="w-4 h-4 text-teal-500 rounded border-slate-600 bg-[#0a1527] focus:ring-teal-500" />
          SIA Required
        </label>

        <label className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#1e2d4d] bg-[#0a1527] cursor-pointer text-sm font-medium text-white">
          <input type="checkbox" checked={filterFlagged} onChange={(e) => onFilterChange('filterFlagged', e.target.checked)}
            className="w-4 h-4 text-teal-500 rounded border-slate-600 bg-[#0a1527] focus:ring-teal-500" />
          Flagged Only
        </label>

        {hasActiveFilters && (
          <button onClick={onClearFilters}
            className="px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-white hover:bg-[#1a2642] rounded-xl transition-all whitespace-nowrap cursor-pointer">
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
}