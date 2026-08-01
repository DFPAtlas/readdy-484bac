'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface JobRow {
  id: string;
  job_title: string;
  venue_city: string;
  venue_postcode: string | null;
  venue_name: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  hourly_rate: number;
  number_of_guards: number;
  status: string;
  urgency: string | null;
  sia_licence_required: boolean;
  risk_level: string | null;
  is_deleted: boolean;
  created_at: string;
  clients: {
    company_name: string | null;
    contact_name: string | null;
    email: string | null;
  } | null;
  applications_count: number;
  assigned_count: number;
  pending_applications_count: number;
}

export interface JobsStats {
  total: number;
  open: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  pending_apps: number;
  flagged: number;
}

export interface JobsFilters {
  search: string;
  filterStatus: string;
  filterUrgency: string;
  filterCity: string;
  filterSia: boolean;
  filterFlagged: boolean;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
}

const defaultFilters: JobsFilters = {
  search: '',
  filterStatus: 'all',
  filterUrgency: 'all',
  filterCity: 'all',
  filterSia: false,
  filterFlagged: false,
  dateFrom: '',
  dateTo: '',
  sortBy: 'created_desc',
};

async function invokeEdgeFunction(action: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-job-mutate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function useAdminJobs() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<JobsStats>({ total: 0, open: 0, in_progress: 0, completed: 0, cancelled: 0, pending_apps: 0, flagged: 0 });
  const [filters, setFilters] = useState<JobsFilters>(defaultFilters);

  const fetchJobs = useCallback(async (p: number = page) => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) { setLoading(false); setError('Not authenticated'); return; }

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          page: p,
          pageSize,
          ...filters,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load jobs');

      setJobs(json.data || []);
      setTotalCount(json.totalCount || 0);
      setStats(json.stats || { total: 0, open: 0, in_progress: 0, completed: 0, cancelled: 0, pending_apps: 0, flagged: 0 });
    } catch (err: any) {
      setError(err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [filters, pageSize]);

  const refresh = useCallback(() => {
    fetchJobs(page);
  }, [fetchJobs, page]);

  const goToPage = useCallback((p: number) => {
    setPage(p);
    fetchJobs(p);
  }, [fetchJobs]);

  const setFilter = useCallback((key: string, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setPage(1);
  }, []);

  useEffect(() => {
    setPage(1);
    fetchJobs(1);
  }, [filters]);

  const deleteJob = async (jobId: string) => {
    await invokeEdgeFunction('delete', { jobId });
    await fetchJobs(page);
  };

  const changeStatus = async (jobId: string, newStatus: string, note?: string) => {
    await invokeEdgeFunction('status_change', { jobId, newStatus, note });
    await fetchJobs(page);
  };

  const flagJob = async (jobId: string, reason: string) => {
    await invokeEdgeFunction('flag', { jobId, reason });
    await fetchJobs(page);
  };

  const unflagJob = async (jobId: string) => {
    await invokeEdgeFunction('unflag', { jobId });
    await fetchJobs(page);
  };

  const bulkAction = async (ids: string[], action: string) => {
    await invokeEdgeFunction('bulk', { ids, bulkAction: action });
    await fetchJobs(page);
  };

  const updatePaymentStatus = async (jobId: string, newPaymentStatus: string, reason?: string) => {
    await invokeEdgeFunction('update_payment_status', { jobId, newPaymentStatus, reason });
  };

  return {
    jobs,
    loading,
    error,
    page,
    pageSize,
    totalCount,
    stats,
    filters,
    setFilter,
    clearFilters,
    goToPage,
    refresh,
    deleteJob,
    changeStatus,
    flagJob,
    unflagJob,
    bulkAction,
    updatePaymentStatus,
  };
}