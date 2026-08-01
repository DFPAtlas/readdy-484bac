'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  search: string;
  onSearch: (v: string) => void;
  statusFilter: string;
  onStatus: (v: string) => void;
  severityFilter: string;
  onSeverity: (v: string) => void;
  categoryFilter: string;
  onCategory: (v: string) => void;
  onExport: () => void;
  hasData: boolean;
}

export default function ComplaintsFilters({
  search, onSearch, statusFilter, onStatus,
  severityFilter, onSeverity, categoryFilter, onCategory,
  onExport, hasData,
}: Props) {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase
        .from('complaints')
        .select('category');
      if (data) {
        const unique = [...new Set(data.map((d: any) => d.category))].sort();
        setCategories(unique);
      }
    };
    loadCategories();
  }, []);

  const displayCategories = categories.length > 0
    ? categories
    : ['guard_behavior', 'no_show', 'late_arrival', 'unprofessional_conduct', 'safety_issue', 'payment_dispute', 'service_quality', 'technical_issue', 'other'];

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5 mb-6 space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-64">
          <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
          <input
            type="text"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search by ID, name, category, description..."
            className="w-full pl-11 pr-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-[#0a1628] text-white placeholder-slate-500"
          />
        </div>
        <button
          onClick={onExport}
          disabled={!hasData}
          className="flex items-center gap-2 px-4 py-2.5 border border-[#1a2b4a] text-slate-400 rounded-xl hover:bg-[#1a2b4a] hover:text-white text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-download-2-line"></i>
          </div>
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Status:</span>
        {['all', 'open', 'under_review', 'resolved', 'closed'].map(s => (
          <button key={s} onClick={() => onStatus(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition cursor-pointer whitespace-nowrap ${
              statusFilter === s ? 'bg-teal-500 text-white border-teal-500 shadow-sm' : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:bg-[#1a2b4a] hover:text-white'
            }`}>
            {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Severity:</span>
        {['all', 'low', 'medium', 'high', 'critical'].map(s => (
          <button key={s} onClick={() => onSeverity(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition cursor-pointer whitespace-nowrap ${
              severityFilter === s ? 'bg-teal-500 text-white border-teal-500 shadow-sm' : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:bg-[#1a2b4a] hover:text-white'
            }`}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Category:</span>
        <button onClick={() => onCategory('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition cursor-pointer whitespace-nowrap ${
            categoryFilter === 'all' ? 'bg-teal-500 text-white border-teal-500 shadow-sm' : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:bg-[#1a2b4a] hover:text-white'
          }`}>
          All
        </button>
        {displayCategories.map(c => (
          <button key={c} onClick={() => onCategory(c)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition cursor-pointer whitespace-nowrap ${
              categoryFilter === c ? 'bg-teal-500 text-white border-teal-500 shadow-sm' : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:bg-[#1a2b4a] hover:text-white'
            }`}>
            {c.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase())}
          </button>
        ))}
      </div>
    </div>
  );
}