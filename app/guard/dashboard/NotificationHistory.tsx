'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
  snoozed_until: string | null;
}

interface NotificationHistoryProps {
  guardUserId: string;
}

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'job_match', label: 'Job Match' },
  { value: 'payment', label: 'Payment' },
  { value: 'application_update', label: 'Applications' },
  { value: 'verification', label: 'Verification' },
  { value: 'message', label: 'Messages' },
];

const TYPE_META: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  job_match: { icon: 'ri-briefcase-line', color: 'text-teal-400', bg: 'bg-teal-500/15', label: 'Job Match' },
  job_offer: { icon: 'ri-gift-line', color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'Job Offer' },
  application_update: { icon: 'ri-file-list-line', color: 'text-blue-400', bg: 'bg-blue-500/15', label: 'Application Update' },
  payment: { icon: 'ri-money-pound-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'Payment' },
  message: { icon: 'ri-message-3-line', color: 'text-purple-400', bg: 'bg-purple-500/15', label: 'Message' },
  verification: { icon: 'ri-shield-check-line', color: 'text-amber-400', bg: 'bg-amber-500/15', label: 'Verification' },
};

const DEFAULT_META = { icon: 'ri-notification-3-line', color: 'text-slate-400', bg: 'bg-[#162036]', label: 'Notification' };

