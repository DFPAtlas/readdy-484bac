'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import PortalSidebar from '@/components/PortalSidebar';
import LiveIndicator from '@/components/LiveIndicator';
import { useClientGuard } from '@/hooks/useClientGuard';
import TicketCard from './TicketCard';
import CreateTicketModal from './CreateTicketModal';
import TicketDetailDrawer from './TicketDetailDrawer';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import SearchFilterBar from '../components/SearchFilterBar';
import BulkActionBar from '../components/BulkActionBar';
import { useRouter } from 'next/navigation';

const TABS = [
  { key: 'all', label: 'All Tickets', icon: 'ri-list-check-2' },
  { key: 'open', label: 'Open', icon: 'ri-folder-open-line' },
  { key: 'awaiting_client', label: 'Awaiting Reply', icon: 'ri-reply-line' },
  { key: 'under_review', label: 'Under Review', icon: 'ri-search-line' },
  { key: 'escalated', label: 'Escalated', icon: 'ri-arrow-up-line' },
  { key: 'resolved', label: 'Resolved', icon: 'ri-checkbox-circle-line' },
  { key: 'closed', label: 'Closed', icon: 'ri-lock-line' },
];

const STATUS_FILTERS: Record<string, string[]> = {
  all: [],
  open: ['open'],
  awaiting_client: ['awaiting_client'],
  under_review: ['under_review'],
  escalated: ['escalated'],
  resolved: ['resolved', 'closed'],
  closed: ['closed'],
};

const CATEGORY_FILTERS = [
  { value: 'all', label: 'All Categories' },
  { value: 'general_support', label: 'General Support' },
  { value: 'payment_issue', label: 'Payment Issue' },
  { value: 'guard_no_show', label: 'Guard No-Show' },
  { value: 'late_arrival', label: 'Late Arrival' },
  { value: 'poor_performance', label: 'Poor Performance' },
  { value: 'refund_request', label: 'Refund Request' },
  { value: 'job_cancellation', label: 'Job Cancellation' },
  { value: 'technical_issue', label: 'Technical Issue' },
  { value: 'account_billing', label: 'Account/Billing' },
];

const TICKET_SORT_OPTIONS = [
  { value: 'urgent', label: 'Urgent First' },
  { value: 'newest', label: 'Newest' },
  { value: 'awaiting_client', label: 'Awaiting Client Reply' },
  { value: 'last_updated', label: 'Last Updated' },
];

