'use client';

import { useState } from 'react';

interface FilterState {
  buildStatus: string | null;
  healthStatus: string | null;
  hasCriticalAlerts: boolean;
  hasBlockedTasks: boolean;
  hasFailedBuilds: boolean;
  hasFailedBackups: boolean;
  showArchived: boolean | null;
}

interface SearchAndFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  isSuperAdmin: boolean;
  blockedTaskSlugs: Set<string>;
  failedBuildSlugs: Set<string>;
  failedBackupSlugs: Set<string>;
}

const BUILD_STATUS_OPTIONS = [
  { value: '', label: 'All Build Statuses' },
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'uat', label: 'UAT' },
  { value: 'ready', label: 'Ready' },
  { value: 'live', label: 'Live' },
  { value: 'maintenance', label: 'Maintenance' },
];

const HEALTH_STATUS_OPTIONS = [
  { value: '', label: 'All Health Statuses' },
  { value: 'healthy', label: 'Healthy' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'critical', label: 'Critical' },
  { value: 'unknown', label: 'Unknown' },
];

const defaultFilters: FilterState = {
  buildStatus: null,
  healthStatus: null,
  hasCriticalAlerts: false,
  hasBlockedTasks: false,
  hasFailedBuilds: false,
  hasFailedBackups: false,
  showArchived: false,
};

export default function SearchAndFilterBar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  isSuperAdmin,
  blockedTaskSlugs,
  failedBuildSlugs,
  failedBackupSlugs,
}: SearchAndFilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);

  const actualActiveCount = [
    filters.buildStatus,
    filters.healthStatus,
    filters.hasCriticalAlerts,
    filters.hasBlockedTasks,
    filters.hasFailedBuilds,
    filters.hasFailedBackups,
    filters.showArchived === true,
  ].filter(Boolean).length;

  const hasAnyFilters = actualActiveCount > 0;

  const clearAll = () => {
    onFiltersChange({ ...defaultFilters });
  };

  const updateFilter = (key: keyof FilterState, value: unknown) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleFilter = (key: keyof FilterState) => {
    updateFilter(key, !filters[key]);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="relative flex-1 w-full">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <div className="w-4 h-4 flex items-center justify-center text-slate-500">
            <i className="ri-search-line text-sm"></i>
          </div>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search projects, tasks, deployments, backups..."
          className="w-full pl-9 pr-9 py-2.5 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
          >
            <div className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
              <i className="ri-close-line text-sm"></i>
            </div>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border ${
              hasAnyFilters
                ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-600/30'
                : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:border-slate-500/30 hover:text-white'
            }`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-filter-3-line text-sm"></i>
            </div>
            Filters
            {actualActiveCount > 0 && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${hasAnyFilters ? 'bg-indigo-600 text-white' : 'bg-[#1a2b4a] text-slate-400'}`}>
                {actualActiveCount}
              </span>
            )}
          </button>

          {showFilters && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#111d35] border border-[#1a2b4a] rounded-2xl shadow-2xl z-40 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Filters</h4>
                {hasAnyFilters && (
                  <button
                    onClick={clearAll}
                    className="text-[10px] font-medium text-indigo-400 hover:text-indigo-300 cursor-pointer whitespace-nowrap"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Build Status</label>
                <select
                  value={filters.buildStatus || ''}
                  onChange={(e) => updateFilter('buildStatus', e.target.value || null)}
                  className="w-full bg-[#0a1628] border border-[#1a2b4a] rounded-lg text-[11px] font-medium text-slate-300 px-3 py-2 pr-8 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                >
                  {BUILD_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Health Status</label>
                <select
                  value={filters.healthStatus || ''}
                  onChange={(e) => updateFilter('healthStatus', e.target.value || null)}
                  className="w-full bg-[#0a1628] border border-[#1a2b4a] rounded-lg text-[11px] font-medium text-slate-300 px-3 py-2 pr-8 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                >
                  {HEALTH_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 pt-1 border-t border-[#1a2b4a]">
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Quick Toggles</label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasCriticalAlerts}
                    onChange={() => toggleFilter('hasCriticalAlerts')}
                    className="w-3.5 h-3.5 rounded border-[#1a2b4a] bg-[#0a1628] accent-red-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-400">Has critical alerts</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasBlockedTasks}
                    onChange={() => toggleFilter('hasBlockedTasks')}
                    className="w-3.5 h-3.5 rounded border-[#1a2b4a] bg-[#0a1628] accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-400">Has blocked tasks</span>
                  <span className="text-[9px] text-slate-600 ml-auto">{blockedTaskSlugs.size} projects</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasFailedBuilds}
                    onChange={() => toggleFilter('hasFailedBuilds')}
                    className="w-3.5 h-3.5 rounded border-[#1a2b4a] bg-[#0a1628] accent-red-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-400">Has failed builds</span>
                  <span className="text-[9px] text-slate-600 ml-auto">{failedBuildSlugs.size} projects</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasFailedBackups}
                    onChange={() => toggleFilter('hasFailedBackups')}
                    className="w-3.5 h-3.5 rounded border-[#1a2b4a] bg-[#0a1628] accent-red-500 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-400">Has failed backups</span>
                  <span className="text-[9px] text-slate-600 ml-auto">{failedBackupSlugs.size} projects</span>
                </label>
              </div>

              <div className="space-y-2 pt-1 border-t border-[#1a2b4a]">
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Project State</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => updateFilter('showArchived', false)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      filters.showArchived === false
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#0a1628] text-slate-400 hover:text-white'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => updateFilter('showArchived', true)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      filters.showArchived === true
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#0a1628] text-slate-400 hover:text-white'
                    }`}
                  >
                    Archived
                  </button>
                  <button
                    onClick={() => updateFilter('showArchived', null)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      filters.showArchived === null
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#0a1628] text-slate-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {searchQuery && (
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            Searching across all projects, tasks, deployments &amp; backups
          </span>
        )}
      </div>
    </div>
  );
}