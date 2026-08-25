'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PortalSidebar from '@/components/PortalSidebar';
import LiveIndicator from '@/components/LiveIndicator';
import { useGuardGuard } from '@/hooks/useGuardGuard';
import TicketCard from './TicketCard';
import CreateTicketModal from './CreateTicketModal';
import TicketDetailDrawer from './TicketDetailDrawer';
import SearchFilterBar from '@/app/client/components/SearchFilterBar';
import BulkActionBar from '@/app/client/components/BulkActionBar';

const TABS = [
  { key: 'all', label: 'All Tickets', icon: 'ri-list-check-2' },
  { key: 'open', label: 'Open', icon: 'ri-folder-open-line' },
  { key: 'awaiting_guard', label: 'Awaiting Reply', icon: 'ri-reply-line' },
  { key: 'under_review', label: 'Under Review', icon: 'ri-search-line' },
  { key: 'escalated', label: 'Escalated', icon: 'ri-arrow-up-line' },
  { key: 'resolved', label: 'Resolved', icon: 'ri-checkbox-circle-line' },
  { key: 'closed', label: 'Closed', icon: 'ri-lock-line' },
];

const STATUS_FILTERS: Record<string, string[]> = {
  all: [],
  open: ['open'],
  awaiting_guard: ['awaiting_guard'],
  under_review: ['under_review'],
  escalated: ['escalated'],
  resolved: ['resolved', 'closed'],
  closed: ['closed'],
};

const TICKET_SORT_OPTIONS = [
  { value: 'urgent', label: 'Urgent First' },
  { value: 'newest', label: 'Newest' },
  { value: 'awaiting_guard', label: 'Awaiting Guard Reply' },
  { value: 'last_updated', label: 'Last Updated' },
];

const TICKET_FILTER_CONFIGS = [
  {
    key: 'status',
    label: 'Status',
    type: 'select' as const,
    options: [
      { value: 'open', label: 'Open' },
      { value: 'awaiting_guard', label: 'Awaiting Guard' },
      { value: 'under_review', label: 'Under Review' },
      { value: 'escalated', label: 'Escalated' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'closed', label: 'Closed' },
    ],
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select' as const,
    options: [
      { value: 'low', label: 'Low' },
      { value: 'normal', label: 'Normal' },
      { value: 'high', label: 'High' },
      { value: 'urgent', label: 'Urgent' },
    ],
  },
  {
    key: 'category',
    label: 'Category',
    type: 'select' as const,
    options: [
      { value: 'general_support', label: 'General Support' },
      { value: 'payment_issue', label: 'Payment Issue' },
      { value: 'late_payment', label: 'Late Payment' },
      { value: 'client_no_show', label: 'Client No-Show' },
      { value: 'job_dispute', label: 'Job Dispute' },
      { value: 'technical_issue', label: 'Technical Issue' },
      { value: 'account_billing', label: 'Account/Billing' },
    ],
  },
  {
    key: 'date',
    label: 'Date Range',
    type: 'dateRange' as const,
  },
];

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s;
}