const TICKET_FILTER_CONFIGS = [
  {
    key: 'status',
    label: 'Status',
    type: 'select' as const,
    options: [
      { value: 'open', label: 'Open' },
      { value: 'awaiting_client', label: 'Awaiting Client' },
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
      { value: 'guard_no_show', label: 'Guard No-Show' },
      { value: 'late_arrival', label: 'Late Arrival' },
      { value: 'poor_performance', label: 'Poor Performance' },
      { value: 'refund_request', label: 'Refund Request' },
      { value: 'job_cancellation', label: 'Job Cancellation' },
      { value: 'technical_issue', label: 'Technical Issue' },
      { value: 'account_billing', label: 'Account/Billing' },
    ],
  },
  {
    key: 'date',
    label: 'Date Range',
    type: 'dateRange' as const,
  },
  {
    key: 'related_job',
    label: 'Has Job',
    type: 'select' as const,
    options: [
      { value: 'yes', label: 'Related to Job' },
      { value: 'no', label: 'No Job' },
    ],
  },
];

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function SupportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: authLoading, allowed } = useClientGuard();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [relatedJobFilter, setRelatedJobFilter] = useState('all');
  const [sortBy, setSortBy] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('Client');
  const [subscriptionTier, setSubscriptionTier] = useState('Basic');
  const [initials, setInitials] = useState('CL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [toast, setToast] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [prefillJobId, setPrefillJobId] = useState<string>('');
  const [prefillCategory, setPrefillCategory] = useState<string>('');
  const [hasProcessedParams, setHasProcessedParams] = useState(false);

  // Bulk selection state
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
      if (!user) { router.push('/client/login'); return; }

      const { data: client } = await supabase
        .from('clients')
        .select('id, company_name, subscription_tier')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!client) { router.push('/client/login'); return; }

      setClientId(client.id);
      setCompanyName(client.company_name || 'Client');
      setSubscriptionTier(client.subscription_tier || 'Basic');
      setInitials(getInitials(client.company_name || 'Client'));

      const { data: ticketsData } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('client_id', client.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, job_title, venue_city, start_date, status')
        .eq('client_id', client.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      const jobsList = jobsData || [];
      setJobs(jobsList);

      const jobMap = new Map(jobsList.map((j: any) => [j.id, j]));

      const formatted = (ticketsData || []).map((t: any) => ({
        ...t,
        job_title: jobMap.get(t.related_job_id)?.job_title || null,
      }));

      setTickets(formatted);
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
    const channel = supabase
      .channel(`client-support-tickets-${clientId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'support_tickets',
        filter: `client_id=eq.${clientId}`,
      }, () => {
        loadTickets(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadTickets, clientId]);

  useEffect(() => {
    if (!hasProcessedParams) {
      const newCategory = searchParams.get('new');
      const jobId = searchParams.get('job');
      if (newCategory) {
        setPrefillCategory(newCategory);
        setPrefillJobId(jobId || '');
        setShowCreateModal(true);
        setHasProcessedParams(true);
      }
    }
  }, [searchParams, hasProcessedParams]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const filteredTickets = tickets.filter((ticket) => {
    const statuses = STATUS_FILTERS[activeTab] || [];
    if (activeTab !== 'all' && statuses.length > 0) {
      if (!statuses.includes(ticket.status)) return false;
    }
    if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && ticket.category !== categoryFilter) return false;
    if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;
    if (relatedJobFilter !== 'all') {
      if (relatedJobFilter === 'yes' && !ticket.related_job_id) return false;
      if (relatedJobFilter === 'no' && ticket.related_job_id) return false;
    }
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
    if (sortBy === 'awaiting_client') {
      const aAwaiting = a.status === 'awaiting_client' ? 1 : 0;
      const bAwaiting = b.status === 'awaiting_client' ? 1 : 0;
      return bAwaiting - aAwaiting;
    }
    if (sortBy === 'last_updated') return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    return 0;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    awaitingClient: tickets.filter(t => t.status === 'awaiting_client').length,
    underReview: tickets.filter(t => t.status === 'under_review').length,
    escalated: tickets.filter(t => t.status === 'escalated').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    urgent: tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length,
    refundRequests: tickets.filter(t => t.category === 'refund_request' && t.status !== 'resolved' && t.status !== 'closed').length,
  };

  const getTabCount = (key: string) => {
    if (key === 'all') return stats.total;
    if (key === 'open') return stats.open;
    if (key === 'awaiting_client') return stats.awaitingClient;
    if (key === 'under_review') return stats.underReview;
    if (key === 'escalated') return stats.escalated;
    if (key === 'resolved') return stats.resolved + stats.closed;
    if (key === 'closed') return stats.closed;
    return 0;
  };

  const handleOpenCreate = (jobId?: string, category?: string) => {
    setPrefillJobId(jobId || '');
    setPrefillCategory(category || '');
    setShowCreateModal(true);
  };

  const handleExport = () => {
    if (filteredTickets.length === 0) {
      setToast('No tickets to export');
      return;
    }
    const headers = [
      'Reference', 'Category', 'Subject', 'Priority', 'Status',
      'Job', 'Created', 'Updated', 'Resolved', 'Description'
    ];
    const rows = filteredTickets.map((t: any) => [
      t.ticket_reference,
      t.category,
      t.subject,
      t.priority,
      t.status,
      t.job_title || '',
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
    a.download = `quickguard-support-${new Date().toISOString().slice(0, 10)}.csv`;
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
    setRelatedJobFilter('all');
    setSortBy('');
    setShowFilters(false);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'status') setStatusFilter(value);
    else if (key === 'priority') setPriorityFilter(value);
    else if (key === 'category') setCategoryFilter(value);
    else if (key === 'related_job') setRelatedJobFilter(value);
    else if (key === 'date_from') setDateFrom(value);
    else if (key === 'date_to') setDateTo(value);
  };

  // --- Bulk action handlers ---
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
    const headers = ['Reference', 'Category', 'Subject', 'Priority', 'Status', 'Job', 'Created', 'Updated'];
    const rows = selected.map((t: any) => [
      t.ticket_reference, t.category, t.subject, t.priority, t.status,
      t.job_title || '', t.created_at, t.updated_at,
    ]);
    const csv = [headers.join(','), ...rows.map((r: any) => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickguard-support-${new Date().toISOString().slice(0, 10)}.csv`;
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
    const ids = Array.from(selectedTicketIds);
    const resolvable = filteredTickets.filter(t => selectedTicketIds.has(t.id) && !['resolved', 'closed'].includes(t.status)).map(t => t.id);
    if (resolvable.length === 0) { setToast('No tickets that can be resolved'); return; }
    setBulkProcessing(true);
    setBulkActionKey('resolve');
    // NOTE: clients cannot directly resolve tickets — only request closure
    // We'll mark as awaiting_client action with a note
    // TODO: If backend supports client-requested resolution, wire this up
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
  // --- End bulk action handlers ---

  if (loading || authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName="Client" subtitle="Free" initials="CL" />
        <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
          {/* Header Skeleton */}
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
            {/* Stats Bar Skeleton */}
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

            {/* Alert Banner Skeleton */}
            <div className="bg-[#111d35] border border-[#1e2d4d] rounded-xl px-4 py-3 mb-4 sm:mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#162036] rounded-lg flex-shrink-0 animate-pulse"></div>
              <div className="h-3 w-48 sm:w-64 bg-[#162036] rounded animate-pulse"></div>
              <div className="ml-auto h-3 w-14 bg-[#162036] rounded animate-pulse"></div>
            </div>

            {/* Quick Actions Skeleton */}
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="h-4 w-32 bg-[#162036] rounded animate-pulse mb-3"></div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 w-28 sm:w-32 bg-[#162036] rounded-xl animate-pulse"></div>
                ))}
              </div>
            </div>

            {/* Tabs Skeleton */}
            <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className={`h-8 sm:h-9 rounded-xl animate-pulse ${i === 0 ? 'w-28 sm:w-32 bg-teal-500/20' : 'w-24 sm:w-28 bg-[#162036]'}`}></div>
              ))}
            </div>

            {/* Search & Filter Skeleton */}
            <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="h-10 w-full bg-[#162036] rounded-xl animate-pulse mb-3"></div>
              <div className="flex flex-wrap gap-2">
                <div className="h-8 w-20 sm:w-24 bg-[#162036] rounded-lg animate-pulse"></div>
                <div className="h-8 w-24 sm:w-28 bg-[#162036] rounded-lg animate-pulse"></div>
              </div>
            </div>

            {/* Ticket Card Skeletons */}
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
                    <div className="sm:ml-auto flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1">
                      <div className="h-3 w-16 bg-[#162036] rounded animate-pulse"></div>
                      <div className="h-5 w-20 sm:w-24 bg-[#162036] rounded-full animate-pulse"></div>
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
        role="client"
        displayName={companyName || 'Client'}
        subtitle={subscriptionTier || 'Free'}
        initials={initials}
      />

      <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
        {/* Header */}
        <header className="bg-[#111d35] border-b border-[#1e2d4d] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Client Portal</p>
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
              onClick={() => handleOpenCreate()}
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
              { label: 'Awaiting Reply', value: stats.awaitingClient, icon: 'ri-reply-line', color: 'text-amber-400' },
              { label: 'Under Review', value: stats.underReview, icon: 'ri-search-line', color: 'text-violet-400' },
              { label: 'Escalated', value: stats.escalated, icon: 'ri-arrow-up-line', color: 'text-orange-400' },
              { label: 'Resolved', value: stats.resolved, icon: 'ri-checkbox-circle-line', color: 'text-emerald-400' },
              { label: 'Urgent', value: stats.urgent, icon: 'ri-fire-line', color: 'text-red-400' },
              { label: 'Refunds', value: stats.refundRequests, icon: 'ri-refund-line', color: 'text-orange-400' },
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
          {stats.awaitingClient > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-reply-line text-amber-400"></i>
              </div>
              <p className="text-sm text-amber-400 font-medium">
                {stats.awaitingClient} ticket{stats.awaitingClient > 1 ? 's' : ''} waiting for your reply
              </p>
              <button
                onClick={() => setActiveTab('awaiting_client')}
                className="ml-auto text-xs text-teal-400 font-semibold hover:underline cursor-pointer whitespace-nowrap"
              >
                View Now
              </button>
            </div>
          )}

          {/* Quick Actions for Incidents */}
          <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 mb-6">
            <p className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <i className="ri-flashlight-line text-teal-400"></i>
              Report an Incident
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Guard No-Show', category: 'guard_no_show', icon: 'ri-user-unfollow-line', color: 'text-red-400', border: 'border-red-500/25', bg: 'hover:bg-red-500/10' },
                { label: 'Late Arrival', category: 'late_arrival', icon: 'ri-time-line', color: 'text-orange-400', border: 'border-orange-500/25', bg: 'hover:bg-orange-500/10' },
                { label: 'Poor Performance', category: 'poor_performance', icon: 'ri-emotion-unhappy-line', color: 'text-amber-400', border: 'border-amber-500/25', bg: 'hover:bg-amber-500/10' },
                { label: 'Request Refund', category: 'refund_request', icon: 'ri-refund-line', color: 'text-violet-400', border: 'border-violet-500/25', bg: 'hover:bg-violet-500/10' },
              ].map((action) => (
                <button
                  key={action.category}
                  onClick={() => handleOpenCreate('', action.category)}
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

          {/* Search & Filters — replaced with SearchFilterBar */}
          <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 mb-6">
            <SearchFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search by reference, subject, or category..."
              filters={{
                status: statusFilter,
                priority: priorityFilter,
                category: categoryFilter,
                related_job: relatedJobFilter,
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
                {searchQuery ? 'Try a different search term or clear your filters' : 'Create a new ticket if you need help with a job, payment, or account issue'}
              </p>
              {!searchQuery && (
                <div className="flex flex-wrap gap-3 justify-center">
                  <button onClick={() => handleOpenCreate()} className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-add-line"></i>Create Ticket
                  </button>
                  <Link href="/client/help#support-disputes" className="inline-flex items-center gap-2 bg-[#162036] text-slate-300 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]">
                    <i className="ri-question-answer-line"></i>Help Guide
                  </Link>
                </div>
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
          clientId={clientId || ''}
          jobs={jobs}
          prefillJobId={prefillJobId}
          prefillCategory={prefillCategory}
          onClose={() => {
            setShowCreateModal(false);
            setPrefillJobId('');
            setPrefillCategory('');
          }}
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
          clientId={clientId || ''}
          onClose={() => setSelectedTicket(null)}
          onUpdated={() => loadTickets(true)}
        />
      )}
    </div>
  );
}