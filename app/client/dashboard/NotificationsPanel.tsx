'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { changeClientNotifications } from '@/lib/client-notification-inbox';
import { normalizeJobLink } from '@/lib/job-links';
import CategoryBadge from '@/app/client/notifications/CategoryBadge';
import PriorityBadge from '@/app/client/notifications/PriorityBadge';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  priority: number;
  is_read: boolean;
  created_at: string;
  link?: string;
  data?: { job_title?: string } | null;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getActionButton(n: Notification): { label: string; icon: string; href: string } | null {
  const type = n.category || n.type || 'general';
  if (type === 'new_applicants' || type === 'guard_selection') {
    return { label: 'Review Applicants', icon: 'ri-user-search-line', href: n.link || '/client/jobs' };
  }
  if (type === 'payment_alert' || type === 'payment') {
    return { label: 'Pay Now', icon: 'ri-bank-card-line', href: n.link || '/client/payment-history' };
  }
  if (type === 'job_update') {
    return { label: 'View Job', icon: 'ri-briefcase-line', href: n.link || '/client/jobs' };
  }
  if (type === 'message') {
    return { label: 'Message', icon: 'ri-message-3-line', href: n.link || '/client/messages' };
  }
  if (type === 'support_ticket' || type === 'complaint') {
    return { label: 'View Ticket', icon: 'ri-customer-service-2-line', href: n.link || '/client/support' };
  }
  if (type === 'guard_confirmation') {
    return { label: 'Manage Guards', icon: 'ri-shield-user-line', href: n.link || '/client/jobs/tracker' };
  }
  return n.link ? { label: 'View', icon: 'ri-arrow-right-line', href: n.link } : null;
}

interface InboxScope {
  owner: string;
  active: boolean;
  request: number;
  ready: boolean;
  mutating: boolean;
  refresh: () => Promise<void>;
}

