'use client';

import { useState } from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'dateRange' | 'search';
  options?: FilterOption[];
  placeholder?: string;
  icon?: string;
}

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  filterConfigs: FilterConfig[];
  sortBy: string;
  onSortChange: (sort: string) => void;
  sortOptions: FilterOption[];
  resultCount?: number;
  loading?: boolean;
  onClear: () => void;
  showMobilePanel?: boolean;
  onToggleMobilePanel?: () => void;
  theme?: 'dark' | 'light';
}

export function useSearchFilterBar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState('');
  const [showMobilePanel, setShowMobilePanel] = useState(false);

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearAll = () => {
    setSearchQuery('');
    setFilters({});
    setSortBy('');
    setShowMobilePanel(false);
  };

  const activeFilterCount = Object.values(filters).filter((v) => v && v !== 'all' && v !== '').length + (searchQuery ? 1 : 0) + (sortBy ? 1 : 0);

  return {
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    sortBy,
    setSortBy,
    showMobilePanel,
    setShowMobilePanel,
    clearAll,
    activeFilterCount,
  };
}

export default function SearchFilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters,
  onFilterChange,
  filterConfigs,
  sortBy,
  onSortChange,
  sortOptions,
  resultCount,
  loading = false,
  onClear,
  showMobilePanel,
  onToggleMobilePanel,
  theme = 'dark',
}: SearchFilterBarProps) {
  const isDark = theme === 'dark';

  const inputBg = isDark
    ? 'bg-[#162036] border-[#1e2d4d] text-white placeholder:text-slate-500 focus:ring-teal-500'
    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-teal-500';

  const selectBg = isDark
    ? 'bg-[#162036] border-[#1e2d4d] text-slate-300'
    : 'bg-slate-50 border-slate-200 text-slate-700';

  const panelBg = isDark
    ? 'bg-[#111d35] border-[#1e2d4d]'
    : 'bg-white border-slate-200';

  const chipBtnBg = isDark
    ? 'bg-[#162036] border-[#1e2d4d]'
    : 'bg-slate-100 border-slate-200';

  const chipBtnText = isDark ? 'text-slate-400' : 'text-slate-600';

  const activeFilterCount = Object.values(filters).filter((v) => v && v !== 'all' && v !== '').length + (searchQuery ? 1 : 0) + (sortBy ? 1 : 0);

  const activeChips = [
    ...(searchQuery ? [{ key: 'search', label: `"${searchQuery}"`, onRemove: () => onSearchChange('') }] : []),
    ...(sortBy ? [{ key: 'sort', label: `Sort: ${sortOptions.find((o) => o.value === sortBy)?.label || sortBy}`, onRemove: () => onSortChange('') }] : []),
    ...Object.entries(filters)
      .filter(([_, v]) => v && v !== 'all' && v !== '')
      .map(([k, v]) => {
        const config = filterConfigs.find((c) => c.key === k);
        let displayLabel = v;
        if (config?.type === 'select' && config.options) {
          displayLabel = config.options.find((o) => o.value === v)?.label || v;
        }
        return {
          key: k,
          label: `${config?.label || k}: ${displayLabel}`,
          onRemove: () => onFilterChange(k, config?.type === 'select' ? 'all' : ''),
        };
      }),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <i className={`ri-search-line absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}></i>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={`w-full pl-10 pr-10 py-2.5 border rounded-xl text-sm focus:ring-2 focus:border-transparent ${inputBg}`}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <i className="ri-close-line"></i>
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="relative min-w-[180px]">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className={`w-full appearance-none pl-3 pr-10 py-2.5 border rounded-xl text-sm cursor-pointer focus:ring-2 focus:ring-teal-500 ${selectBg}`}
          >
            <option value="">Sort by...</option>
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <i className={`ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`}></i>
        </div>

        {/* Mobile filter toggle */}
        <button
          onClick={onToggleMobilePanel}
          className={`md:hidden flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${chipBtnBg} ${chipBtnText}`}
        >
          <i className="ri-filter-3-line"></i>
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-teal-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Desktop inline filters */}
        <div className="hidden md:flex items-center gap-2 flex-wrap">
          {filterConfigs
            .filter((c) => c.type === 'select')
            .map((config) => (
              <div key={config.key} className="relative">
                <select
                  value={filters[config.key] || 'all'}
                  onChange={(e) => onFilterChange(config.key, e.target.value)}
                  className={`appearance-none pl-3 pr-8 py-2.5 border rounded-xl text-sm cursor-pointer focus:ring-2 focus:ring-teal-500 ${selectBg}`}
                >
                  <option value="all">{config.label}</option>
                  {config.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <i className={`ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`}></i>
              </div>
            ))}

          {filterConfigs
            .filter((c) => c.type === 'dateRange')
            .map((config) => (
              <div key={config.key} className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters[`${config.key}_from`] || filters['date_from'] || ''}
                  onChange={(e) => onFilterChange(`${config.key}_from`, e.target.value)}
                  className={`px-3 py-2.5 border rounded-xl text-sm cursor-pointer focus:ring-2 focus:ring-teal-500 ${selectBg}`}
                />
                <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>to</span>
                <input
                  type="date"
                  value={filters[`${config.key}_to`] || filters['date_to'] || ''}
                  onChange={(e) => onFilterChange(`${config.key}_to`, e.target.value)}
                  className={`px-3 py-2.5 border rounded-xl text-sm cursor-pointer focus:ring-2 focus:ring-teal-500 ${selectBg}`}
                />
              </div>
            ))}

          {activeFilterCount > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer whitespace-nowrap border border-red-500/25"
            >
              <i className="ri-close-circle-line"></i>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Mobile filter panel */}
      {showMobilePanel && (
        <div className={`md:hidden rounded-xl border p-4 space-y-4 ${panelBg}`}>
          {filterConfigs.map((config) => {
            if (config.type === 'select') {
              return (
                <div key={config.key}>
                  <label className={`text-xs font-medium block mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{config.label}</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onFilterChange(config.key, 'all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                        (filters[config.key] || 'all') === 'all'
                          ? 'bg-teal-500 text-white border-teal-500'
                          : `${chipBtnBg} ${chipBtnText}`
                      }`}
                    >
                      All
                    </button>
                    {config.options?.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => onFilterChange(config.key, o.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                          filters[config.key] === o.value
                            ? 'bg-teal-500 text-white border-teal-500'
                            : `${chipBtnBg} ${chipBtnText}`
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }
            if (config.type === 'dateRange') {
              return (
                <div key={config.key}>
                  <label className={`text-xs font-medium block mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{config.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={filters[`${config.key}_from`] || filters['date_from'] || ''}
                      onChange={(e) => onFilterChange(`${config.key}_from`, e.target.value)}
                      className={`flex-1 px-3 py-2 border rounded-lg text-sm cursor-pointer ${selectBg}`}
                    />
                    <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>to</span>
                    <input
                      type="date"
                      value={filters[`${config.key}_to`] || filters['date_to'] || ''}
                      onChange={(e) => onFilterChange(`${config.key}_to`, e.target.value)}
                      className={`flex-1 px-3 py-2 border rounded-lg text-sm cursor-pointer ${selectBg}`}
                    />
                  </div>
                </div>
              );
            }
            return null;
          })}

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-[#1e2d4d]">
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{resultCount ?? 0} results</span>
            <div className="flex gap-2">
              <button
                onClick={onClear}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-red-400 border border-red-500/25 hover:bg-red-500/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                Clear All
              </button>
              <button
                onClick={onToggleMobilePanel}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-teal-500 text-white hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              onClick={chip.onRemove}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/25 hover:bg-teal-500/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              {chip.label}
              <i className="ri-close-line text-[10px]"></i>
            </button>
          ))}
          {activeChips.length > 1 && (
            <button
              onClick={onClear}
              className="text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer whitespace-nowrap"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Result count */}
      {resultCount !== undefined && (
        <div className="flex items-center justify-between">
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-teal-500 border-t-transparent rounded-full animate-spin inline-block"></span>
                Loading...
              </span>
            ) : (
              <>
                <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{resultCount}</span>
                {' '}result{resultCount !== 1 ? 's' : ''}
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}