'use client';

import { useState } from 'react';

interface EmailTemplate {
  id: string;
  name: string;
  template_slug: string;
  subject: string;
  body_html: string;
  category: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const categoryColors: Record<string, string> = {
  guard: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  client: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  admin: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  all: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

interface TemplateListProps {
  templates: EmailTemplate[];
  searchQuery: string;
  categoryFilter: string;
  onSearchChange: (q: string) => void;
  onCategoryChange: (c: string) => void;
  onEdit: (t: EmailTemplate) => void;
  onDelete: (id: string) => void;
  onPreview: (t: EmailTemplate) => void;
  onCreate: () => void;
  onDuplicate: (t: EmailTemplate) => void;
}

export default function TemplateList({
  templates,
  searchQuery,
  categoryFilter,
  onSearchChange,
  onCategoryChange,
  onEdit,
  onDelete,
  onPreview,
  onCreate,
  onDuplicate,
}: TemplateListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const categories = ['all', ...new Set(
    templates.map(t => t.category).filter(Boolean).filter(c => c !== 'all')
  )];

  const filtered = templates.filter(t => {
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesName = t.name.toLowerCase().includes(q);
      const matchesSlug = (t.template_slug || '').toLowerCase().includes(q);
      const matchesSubject = (t.subject || '').toLowerCase().includes(q);
      const matchesCategory = (t.category || '').toLowerCase().includes(q);
      if (!matchesName && !matchesSlug && !matchesSubject && !matchesCategory) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="bg-[#111d35] rounded-xl border border-[#1e2d4a] p-4 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
              <i className="ri-search-line text-slate-500"></i>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name, slug, subject, or category..."
              className="w-full pl-11 pr-4 py-2.5 border border-[#1e2d4a] rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-sm bg-[#0a1628] text-slate-200 placeholder:text-slate-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap capitalize ${
                  categoryFilter === cat
                    ? 'bg-teal-600 text-white'
                    : 'bg-[#0a1628] text-slate-400 hover:bg-[#1e2d4a] hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map(template => (
          <div
            key={template.id}
            className="bg-[#111d35] rounded-xl border border-[#1e2d4a] hover:border-teal-500/30 hover:shadow-lg transition-all group"
          >
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-base font-semibold text-white truncate">{template.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${categoryColors[template.category] || categoryColors.all}`}>
                      {template.category || 'all'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      template.is_active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/15 text-slate-500 border-slate-500/20'
                    }`}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-1 font-mono">{template.template_slug}</p>
                  <p className="text-sm text-slate-300 mb-2 truncate">{template.subject}</p>
                  {template.description && (
                    <p className="text-xs text-slate-500 mb-2 line-clamp-1">{template.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>
                      Updated {new Date(template.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onPreview(template)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-colors"
                    title="Preview"
                  >
                    <i className="ri-eye-line"></i>
                  </button>
                  <button
                    onClick={() => onEdit(template)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
                    title="Edit"
                  >
                    <i className="ri-edit-line"></i>
                  </button>
                  <button
                    onClick={() => onDuplicate(template)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-teal-500/15 text-teal-400 hover:bg-teal-500/25 transition-colors"
                    title="Duplicate"
                  >
                    <i className="ri-file-copy-line"></i>
                  </button>
                  {confirmDelete === template.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { onDelete(template.id); setConfirmDelete(null); }}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
                      >
                        <i className="ri-check-line"></i>
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-500/15 text-slate-400 hover:bg-slate-500/25 transition-colors"
                      >
                        <i className="ri-close-line"></i>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(template.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="bg-[#111d35] rounded-xl border border-[#1e2d4a] p-16 text-center">
            <div className="w-16 h-16 flex items-center justify-center bg-slate-500/10 rounded-full mx-auto mb-4">
              <i className="ri-mail-settings-line text-3xl text-slate-500"></i>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No templates found</h3>
            <p className="text-slate-400 mb-6 max-w-sm mx-auto">
              {templates.length === 0
                ? 'Get started by creating your first email template.'
                : 'No templates match your current filters. Try adjusting your search.'}
            </p>
            {templates.length === 0 && (
              <button
                onClick={onCreate}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors font-medium whitespace-nowrap"
              >
                <i className="ri-add-line"></i>
                Create First Template
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}