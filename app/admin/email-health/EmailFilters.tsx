'use client';

import { useState, useEffect, useRef } from 'react';

export type DateRange = '24h' | '7d' | '30d' | 'custom';

interface FiltersProps {
  dateRange: DateRange;
  customStart: string;
  customEnd: string;
  statusFilter: string;
  templateFilter: string;
  templates: string[];
  onDateRangeChange: (range: DateRange) => void;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onTemplateChange: (v: string) => void;
  onClear: () => void;
  hasFilters: boolean;
}

export default function EmailFilters({
  dateRange,
  customStart,
  customEnd,
  statusFilter,
  templateFilter,
  templates,
  onDateRangeChange,
  onCustomStartChange,
  onCustomEndChange,
  onStatusChange,
  onTemplateChange,
  onClear,
  hasFilters,
}: FiltersProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const statusRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) setTemplateOpen(false);
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setStatusOpen(false);
        setTemplateOpen(false);
        setDateOpen(false);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const dateLabels: Record<DateRange, string> = { '24h': 'Last 24 hours', '7d': 'Last 7 days', '30d': 'Last 30 days', 'custom': 'Custom range' };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative" ref={dateRef}>
        <button
          onClick={() => { setDateOpen(!dateOpen); setStatusOpen(false); setTemplateOpen(false); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#111d35] border border-[#1a2b4a] text-slate-300 hover:text-white hover:border-[#2a3d5c] transition cursor-pointer whitespace-nowrap"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-calendar-line text-sm"></i>
          </div>
          {dateLabels[dateRange]}
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-arrow-down-s-line text-sm text-slate-500"></i>
          </div>
        </button>
        {dateOpen && (
          <div className="absolute top-full mt-1 left-0 z-40 bg-[#111d35] border border-[#1a2b4a] rounded-xl shadow-lg py-1 min-w-[180px]">
            {(['24h', '7d', '30d', 'custom'] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => { onDateRangeChange(r); setDateOpen(false); }}
                className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap hover:bg-[#1a2b4a] transition ${dateRange === r ? 'text-teal-400' : 'text-slate-300'}`}
              >
                {dateLabels[r]}
              </button>
            ))}
          </div>
        )}
      </div>

      {dateRange === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => onCustomStartChange(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm bg-[#111d35] border border-[#1a2b4a] text-white focus:outline-none focus:border-teal-500"
          />
          <span className="text-slate-500 text-sm">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => onCustomEndChange(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm bg-[#111d35] border border-[#1a2b4a] text-white focus:outline-none focus:border-teal-500"
          />
        </div>
      )}

      <div className="relative" ref={statusRef}>
        <button
          onClick={() => { setStatusOpen(!statusOpen); setTemplateOpen(false); setDateOpen(false); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#111d35] border border-[#1a2b4a] text-slate-300 hover:text-white hover:border-[#2a3d5c] transition cursor-pointer whitespace-nowrap"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-filter-3-line text-sm"></i>
          </div>
          {statusFilter ? `Status: ${statusFilter}` : 'All Statuses'}
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-arrow-down-s-line text-sm text-slate-500"></i>
          </div>
        </button>
        {statusOpen && (
          <div className="absolute top-full mt-1 left-0 z-40 bg-[#111d35] border border-[#1a2b4a] rounded-xl shadow-lg py-1 min-w-[160px]">
            {['', 'sent', 'failed'].map((s) => (
              <button
                key={s}
                onClick={() => { onStatusChange(s); setStatusOpen(false); }}
                className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap hover:bg-[#1a2b4a] transition ${statusFilter === s ? 'text-teal-400' : 'text-slate-300'}`}
              >
                {s || 'All Statuses'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative" ref={templateRef}>
        <button
          onClick={() => { setTemplateOpen(!templateOpen); setStatusOpen(false); setDateOpen(false); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#111d35] border border-[#1a2b4a] text-slate-300 hover:text-white hover:border-[#2a3d5c] transition cursor-pointer whitespace-nowrap"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-mail-line text-sm"></i>
          </div>
          {templateFilter ? `Template: ${templateFilter}` : 'All Templates'}
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-arrow-down-s-line text-sm text-slate-500"></i>
          </div>
        </button>
        {templateOpen && (
          <div className="absolute top-full mt-1 left-0 z-40 bg-[#111d35] border border-[#1a2b4a] rounded-xl shadow-lg py-1 min-w-[200px] max-h-[300px] overflow-y-auto">
            <button
              onClick={() => { onTemplateChange(''); setTemplateOpen(false); }}
              className="block w-full text-left px-4 py-2 text-sm hover:bg-[#1a2b4a] transition text-slate-300"
            >
              All Templates
            </button>
            {templates.map((t) => (
              <button
                key={t}
                onClick={() => { onTemplateChange(t); setTemplateOpen(false); }}
                className={`block w-full text-left px-4 py-2 text-sm hover:bg-[#1a2b4a] transition whitespace-nowrap ${templateFilter === t ? 'text-teal-400' : 'text-slate-300'}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {hasFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition cursor-pointer whitespace-nowrap"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-close-line text-sm"></i>
          </div>
          Clear
        </button>
      )}
    </div>
  );
}