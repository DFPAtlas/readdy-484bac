'use client';

import { normalizeJobLink } from '@/lib/job-links';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { changeClientNotifications as changeOwnedNotifications } from '@/lib/client-notification-inbox';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

interface NotificationBellProps {
  guardUserId: string;
}

interface InboxScope {
  owner: string;
  active: boolean;
  request: number;
  ready: boolean;
  mutating: boolean;
  refresh: () => Promise<void>;
}

export default function NotificationBell({ guardUserId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const inboxRef = useRef<InboxScope | null>(null);
  const navigationRef = useRef(0);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const scope: InboxScope = { owner: guardUserId, active: true, request: 0, ready: false, mutating: false, refresh: async () => {} };
    inboxRef.current = scope;
    setNotifications([]);
    setLoadError(false);
    setActionError('');
    setActionPending(false);
    if (!guardUserId) {
      setLoading(false);
      setLoadError(true);
      return () => { scope.active = false; };
    }
    const fetchNotifications = async () => {
      if (!scope.active || scope.mutating) return;
      const request = ++scope.request;
      const current = () => scope.active && inboxRef.current === scope && request === scope.request;
      scope.ready = false;
      setLoading(true);
      setLoadError(false);
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, title, message, type, is_read, link, created_at')
          .eq('user_id', guardUserId)
          .eq('user_type', 'guard')
          .order('created_at', { ascending: false })
          .limit(20);
        if (!current()) return;
        if (error || !Array.isArray(data)) throw new Error('Unable to load notifications.');
        setNotifications(data);
        scope.ready = true;
      } catch {
        if (current()) setLoadError(true);
      } finally {
        if (current()) setLoading(false);
      }
    };
    scope.refresh = fetchNotifications;
    const refresh = () => { if (scope.active) void fetchNotifications(); };
    refresh();
    const channel = supabase
      .channel(`guard-notifications-${guardUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'app', table: 'notifications', filter: `user_id=eq.${guardUserId}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'app', table: 'notifications', filter: `user_id=eq.${guardUserId}` }, refresh)
      .subscribe();
    return () => { scope.active = false; void supabase.removeChannel(channel); };
  }, [guardUserId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        navigationRef.current += 1;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const retryLoad = () => {
    const scope = inboxRef.current;
    if (scope?.owner === guardUserId) void scope.refresh();
  };

  const markRead = async (ids: string[]) => {
    const scope = inboxRef.current;
    if (!scope || scope.owner !== guardUserId || !scope.active || !scope.ready || scope.mutating || ids.length === 0) return false;
    scope.mutating = true;
    scope.request += 1;
    const current = () => scope.active && inboxRef.current === scope;
    setActionPending(true);
    setActionError('');
    try {
      const result = await changeOwnedNotifications(supabase, guardUserId, ids, 'mark_read');
      if (!current()) return false;
      const confirmed = new Set(result.confirmedIds);
      setNotifications(previous => previous.map(n => confirmed.has(n.id) ? { ...n, is_read: true } : n));
      if (!result.complete) setActionError('Some read changes could not be confirmed. Check the refreshed list before retrying.');
      return result.complete;
    } catch {
      if (current()) setActionError('Read changes could not be confirmed. Check the refreshed list before retrying.');
      return false;
    } finally {
      if (current()) {
        scope.mutating = false;
        setActionPending(false);
        void scope.refresh();
      }
    }
  };

  const markAllAsRead = () => markRead(notifications.filter(n => !n.is_read).map(n => n.id));
  const markAsRead = (id: string) => markRead([id]);

  const handleView = async (n: Notification) => {
    // Keep the warning visible when the automatic mark-read step is unconfirmed.
    const scope = inboxRef.current;
    if (!scope || scope.owner !== guardUserId || !scope.active || !scope.ready || scope.mutating) return;
    const navigation = ++navigationRef.current;
    if (!n.is_read && !(await markAsRead(n.id))) return;
    if (!scope.active || inboxRef.current !== scope || navigation !== navigationRef.current) return;
    setOpen(false);
    if (n.link) router.push(normalizeJobLink(n.link));
  };

  const handleToggle = () => {
    navigationRef.current += 1;
    setOpen((v) => !v);
  };

  const getTypeIcon = (type: string) => {
    const map: Record<string, { icon: string; color: string; bg: string }> = {
      job_match: { icon: 'ri-briefcase-line', color: 'text-teal-400', bg: 'bg-teal-500/15' },
      job_offer: { icon: 'ri-gift-line', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
      application_update: { icon: 'ri-file-list-line', color: 'text-blue-400', bg: 'bg-blue-500/15' },
      payment: { icon: 'ri-money-pound-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
      message: { icon: 'ri-message-3-line', color: 'text-purple-400', bg: 'bg-purple-500/15' },
      verification: { icon: 'ri-shield-check-line', color: 'text-amber-400', bg: 'bg-amber-500/15' },
    };
    return map[type] || { icon: 'ri-notification-3-line', color: 'text-slate-400', bg: 'bg-[#162036]' };
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="relative w-10 h-10 flex items-center justify-center rounded-full border border-[#1e2d4d] bg-[#162036] hover:bg-[#1a2642] transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <i className="ri-notification-3-line text-xl text-slate-400"></i>
        {!loading && !loadError && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-96 bg-[#111d35] rounded-2xl shadow-2xl border border-[#1e2d4d] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d4d]">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-base">Notifications</h3>
              {!loading && !loadError && unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-500/15 text-red-400 text-xs font-semibold rounded-full border border-red-500/25">
                  {unreadCount} new
                </span>
              )}
            </div>
            {!loading && !loadError && unreadCount > 0 && (
              <button
                onClick={() => { void markAllAsRead(); }}
                disabled={actionPending || loading || loadError}
                className="text-xs text-teal-400 hover:text-teal-300 font-medium cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {actionError && (
            <div role="alert" className="mx-4 mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-400">
              <p>{actionError}</p>
              <button onClick={retryLoad} disabled={actionPending || loading} className="mt-2 font-semibold underline disabled:opacity-50">Reload notifications</button>
            </div>
          )}

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <i className="ri-loader-4-line text-3xl text-teal-400 animate-spin"></i>
              </div>
            ) : loadError ? (
              <div role="alert" className="px-6 py-10 text-center">
                <p className="text-sm font-semibold text-red-400">Unable to load notifications</p>
                <p className="mt-1 text-xs text-slate-500">Please retry to check for updates.</p>
                <button onClick={retryLoad} className="mt-3 text-sm font-semibold text-teal-400 underline">Retry</button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div className="w-14 h-14 bg-[#162036] rounded-full flex items-center justify-center mb-3">
                  <i className="ri-notification-off-line text-2xl text-slate-600"></i>
                </div>
                <p className="text-slate-400 text-sm">No notifications yet</p>
                <p className="text-slate-500 text-xs mt-1">Job match alerts will appear here</p>
              </div>
            ) : (
              notifications.map(n => {
                const { icon, color, bg } = getTypeIcon(n.type);
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-5 py-4 border-b border-[#1e2d4d] transition-colors ${
                      !n.is_read ? 'bg-teal-500/5 hover:bg-teal-500/10' : 'hover:bg-[#162036]'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                      <i className={`${icon} text-base ${color}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium leading-snug ${!n.is_read ? 'text-white' : 'text-slate-400'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="w-2 h-2 bg-teal-400 rounded-full flex-shrink-0 mt-1"></span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] text-slate-500">{timeAgo(n.created_at)}</span>
                        {n.link && (
                          <button
                            onClick={() => { void handleView(n); }}
                            disabled={actionPending || loading || loadError}
                            className="text-[11px] text-teal-400 hover:text-teal-300 font-medium whitespace-nowrap disabled:opacity-50"
                          >
                            View →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-5 py-3 border-t border-[#1e2d4d] bg-[#0B1933]">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {loadError ? 'Notifications unavailable' : loading ? 'Loading notifications…' : notifications.length > 0 ? `Last ${notifications.length} notification${notifications.length !== 1 ? 's' : ''}` : 'No notifications'}
              </p>
              <Link
                href="/guard/notifications"
                onClick={() => { navigationRef.current += 1; setOpen(false); }}
                className="text-xs text-teal-400 hover:text-teal-300 font-medium cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                View All →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
