'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import NotificationCard from './NotificationCard';
import ReplacementNotificationsSection from './ReplacementNotificationsSection';
import { useClientGuard } from '@/hooks/useClientGuard';
import SearchFilterBar from '../components/SearchFilterBar';
import BulkActionBar from '../components/BulkActionBar';
import Link from 'next/link';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: string;
  type: string;
  priority: number;
  is_read: boolean;
  created_at: string;
  link: string | null;
  data: { job_title?: string } | null;
  read: boolean;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'job_update', label: 'Job Updates' },
  { id: 'new_applicants', label: 'New Applicants' },
  { id: 'guard_selection', label: 'Guard Selection' },
  { id: 'guard_confirmation', label: 'Guard Confirmation' },
  { id: 'payment_alert', label: 'Payment Alerts' },
  { id: 'message', label: 'Messages' },
  { id: 'support_ticket', label: 'Support Tickets' },
  { id: 'account_billing', label: 'Account / Billing' },
  { id: 'general', label: 'General' },
  { id: 'payment', label: 'Payment' },
  { id: 'guard_assigned', label: 'Guard Assigned' },
  { id: 'complaint', label: 'Complaint' },
  { id: 'replacement_request', label: 'Replacement' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'job_cancelled', label: 'Cancellation' },
  { id: 'refund_request', label: 'Refund' },
  { id: 'booking_confirmed', label: 'Booking Confirmed' },
  { id: 'booking_disputed', label: 'Booking Disputed' },
];

const PRIORITIES = [
  { value: 'all', label: 'All Priorities' },
  { value: '3', label: 'Urgent' },
  { value: '2', label: 'Important' },
  { value: '1', label: 'Normal' },
  { value: '0', label: 'Info' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

const NOTIFICATION_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'unread_first', label: 'Unread First' },
  { value: 'urgent_first', label: 'Urgent First' },
];

const NOTIFICATION_FILTER_CONFIGS = [
  {
    key: 'status',
    label: 'Status',
    type: 'select' as const,
    options: [
      { value: 'unread', label: 'Unread' },
      { value: 'read', label: 'Read' },
    ],
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select' as const,
    options: [
      { value: '3', label: 'Urgent' },
      { value: '2', label: 'Important' },
      { value: '1', label: 'Normal' },
      { value: '0', label: 'Info' },
    ],
  },
  {
    key: 'date',
    label: 'Date Range',
    type: 'dateRange' as const,
  },
];

