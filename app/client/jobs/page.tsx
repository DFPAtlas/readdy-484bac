'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ClientJob } from '@/lib/client-types';
import Link from 'next/link';
import PortalSidebar from '@/components/PortalSidebar';
import LiveIndicator from '@/components/LiveIndicator';
import { useClientGuard } from '@/hooks/useClientGuard';
import JobCard from './JobCard';
import JobDetailDrawer from './JobDetailDrawer';
import CancelJobModal from './CancelJobModal';
import EditJobModal from './EditJobModal';
import QuickDuplicateModal from './QuickDuplicateModal';
import NeedsAttentionBadge, { getAttentionItems } from './NeedsAttentionBadge';
import SearchFilterBar from '../components/SearchFilterBar';
import BulkActionBar from '../components/BulkActionBar';
import { useRouter } from 'next/navigation';

interface Draft {
  id: string;
  draft_name: string;
  last_saved_at: string;
}

const JOBS_PER_PAGE = 50;
const REALTIME_DEBOUNCE_MS = 1500;

const TABS = [
  { key: 'all', label: 'All Jobs', icon: 'ri-list-check-2' },
  { key: 'drafts', label: 'Drafts', icon: 'ri-draft-line' },
  { key: 'featured', label: 'Featured', icon: 'ri-vip-crown-line' },
  { key: 'scheduled', label: 'Scheduled', icon: 'ri-calendar-schedule-line' },
  { key: 'posted', label: 'Posted', icon: 'ri-send-plane-line' },
  { key: 'applications_open', label: 'Applications Open', icon: 'ri-user-received-line' },
  { key: 'awaiting_payment', label: 'Awaiting Payment', icon: 'ri-secure-payment-line' },
  { key: 'active', label: 'Active', icon: 'ri-pulse-line' },
  { key: 'completed', label: 'Completed', icon: 'ri-checkbox-circle-line' },
  { key: 'cancelled', label: 'Cancelled', icon: 'ri-close-circle-line' },
];

const STATUS_FILTERS: Record<string, string[]> = {
  all: [],
  drafts: [],
  featured: [],
  scheduled: [],
  posted: ['open', 'pending'],
  applications_open: ['awaiting_guard_selection'],
  awaiting_payment: ['awaiting_payment'],
  active: ['in_progress'],
  completed: ['completed'],
  cancelled: ['cancelled'],
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Posted',
  pending: 'Pending',
  awaiting_guard_selection: 'Applications Open',
  awaiting_payment: 'Awaiting Payment',
  in_progress: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: 'Pending',
  completed: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  disputed: 'Disputed',
  none: 'No Payment',
};

const JOB_SORT_OPTIONS = [
  { value: 'start_date_asc', label: 'Start Date Soonest' },
  { value: 'newest', label: 'Newest Posted' },
  { value: 'most_applicants', label: 'Most Applicants' },
  { value: 'payment_required', label: 'Payment Required First' },
  { value: 'highest_rate', label: 'Highest Rate' },
  { value: 'lowest_rate', label: 'Lowest Rate' },
];