export default function NotificationsPanel({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const inboxRef = useRef<InboxScope | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef(0);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    const scope: InboxScope = { owner: userId, active: true, request: 0, ready: false, mutating: false, refresh: async () => {} };
    inboxRef.current = scope;
    setNotifications([]);
    setLoadError(false);
    setActionError('');
    setActionPending(false);
    if (!userId) {
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
          .select('*')
          .eq('user_id', userId)
          .eq('user_type', 'client')
          .order('priority', { ascending: false })
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
      .channel(`client-notifications-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'app', table: 'notifications', filter: `user_id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'app', table: 'notifications', filter: `user_id=eq.${userId}` }, refresh)
      .subscribe();
    return () => { scope.active = false; void supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        navigationRef.current += 1;
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const retryLoad = () => {
    const scope = inboxRef.current;
    if (scope?.owner === userId) void scope.refresh();
  };

  const markRead = async (ids: string[]) => {
    const scope = inboxRef.current;
    if (!scope || scope.owner !== userId || !scope.active || !scope.ready || scope.mutating || ids.length === 0) return false;
    scope.mutating = true;
    scope.request += 1;
    const current = () => scope.active && inboxRef.current === scope;
    setActionPending(true);
    setActionError('');
    try {
      const result = await changeClientNotifications(supabase, userId, ids, 'mark_read');
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

  const markAllRead = () => markRead(notifications.filter(n => !n.is_read).map(n => n.id));
  const markOneRead = (id: string) => markRead([id]);

  const handleActionClick = async (n: Notification) => {
    // Keep the warning visible when the automatic mark-read step is unconfirmed.
    const scope = inboxRef.current;
    if (!scope || scope.owner !== userId || !scope.active || !scope.ready || scope.mutating) return;
    const navigation = ++navigationRef.current;
    if (!n.is_read && !(await markOneRead(n.id))) return;
    if (!scope.active || inboxRef.current !== scope || navigation !== navigationRef.current) return;
    setOpen(false);
    const action = getActionButton(n);
    if (action?.href) router.push(normalizeJobLink(action.href));
  };

  const handleToggle = () => {
    navigationRef.current += 1;
    setOpen((v) => !v);
  };

  const urgentCount = notifications.filter((n) => n.priority === 3 && !n.is_read).length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleToggle}
        className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-[#162036] border border-slate-200 dark:border-[#1e2d4d] hover:bg-slate-200 dark:hover:bg-[#1a2642] transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <i className="ri-notification-3-line text-slate-400 text-lg"></i>
        {!loading && !loadError && unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-[400px] max-w-[92vw] bg-white dark:bg-[#111d35] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1e2d4d] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#1e2d4d]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h3>
              {!loading && !loadError && unreadCount > 0 && (
                <span className="bg-red-500/15 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full border border-red-500/25">
                  {unreadCount} new
                </span>
              )}
              {!loading && !loadError && urgentCount > 0 && (
                <span className="bg-amber-500/15 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-500/25">
                  {urgentCount} urgent
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!loading && !loadError && unreadCount > 0 && (
                <button
                  onClick={() => { void markAllRead(); }}
                  disabled={actionPending || loading || loadError}
                  className="text-xs text-teal-500 dark:text-teal-400 font-semibold hover:underline cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {actionError && (
            <div role="alert" className="mx-4 mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
              <p>{actionError}</p>
              <button onClick={retryLoad} disabled={actionPending || loading} className="mt-2 font-semibold underline disabled:opacity-50">Reload notifications</button>
            </div>
          )}

          <div className="max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-teal-500 dark:border-teal-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : loadError ? (
              <div role="alert" className="px-6 py-10 text-center">
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">Unable to load notifications</p>
                <p className="mt-1 text-xs text-slate-500">Please retry to check for updates.</p>
                <button onClick={retryLoad} className="mt-3 text-sm font-semibold text-teal-600 dark:text-teal-400 underline">Retry</button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div className="w-14 h-14 bg-slate-100 dark:bg-[#162036] rounded-2xl flex items-center justify-center mb-3">
                  <i className="ri-notification-off-line text-2xl text-slate-400 dark:text-slate-600"></i>
                </div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No notifications yet</p>
                <p className="text-xs text-slate-500 mt-1">You are all caught up!</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => {
                  const action = getActionButton(n);
                  return (
                    <li
                      key={n.id}
                      className={`border-b border-slate-100 dark:border-[#1e2d4d] transition-colors ${
                        n.is_read ? 'bg-white dark:bg-[#111d35]' : 'bg-teal-50 dark:bg-teal-500/5'
                      }`}
                    >
                      <div className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <PriorityBadge priority={n.priority ?? 1} />
                              <CategoryBadge category={n.category || n.type || 'general'} />
                            </div>
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-semibold leading-tight ${n.is_read ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                {n.title}
                              </p>
                              {!n.is_read && (
                                <span className="w-2 h-2 bg-teal-400 rounded-full flex-shrink-0 mt-1.5"></span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                            {n.data?.job_title && (
                              <p className="text-xs text-teal-500 dark:text-teal-400 mt-1 font-medium">
                                <i className="ri-briefcase-line mr-1"></i>
                                {n.data.job_title}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-400 mt-1.5 font-medium">{timeAgo(n.created_at)}</p>
                            {action && (
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={() => { void handleActionClick(n); }}
                                  disabled={actionPending || loading || loadError}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-500 dark:text-teal-400 hover:text-teal-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                                >
                                  <i className={action.icon}></i>
                                  {action.label}
                                </button>
                                {!n.is_read && (
                                  <button
                                    onClick={() => { void markOneRead(n.id); }}
                                disabled={actionPending || loading || loadError}
                                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                                  >
                                    Mark as read
                                  </button>
                                )}
                              </div>
                            )}
                            {!action && !n.is_read && (
                              <button
                                onClick={() => { void markOneRead(n.id); }}
                                disabled={actionPending || loading || loadError}
                                className="mt-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                              >
                                Mark as read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-200 dark:border-[#1e2d4d] bg-slate-50/50 dark:bg-[#0B1933]/50 flex items-center justify-between">
            <p className="text-xs text-slate-500">{loadError ? 'Notifications unavailable' : loading ? 'Loading notifications…' : `Showing last ${notifications.length} notifications`}</p>
            <Link
              href="/client/notifications"
              onClick={() => { navigationRef.current += 1; setOpen(false); }}
              className="text-xs text-teal-500 dark:text-teal-400 font-semibold hover:underline cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              View All →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}