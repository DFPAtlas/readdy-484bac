'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  search: string;
  onSearch: (s: string) => void;
  statusFilter: string;
  onStatus: (s: string) => void;
  categoryFilter: string;
  onCategory: (c: string) => void;
  categories: string[];
  onExport: () => void;
  hasData: boolean;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'in progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'archived', label: 'Archived' },
];

const DEFAULT_CATEGORIES = [
  'General Enquiry',
  'Guard Support',
  'Client Support',
  'Technical Issue',
  'Billing',
  'Partnership',
  'Feedback',
  'Complaint',
];

function DropdownFilter({ label, options, value, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activeOption = options.find(o => o.value === value);
  const displayLabel = activeOption ? activeOption.label : value;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm text-slate-300 bg-[#0a1628] hover:bg-[#1a2b4a] focus:outline-none cursor-pointer whitespace-nowrap flex items-center gap-2 min-w-[140px] justify-between"
      >
        <span>{displayLabel}</span>
        {open ? (
          <i className="ri-arrow-up-s-line text-slate-400 text-xs"></i>
        ) : (
          <i className="ri-arrow-down-s-line text-slate-400 text-xs"></i>
        )}
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-full bg-[#111d35] border border-[#1a2b4a] rounded-xl shadow-xl z-40 py-1 overflow-hidden">
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm cursor-pointer whitespace-nowrap transition-colors ${
                value === o.value
                  ? 'bg-teal-600/20 text-teal-400 font-semibold'
                  : 'text-slate-300 hover:bg-[#1a2b4a] hover:text-white'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SubmissionsFilters({ search, onSearch, statusFilter, onStatus, categoryFilter, onCategory, categories, onExport, hasData }: Props) {
  const mergedCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...mergedCategories.map(c => ({ value: c, label: c })),
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400">
          <i className="ri-search-line"></i>
        </div>
        <input
          type="text"
          placeholder="Search by name, email or subject..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm bg-[#0a1628] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50"
        />
      </div>

      <div className="flex gap-2">
        <DropdownFilter
          label="Status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={onStatus}
        />

        <DropdownFilter
          label="Category"
          options={categoryOptions}
          value={categoryFilter}
          onChange={onCategory}
        />

        <button
          onClick={onExport}
          disabled={!hasData}
          className="flex items-center gap-2 px-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap transition-colors"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-download-line"></i>
          </div>
          Export
        </button>
      </div>
    </div>
  );
}