const JOB_FILTER_CONFIGS = [
  {
    key: 'status',
    label: 'Status',
    type: 'select' as const,
    options: [
      { value: 'open', label: 'Posted' },
      { value: 'pending', label: 'Pending' },
      { value: 'awaiting_guard_selection', label: 'Applications Open' },
      { value: 'awaiting_payment', label: 'Awaiting Payment' },
      { value: 'in_progress', label: 'Active' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'disputed', label: 'Disputed' },
    ],
  },
  {
    key: 'payment',
    label: 'Payment',
    type: 'select' as const,
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'completed', label: 'Paid' },
      { value: 'failed', label: 'Failed' },
      { value: 'refunded', label: 'Refunded' },
      { value: 'none', label: 'No Payment' },
    ],
  },
  {
    key: 'date',
    label: 'Date Range',
    type: 'dateRange' as const,
  },
  {
    key: 'location',
    label: 'Location',
    type: 'select' as const,
    options: [
      { value: 'has_location', label: 'Has Location' },
      { value: 'missing_location', label: 'Missing Location' },
    ],
  },
];

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function escapeCsv(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvRows(jobs: ClientJob[], paymentMap: Record<string, string>): string {
  const headers = [
    'Job ID', 'Job Title', 'Status', 'Payment Status',
    'Venue', 'City', 'Postcode', 'Start Date', 'End Date',
    'Start Time', 'End Time', 'Guards Required', 'Guards Selected',
    'Applicants', 'Hourly Rate', 'Site Instructions', 'Created At',
  ];
  const lines = [headers.join(',')];
  for (const job of jobs) {
    const row = [
      job.id, job.job_title,
      STATUS_LABELS[job.status] || job.status,
      PAYMENT_LABELS[paymentMap[job.id]] || paymentMap[job.id] || 'No Payment',
      job.venue_name, job.venue_city, job.venue_postcode,
      job.start_date, job.end_date || job.start_date,
      job.start_time, job.end_time,
      job.number_of_guards, job.assigned_count || 0,
      job.applications_count || 0, job.hourly_rate,
      job.site_instructions, job.created_at,
    ].map(escapeCsv);
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

export default function JobManagement() {
  const router = useRouter();
  const { loading: authLoading, allowed, userId, clientData } = useClientGuard();
  const clientId = clientData?.id || null;
  const companyName = clientData?.company_name || 'Client';
  const subscriptionTier = clientData?.subscription_tier || 'Basic';
  const initials = getInitials(clientData?.company_name || 'Client');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [paymentMap, setPaymentMap] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [needsActionFilter, setNeedsActionFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedJob, setSelectedJob] = useState<ClientJob | null>(null);
  const [cancelJob, setCancelJob] = useState<ClientJob | null>(null);
  const [editJob, setEditJob] = useState<ClientJob | null>(null);
  const [duplicateJob, setDuplicateJob] = useState<ClientJob | null>(null);
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'warning'>();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkAction, setBulkAction] = useState<string>('');

  const cancelledRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  const showToast = useCallback((msg: string, type: 'success' | 'warning' = 'success') => {
    setToast(msg);
    setToastType(type);
  }, []);

  const buildJobQuery = useCallback(() => {
    let query = supabase
      .from('jobs')
      .select('*, job_assignments(id, guards(id, full_name))', { count: 'exact' })
      .eq('client_id', clientId)
      .eq('is_deleted', false);

    if (activeTab !== 'all' && activeTab !== 'drafts' && activeTab !== 'scheduled' && activeTab !== 'featured') {
      const statuses = STATUS_FILTERS[activeTab];
      if (statuses && statuses.length > 0) {
        query = query.in('status', statuses);
      }
    }

    if (activeTab === 'featured') {
      query = query.eq('is_featured', true);
    }

    if (activeTab === 'scheduled') {
      query = query.eq('is_draft', true).gt('publish_at', new Date().toISOString());
    }

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (dateFrom) {
      query = query.gte('start_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('start_date', dateTo);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      query = query.or(
        `job_title.ilike.%${q}%,venue_name.ilike.%${q}%,venue_city.ilike.%${q}%,venue_postcode.ilike.%${q}%,booking_reference.ilike.%${q}%`
      );
    }

    if (sortBy === 'start_date_asc') {
      query = query.order('start_date', { ascending: true });
    } else if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'highest_rate') {
      query = query.order('hourly_rate', { ascending: false });
    } else if (sortBy === 'lowest_rate') {
      query = query.order('hourly_rate', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.limit(JOBS_PER_PAGE);

    return query;
  }, [clientId, activeTab, statusFilter, dateFrom, dateTo, searchQuery, sortBy]);

  const loadJobs = useCallback(async (silent = false) => {
    if (!clientId) return;
    if (!silent) { setLoading(true); setLoadError(false); }
    else setRefreshing(true);

    try {
      const query = buildJobQuery();
      const { data: jobsData, count } = await query;

      setHasMore((count || 0) > JOBS_PER_PAGE);

      const jobIds = (jobsData || []).map((j: any) => j.id);
      let pmap: Record<string, string> = {};
      let cMap: Record<string, any> = {};
      let rMap: Record<string, string> = {};

      if (jobIds.length > 0) {
        const [txRes, cancelRes, refundRes] = await Promise.all([
          supabase.from('transactions').select('job_id, status').in('job_id', jobIds).order('created_at', { ascending: false }),
          supabase.schema('app').from('job_cancellations').select('job_id, status, reason').in('job_id', jobIds),
          supabase.schema('app').from('refund_requests').select('job_id, status').in('job_id', jobIds),
        ]);
        (txRes.data || []).forEach((t: any) => { if (!pmap[t.job_id]) pmap[t.job_id] = t.status; });
        (cancelRes.data || []).forEach((c: any) => { cMap[c.job_id] = c; });
        (refundRes.data || []).forEach((r: any) => { if (!rMap[r.job_id]) rMap[r.job_id] = r.status; });
        setPaymentMap(pmap);
      }

      const formattedJobs = (jobsData || []).map((job: any) => ({
        ...job,
        assigned_count: job.job_assignments?.length || 0,
        cancellation_status: cMap[job.id]?.status,
        cancellation_reason: cMap[job.id]?.reason,
        refund_status: rMap[job.id],
      }));

      setJobs(formattedJobs);

      if (activeTab === 'drafts') {
        try {
          const { data: draftsData } = await supabase
            .schema('app')
            .from('job_drafts')
            .select('id, draft_name, last_saved_at')
            .eq('client_id', clientId)
            .order('last_saved_at', { ascending: false });
          setDrafts(draftsData || []);
        } catch {
          setDrafts([]);
        }
      }

      setLastUpdated(new Date());
    } catch {
      if (!silent) setLoadError(true);
      else showToast('Background refresh failed — pull to retry', 'warning');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId, buildJobQuery, activeTab, showToast]);

  const loadMore = useCallback(async () => {
    if (!clientId || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = searchQuery.trim();
      let query = supabase
        .from('jobs')
        .select('*, job_assignments(id, guards(id, full_name))')
        .eq('client_id', clientId)
        .eq('is_deleted', false);

      if (activeTab !== 'all' && activeTab !== 'drafts' && activeTab !== 'scheduled' && activeTab !== 'featured') {
        const statuses = STATUS_FILTERS[activeTab];
        if (statuses && statuses.length > 0) query = query.in('status', statuses);
      }
      if (activeTab === 'featured') query = query.eq('is_featured', true);
      if (activeTab === 'scheduled') query = query.eq('is_draft', true).gt('publish_at', new Date().toISOString());
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (dateFrom) query = query.gte('start_date', dateFrom);
      if (dateTo) query = query.lte('start_date', dateTo);
      if (q) query = query.or(`job_title.ilike.%${q}%,venue_name.ilike.%${q}%,venue_city.ilike.%${q}%,venue_postcode.ilike.%${q}%,booking_reference.ilike.%${q}%`);
      query = query.order('created_at', { ascending: false }).range(jobs.length, jobs.length + JOBS_PER_PAGE - 1);

      const { data: moreData, count } = await query;
      const moreJobs = moreData || [];
      setHasMore(jobs.length + moreJobs.length < (count || 0));

      const allIds = [...jobs, ...moreJobs].map((j: any) => j.id);
      const newIds = moreJobs.map((j: any) => j.id);
      let pmap = { ...paymentMap };

      if (newIds.length > 0) {
        const [txRes, cancelRes, refundRes] = await Promise.all([
          supabase.from('transactions').select('job_id, status').in('job_id', allIds).order('created_at', { ascending: false }),
          supabase.schema('app').from('job_cancellations').select('job_id, status, reason').in('job_id', allIds),
          supabase.schema('app').from('refund_requests').select('job_id, status').in('job_id', allIds),
        ]);
        pmap = {};
        (txRes.data || []).forEach((t: any) => { if (!pmap[t.job_id]) pmap[t.job_id] = t.status; });
        setPaymentMap(pmap);
      }

      const cMap: Record<string, any> = {};

      const formattedMore = moreJobs.map((job: any) => ({
        ...job,
        assigned_count: job.job_assignments?.length || 0,
        cancellation_status: cMap[job.id]?.status,
        refund_status: undefined,
      }));

      setJobs(prev => [...prev, ...formattedMore]);
    } catch {
      showToast('Failed to load more jobs', 'warning');
    } finally {
      setLoadingMore(false);
    }
  }, [clientId, activeTab, statusFilter, dateFrom, dateTo, searchQuery, jobs, paymentMap, loadingMore, showToast]);

  const loadJobsRef = useRef(loadJobs);
  loadJobsRef.current = loadJobs;

  const doSilentRefresh = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (!cancelledRef.current) loadJobsRef.current(true);
    }, REALTIME_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!clientId) return;
    cancelledRef.current = false;
    initialLoadDone.current = false;

    loadJobsRef.current();
    initialLoadDone.current = true;

    const channels: any[] = [];

    const jobsChannel = supabase
      .channel(`client-jobs-list-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'app', table: 'jobs' }, doSilentRefresh)
      .subscribe();
    channels.push(jobsChannel);

    const appsChannel = supabase
      .channel(`client-jobs-apps-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'app', table: 'job_applications' }, doSilentRefresh)
      .subscribe();
    channels.push(appsChannel);

    const assignmentsChannel = supabase
      .channel(`client-jobs-assignments-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'app', table: 'job_assignments' }, doSilentRefresh)
      .subscribe();
    channels.push(assignmentsChannel);

    return () => {
      cancelledRef.current = true;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [clientId, doSilentRefresh]);

  useEffect(() => {
    if (!clientId || !initialLoadDone.current) return;
    loadJobs();
  }, [activeTab, statusFilter, paymentFilter, dateFrom, dateTo, searchQuery, sortBy, locationFilter, needsActionFilter]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleMarkComplete = async (job: ClientJob) => {
    setMarkingComplete(job.id);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('client_id', clientId);

      if (error) throw error;

      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'completed' } : j));
      showToast('Job marked as complete');
    } catch {
      showToast('Failed to mark job as complete', 'warning');
    } finally {
      setMarkingComplete(null);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (activeTab === 'drafts') return false;
    if (activeTab === 'scheduled') return job.is_draft && job.publish_at && new Date(job.publish_at) > new Date();

    if (paymentFilter !== 'all') {
      const ps = paymentMap[job.id] || 'none';
      if (ps !== paymentFilter) return false;
    }

    if (needsActionFilter && getAttentionItems(job).length === 0) return false;

    if (locationFilter !== 'all') {
      if (locationFilter === 'has_location') {
        if (!job.venue_city && !job.venue_postcode) return false;
      } else if (locationFilter === 'missing_location') {
        if (job.venue_city || job.venue_postcode) return false;
      }
    }

    if (sortBy === 'most_applicants' || sortBy === 'payment_required') return true;

    return true;
  }).sort((a, b) => {
    if (sortBy === 'most_applicants') {
      return (b.applications_count || 0) - (a.applications_count || 0);
    }
    if (sortBy === 'payment_required') {
      const aNeeds = a.status === 'awaiting_payment' ? 1 : 0;
      const bNeeds = b.status === 'awaiting_payment' ? 1 : 0;
      return bNeeds - aNeeds;
    }
    return 0;
  });

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const selectAllJobs = () => {
    if (activeTab === 'drafts') return;
    const ids = filteredJobs.map(j => j.id);
    setSelectedJobIds(new Set(ids));
  };

  const clearJobSelection = () => setSelectedJobIds(new Set());

  const handleBulkDuplicate = async () => {
    setBulkProcessing(true);
    setBulkAction('duplicate');
    const ids = Array.from(selectedJobIds);
    const newJobs: any[] = [];
    for (const jobId of ids) {
      const job = jobs.find(j => j.id === jobId);
      if (!job || job.status === 'cancelled' || job.status === 'disputed') continue;
      newJobs.push({
        client_id: clientId,
        job_title: job.job_title + ' (Copy)',
        security_type: job.security_type,
        number_of_guards: job.number_of_guards,
        hourly_rate: job.hourly_rate,
        venue_name: job.venue_name,
        venue_city: job.venue_city,
        venue_postcode: job.venue_postcode,
        latitude: job.latitude,
        longitude: job.longitude,
        start_date: job.start_date,
        end_date: job.end_date,
        start_time: job.start_time,
        end_time: job.end_time,
        job_description: job.job_description,
        special_instructions: job.special_instructions,
        experience_level: job.experience_level,
        uniform_required: job.uniform_required,
        uniform_details: job.uniform_details,
        sia_licence_required: job.sia_licence_required,
        required_licence_types: job.required_licence_types,
        urgency: job.urgency || 'standard',
        status: 'open',
        created_at: new Date().toISOString(),
      });
    }

    let count = 0;
    if (newJobs.length > 0) {
      try {
        const { error } = await supabase.from('jobs').insert(newJobs);
        if (!error) count = newJobs.length;
      } catch {}
    }

    setBulkProcessing(false);
    setBulkAction('');
    setSelectedJobIds(new Set());
    setBulkMode(false);
    loadJobs(true);
    showToast(`${count} job${count !== 1 ? 's' : ''} duplicated`);
  };

  const handleBulkArchive = async () => {
    setBulkProcessing(true);
    setBulkAction('archive');
    const ids = Array.from(selectedJobIds);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('client_id', clientId);
      if (error) throw error;
      setJobs(prev => prev.filter(j => !ids.includes(j.id)));
      showToast(`${ids.length} job${ids.length !== 1 ? 's' : ''} archived`);
    } catch {
      showToast('Failed to archive jobs', 'warning');
    } finally {
      setBulkProcessing(false);
      setBulkAction('');
      setSelectedJobIds(new Set());
      setBulkMode(false);
    }
  };

  const handleBulkExport = () => {
    const selectedJobs = jobs.filter(j => selectedJobIds.has(j.id));
    if (selectedJobs.length === 0) {
      showToast('No jobs selected', 'warning');
      return;
    }
    setBulkProcessing(true);
    setBulkAction('export');
    try {
      const csv = buildCsvRows(selectedJobs, paymentMap ?? {});
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `quickguard-jobs-${date}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`${selectedJobs.length} job${selectedJobs.length !== 1 ? 's' : ''} exported`);
    } catch {
      showToast('Export failed', 'warning');
    } finally {
      setBulkProcessing(false);
      setBulkAction('');
      setSelectedJobIds(new Set());
      setBulkMode(false);
    }
  };

  const handleBulkCancel = async () => {
    setBulkProcessing(true);
    setBulkAction('cancel');
    const ids = Array.from(selectedJobIds);
    const eligibleIds = ids.filter(jobId => {
      const job = jobs.find(j => j.id === jobId);
      return job && !['cancelled', 'completed', 'disputed'].includes(job.status);
    });
    let count = 0;
    if (eligibleIds.length > 0) {
      try {
        const { error } = await supabase
          .from('jobs')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .in('id', eligibleIds)
          .eq('client_id', clientId);
        if (!error) count = eligibleIds.length;
      } catch {}
    }
    setBulkProcessing(false);
    setBulkAction('');
    setSelectedJobIds(new Set());
    setBulkMode(false);
    loadJobs(true);
    showToast(`${count} job${count !== 1 ? 's' : ''} cancelled`);
  };

  const handleBulkAction = (actionKey: string) => {
    if (actionKey === 'duplicate') handleBulkDuplicate();
    else if (actionKey === 'archive') handleBulkArchive();
    else if (actionKey === 'export') handleBulkExport();
    else if (actionKey === 'cancel') handleBulkCancel();
  };

  const handleExport = () => {
    const jobsToExport = activeTab === 'drafts' ? [] : filteredJobs;
    if (jobsToExport.length === 0) {
      showToast('No jobs to export', 'warning');
      return;
    }
    setExporting(true);
    try {
      const csv = buildCsvRows(jobsToExport, paymentMap ?? {});
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `quickguard-jobs-${date}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`${jobsToExport.length} job${jobsToExport.length !== 1 ? 's' : ''} exported`);
    } catch {
      showToast('Export failed', 'warning');
    } finally {
      setExporting(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setNeedsActionFilter(false);
    setDateFrom('');
    setDateTo('');
    setSortBy('');
    setLocationFilter('all');
    setShowFilters(false);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'status') setStatusFilter(value);
    else if (key === 'payment') setPaymentFilter(value);
    else if (key === 'location') setLocationFilter(value);
    else if (key === 'date_from') setDateFrom(value);
    else if (key === 'date_to') setDateTo(value);
  };

  const stats = {
    total: jobs.length,
    drafts: drafts.length,
    featured: jobs.filter(j => j.is_featured).length,
    scheduled: jobs.filter(j => j.is_draft && j.publish_at && new Date(j.publish_at) > new Date()).length,
    posted: jobs.filter(j => ['open', 'pending'].includes(j.status)).length,
    applications: jobs.filter(j => j.status === 'awaiting_guard_selection').length,
    awaitingPayment: jobs.filter(j => j.status === 'awaiting_payment').length,
    active: jobs.filter(j => j.status === 'in_progress').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    cancelled: jobs.filter(j => j.status === 'cancelled').length,
    needsAction: jobs.filter(j => getAttentionItems(j).length > 0).length,
  };

  const getTabCount = (key: string) => {
    if (key === 'all') return stats.total;
    if (key === 'drafts') return stats.drafts;
    if (key === 'featured') return stats.featured;
    if (key === 'scheduled') return stats.scheduled;
    if (key === 'posted') return stats.posted;
    if (key === 'applications_open') return stats.applications;
    if (key === 'awaiting_payment') return stats.awaitingPayment;
    if (key === 'active') return stats.active;
    if (key === 'completed') return stats.completed;
    if (key === 'cancelled') return stats.cancelled;
    return 0;
  };

  if (loading || authLoading || !allowed) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">Loading your jobs...</p>
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
        collapsible={true}
      />

      <div className="flex-1 min-h-screen flex flex-col pb-20 lg:pb-0">
        <header className="bg-[#111d35] border-b border-[#1e2d4d] px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Client Portal</p>
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              My Jobs
              {stats.needsAction > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                  {stats.needsAction} needs attention
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LiveIndicator />
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className={`w-2 h-2 rounded-full ${refreshing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
              {lastUpdated && (
                <span suppressHydrationWarning>
                  Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <button
              onClick={() => loadJobs(true)}
              disabled={refreshing}
              className="hidden md:flex items-center gap-2 bg-[#162036] text-slate-400 text-sm font-semibold px-3 py-2 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 border border-[#1e2d4d]"
            >
              <i className={`ri-refresh-line ${refreshing ? 'animate-spin' : ''}`}></i>
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || activeTab === 'drafts' || filteredJobs.length === 0}
              className="hidden md:flex items-center gap-2 bg-[#162036] text-slate-400 text-sm font-semibold px-3 py-2 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 border border-[#1e2d4d]"
            >
              <i className={`ri-download-line ${exporting ? 'animate-pulse' : ''}`}></i>
              Export
            </button>
            <button
              onClick={() => setBulkMode(!bulkMode)}
              className={`hidden md:flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap border ${
                bulkMode
                  ? 'bg-teal-500 text-white border-teal-500'
                  : 'bg-[#162036] text-slate-400 border-[#1e2d4d] hover:bg-[#1a2642]'
              }`}
            >
              <i className="ri-stack-line"></i>
              {bulkMode ? 'Done' : 'Bulk Actions'}
            </button>
            <Link
              href="/client/post-job"
              className="flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line"></i>
              Post a Job
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3 mb-4 sm:mb-6">
            {[
              { label: 'Total', value: stats.total, icon: 'ri-briefcase-4-line', color: 'text-teal-400' },
              { label: 'Drafts', value: stats.drafts, icon: 'ri-draft-line', color: 'text-slate-400' },
              { label: 'Posted', value: stats.posted, icon: 'ri-send-plane-line', color: 'text-blue-400' },
              { label: 'Applications', value: stats.applications, icon: 'ri-user-received-line', color: 'text-violet-400' },
              { label: 'Payment', value: stats.awaitingPayment, icon: 'ri-secure-payment-line', color: 'text-orange-400' },
              { label: 'Active', value: stats.active, icon: 'ri-pulse-line', color: 'text-blue-400' },
              { label: 'Completed', value: stats.completed, icon: 'ri-checkbox-circle-line', color: 'text-emerald-400' },
              { label: 'Needs Action', value: stats.needsAction, icon: 'ri-error-warning-line', color: 'text-red-400' },
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

          <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 mb-6">
            <SearchFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search by job title, location, postcode, or booking reference..."
              filters={{
                status: statusFilter,
                payment: paymentFilter,
                location: locationFilter,
                date_from: dateFrom,
                date_to: dateTo,
              }}
              onFilterChange={handleFilterChange}
              filterConfigs={[
                ...JOB_FILTER_CONFIGS,
                ...(needsActionFilter ? [{
                  key: 'needs_action',
                  label: 'Needs Action',
                  type: 'select' as const,
                  options: [{ value: 'yes', label: 'Needs Action' }],
                }] : []),
              ]}
              sortBy={sortBy}
              onSortChange={setSortBy}
              sortOptions={JOB_SORT_OPTIONS}
              resultCount={activeTab === 'drafts' ? drafts.length : filteredJobs.length}
              loading={loading}
              onClear={handleClearFilters}
              showMobilePanel={showFilters}
              onToggleMobilePanel={() => setShowFilters((v) => !v)}
            />

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button
                onClick={() => setNeedsActionFilter(!needsActionFilter)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  needsActionFilter
                    ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                    : 'bg-[#162036] text-slate-400 border border-[#1e2d4d] hover:text-slate-300'
                }`}
              >
                <i className="ri-error-warning-line"></i>
                Needs Action
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || activeTab === 'drafts' || filteredJobs.length === 0}
                className="flex md:hidden items-center gap-2 px-3 py-2 bg-[#162036] text-slate-400 text-sm font-semibold rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 border border-[#1e2d4d]"
              >
                <i className={`ri-download-line ${exporting ? 'animate-pulse' : ''}`}></i>
                Export
              </button>
            </div>
          </div>

          {loadError ? (
            <div className="bg-[#111d35] rounded-2xl border border-red-500/20 shadow-sm p-10 md:p-16 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <i className="ri-error-warning-line text-4xl text-red-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Failed to load jobs</h3>
              <p className="text-slate-500 text-sm mb-6">We could not load your jobs. Please check your connection and try again.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => loadJobs()}
                  className="inline-flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]"
                >
                  <i className="ri-refresh-line"></i>
                  Retry
                </button>
                <Link href="/client/support" className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-red-500/20 transition-colors cursor-pointer whitespace-nowrap border border-red-500/25">
                  <i className="ri-customer-service-2-line"></i>
                  Contact Support
                </Link>
              </div>
            </div>
          ) : activeTab === 'drafts' ? (
            drafts.length === 0 ? (
              <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-10 md:p-16 text-center">
                <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <i className="ri-draft-line text-3xl text-slate-600"></i>
                </div>
                <h3 className="text-lg font-semibold text-slate-200 mb-2">No drafts saved</h3>
                <p className="text-slate-500 text-sm mb-6">Save a draft while posting a job to continue later</p>
                <Link href="/client/post-job" className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                  <i className="ri-add-line"></i>Post a Job
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {drafts.map((draft) => (
                  <div key={draft.id} className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#162036] rounded-lg flex items-center justify-center">
                        <i className="ri-draft-line text-lg text-slate-400"></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-200">{draft.draft_name || 'Untitled Draft'}</h3>
                        <p className="text-xs text-slate-500">
                          Last saved {new Date(draft.last_saved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <Link href="/client/post-job">
                      <button className="bg-teal-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                        <i className="ri-edit-line mr-1"></i>Continue
                      </button>
                    </Link>
                  </div>
                ))}
              </div>
            )
          ) : filteredJobs.length === 0 ? (
            <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] shadow-sm p-10 md:p-16 text-center">
              <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-briefcase-line text-3xl text-slate-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">
                {searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' || dateFrom || dateTo || locationFilter !== 'all'
                  ? 'No jobs match your filters'
                  : activeTab !== 'all' ? `No ${activeTab.replace(/_/g, ' ')} jobs` : 'No jobs yet'}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' || dateFrom || dateTo || locationFilter !== 'all'
                  ? 'Try different search terms or clear your filters'
                  : 'Post your first security guard job to get started'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {activeTab === 'all' && !searchQuery && statusFilter === 'all' && paymentFilter === 'all' && !dateFrom && !dateTo && locationFilter === 'all' && (
                  <Link href="/client/post-job" className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-add-line"></i>Post a Job
                  </Link>
                )}
                <button onClick={handleClearFilters} className="inline-flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]">
                  <i className="ri-close-circle-line"></i>Clear Filters
                </button>
                <Link href="/client/support" className="inline-flex items-center gap-2 bg-[#162036] text-slate-300 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]">
                  <i className="ri-customer-service-2-line"></i>Get Help
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <BulkActionBar
                selectedCount={selectedJobIds.size}
                totalCount={filteredJobs.length}
                allSelected={selectedJobIds.size === filteredJobs.length && filteredJobs.length > 0}
                onSelectAll={selectAllJobs}
                onClearSelection={clearJobSelection}
                actions={[
                  { key: 'duplicate', label: 'Duplicate', icon: 'ri-file-copy-line', variant: 'secondary' },
                  { key: 'export', label: 'Export', icon: 'ri-download-line', variant: 'secondary' },
                  { key: 'cancel', label: 'Cancel', icon: 'ri-close-circle-line', variant: 'danger', requiresConfirmation: true, confirmationTitle: 'Cancel Selected Jobs', confirmationMessage: 'Only jobs that are not already completed, cancelled, or disputed will be cancelled. Guards will be notified.', confirmButtonText: 'Cancel Jobs', confirmButtonIcon: 'ri-close-circle-line' },
                  { key: 'archive', label: 'Archive', icon: 'ri-archive-line', variant: 'danger', requiresConfirmation: true, confirmationTitle: 'Archive Selected Jobs', confirmationMessage: 'Archived jobs will be hidden from your active list. You can still view them in filters.', confirmButtonText: 'Archive Jobs', confirmButtonIcon: 'ri-archive-line' },
                ]}
                onAction={handleBulkAction}
                processing={bulkProcessing}
                processingAction={bulkAction}
              />
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  paymentStatus={paymentMap?.[job.id]}
                  markingCompleteId={markingComplete}
                  clientId={clientId}
                  onOpenDetail={setSelectedJob}
                  onEdit={setEditJob}
                  onDuplicate={setDuplicateJob}
                  onCancel={setCancelJob}
                  onMarkComplete={handleMarkComplete}
                  selectable={bulkMode}
                  selected={selectedJobIds.has(job.id)}
                  onToggleSelect={() => toggleJobSelection(job.id)}
                />
              ))}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-5 py-3 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d] disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        <i className="ri-arrow-down-line"></i>
                        Load More Jobs
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {toast && (
        <div className={`fixed top-24 right-6 z-50 px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 border animate-fade-in ${
          toastType === 'warning'
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
            : 'bg-[#111d35] text-white border-[#1e2d4d]'
        }`}>
          <i className={toastType === 'warning' ? 'ri-error-warning-line text-amber-400' : 'ri-checkbox-circle-fill text-teal-400'}></i>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {selectedJob && <JobDetailDrawer job={selectedJob} clientId={clientId} onClose={() => setSelectedJob(null)} />}
      {cancelJob && <CancelJobModal job={cancelJob} clientId={clientId} onClose={() => setCancelJob(null)} onSuccess={() => { loadJobs(true); showToast('Job cancelled'); }} />}
      {editJob && <EditJobModal job={editJob} onClose={() => setEditJob(null)} onSuccess={() => { loadJobs(true); showToast('Job updated'); }} />}
      {duplicateJob && <QuickDuplicateModal job={duplicateJob} clientId={clientId} onClose={() => setDuplicateJob(null)} onSuccess={() => { loadJobs(true); showToast('Job duplicated and posted'); }} />}
    </div>
  );
}