const SNOOZE_OPTIONS = [
  { label: '1 hour', icon: 'ri-time-line', getValue: () => { const d = new Date(); d.setHours(d.getHours() + 1); return d.toISOString(); } },
  { label: '3 hours', icon: 'ri-time-line', getValue: () => { const d = new Date(); d.setHours(d.getHours() + 3); return d.toISOString(); } },
  { label: 'Tomorrow', icon: 'ri-sun-line', getValue: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString(); } },
  { label: 'Next week', icon: 'ri-calendar-line', getValue: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d.toISOString(); } },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function snoozeLabel(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `Snoozed ${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `Snoozed ${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  return `Snoozed ${diffDays}d`;
}

function isSnoozed(n: Notification) {
  return !!n.snoozed_until && new Date(n.snoozed_until) > new Date();
}

function formatDateLabel(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const notifDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (notifDate.getTime() === today.getTime()) return 'Today';
  if (notifDate.getTime() === yesterday.getTime()) return 'Yesterday';

  const daysDiff = Math.floor((today.getTime() - notifDate.getTime()) / 86400000);
  if (daysDiff < 7) {
    return date.toLocaleDateString('en-GB', { weekday: 'long' });
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function SnoozeDropdown({ onSnooze, onClose }: { onSnooze: (iso: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-30 bg-[#111d35] border border-[#1e2d4d] rounded-xl shadow-lg w-44 py-1 overflow-hidden">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-3 pt-2 pb-1">Remind me in</p>
      {SNOOZE_OPTIONS.map(opt => (
        <button
          key={opt.label}
          onClick={() => { onSnooze(opt.getValue()); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-amber-500/10 hover:text-amber-400 transition-colors cursor-pointer"
        >
          <i className={`${opt.icon} text-amber-400 text-base`}></i>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function NotificationHistory({ guardUserId }: NotificationHistoryProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [page, setPage] = useState(1);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null);
  const [snoozeToast, setSnoozeToast] = useState<{ show: boolean; label: string }>({ show: false, label: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const PER_PAGE = 15;

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel(`notif-history-${guardUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'app', table: 'notifications', filter: `user_id=eq.${guardUserId}` }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'app', table: 'notifications', filter: `user_id=eq.${guardUserId}` }, (payload) => {
        setNotifications(prev => prev.map(n => n.id === payload.new.id ? { ...n, ...(payload.new as Notification) } : n));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [guardUserId]);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, type, is_read, link, created_at, snoozed_until')
      .eq('user_id', guardUserId)
      .eq('user_type', 'guard')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error) setNotifications(data || []);
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    const ids = filtered.filter(n => !n.is_read).map(n => n.id);
    if (!ids.length) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n));
  };

  const clearAll = async () => {
    setClearing(true);
    const ids = filtered.map(n => n.id);
    if (ids.length) {
      await supabase.from('notifications').delete().in('id', ids);
      setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    }
    setClearing(false);
    setShowClearConfirm(false);
    setPage(1);
  };

  const deleteNotification = async (id: string) => {
    setDeletingId(id);
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const snoozeNotification = async (id: string, until: string) => {
    await supabase.from('notifications').update({ snoozed_until: until }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, snoozed_until: until } : n));
    const opt = SNOOZE_OPTIONS.find(o => o.getValue() === until);
    const label = opt?.label ?? 'later';
    setSnoozeToast({ show: true, label });
    setTimeout(() => setSnoozeToast({ show: false, label: '' }), 3000);
  };

  const unsnoozeNotification = async (id: string) => {
    await supabase.from('notifications').update({ snoozed_until: null }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, snoozed_until: null } : n));
  };

  const filtered = notifications.filter(n => {
    const typeOk = typeFilter === 'all' || n.type === typeFilter;
    const readOk = readFilter === 'all' || (readFilter === 'unread' ? !n.is_read : n.is_read);
    const snoozeOk = showSnoozed ? isSnoozed(n) : !isSnoozed(n);
    const searchOk = !searchQuery ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase());
    return typeOk && readOk && snoozeOk && searchOk;
  });

  const snoozedCount = notifications.filter(isSnoozed).length;
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const unreadCount = filtered.filter(n => !n.is_read).length;

  const handleTypeFilter = (val: string) => { setTypeFilter(val); setPage(1); };
  const handleReadFilter = (val: 'all' | 'unread' | 'read') => { setReadFilter(val); setPage(1); };

  const groupedNotifications = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    paginated.forEach(n => {
      const label = formatDateLabel(n.created_at);
      if (!groups[label]) groups[label] = [];
      groups[label].push(n);
    });
    return groups;
  }, [paginated]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="ri-loader-4-line text-4xl text-teal-400 animate-spin"></i>
      </div>
    );
  }

  return (
    <div>
      {snoozeToast.show && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-sm font-medium">
          <i className="ri-alarm-line text-lg"></i>
          Snoozed — you'll be reminded in {snoozeToast.label.toLowerCase()}
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111d35] rounded-2xl shadow-xl p-6 w-full max-w-sm border border-[#1e2d4d]">
            <div className="w-12 h-12 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-delete-bin-line text-2xl text-red-400"></i>
            </div>
            <h3 className="text-lg font-semibold text-white text-center mb-2">Clear All Notifications?</h3>
            <p className="text-sm text-slate-400 text-center mb-6">
              This will permanently delete <span className="font-semibold text-slate-300">{filtered.length}</span> notification{filtered.length !== 1 ? 's' : ''}. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 px-4 py-2.5 border border-[#1e2d4d] text-slate-300 text-sm font-medium rounded-xl hover:bg-[#162036] cursor-pointer whitespace-nowrap">
                Cancel
              </button>
              <button onClick={clearAll} disabled={clearing} className="flex-1 px-4 py-2.5 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 disabled:opacity-60 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
                {clearing ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-delete-bin-line"></i>}
                {clearing ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500/15 rounded-lg flex items-center justify-center">
              <i className="ri-history-line text-xl text-teal-400"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Notification History</h2>
              <p className="text-sm text-slate-400">
                {notifications.length} total · {notifications.filter(n => !n.is_read).length} unread
                {snoozedCount > 0 && <span className="text-amber-400"> · {snoozedCount} snoozed</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="px-4 py-2 bg-teal-500/15 text-teal-400 text-sm font-medium rounded-lg hover:bg-teal-500/25 transition-colors whitespace-nowrap cursor-pointer">
                <i className="ri-check-double-line mr-1.5"></i>
                Mark all read
              </button>
            )}
            {filtered.length > 0 && (
              <button onClick={() => setShowClearConfirm(true)} className="px-4 py-2 bg-red-500/10 text-red-400 text-sm font-medium rounded-lg hover:bg-red-500/20 transition-colors whitespace-nowrap cursor-pointer">
                <i className="ri-delete-bin-line mr-1.5"></i>
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 bg-[#162036] border border-[#1e2d4d] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 transition-colors"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 ${showFilters ? 'bg-teal-500 text-white' : 'bg-[#162036] text-slate-400 hover:bg-[#1a2642] border border-[#1e2d4d]'}`}
          >
            <i className="ri-filter-3-line"></i>
            Filters
            {(typeFilter !== 'all' || readFilter !== 'all') && (
              <span className="w-2 h-2 bg-teal-400 rounded-full"></span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="bg-[#162036] border border-[#1e2d4d] rounded-xl p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Type</p>
              <div className="flex flex-wrap gap-2">
                {TYPE_FILTERS.map(f => (
                  <button key={f.value} onClick={() => handleTypeFilter(f.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${typeFilter === f.value ? 'bg-teal-500 text-white' : 'bg-[#0B1933] text-slate-400 hover:bg-[#1a2642] border border-[#1e2d4d]'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Status</p>
              <div className="flex items-center bg-[#0B1933] rounded-lg p-1 w-fit">
                {(['all', 'unread', 'read'] as const).map(v => (
                  <button key={v} onClick={() => handleReadFilter(v)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer capitalize ${readFilter === v ? 'bg-[#162036] text-white shadow-sm border border-[#1e2d4d]' : 'text-slate-500 hover:text-white'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowSnoozed(false); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${!showSnoozed ? 'bg-[#162036] text-white border border-[#1e2d4d]' : 'bg-[#0B1933] text-slate-500 hover:bg-[#162036] border border-[#1e2d4d]'}`}
          >
            <i className="ri-notification-3-line text-base"></i>
            Active
            {!showSnoozed && unreadCount > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-teal-500/15 text-teal-400">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setShowSnoozed(true); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${showSnoozed ? 'bg-amber-500 text-white' : 'bg-[#0B1933] text-slate-500 hover:bg-[#162036] border border-[#1e2d4d]'}`}
          >
            <i className="ri-alarm-line text-base"></i>
            Snoozed
            {snoozedCount > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${showSnoozed ? 'bg-white/30 text-white' : 'bg-amber-500/15 text-amber-400'}`}>
                {snoozedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-[#162036] rounded-full flex items-center justify-center mb-4">
            <i className={`text-3xl text-slate-600 ${showSnoozed ? 'ri-alarm-line' : 'ri-notification-off-line'}`}></i>
          </div>
          <p className="text-slate-500 font-medium">{showSnoozed ? 'No snoozed notifications' : 'No notifications found'}</p>
          <p className="text-slate-500 text-sm mt-1">
            {showSnoozed ? 'Snoozed alerts will appear here' : searchQuery ? 'Try a different search term' : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <>
          <div className="text-xs text-slate-500 mb-3">
            Showing {paginated.length} of {filtered.length} notification{filtered.length !== 1 ? 's' : ''}
            {unreadCount > 0 && !showSnoozed && <span className="ml-2 text-teal-400 font-medium">• {unreadCount} unread</span>}
            {showSnoozed && <span className="ml-2 text-amber-400 font-medium">• snoozed</span>}
          </div>

          <div className="space-y-6">
            {Object.entries(groupedNotifications).map(([dateLabel, items]) => (
              <div key={dateLabel}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-[#1e2d4d]"></div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{dateLabel}</span>
                  <div className="h-px flex-1 bg-[#1e2d4d]"></div>
                </div>
                <div className="space-y-3">
                  {items.map(n => {
                    const meta = TYPE_META[n.type] || DEFAULT_META;
                    const isConfirmingDelete = confirmDeleteId === n.id;
                    const isDeleting = deletingId === n.id;
                    const snoozed = isSnoozed(n);
                    const snoozeText = n.snoozed_until ? snoozeLabel(n.snoozed_until) : null;
                    const isExpanded = expandedId === n.id;

                    return (
                      <div key={n.id}
                        className={`flex gap-4 p-5 rounded-xl border transition-all ${
                          snoozed
                            ? 'bg-amber-500/5 border-amber-500/20'
                            : !n.is_read
                              ? 'bg-teal-500/5 border-teal-500/20 hover:bg-teal-500/10'
                              : 'bg-[#0B1933] border-[#1e2d4d] hover:shadow-md'
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${snoozed ? 'bg-amber-500/15' : meta.bg}`}>
                          <i className={`${snoozed ? 'ri-alarm-line text-amber-400' : `${meta.icon} ${meta.color}`} text-lg`}></i>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`text-sm font-semibold ${snoozed ? 'text-amber-400' : !n.is_read ? 'text-white' : 'text-slate-400'}`}>
                                  {n.title}
                                </p>
                                <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${meta.bg} ${meta.color}`}>
                                  {meta.label}
                                </span>
                                {snoozed && snoozeText && (
                                  <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-[10px] font-semibold rounded-full flex items-center gap-1">
                                    <i className="ri-alarm-line text-[10px]"></i>
                                    {snoozeText}
                                  </span>
                                )}
                                {!n.is_read && !snoozed && (
                                  <span className="px-2 py-0.5 bg-teal-500 text-white text-[10px] font-semibold rounded-full">New</span>
                                )}
                              </div>
                              <p className={`text-sm text-slate-400 mt-1 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>{n.message}</p>
                              {n.message.length > 120 && (
                                <button
                                  onClick={() => setExpandedId(isExpanded ? null : n.id)}
                                  className="text-xs text-teal-400 hover:text-teal-300 mt-1 cursor-pointer"
                                >
                                  {isExpanded ? 'Show less' : 'Show more'}
                                </button>
                              )}
                              <p className="text-xs text-slate-500 mt-2">{timeAgo(n.created_at)}</p>
                              {snoozed && n.snoozed_until && (
                                <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                                  <i className="ri-alarm-line"></i>
                                  Remind at {new Date(n.snoozed_until).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {n.link && !snoozed && (
                                <Link href={n.link} className="px-3 py-1.5 bg-teal-500 text-white text-xs font-medium rounded-lg hover:bg-teal-600 whitespace-nowrap cursor-pointer">
                                  View
                                </Link>
                              )}
                              {!n.is_read && !snoozed && (
                                <button onClick={() => markAsRead(n.id)} className="px-3 py-1.5 border border-[#1e2d4d] text-slate-400 text-xs font-medium rounded-lg hover:bg-[#162036] whitespace-nowrap cursor-pointer">
                                  Mark read
                                </button>
                              )}
                              {n.is_read && !isConfirmingDelete && !snoozed && (
                                <div className="w-6 h-6 flex items-center justify-center">
                                  <i className="ri-check-double-line text-slate-600 text-base"></i>
                                </div>
                              )}

                              {snoozed ? (
                                <button
                                  onClick={() => unsnoozeNotification(n.id)}
                                  className="px-3 py-1.5 bg-amber-500/15 text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-500/25 whitespace-nowrap cursor-pointer flex items-center gap-1"
                                >
                                  <i className="ri-alarm-warning-line text-xs"></i>
                                  Wake up
                                </button>
                              ) : (
                                <div className="relative">
                                  <button
                                    onClick={() => setSnoozeOpenId(snoozeOpenId === n.id ? null : n.id)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                                    title="Snooze notification"
                                  >
                                    <i className="ri-alarm-line text-sm"></i>
                                  </button>
                                  {snoozeOpenId === n.id && (
                                    <SnoozeDropdown
                                      onSnooze={(iso) => snoozeNotification(n.id, iso)}
                                      onClose={() => setSnoozeOpenId(null)}
                                    />
                                  )}
                                </div>
                              )}

                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-slate-500 whitespace-nowrap">Delete?</span>
                                  <button onClick={() => deleteNotification(n.id)} disabled={isDeleting}
                                    className="px-2.5 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-60 whitespace-nowrap cursor-pointer flex items-center gap-1">
                                    {isDeleting ? <i className="ri-loader-4-line animate-spin text-xs"></i> : <i className="ri-check-line text-xs"></i>}
                                    Yes
                                  </button>
                                  <button onClick={() => setConfirmDeleteId(null)}
                                    className="px-2.5 py-1.5 border border-[#1e2d4d] text-slate-400 text-xs font-medium rounded-lg hover:bg-[#162036] whitespace-nowrap cursor-pointer">
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDeleteId(n.id)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                  title="Delete notification">
                                  <i className="ri-delete-bin-line text-sm"></i>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#1e2d4d] text-slate-400 hover:bg-[#162036] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                <i className="ri-arrow-left-s-line text-lg"></i>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium cursor-pointer transition-colors ${page === p ? 'bg-teal-500 text-white' : 'border border-[#1e2d4d] text-slate-400 hover:bg-[#162036]'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#1e2d4d] text-slate-400 hover:bg-[#162036] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                <i className="ri-arrow-right-s-line text-lg"></i>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}