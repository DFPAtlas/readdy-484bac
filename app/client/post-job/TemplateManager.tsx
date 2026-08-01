
'use client';

import { useState } from 'react';

interface Template {
  id: string;
  template_name: string;
  job_title: string;
  security_type: string;
  venue: string;
  city: string;
  hourly_rate: string;
  use_count: number;
  created_at: string;
}

interface TemplateManagerProps {
  templates: Template[];
  onLoadTemplate: (template: Template) => void;
  onDeleteTemplate: (id: string) => void;
  onClose: () => void;
}

export default function TemplateManager({ templates, onLoadTemplate, onDeleteTemplate, onClose }: TemplateManagerProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = templates.filter(t =>
    t.template_name.toLowerCase().includes(search.toLowerCase()) ||
    (t.job_title || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Job Templates</h2>
            <p className="text-sm text-gray-500 mt-1">Load a saved template to quickly fill the form</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {templates.length > 3 && (
          <div className="px-6 pt-4">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        <div className="overflow-y-auto max-h-[60vh] p-6">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-file-copy-line text-3xl text-gray-400"></i>
              </div>
              <p className="text-gray-600 font-medium">
                {templates.length === 0 ? 'No templates yet' : 'No matching templates'}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {templates.length === 0 ? 'Save a job as a template for quick reuse' : 'Try a different search term'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <i className="ri-file-copy-line text-indigo-600"></i>
                        </div>
                        <h3 className="font-semibold text-gray-900 truncate">{template.template_name}</h3>
                      </div>
                    </div>
                    {confirmDelete === template.id ? (
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => { onDeleteTemplate(template.id); setConfirmDelete(null); }}
                          className="text-red-600 hover:text-red-700 text-xs font-medium cursor-pointer whitespace-nowrap"
                        >
                          Delete
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-gray-500 hover:text-gray-700 text-xs font-medium cursor-pointer whitespace-nowrap"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(template.id)}
                        className="text-gray-400 hover:text-red-500 cursor-pointer ml-2"
                      >
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {template.job_title && (
                      <p className="text-sm text-gray-600 truncate">
                        <i className="ri-briefcase-line mr-1 text-gray-400"></i>
                        {template.job_title}
                      </p>
                    )}
                    {template.security_type && (
                      <p className="text-sm text-gray-600 truncate">
                        <i className="ri-shield-line mr-1 text-gray-400"></i>
                        {template.security_type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                    )}
                    {template.venue && (
                      <p className="text-sm text-gray-600 truncate">
                        <i className="ri-map-pin-line mr-1 text-gray-400"></i>
                        {template.venue}{template.city ? `, ${template.city}` : ''}
                      </p>
                    )}
                    {template.hourly_rate && (
                      <p className="text-sm text-gray-600">
                        <i className="ri-money-pound-circle-line mr-1 text-gray-400"></i>
                        £{template.hourly_rate}/hr
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Used {template.use_count} times</span>
                    <button
                      onClick={() => onLoadTemplate(template)}
                      className="bg-[#1a237e] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#0d1642] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Use Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
