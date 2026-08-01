'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface Announcement {
  id: string;
  title: string;
  message: string;
  target_audience: 'all' | 'clients' | 'guards';
  is_active: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
}

interface AdminInfo {
  id: string;
  email: string;
  fullName: string;
}

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  targetName: string;
  onConfirm: () => void;
  variant: 'danger' | 'warning';
  confirmLabel: string;
}

const priorityStyles: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
  urgent: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'ri-alarm-warning-line', label: 'Urgent' },
  high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'ri-error-warning-line', label: 'High' },
  normal: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'ri-information-line', label: 'Normal' },
  low: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', icon: 'ri-notification-4-line', label: 'Low' },
};

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: '',
    message: '',
    targetName: '',
    onConfirm: () => {},
    variant: 'danger',
    confirmLabel: 'Confirm',
  });

  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formTarget, setFormTarget] = useState<'all' | 'clients' | 'guards'>('all');
  const [formPriority, setFormPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [formPublishNow, setFormPublishNow] = useState(true);

  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function loadAdminInfo() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('admin_users')
        .select('id, email, full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setAdminInfo({
          id: data.id,
          email: data.email,
          fullName: data.full_name || data.email,
        });
      }
    }
    loadAdminInfo();
  }, []);

  async function logAction(action: string, description: string, entityId?: string, targetName?: string, details?: Record<string, unknown>) {
    try {
      await supabase.from('admin_activity_log').insert({
        admin_username: adminInfo?.email || 'unknown',
        admin_name: adminInfo?.fullName || adminInfo?.email || 'unknown',
        admin_user_id: adminInfo?.id || null,
        action_type: action,
        action_description: description,
        action: action,
        entity_type: 'announcement',
        entity_id: entityId || null,
        target_type: 'announcement',
        target_name: targetName || null,
        details: details || null,
      });
    } catch {
      // fire-and-forget — never block the UI
    }
  }

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      showToast('Failed to load announcements.', 'error');
      setFetchError(error.message || 'An unexpected error occurred.');
      setLoading(false);
      return;
    }
    setAnnouncements(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  function resetForm() {
    setFormTitle('');
    setFormMessage('');
    setFormTarget('all');
    setFormPriority('normal');
    setFormPublishNow(true);
    setEditingId(null);
    setFormDirty(false);
  }

  function openCreate() {
    resetForm();
    setShowCreateModal(true);
  }

  function openEdit(item: Announcement) {
    setFormTitle(item.title);
    setFormMessage(item.message);
    setFormTarget(item.target_audience);
    setFormPriority(item.priority);
    setFormPublishNow(item.is_active);
    setEditingId(item.id);
    setFormDirty(false);
    setShowCreateModal(true);
  }

  function handleCloseModal() {
    if (formDirty) {
      setConfirmState({
        open: true,
        title: 'Discard Changes?',
        message: 'You have unsaved changes. Are you sure you want to close?',
        targetName: '',
        onConfirm: () => {
          setConfirmState(prev => ({ ...prev, open: false }));
          setShowCreateModal(false);
          resetForm();
        },
        variant: 'warning',
        confirmLabel: 'Discard',
      });
      return;
    }
    setShowCreateModal(false);
    resetForm();
  }

  function markDirty() {
    if (!formDirty) setFormDirty(true);
  }

  async function saveAnnouncement() {
    if (!formTitle.trim() || !formMessage.trim()) {
      showToast('Title and message are required.', 'error');
      return;
    }
    setSaving(true);

    const payload = {
      title: formTitle.trim(),
      message: formMessage.trim(),
      target_audience: formTarget,
      priority: formPriority,
      is_active: formPublishNow,
    };

    if (editingId) {
      const { error } = await supabase
        .from('announcements')
        .update(payload)
        .eq('id', editingId);
      if (error) {
        showToast('Failed to update announcement.', 'error');
        setSaving(false);
        return;
      }
      await logAction(
        'announcement_edit',
        `Edited announcement "${formTitle.trim()}"`,
        editingId,
        formTitle.trim(),
        { priority: formPriority, target_audience: formTarget, is_active: formPublishNow }
      );
      showToast('Announcement updated.', 'success');
    } else {
      const { data, error } = await supabase
        .from('announcements')
        .insert(payload)
        .select('id')
        .single();
      if (error) {
        showToast('Failed to create announcement.', 'error');
        setSaving(false);
        return;
      }
      if (data) {
        await logAction(
          'announcement_create',
          `Created announcement "${formTitle.trim()}"`,
          data.id,
          formTitle.trim(),
          { priority: formPriority, target_audience: formTarget, is_active: formPublishNow }
        );
      }
      showToast('Announcement broadcasted!', 'success');
    }

    setShowCreateModal(false);
    resetForm();
    await fetchAnnouncements();
    setSaving(false);
  }

  async function toggleActive(id: string, current: boolean, title: string) {
    const { error } = await supabase
      .from('announcements')
      .update({ is_active: !current })
      .eq('id', id);
    if (error) {
      showToast('Failed to toggle status.', 'error');
      return;
    }
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_active: !current } : a))
    );
    await logAction(
      'announcement_toggle',
      `${current ? 'Hid' : 'Published'} announcement "${title}"`,
      id,
      title,
      { previous: current, current: !current }
    );
    showToast(current ? 'Announcement hidden.' : 'Announcement live.', 'success');
  }

  function promptDeleteAnnouncement(item: Announcement) {
    setConfirmState({
      open: true,
      title: 'Delete Announcement',
      message: `Are you sure you want to permanently delete "${item.title}"? This cannot be undone.`,
      targetName: item.title,
      onConfirm: () => {
        setConfirmState(prev => ({ ...prev, open: false }));
        deleteAnnouncement(item);
      },
      variant: 'danger',
      confirmLabel: 'Delete',
    });
  }

  async function deleteAnnouncement(item: Announcement) {
    const { error } = await supabase.from('announcements').delete().eq('id', item.id);
    if (error) {
      showToast('Failed to delete.', 'error');
      return;
    }
    setAnnouncements((prev) => prev.filter((a) => a.id !== item.id));
    await logAction(
      'announcement_delete',
      `Deleted announcement "${item.title}"`,
      item.id,
      item.title
    );
    showToast('Announcement deleted.', 'success');
  }

  function promptResetDismissals(item: Announcement) {
    setConfirmState({
      open: true,
      title: 'Reset Dismissals',
      message: `This will make "${item.title}" visible again for all users who previously dismissed it. Continue?`,
      targetName: item.title,
      onConfirm: () => {
        setConfirmState(prev => ({ ...prev, open: false }));
        resetDismissals(item);
      },
      variant: 'warning',
      confirmLabel: 'Reset',
    });
  }

  async function resetDismissals(item: Announcement) {
    const { error } = await supabase.from('announcement_reads').delete().eq('announcement_id', item.id);
    if (error) {
      showToast('Failed to reset dismissals.', 'error');
      return;
    }
    await logAction(
      'announcement_reset_dismissals',
      `Reset dismissals for announcement "${item.title}"`,
      item.id,
      item.title
    );
    showToast('Dismissals reset. Users will see this again.', 'success');
  }

  const filteredAnnouncements = useMemo(() => {
    let filtered = announcements;
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter((a) => new Date(a.created_at) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((a) => new Date(a.created_at) <= to);
    }
    return filtered;
  }, [announcements, filterDateFrom, filterDateTo]);

  const isFiltering = filterDateFrom !== '' || filterDateTo !== '';

  function clearFilters() {
    setFilterDateFrom('');
    setFilterDateTo('');
  }

  const activeCount = announcements.filter((a) => a.is_active).length;

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shadow-amber-900/50">
                <i className="ri-megaphone-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Announcements</h1>
                <p className="text-xs text-slate-400">Broadcast messages to all client and guard dashboards</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchAnnouncements}
                className="flex items-center gap-2 px-4 py-2 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white cursor-pointer whitespace-nowrap transition-colors"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
                Refresh
              </button>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line"></i></div>
                New Announcement
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <i className="ri-broadcast-line text-emerald-400 text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{activeCount}</p>
              <p className="text-xs text-slate-400 font-medium">Active Announcements</p>
            </div>
          </div>
          <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-500/10 rounded-xl flex items-center justify-center">
              <i className="ri-archive-line text-slate-400 text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{announcements.filter(a => !a.is_active).length}</p>
              <p className="text-xs text-slate-400 font-medium">Hidden / Archived</p>
            </div>
          </div>
          <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <i className="ri-group-line text-amber-400 text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{announcements.length}</p>
              <p className="text-xs text-slate-400 font-medium">Total Created</p>
            </div>
          </div>
        </div>

        {/* Date Filter Bar */}
        {!loading && !fetchError && announcements.length > 0 && (
          <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center"><i className="ri-calendar-line text-slate-400 text-sm"></i></div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Filter by date</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="px-3 py-1.5 text-xs border border-[#1a2b4a] rounded-lg bg-[#0a1628] text-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent [color-scheme:dark]"
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="px-3 py-1.5 text-xs border border-[#1a2b4a] rounded-lg bg-[#0a1628] text-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent [color-scheme:dark]"
              />
            </div>
            {isFiltering && (
              <>
                <span className="text-xs text-slate-500">
                  {filteredAnnouncements.length} of {announcements.length} shown
                </span>
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1a2b4a] rounded-lg text-xs font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white cursor-pointer whitespace-nowrap transition-colors"
                >
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-close-line"></i></div>
                  Clear
                </button>
              </>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : fetchError ? (
          <div className="bg-[#111d35] rounded-2xl border border-red-500/20 p-8 text-center">
            <div className="w-14 h-14 bg-red-500/10 rounded-full mx-auto mb-4 flex items-center justify-center">
              <i className="ri-error-warning-line text-2xl text-red-400"></i>
            </div>
            <p className="text-sm text-slate-300 font-medium mb-1">Failed to load announcements</p>
            <p className="text-xs text-slate-500 mb-5">{fetchError}</p>
            <button
              onClick={fetchAnnouncements}
              className="inline-flex items-center gap-2 px-5 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
              Retry
            </button>
          </div>
        ) : (
          <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden">
            {announcements.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-[#1a2b4a] rounded-full mx-auto mb-4 flex items-center justify-center">
                  <i className="ri-megaphone-line text-2xl text-slate-500"></i>
                </div>
                <p className="text-sm text-slate-400 font-medium">No announcements yet</p>
                <p className="text-xs text-slate-500 mt-1">Broadcast your first message to all users</p>
                <button
                  onClick={openCreate}
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-400 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-add-line"></i>
                  Create Announcement
                </button>
              </div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-[#1a2b4a] rounded-full mx-auto mb-4 flex items-center justify-center">
                  <i className="ri-filter-off-line text-2xl text-slate-500"></i>
                </div>
                <p className="text-sm text-slate-400 font-medium">No announcements match your date filter</p>
                <p className="text-xs text-slate-500 mt-1">Try a different date range</p>
                <button
                  onClick={clearFilters}
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2 border border-[#1a2b4a] text-slate-300 rounded-xl text-sm font-medium hover:bg-[#1a2b4a] cursor-pointer whitespace-nowrap transition-colors"
                >
                  <div className="w-4 h-4 flex items-center justify-center"><i className="ri-close-line"></i></div>
                  Clear Filters
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0a1628] border-b border-[#1a2b4a]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-48">Title</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Message</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Audience</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-24">Priority</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-20">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2b4a]">
                  {filteredAnnouncements.map((item) => {
                    const p = priorityStyles[item.priority] || priorityStyles.normal;
                    return (
                      <tr key={item.id} className={`hover:bg-[#0a1628]/50 transition ${!item.is_active ? 'opacity-60' : ''}`}>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-slate-400 line-clamp-2">{item.message}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                            item.target_audience === 'all'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              : item.target_audience === 'clients'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                          }`}>
                            <i className={
                              item.target_audience === 'all' ? 'ri-global-line' :
                              item.target_audience === 'clients' ? 'ri-building-line' : 'ri-shield-user-line'
                            }></i>
                            {item.target_audience === 'all' ? 'All Users' : item.target_audience === 'clients' ? 'Clients Only' : 'Guards Only'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${p.bg} ${p.text} ${p.border}`}>
                            <i className={p.icon}></i>
                            {p.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <label className="inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={item.is_active} onChange={() => toggleActive(item.id, item.is_active, item.title)} className="sr-only peer" />
                            <div className="w-10 h-5 bg-[#1a2b4a] rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-5 relative"></div>
                          </label>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(item)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] text-slate-400 hover:text-white transition cursor-pointer" title="Edit"><i className="ri-pencil-line text-sm"></i></button>
                            <button onClick={() => promptResetDismissals(item)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 transition cursor-pointer" title="Reset dismissals"><i className="ri-refresh-line text-sm"></i></button>
                            <button onClick={() => promptDeleteAnnouncement(item)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition cursor-pointer" title="Delete"><i className="ri-delete-bin-line text-sm"></i></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleCloseModal}>
          <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2b4a]">
              <h2 className="text-base font-bold text-white">
                {editingId ? 'Edit Announcement' : 'New Announcement'}
              </h2>
              <button onClick={handleCloseModal} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] text-slate-400 hover:text-white transition cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Title</label>
                <input type="text" value={formTitle} onChange={(e) => { setFormTitle(e.target.value); markDirty(); }} className="w-full px-3 py-2 text-sm border border-[#1a2b4a] rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-[#0a1628] text-white placeholder-slate-500" placeholder="e.g. System Maintenance Notice" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Message</label>
                <textarea value={formMessage} onChange={(e) => { setFormMessage(e.target.value); markDirty(); }} className="w-full px-3 py-2 text-sm border border-[#1a2b4a] rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-[#0a1628] text-white placeholder-slate-500 min-h-[100px] resize-none" placeholder="Write your announcement message..." maxLength={500} />
                <p className="text-xs text-slate-500 mt-1 text-right">{formMessage.length}/500</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Target Audience</label>
                  <div className="flex gap-2">
                    {(['all', 'clients', 'guards'] as const).map((t) => (
                      <button key={t} onClick={() => { setFormTarget(t); markDirty(); }} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition cursor-pointer whitespace-nowrap ${
                          formTarget === t ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-[#0a1628] border-[#1a2b4a] text-slate-400 hover:bg-[#1a2b4a]'}`}>
                        {t === 'all' ? 'All' : t === 'clients' ? 'Clients' : 'Guards'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Priority</label>
                  <div className="flex gap-2">
                    {(['low', 'normal', 'high', 'urgent'] as const).map((p) => (
                      <button key={p} onClick={() => { setFormPriority(p); markDirty(); }} className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border transition cursor-pointer whitespace-nowrap ${
                          formPriority === p ? priorityStyles[p].bg + ' ' + priorityStyles[p].border + ' ' + priorityStyles[p].text : 'bg-[#0a1628] border-[#1a2b4a] text-slate-400 hover:bg-[#1a2b4a]'}`}>
                        {priorityStyles[p].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {!editingId && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={formPublishNow} onChange={(e) => { setFormPublishNow(e.target.checked); markDirty(); }} className="sr-only peer" />
                  <div className="w-10 h-5 bg-[#1a2b4a] rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-5 relative flex-shrink-0"></div>
                  <span className="text-sm text-slate-300">Publish immediately</span>
                </label>
              )}

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                <div className="w-6 h-6 bg-amber-500 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-lightbulb-line text-white text-xs"></i>
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-400">Tip</p>
                  <p className="text-xs text-amber-300 leading-relaxed">This announcement will appear at the top of every user's dashboard until you hide or delete it.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1a2b4a] bg-[#0a1628] rounded-b-2xl">
              <button onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] rounded-xl transition cursor-pointer whitespace-nowrap">Cancel</button>
              <button onClick={saveAnnouncement} disabled={saving || !formTitle.trim() || !formMessage.trim()} className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                {editingId ? 'Save Changes' : 'Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmState.open && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmState(prev => ({ ...prev, open: false }))}>
          <div
            className={`rounded-2xl shadow-xl w-full max-w-md overflow-hidden border ${confirmState.variant === 'danger' ? 'border-red-500/20' : 'border-amber-500/20'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-5 ${confirmState.variant === 'danger' ? 'bg-gradient-to-r from-red-600 to-rose-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-white/15 rounded-full flex items-center justify-center ring-1 ring-white/20">
                  <i className={`text-white text-xl ${confirmState.variant === 'danger' ? 'ri-alert-line' : 'ri-error-warning-line'}`}></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{confirmState.title}</h3>
                  {confirmState.targetName && (
                    <p className="text-white/70 text-sm truncate max-w-[280px]">{confirmState.targetName}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-[#111d35] px-6 py-5">
              <p className="text-sm text-slate-300 leading-relaxed">{confirmState.message}</p>
            </div>
            <div className="bg-[#0a1628] border-t border-[#1a2b4a] px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmState(prev => ({ ...prev, open: false }))}
                className="px-4 py-2 border border-[#1a2b4a] text-slate-300 rounded-xl hover:bg-[#1a2b4a] transition-colors cursor-pointer text-sm font-medium whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={confirmState.onConfirm}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap text-white ${confirmState.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-400'}`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          <div className="w-5 h-5 flex items-center justify-center">
            <i className={toast.type === 'success' ? 'ri-check-line text-base' : 'ri-error-warning-line text-base'}></i>
          </div>
          {toast.message}
        </div>
      )}
    </div>
  );
}