export default function ClientNotificationsPage() {
  const router = useRouter();
  const { loading: authLoading, allowed } = useClientGuard();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activePriority, setActivePriority] = useState('all');
  const [activeStatus, setActiveStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [companyName, setCompanyName] = useState('Client');

  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedNotifIds, setSelectedNotifIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkAction, setBulkAction] = useState('');

  const loadNotifications = useCallback(async () => {
    setLoadError(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/client/login');
        return;
      }
      const uid = session.user.id;
      setUserId(uid);

      const { data: client } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('user_id', uid)
        .maybeSingle();

      if (!client) {
        router.push('/client/complete-profile-wizard');
        return;
      }
      setClientId(client.id);
      setCompanyName(client.company_name || 'Client');

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (activeCategory !== 'all') {
        query = query.eq('category', activeCategory);
      }
      if (activePriority !== 'all') {
        query = query.eq('priority', parseInt(activePriority));
      }
      if (activeStatus === 'unread') {
        query = query.eq('is_read', false);
      } else if (activeStatus === 'read') {
        query = query.eq('is_read', true);
      }
      if (search.trim()) {
        query = query.or(`title.ilike.%${search.trim()}%,message.ilike.%${search.trim()}%`);
      }
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo + 'T23:59:59');
      }

      const { data } = await query.limit(100);
      setNotifications((data || []) as NotificationItem[]);
      setLoading(false);
    } catch {
      setLoadError(true);
      setLoading(false);
    }
  }, [router, activeCategory, activePriority, activeStatus, search, dateFrom, dateTo]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`client-notifications-page-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => { loadNotifications(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => { loadNotifications(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, loadNotifications]);

  const markOneRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true, read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true, read: true } : n));
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setMarkingAll(true);
    await supabase.from('notifications').update({ is_read: true, read: true }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read: true })));
    setMarkingAll(false);
  };

  const deleteOne = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // --- Bulk action handlers ---
  const toggleNotifSelection = (id: string) => {
    setSelectedNotifIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllNotifs = () => {
    const ids = filtered.map(n => n.id);
    setSelectedNotifIds(new Set(ids));
  };

  const clearNotifSelection = () => setSelectedNotifIds(new Set());

  const handleBulkMarkRead = async () => {
    setBulkProcessing(true);
    setBulkAction('mark_read');
    const ids = Array.from(selectedNotifIds);
    await supabase.from('notifications').update({ is_read: true, read: true }).in('id', ids);
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true, read: true } : n));
    setBulkProcessing(false);
    setBulkAction('');
    setSelectedNotifIds(new Set());
    setBulkMode(false);
  };

  const handleBulkMarkUnread = async () => {
    setBulkProcessing(true);
    setBulkAction('mark_unread');
    const ids = Array.from(selectedNotifIds);
    await supabase.from('notifications').update({ is_read: false, read: false }).in('id', ids);
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: false, read: false } : n));
    setBulkProcessing(false);
    setBulkAction('');
    setSelectedNotifIds(new Set());
    setBulkMode(false);
  };

  const handleBulkDeleteNotifs = async () => {
    setBulkProcessing(true);
    setBulkAction('delete');
    const ids = Array.from(selectedNotifIds);
    await supabase.from('notifications').delete().in('id', ids);
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    setBulkProcessing(false);
    setBulkAction('');
    setSelectedNotifIds(new Set());
    setBulkMode(false);
  };

  const handleNotifBulkAction = (actionKey: string) => {
    if (actionKey === 'mark_read') handleBulkMarkRead();
    else if (actionKey === 'mark_unread') handleBulkMarkUnread();
    else if (actionKey === 'delete') handleBulkDeleteNotifs();
  };
  // --- End bulk action handlers ---

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const urgentCount = notifications.filter((n) => n.priority === 3 && !n.is_read).length;
  const importantCount = notifications.filter((n) => n.priority === 2 && !n.is_read).length;

  const sortedNotifications = [...notifications].sort((a, b) => {
    if (sortBy === 'unread_first') {
      if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (sortBy === 'urgent_first') {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return 0;
  });

  const filtered = sortedNotifications;

  if (authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={companyName}
        subtitle="Client"
        initials={companyName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
      />
      <main className="flex-1 min-h-screen pb-20 lg:pb-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Stay on top of job, guard, and payment updates</p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={markingAll}
                  className="flex items-center gap-1.5 bg-teal-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  {markingAll ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <i className="ri-check-double-line"></i>
                  )}
                  Mark All Read
                </button>
              )}
              <button
                onClick={() => setBulkMode(!bulkMode)}
                className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors cursor-pointer whitespace-nowrap ${
                  bulkMode
                    ? 'bg-teal-500 text-white border-teal-500'
                    : 'bg-white dark:bg-[#111d35] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1e2d4d] hover:bg-slate-50 dark:hover:bg-[#162036]'
                }`}
              >
                <i className="ri-stack-line"></i>
                {bulkMode ? 'Done' : 'Bulk'}
              </button>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="flex items-center gap-1.5 bg-white dark:bg-[#111d35] text-slate-600 dark:text-slate-300 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#1e2d4d] hover:bg-slate-50 dark:hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-filter-3-line"></i>
                Filters
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{notifications.length}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
            <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{unreadCount}</p>
              <p className="text-xs text-slate-500">Unread</p>
            </div>
            <div className="bg-white dark:bg-[#111d35] rounded-xl border border-red-500/20 p-4">
              <p className="text-2xl font-bold text-red-500">{urgentCount}</p>
              <p className="text-xs text-red-400">Urgent</p>
            </div>
            <div className="bg-white dark:bg-[#111d35] rounded-xl border border-amber-500/20 p-4">
              <p className="text-2xl font-bold text-amber-500">{importantCount}</p>
              <p className="text-xs text-amber-400">Important</p>
            </div>
          </div>

          {/* Alert banner */}
          {urgentCount > 0 && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-alarm-warning-line text-red-400 text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-400">{urgentCount} urgent notification{urgentCount > 1 ? 's' : ''} need attention</p>
                <p className="text-xs text-red-400/70">Review immediately to avoid missing critical updates</p>
              </div>
            </div>
          )}

          {/* Replacement Requests Section */}
          {clientId && (activeCategory === 'all' || activeCategory === 'replacement_request') && (
            <ReplacementNotificationsSection clientId={clientId} />
          )}

          {/* Search and Filters */}
          <div className="bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4 mb-6">
            <SearchFilterBar
              searchQuery={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search notifications..."
              filters={{
                status: activeStatus,
                priority: activePriority,
                date_from: dateFrom,
                date_to: dateTo,
              }}
              onFilterChange={(key, value) => {
                if (key === 'status') setActiveStatus(value);
                else if (key === 'priority') setActivePriority(value);
                else if (key === 'date_from') setDateFrom(value);
                else if (key === 'date_to') setDateTo(value);
              }}
              filterConfigs={NOTIFICATION_FILTER_CONFIGS}
              sortBy={sortBy}
              onSortChange={setSortBy}
              sortOptions={NOTIFICATION_SORT_OPTIONS}
              resultCount={filtered.length}
              loading={loading}
              onClear={() => {
                setSearch('');
                setActiveCategory('all');
                setActivePriority('all');
                setActiveStatus('all');
                setDateFrom('');
                setDateTo('');
                setSortBy('');
                setShowFilters(false);
              }}
              showMobilePanel={showFilters}
              onToggleMobilePanel={() => setShowFilters((v) => !v)}
            />
          </div>

          {/* BulkActionBar */}
          <BulkActionBar
            selectedCount={selectedNotifIds.size}
            totalCount={filtered.length}
            allSelected={selectedNotifIds.size === filtered.length && filtered.length > 0}
            onSelectAll={selectAllNotifs}
            onClearSelection={clearNotifSelection}
            actions={[
              {
                key: 'mark_read',
                label: 'Mark Read',
                icon: 'ri-check-double-line',
                variant: 'primary',
              },
              {
                key: 'mark_unread',
                label: 'Mark Unread',
                icon: 'ri-mail-unread-line',
                variant: 'secondary',
              },
              {
                key: 'delete',
                label: 'Delete',
                icon: 'ri-delete-bin-line',
                variant: 'danger',
                requiresConfirmation: true,
                confirmationTitle: 'Delete Selected Notifications',
                confirmationMessage: 'This will permanently delete the selected notifications. This action cannot be undone.',
                confirmButtonText: 'Delete',
                confirmButtonIcon: 'ri-delete-bin-line',
              },
            ]}
            onAction={handleNotifBulkAction}
            processing={bulkProcessing}
            processingAction={bulkAction}
          />

          {/* Category tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
            {CATEGORIES.map((cat) => {
              const count = cat.id === 'all'
                ? notifications.length
                : notifications.filter((n) => (n.category || n.type) === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
                    activeCategory === cat.id
                      ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                      : 'bg-white dark:bg-[#111d35] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1e2d4d] hover:bg-slate-50 dark:hover:bg-[#162036]'
                  }`}
                >
                  {cat.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeCategory === cat.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-[#162036] text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Notification list */}
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {/* Notification card skeletons */}
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`bg-white dark:bg-[#111d35] rounded-xl border border-slate-200 dark:border-[#1e2d4d] p-4 sm:p-5 flex items-start gap-3 sm:gap-4 ${i < 2 ? 'border-l-4 border-l-red-500 dark:border-l-red-500' : ''}`}
                  >
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex-shrink-0 mt-0.5 ${i < 2 ? 'bg-red-500/10' : 'bg-[#162036]'}`} />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="h-4 sm:h-5 bg-[#162036] rounded w-full sm:w-2/3" />
                        <div className="h-3 bg-[#162036] rounded w-14 sm:w-16 flex-shrink-0" />
                      </div>
                      <div className="h-3 bg-[#162036] rounded w-full sm:w-3/4" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="h-5 sm:h-6 bg-[#162036] rounded-full w-16 sm:w-20" />
                        <div className="h-3 bg-[#162036] rounded w-20 sm:w-24" />
                      </div>
                    </div>
                    <div className="h-4 w-4 bg-[#162036] rounded flex-shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-red-500/20 p-10 md:p-16 text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                  <i className="ri-error-warning-line text-3xl text-red-400"></i>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Failed to load notifications</h3>
                <p className="text-slate-500 text-sm mb-6">We could not load your notifications. Please check your connection and try again.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button onClick={loadNotifications} className="inline-flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]">
                    <i className="ri-refresh-line"></i>Retry
                  </button>
                  <Link href="/client/support" className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-red-500/20 transition-colors cursor-pointer whitespace-nowrap border border-red-500/25">
                    <i className="ri-customer-service-2-line"></i>Contact Support
                  </Link>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white dark:bg-[#111d35] rounded-2xl border border-slate-200 dark:border-[#1e2d4d] p-10 md:p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <i className="ri-notification-off-line text-3xl text-slate-400 dark:text-slate-600"></i>
                </div>
                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {search ? 'No matching notifications' : 'You are all caught up'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {search ? 'Try a different search term' : 'No notifications in this category'}
                </p>
                {search && (
                  <button onClick={() => setSearch('')} className="mt-4 inline-flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]">
                    <i className="ri-close-circle-line"></i>Clear Search
                  </button>
                )}
              </div>
            ) : (
              filtered.map((n) => (
                <NotificationCard
                  key={n.id}
                  id={n.id}
                  title={n.title}
                  message={n.message}
                  category={n.category || n.type || 'general'}
                  priority={n.priority || 1}
                  is_read={n.is_read}
                  created_at={n.created_at}
                  link={n.link || undefined}
                  related_job_title={n.data?.job_title || undefined}
                  onMarkRead={markOneRead}
                  onDelete={deleteOne}
                  selectable={bulkMode}
                  selected={selectedNotifIds.has(n.id)}
                  onToggleSelect={toggleNotifSelection}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}