export default function SupportPage() {
  const router = useRouter();
  const { loading: authLoading, allowed } = useGuardGuard();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [guardId, setGuardId] = useState<string | null>(null);
  const [guardName, setGuardName] = useState('Guard');
  const [verificationStatus, setVerificationStatus] = useState('Guard');
  const [initials, setInitials] = useState('GD');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [prefillCategory, setPrefillCategory] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [toast, setToast] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkActionKey, setBulkActionKey] = useState('');

  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    if (!silent) setLoadError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/guard/login'); return; }

      const { data: guard } = await supabase
        .from('guards')
        .select('id, full_name, verification_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!guard) { router.push('/guard/login'); return; }

      setGuardId(guard.id);
      setGuardName(guard.full_name || 'Guard');
      setVerificationStatus(guard.verification_status ? capitalize(guard.verification_status) : 'Guard');
      setInitials(getInitials(guard.full_name || 'Guard'));

      const { data: ticketsData } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('guard_id', guard.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      setTickets(ticketsData || []);
      setLastUpdated(new Date());
    } catch {
      if (!silent) setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (!guardId) return;
    const channel = supabase
      .channel(`guard-support-tickets-${guardId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'app',
        table: 'support_tickets',
        filter: `guard_id=eq.${guardId}`,
      }, () => {
        loadTickets(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadTickets, guardId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (!selectedTicket) return;

    const refreshedTicket = tickets.find(
      (ticket) => ticket.id === selectedTicket.id
    );

    if (!refreshedTicket) return;

    if (
      refreshedTicket.status === selectedTicket.status &&
      refreshedTicket.updated_at === selectedTicket.updated_at &&
      refreshedTicket.priority === selectedTicket.priority
    ) {
      return;
    }

    setSelectedTicket(refreshedTicket);
  }, [tickets]);

  const filteredTickets = tickets.filter((ticket) => {
    const statuses = STATUS_FILTERS[activeTab] || [];
    if (activeTab !== 'all' && statuses.length > 0) {
      if (!statuses.includes(ticket.status)) return false;
    }
    if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && ticket.category !== categoryFilter) return false;
    if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;
    if (dateFrom && ticket.created_at && ticket.created_at < dateFrom) return false;
    if (dateTo && ticket.created_at && ticket.created_at > dateTo + 'T23:59:59') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = (ticket.ticket_reference || '').toLowerCase().includes(q);
      const matchSubject = (ticket.subject || '').toLowerCase().includes(q);
      const matchCategory = (ticket.category || '').toLowerCase().includes(q);
      const matchDesc = (ticket.description || '').toLowerCase().includes(q);
      if (!matchRef && !matchSubject && !matchCategory && !matchDesc) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'urgent') {
      const priorityOrder = { urgent: 3, high: 2, normal: 1, low: 0 };
      return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
    }
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'awaiting_guard') {
      const aAwaiting = a.status === 'awaiting_guard' ? 1 : 0;
      const bAwaiting = b.status === 'awaiting_guard' ? 1 : 0;
      return bAwaiting - aAwaiting;
    }
    if (sortBy === 'last_updated') return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    return 0;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    awaitingGuard: tickets.filter(t => t.status === 'awaiting_guard').length,
    underReview: tickets.filter(t => t.status === 'under_review').length,
    escalated: tickets.filter(t => t.status === 'escalated').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    urgent: tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length,
  };

  const getTabCount = (key: string) => {
    if (key === 'all') return stats.total;
    if (key === 'open') return stats.open;
    if (key === 'awaiting_guard') return stats.awaitingGuard;
    if (key === 'under_review') return stats.underReview;
    if (key === 'escalated') return stats.escalated;
    if (key === 'resolved') return stats.resolved + stats.closed;
    if (key === 'closed') return stats.closed;
    return 0;
  };

  const handleOpenCreate = (category = '') => {
    setPrefillCategory(category);
    setShowCreateModal(true);
  };

  const handleExport = () => {
    if (filteredTickets.length === 0) {
      setToast('No tickets to export');
      return;
    }
    const headers = [
      'Reference', 'Category', 'Subject', 'Priority', 'Status',
      'Created', 'Updated', 'Resolved', 'Description'
    ];
    const rows = filteredTickets.map((t: any) => [
      t.ticket_reference,
      t.category,
      t.subject,
      t.priority,
      t.status,
      t.created_at,
      t.updated_at,
      t.resolved_at || '',
      t.description.replace(/"/g, '""'),
    ]);
    const csv = [headers.join(','), ...rows.map((r: any) => r.map((v: any) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickguard-guard-support-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast(`${filteredTickets.length} ticket${filteredTickets.length !== 1 ? 's' : ''} exported`);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setPriorityFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('');
    setShowFilters(false);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'status') setStatusFilter(value);
    else if (key === 'priority') setPriorityFilter(value);
    else if (key === 'category') setCategoryFilter(value);
    else if (key === 'date_from') setDateFrom(value);
    else if (key === 'date_to') setDateTo(value);
  };

  const toggleTicketSelection = (id: string) => {
    setSelectedTicketIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkExportTickets = () => {
    const selected = filteredTickets.filter(t => selectedTicketIds.has(t.id));
    if (selected.length === 0) { setToast('No tickets selected'); return; }
    setBulkProcessing(true);
    setBulkActionKey('export');
    const headers = ['Reference', 'Category', 'Subject', 'Priority', 'Status', 'Created', 'Updated'];
    const rows = selected.map((t: any) => [
      t.ticket_reference, t.category, t.subject, t.priority, t.status, t.created_at, t.updated_at,
    ]);
    const csv = [headers.join(','), ...rows.map((r: any) => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickguard-guard-support-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBulkProcessing(false);
    setBulkActionKey('');
    setSelectedTicketIds(new Set());
    setBulkMode(false);
    setToast(`${selected.length} ticket${selected.length !== 1 ? 's' : ''} exported`);
  };

  const handleBulkMarkResolved = async () => {
    const resolvable = filteredTickets.filter(t => selectedTicketIds.has(t.id) && !['resolved', 'closed'].includes(t.status)).map(t => t.id);
    if (resolvable.length === 0) { setToast('No tickets that can be closed'); return; }
    setBulkProcessing(true);
    setBulkActionKey('resolve');
    await supabase
      .from('support_tickets')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .in('id', resolvable);
    setTickets(prev => prev.map(t => resolvable.includes(t.id) ? { ...t, status: 'closed' } : t));
    setBulkProcessing(false);
    setBulkActionKey('');
    setSelectedTicketIds(new Set());
    setBulkMode(false);
    setToast(`${resolvable.length} ticket${resolvable.length !== 1 ? 's' : ''} closed`);
  };

  const handleTicketBulkAction = (actionKey: string) => {
    if (actionKey === 'export') handleBulkExportTickets();
    else if (actionKey === 'resolve') handleBulkMarkResolved();
  };

  if (loading || authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="guard" displayName="Guard" subtitle="Guard" initials="GD" />
        <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
          <header className="bg-[#111d35] border-b border-[#1e2d4d] px-4 sm:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-20">
            <div className="space-y-1">
              <div className="h-3 w-28 bg-[#162036] rounded animate-pulse"></div>
              <div className="h-7 sm:h-8 w-40 sm:w-48 bg-[#162036] rounded animate-pulse"></div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="h-8 sm:h-9 w-24 sm:w-32 bg-[#162036] rounded-xl animate-pulse"></div>
              <div className="h-8 sm:h-9 w-20 sm:w-24 bg-[#162036] rounded-xl animate-pulse"></div>
              <div className="h-8 sm:h-9 w-28 sm:w-32 bg-teal-500/20 rounded-xl animate-pulse"></div>
            </div>
          </header>
          <main className="flex-1 px-4 sm:px-8 py-4 sm:py-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3 mb-4 sm:mb-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 bg-[#162036] rounded-lg flex-shrink-0 animate-pulse"></div>
                  <div className="space-y-1">
                    <div className="h-5 sm:h-6 w-6 sm:w-8 bg-[#162036] rounded animate-pulse"></div>
                    <div className="h-2 w-10 sm:w-12 bg-[#162036] rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3 sm:space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#162036] rounded-lg flex-shrink-0 animate-pulse"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-full sm:w-3/4 bg-[#162036] rounded animate-pulse"></div>
                        <div className="h-3 w-full sm:w-1/2 bg-[#162036] rounded animate-pulse"></div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <div className="h-5 w-16 bg-[#162036] rounded-full animate-pulse"></div>
                          <div className="h-5 w-20 bg-[#162036] rounded-full animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="guard"
        displayName={guardName || 'Guard'}
        subtitle={verificationStatus || 'Guard'}
        initials={initials}
      />

      <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
        {/* Header */}
        <header className="bg-[#111d35] border-b border-[#1e2d4d] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Guard Portal</p>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Support Centre
              {stats.open > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                  {stats.open} open
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <LiveIndicator />
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              <div className={`w-2 h-2 rounded-full ${refreshing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
              {lastUpdated && (
                <span suppressHydrationWarning>
                  Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <button
              onClick={() => loadTickets(true)}
              disabled={refreshing}
              className="hidden md:flex items-center gap-2 bg-[#162036] text-slate-400 text-sm font-semibold px-3 py-2 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 border border-[#1e2d4d]"
            >
              <i className={`ri-refresh-line ${refreshing ? 'animate-spin' : ''}`}></i>
              Refresh
            </button>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line"></i>
              New Ticket
            </button>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            {[
              { label: 'Total', value: stats.total, icon: 'ri-list-check-2', color: 'text-teal-400' },
              { label: 'Open', value: stats.open, icon: 'ri-folder-open-line', color: 'text-red-400' },
              { label: 'Awaiting Reply', value: stats.awaitingGuard, icon: 'ri-reply-line', color: 'text-amber-400' },
              { label: 'Under Review', value: stats.underReview, icon: 'ri-search-line', color: 'text-violet-400' },
              { label: 'Escalated', value: stats.escalated, icon: 'ri-arrow-up-line', color: 'text-orange-400' },
              { label: 'Resolved', value: stats.resolved, icon: 'ri-checkbox-circle-line', color: 'text-emerald-400' },
              { label: 'Closed', value: stats.closed, icon: 'ri-lock-line', color: 'text-slate-400' },
              { label: 'Urgent', value: stats.urgent, icon: 'ri-fire-line', color: 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-[#162036] rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className={`${s.icon} text-lg ${s.color}`}></i>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-200">{s.value}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Alert Banner */}
          {stats.awaitingGuard > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-reply-line text-amber-400"></i>
              </div>
              <p className="text-sm text-amber-400 font-medium">
                {stats.awaitingGuard} ticket{stats.awaitingGuard > 1 ? 's' : ''} waiting for your reply
              </p>
              <button
                onClick={() => setActiveTab('awaiting_guard')}
                className="ml-auto text-xs text-teal-400 font-semibold hover:underline cursor-pointer whitespace-nowrap"
              >
                View Now
              </button>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 mb-6">
            <p className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <i className="ri-flashlight-line text-teal-400"></i>
              Report a Problem
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Payment Issue', category: 'payment_issue', icon: 'ri-secure-payment-line', color: 'text-red-400', border: 'border-red-500/25', bg: 'hover:bg-red-500/10' },
                { label: 'Late Payment', category: 'late_payment', icon: 'ri-time-line', color: 'text-orange-400', border: 'border-orange-500/25', bg: 'hover:bg-orange-500/10' },
                { label: 'Client No-Show', category: 'client_no_show', icon: 'ri-user-unfollow-line', color: 'text-amber-400', border: 'border-amber-500/25', bg: 'hover:bg-amber-500/10' },
                { label: 'Technical Issue', category: 'technical_issue', icon: 'ri-bug-line', color: 'text-violet-400', border: 'border-violet-500/25', bg: 'hover:bg-violet-500/10' },
              ].map((action) => (
                <button
                  key={action.category}
                  onClick={() => handleOpenCreate(action.category)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border ${action.border} ${action.color} text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${action.bg}`}
                >
                  <i className={action.icon}></i>
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-4 flex-wrap overflow-x-auto pb-1">
            {TABS.map((tab) => {
              const count = getTabCount(tab.key);
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-teal-500 text-white shadow-sm'
                      : 'bg-[#111d35] text-slate-400 border border-[#1e2d4d] hover:border-teal-500/30 hover:text-slate-200'
                  }`}
                >
                  <i className={tab.icon}></i>
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-[#162036] text-slate-400'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search & Filters */}
          <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 mb-6">
            <SearchFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search by reference, subject, or category..."
              filters={{
                status: statusFilter,
                priority: priorityFilter,
                category: categoryFilter,
                date_from: dateFrom,
                date_to: dateTo,
              }}
              onFilterChange={handleFilterChange}
              filterConfigs={TICKET_FILTER_CONFIGS}
              sortBy={sortBy}
              onSortChange={setSortBy}
              sortOptions={TICKET_SORT_OPTIONS}
              resultCount={filteredTickets.length}
              loading={loading}
              onClear={handleClearFilters}
              showMobilePanel={showFilters}
              onToggleMobilePanel={() => setShowFilters((v) => !v)}
            />

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button
                onClick={handleExport}
                disabled={filteredTickets.length === 0}
                className="flex items-center gap-2 px-3 py-2 bg-[#162036] text-slate-400 text-sm font-semibold rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 border border-[#1e2d4d]"
              >
                <i className="ri-download-line"></i>
                Export All
              </button>
              <button
                onClick={() => setBulkMode(!bulkMode)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap border ${
                  bulkMode
                    ? 'bg-teal-500 text-white border-teal-500'
                    : 'bg-[#162036] text-slate-400 border-[#1e2d4d] hover:bg-[#1a2642]'
                }`}
              >
                <i className="ri-stack-line"></i>
                {bulkMode ? 'Done' : 'Bulk Actions'}
              </button>
            </div>
          </div>

          {/* Content */}
          {loadError ? (
            <div className="bg-[#111d35] rounded-2xl border border-red-500/20 shadow-sm p-10 md:p-16 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <i className="ri-error-warning-line text-4xl text-red-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Failed to load support tickets</h3>
              <p className="text-slate-500 text-sm mb-6">We could not load your support tickets. Please check your connection and try again.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={() => loadTickets()} className="inline-flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]">
                  <i className="ri-refresh-line"></i>Retry
                </button>
                <a href="mailto:support@quickguard.uk" className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-red-500/20 transition-colors cursor-pointer whitespace-nowrap border border-red-500/25">
                  <i className="ri-mail-line"></i>Email Support
                </a>
              </div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-10 md:p-16 text-center">
              <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-customer-service-2-line text-3xl text-slate-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">
                {searchQuery ? 'No tickets match your search' : 'No support tickets yet'}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {searchQuery ? 'Try a different search term or clear your filters' : 'Create a new ticket if you need help with a payment, job, or account issue'}
              </p>
              {!searchQuery && (
                <button onClick={handleOpenCreate} className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                  <i className="ri-add-line"></i>Create Ticket
                </button>
              )}
              {searchQuery && (
                <button onClick={handleClearFilters} className="inline-flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]">
                  <i className="ri-close-circle-line"></i>Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <BulkActionBar
                selectedCount={selectedTicketIds.size}
                totalCount={filteredTickets.length}
                allSelected={selectedTicketIds.size === filteredTickets.length && filteredTickets.length > 0}
                onSelectAll={() => setSelectedTicketIds(new Set(filteredTickets.map(t => t.id)))}
                onClearSelection={() => setSelectedTicketIds(new Set())}
                actions={[
                  { key: 'export', label: 'Export Selected', icon: 'ri-download-line', variant: 'secondary' },
                  { key: 'resolve', label: 'Close Tickets', icon: 'ri-checkbox-circle-line', variant: 'primary', requiresConfirmation: true, confirmationTitle: 'Close Selected Tickets', confirmationMessage: 'This will mark the selected open tickets as closed. Only tickets that are not already resolved or closed will be affected.', confirmButtonText: 'Close Tickets', confirmButtonIcon: 'ri-checkbox-circle-line' },
                ]}
                onAction={handleTicketBulkAction}
                processing={bulkProcessing}
                processingAction={bulkActionKey}
              />
              {filteredTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onOpen={setSelectedTicket}
                  selectable={bulkMode}
                  selected={selectedTicketIds.has(ticket.id)}
                  onToggleSelect={() => toggleTicketSelection(ticket.id)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-24 right-6 z-50 bg-[#111d35] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-[#1e2d4d] animate-fade-in">
          <i className="ri-checkbox-circle-fill text-teal-400"></i>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* Modals / Drawers */}
      {showCreateModal && (
        <CreateTicketModal
          guardId={guardId || ''}
          prefillCategory={prefillCategory}
          onClose={() => { setShowCreateModal(false); setPrefillCategory(''); }}
          onSuccess={() => {
            loadTickets(true);
            setShowCreateModal(false);
            setToast('Ticket created successfully');
          }}
        />
      )}
      {selectedTicket && (
        <TicketDetailDrawer
          ticket={selectedTicket}
          guardId={guardId || ''}
          onClose={() => setSelectedTicket(null)}
          onUpdated={() => loadTickets(true)}
        />
      )}
    </div>
  );
}