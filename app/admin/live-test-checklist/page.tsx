'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface ChecklistItem {
  id: string;
  test_key: string;
  label: string;
  section: string;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface GroupedSection {
  name: string;
  items: ChecklistItem[];
}

export default function LiveTestChecklistPage() {
  const admin = useAdminAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('launch_test_checklist')
        .select('*')
        .order('section')
        .order('created_at');

      if (fetchErr) throw fetchErr;
      setItems(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load checklist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const toggleCompleted = useCallback(async (item: ChecklistItem) => {
    const newCompleted = !item.completed;
    setSaving(item.id);

    const updateData: any = {
      completed: newCompleted,
      updated_at: new Date().toISOString(),
    };

    if (newCompleted) {
      updateData.completed_by = admin.name || 'Admin';
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_by = null;
      updateData.completed_at = null;
    }

    const { error: updateErr } = await supabase
      .from('launch_test_checklist')
      .update(updateData)
      .eq('id', item.id);

    if (updateErr) {
      setToast({ message: 'Failed to update: ' + updateErr.message, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } else {
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, ...updateData } : i
      ));
    }

    setSaving(null);
  }, [admin.name]);

  const saveNote = useCallback(async (itemId: string) => {
    setSaving(itemId);
    const { error: updateErr } = await supabase
      .from('launch_test_checklist')
      .update({
        notes: noteText || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (updateErr) {
      setToast({ message: 'Failed to save note', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } else {
      setItems(prev => prev.map(i =>
        i.id === itemId ? { ...i, notes: noteText || null } : i
      ));
      setEditingNote(null);
      setNoteText('');
    }

    setSaving(null);
  }, [noteText]);

  const startEditNote = (item: ChecklistItem) => {
    setEditingNote(item.id);
    setNoteText(item.notes || '');
  };

  const cancelEditNote = () => {
    setEditingNote(null);
    setNoteText('');
  };

  const exportCSV = () => {
    const headers = ['Section', 'Test Key', 'Label', 'Status', 'Completed By', 'Completed At', 'Notes'];
    const rows = items.map(i => [
      i.section,
      i.test_key,
      i.label,
      i.completed ? 'PASSED' : 'FAILED',
      i.completed_by || '',
      i.completed_at ? new Date(i.completed_at).toISOString() : '',
      (i.notes || '').replace(/"/g, '""'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickguard-launch-checklist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const groupedSections: GroupedSection[] = [];
  const sectionMap = new Map<string, ChecklistItem[]>();
  let filteredItems = items;

  if (filter === 'passed') filteredItems = filteredItems.filter(i => i.completed);
  if (filter === 'failed') filteredItems = filteredItems.filter(i => !i.completed);
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    filteredItems = filteredItems.filter(i =>
      i.label.toLowerCase().includes(q) ||
      i.section.toLowerCase().includes(q) ||
      i.test_key.toLowerCase().includes(q)
    );
  }

  filteredItems.forEach(item => {
    const existing = sectionMap.get(item.section);
    if (existing) {
      existing.push(item);
    } else {
      sectionMap.set(item.section, [item]);
    }
  });

  sectionMap.forEach((sectionItems, name) => {
    groupedSections.push({ name, items: sectionItems });
  });

  const totalPassed = items.filter(i => i.completed).length;
  const totalFailed = items.length - totalPassed;
  const progressPercent = items.length > 0 ? Math.round((totalPassed / items.length) * 100) : 0;

  const getProgressColor = () => {
    if (progressPercent >= 90) return 'bg-emerald-500';
    if (progressPercent >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-[#0B1933]">
      {toast && (
        <div className={`fixed top-5 right-5 z-[60] px-5 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-red-500/20 border-red-500/30 text-red-300'
        }`}>
          <div className="flex items-center gap-2">
            <i className={`${toast.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} text-lg`}></i>
            {toast.message}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-900/50">
                <i className="ri-check-double-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight tracking-tight">Live Test Checklist</h1>
                <p className="text-[11px] text-slate-500 font-medium">Production launch readiness</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-download-line text-base"></i>
                </div>
                <span className="hidden sm:inline">Export CSV</span>
              </button>
              <button
                onClick={fetchItems}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-refresh-line text-base"></i>
                </div>
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-error-warning-line text-red-400"></i>
            </div>
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={fetchItems} className="ml-auto text-slate-400 hover:text-white cursor-pointer">
              <i className="ri-refresh-line"></i>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-500/10">
                <i className="ri-list-check-3 text-xl text-teal-400"></i>
              </div>
              <span className="text-sm font-medium text-slate-400">Total Tests</span>
            </div>
            <div className="text-3xl font-bold text-white">{items.length}</div>
          </div>
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500/10">
                <i className="ri-check-line text-xl text-emerald-400"></i>
              </div>
              <span className="text-sm font-medium text-slate-400">Passed</span>
            </div>
            <div className="text-3xl font-bold text-emerald-400">{totalPassed}</div>
          </div>
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10">
                <i className="ri-close-line text-xl text-red-400"></i>
              </div>
              <span className="text-sm font-medium text-slate-400">Failed</span>
            </div>
            <div className="text-3xl font-bold text-red-400">{totalFailed}</div>
          </div>
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-500/10">
                <i className="ri-percent-line text-xl text-indigo-400"></i>
              </div>
              <span className="text-sm font-medium text-slate-400">Progress</span>
            </div>
            <div className="text-3xl font-bold text-white">{progressPercent}%</div>
            <div className="mt-2 h-2 bg-[#1a2b4a] rounded-full overflow-hidden">
              <div className={`h-full ${getProgressColor()} rounded-full transition-all duration-500`} style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-4 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <div className="w-5 h-5 flex items-center justify-center absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              <i className="ri-search-line"></i>
            </div>
            <input
              type="text"
              placeholder="Search tests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-[#0B1933] border border-[#1a2b4a] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50"
            />
          </div>
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'passed', label: 'Passed' },
              { key: 'failed', label: 'Failed' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as 'all' | 'passed' | 'failed')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                  filter === tab.key
                    ? 'bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/20'
                    : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-teal-500 border-t-transparent mx-auto"></div>
              <p className="mt-4 text-slate-400 text-sm font-medium">Loading checklist...</p>
            </div>
          </div>
        ) : groupedSections.length === 0 ? (
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-16 text-center">
            <div className="w-16 h-16 flex items-center justify-center bg-[#1a2b4a] rounded-2xl mx-auto mb-4">
              <i className="ri-list-check-3 text-3xl text-slate-500"></i>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No test items found</h3>
            <p className="text-sm text-slate-400">Try adjusting your filters.</p>
          </div>
        ) : (
          groupedSections.map((section) => (
            <div key={section.name} className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 bg-[#0d1a2d] border-b border-[#1a2b4a] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-teal-500/10">
                    <i className={`${
                      section.name === 'Authentication' ? 'ri-shield-keyhole-line' :
                      section.name === 'Payments' ? 'ri-money-pound-circle-line' :
                      section.name === 'Jobs' ? 'ri-briefcase-line' :
                      section.name === 'Guard Profiles' ? 'ri-shield-user-line' :
                      section.name === 'Client Profiles' ? 'ri-building-4-line' :
                      section.name === 'Email' ? 'ri-mail-send-line' :
                      section.name === 'Security' ? 'ri-lock-line' :
                      section.name === 'SEO / Launch' ? 'ri-rocket-line' :
                      'ri-server-line'
                    } text-teal-400`}></i>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">{section.name}</h2>
                    <p className="text-xs text-slate-500">
                      {section.items.filter(i => i.completed).length}/{section.items.length} passed
                    </p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-[#1a2b4a]">
                {section.items.map((item) => (
                  <div key={item.id} className="px-6 py-4 hover:bg-[#0d1a2d]/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <button
                        onClick={() => toggleCompleted(item)}
                        disabled={saving === item.id}
                        className="mt-0.5 flex-shrink-0 cursor-pointer"
                      >
                        {saving === item.id ? (
                          <div className="w-5 h-5 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
                        ) : (
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            item.completed
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-slate-600 hover:border-slate-400'
                          }`}>
                            {item.completed && <i className="ri-check-line text-white text-xs"></i>}
                          </div>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className={`text-sm font-medium ${item.completed ? 'text-slate-400 line-through' : 'text-white'}`}>
                              {item.label}
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5 font-mono">{item.test_key}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {item.completed && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <i className="ri-check-line"></i>
                                PASSED
                              </span>
                            )}
                            {!item.completed && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                                <i className="ri-close-line"></i>
                                FAILED
                              </span>
                            )}
                          </div>
                        </div>

                        {item.completed && item.completed_by && (
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <i className="ri-user-line"></i>
                              {item.completed_by}
                            </span>
                            {item.completed_at && (
                              <span className="flex items-center gap-1">
                                <i className="ri-time-line"></i>
                                {new Date(item.completed_at).toLocaleString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        )}

                        {editingNote === item.id ? (
                          <div className="mt-3 space-y-2">
                            <textarea
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              maxLength={500}
                              className="w-full bg-[#0B1933] border border-[#1a2b4a] rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500/50 resize-none"
                              placeholder="Add notes..."
                              rows={2}
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => saveNote(item.id)}
                                disabled={saving === item.id}
                                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                              >
                                {saving === item.id ? 'Saving...' : 'Save Note'}
                              </button>
                              <button
                                onClick={cancelEditNote}
                                className="px-3 py-1.5 bg-[#1a2b4a] hover:bg-[#253a5e] text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : item.notes ? (
                          <div className="mt-2 group">
                            <p className="text-xs text-slate-400 bg-[#0B1933]/50 rounded-lg px-3 py-2 border border-[#1a2b4a]/50">
                              {item.notes}
                            </p>
                            <button
                              onClick={() => startEditNote(item)}
                              className="mt-1 text-xs text-slate-600 hover:text-teal-400 transition-colors cursor-pointer"
                            >
                              <i className="ri-edit-line mr-1"></i>Edit note
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditNote(item)}
                            className="mt-2 text-xs text-slate-600 hover:text-teal-400 transition-colors cursor-pointer"
                          >
                            <i className="ri-add-line mr-1"></i>Add note
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}