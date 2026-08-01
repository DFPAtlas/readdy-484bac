'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useClientAuth } from '@/lib/ClientAuthContext';
import { useClientGuard } from '@/hooks/useClientGuard';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import UpgradePrompt from '@/components/UpgradePrompt';
import PortalSidebar from '@/components/PortalSidebar';
import MobileClientNav from '@/components/MobileClientNav';
import SiteCard from './SiteCard';
import SearchFilterBar from '../components/SearchFilterBar';
import SiteFormModal from './SiteFormModal';
import SiteDetailDrawer from './SiteDetailDrawer';

interface SavedSite {
  id: string;
  site_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postcode: string;
  site_contact_name?: string;
  site_contact_phone?: string;
  site_contact_email?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  access_instructions?: string;
  parking_details?: string;
  risk_notes?: string;
  key_entry_instructions?: string;
  patrol_expectations?: string;
  uniform_requirements?: string;
  cctv_details?: string;
  status?: string;
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
  job_count?: number;
  last_job_date?: string;
}

interface SiteStats {
  total: number;
  active: number;
  needsInfo: number;
  incomplete: number;
}

const PAGE_SIZE = 12;

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function SavedSitesPage() {
  const router = useRouter();
  const { loading: authLoading, allowed } = useClientGuard();
  const { checking, blocked } = useRouteGuard();
  const authCtx = useClientAuth();

  const [clientId, setClientId] = useState<string | null>(authCtx.clientId);
  const [companyName, setCompanyName] = useState(authCtx.companyName);
  const [subscriptionTier, setSubscriptionTier] = useState(authCtx.subscriptionTier);

  const [sites, setSites] = useState<SavedSite[]>([]);
  const [stats, setStats] = useState<SiteStats>({ total: 0, active: 0, needsInfo: 0, incomplete: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'needs_info'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showForm, setShowForm] = useState(false);
  const [editingSite, setEditingSite] = useState<SavedSite | null>(null);
  const [viewingSite, setViewingSite] = useState<SavedSite | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Bootstrap client identity if context hasn't hydrated yet
  useEffect(() => {
    if (authCtx.clientId) {
      setClientId(authCtx.clientId);
      setCompanyName(authCtx.companyName);
      setSubscriptionTier(authCtx.subscriptionTier);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) { if (!cancelled) router.push('/client/login'); return; }
        const { data: client, error: clientErr } = await supabase
          .from('clients')
          .select('id, company_name, subscription_tier')
          .eq('user_id', user.id)
          .maybeSingle();
        if (clientErr) throw clientErr;
        if (!client) { if (!cancelled) router.push('/client/login'); return; }
        if (!cancelled) {
          const cName = client.company_name || 'Client';
          const cTier = client.subscription_tier || 'Free';
          setClientId(client.id);
          setCompanyName(cName);
          setSubscriptionTier(cTier);
          authCtx.setAuth({ user, clientId: client.id, companyName: cName, subscriptionTier: cTier });
        }
      } catch (err: any) {
        console.error('[sites] bootstrap error:', err);
        const msg = err?.message || '';
        if (!cancelled) {
          if (msg.includes('network') || msg.includes('timeout')) {
            setErrorMessage('Connection issue. Please check your internet and try again.');
          } else {
            setErrorMessage('Failed to load sites. Please try again.');
          }
          setLoadError(true);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [authCtx.clientId, authCtx.companyName, authCtx.subscriptionTier, authCtx.setAuth, router]);

  const loadStats = useCallback(async () => {
    if (!clientId) return;
    try {
      const { data, error } = await supabase.rpc('count_site_stats', { p_client_id: clientId });
      if (error) throw error;
      const result = (data as { total?: number; active?: number; needsInfo?: number; incomplete?: number }) || {};
      if (mountedRef.current) {
        setStats({
          total: result.total || 0,
          active: result.active || 0,
          needsInfo: result.needsInfo || 0,
          incomplete: result.incomplete || 0,
        });
      }
    } catch (err: any) {
      console.error('[sites] stats error:', err);
    }
  }, [clientId]);

  const loadSites = useCallback(async (append = false, targetPage = 1) => {
    if (!clientId) return;
    setLoadError(false);
    setErrorMessage('');
    if (!append) setLoading(true);

    try {
      const from = (targetPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: sitesData, error: sitesErr } = await supabase
        .from('saved_sites')
        .select('*')
        .eq('client_id', clientId)
        .eq('archived', false)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (sitesErr) throw sitesErr;

      const sitesList = (sitesData || []) as SavedSite[];
      const hasMorePages = sitesList.length === PAGE_SIZE;

      if (sitesList.length > 0) {
        const siteIds = sitesList.map(s => s.id);
        const { data: jobsData, error: jobsErr } = await supabase
          .from('jobs')
          .select('saved_site_id, created_at')
          .eq('client_id', clientId)
          .in('saved_site_id', siteIds);

        if (jobsErr) {
          console.error('[sites] job counts error:', jobsErr);
        }

        const jobCounts: Record<string, number> = {};
        const lastJobDates: Record<string, string> = {};
        (jobsData || []).forEach((job: any) => {
          const sid = job.saved_site_id;
          if (!sid) return;
          jobCounts[sid] = (jobCounts[sid] || 0) + 1;
          const date = job.created_at;
          if (!lastJobDates[sid] || date > lastJobDates[sid]) {
            lastJobDates[sid] = date;
          }
        });

        sitesList.forEach(s => {
          s.job_count = jobCounts[s.id] || 0;
          s.last_job_date = lastJobDates[s.id] || undefined;
        });
      }

      if (mountedRef.current) {
        setSites(prev => append ? [...prev, ...sitesList] : sitesList);
        setPage(targetPage);
        setHasMore(hasMorePages);
      }
    } catch (err: any) {
      console.error('[sites] load error:', err);
      const msg = err?.message || '';
      if (msg.includes('timeout') || msg.includes('network')) {
        setErrorMessage('Connection timed out. Please check your internet and try again.');
      } else if (msg.includes('row-level security') || msg.includes('42501') || msg.includes('permission denied')) {
        setErrorMessage('Access denied. Your session may have expired. Please sign in again.');
      } else if (msg.includes('JSON') || msg.includes('parse')) {
        setErrorMessage('Received invalid data from the server. Please try again.');
      } else {
        setErrorMessage('Failed to load sites. Please try again.');
      }
      setLoadError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    loadSites(false, 1);
    loadStats();
  }, [clientId, loadSites, loadStats]);

  const handleLoadMore = () => {
    if (!hasMore || loading) return;
    loadSites(true, page + 1);
  };

  const handleSave = async (form: Omit<SavedSite, 'id' | 'created_at' | 'updated_at'>) => {
    if (!clientId) {
      setToast('Not signed in. Please refresh and try again.');
      return;
    }
    setSaving(true);
    try {
      if (editingSite) {
        const { data, error } = await supabase
          .from('saved_sites')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', editingSite.id)
          .select()
          .single();
        if (error) throw error;
        const updated = data as SavedSite;
        const existing = sites.find(s => s.id === updated.id);
        updated.job_count = existing?.job_count ?? 0;
        updated.last_job_date = existing?.last_job_date;
        setSites(prev => prev.map(s => s.id === updated.id ? updated : s));
        setToast('Site updated');
        loadStats();
      } else {
        const { data, error } = await supabase
          .from('saved_sites')
          .insert({ ...form, client_id: clientId })
          .select()
          .single();
        if (error) throw error;
        const created = data as SavedSite;
        created.job_count = 0;
        created.last_job_date = undefined;
        setSites(prev => [created, ...prev]);
        setToast('Site saved');
        loadStats();
      }
      setShowForm(false);
      setEditingSite(null);
    } catch (err: any) {
      console.error('[sites] save error:', err);
      const msg = err?.message || '';
      if (msg.includes('duplicate') || msg.includes('23505')) {
        setToast('A site with this name or address already exists');
      } else if (msg.includes('violates')) {
        setToast('Some fields are invalid. Please check and try again.');
      } else if (msg.includes('42501') || msg.includes('permission denied')) {
        setToast('Permission denied. Your session may have expired.');
      } else {
        setToast('Failed to save site');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_sites')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setSites(prev => prev.filter(s => s.id !== id));
      setToast('Site deleted');
      setViewingSite(null);
      setConfirmDelete(null);
      loadStats();
    } catch (err: any) {
      console.error('[sites] delete error:', err);
      setToast('Failed to delete site');
    }
  };

  const handleDuplicate = (site: SavedSite) => {
    const duplicated: SavedSite = {
      ...site,
      id: '',
      site_name: `${site.site_name} (Copy)`,
      status: 'active',
      archived: false,
      job_count: 0,
      last_job_date: undefined,
    };
    setEditingSite(duplicated);
    setShowForm(true);
    setTimeout(() => setToast('Duplicated — edit and save'), 100);
  };

  const handleArchive = async (site: SavedSite) => {
    try {
      const { error } = await supabase
        .from('saved_sites')
        .update({ archived: true, status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', site.id);
      if (error) throw error;
      setSites(prev => prev.filter(s => s.id !== site.id));
      setToast('Site archived');
      setViewingSite(null);
      loadStats();
    } catch (err: any) {
      console.error('[sites] archive error:', err);
      setToast('Failed to archive site');
    }
  };

  const handleUse = (site: SavedSite) => {
    router.push(`/client/post-job?site=${site.id}`);
  };

  const filtered = sites.filter(s => {
    const matchesSearch =
      s.site_name.toLowerCase().includes(search.toLowerCase()) ||
      s.city.toLowerCase().includes(search.toLowerCase()) ||
      s.postcode.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'name_az') return a.site_name.localeCompare(b.site_name);
    if (sortBy === 'name_za') return b.site_name.localeCompare(a.site_name);
    if (sortBy === 'most_jobs') return (b.job_count || 0) - (a.job_count || 0);
    if (sortBy === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    return 0;
  });

  const SITE_SORT_OPTIONS = [
    { value: 'name_az', label: 'Name A-Z' },
    { value: 'name_za', label: 'Name Z-A' },
    { value: 'most_jobs', label: 'Most Jobs' },
    { value: 'newest', label: 'Newest' },
  ];

  const SITE_FILTER_CONFIGS = [
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: [
        { value: 'active', label: 'Active' },
        { value: 'needs_info', label: 'Needs Info' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
  ];

  const displayName = companyName || 'Client';
  const tier = subscriptionTier || 'Free';
  const initials = getInitials(displayName);

  if (loading || authLoading || !allowed || checking) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar role="client" displayName="Client" subtitle="Free" initials="CL" />
        <div className="flex-1 min-h-screen pb-20 lg:pb-0">
          <div className="relative bg-gradient-to-br from-[#0f172a] via-[#111d35] to-[#162036] text-white py-8 sm:py-12 border-b border-[#1e2d4d]">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
              <div className="flex items-center gap-3 mb-3 sm:mb-4">
                <div className="h-6 w-6 bg-[#162036] rounded animate-pulse"></div>
                <div className="h-3 w-28 bg-[#162036] rounded animate-pulse"></div>
              </div>
              <div className="h-8 sm:h-10 w-40 sm:w-48 bg-[#162036] rounded animate-pulse mb-2"></div>
              <div className="h-3 w-56 sm:w-72 bg-[#162036] rounded animate-pulse"></div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#162036] rounded-lg flex-shrink-0 animate-pulse"></div>
                  <div className="space-y-1">
                    <div className="h-5 sm:h-6 w-6 sm:w-8 bg-[#162036] rounded animate-pulse"></div>
                    <div className="h-2 w-14 sm:w-16 bg-[#162036] rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="flex-1 h-10 bg-[#162036] rounded-xl animate-pulse"></div>
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center bg-[#111d35] border border-[#1e2d4d] rounded-xl p-1">
                  <div className="w-9 h-9 bg-[#162036] rounded-lg animate-pulse"></div>
                  <div className="w-9 h-9 bg-[#162036] rounded-lg animate-pulse ml-1"></div>
                </div>
                <div className="h-10 sm:h-11 w-28 sm:w-32 bg-teal-500/20 rounded-xl animate-pulse"></div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 sm:p-5">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#162036] rounded-lg flex-shrink-0 animate-pulse"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 sm:w-40 bg-[#162036] rounded animate-pulse"></div>
                      <div className="h-3 w-full sm:w-3/4 bg-[#162036] rounded animate-pulse"></div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <div className="h-5 w-14 bg-[#162036] rounded-full animate-pulse"></div>
                        <div className="h-5 w-16 bg-[#162036] rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-[#1e2d4d] flex items-center justify-between">
                    <div className="flex gap-2">
                      <div className="h-4 w-12 bg-[#162036] rounded animate-pulse"></div>
                      <div className="h-4 w-12 bg-[#162036] rounded animate-pulse"></div>
                    </div>
                    <div className="h-8 w-20 bg-[#162036] rounded-lg animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar
          role="client"
          displayName={displayName}
          subtitle={tier}
          initials={initials}
        />
        <div className="flex-1 min-h-screen flex items-center justify-center px-6">
          <div className="w-full max-w-lg">
            <UpgradePrompt feature="client.multi_site" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={displayName}
        subtitle={tier}
        initials={initials}
      />
      <div className="flex-1 min-h-screen pb-20 lg:pb-0">
        {toast && (
          <div className="fixed top-24 right-6 z-50 bg-[#111d35] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-[#1e2d4d] animate-fade-in">
            <i className="ri-checkbox-circle-fill text-teal-400"></i>
            <span className="text-sm font-medium">{toast}</span>
          </div>
        )}

        <div className="relative bg-gradient-to-br from-[#0f172a] via-[#111d35] to-[#162036] text-white py-12 border-b border-[#1e2d4d]">
          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Link href="/client/dashboard" className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <i className="ri-arrow-left-line text-xl"></i>
              </Link>
              <span className="text-slate-500 text-sm">Back to Dashboard</span>
            </div>
            <h1 className="text-3xl font-bold mb-2 text-white">Saved Sites</h1>
            <p className="text-slate-400">Manage your regular sites for quick job posting</p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Sites', value: stats.total, icon: 'ri-building-line', colour: 'text-teal-400' },
              { label: 'Active', value: stats.active, icon: 'ri-checkbox-circle-line', colour: 'text-emerald-400' },
              { label: 'Needs Info', value: stats.needsInfo, icon: 'ri-error-warning-line', colour: 'text-amber-400' },
              { label: 'Incomplete', value: stats.incomplete, icon: 'ri-alert-line', colour: 'text-red-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-[#162036] rounded-lg flex items-center justify-center">
                  <i className={`${stat.icon} ${stat.colour} text-lg`}></i>
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
            <div className="flex-1">
              <SearchFilterBar
                searchQuery={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search sites by name, city, or postcode..."
                filters={{ status: statusFilter }}
                onFilterChange={(key, value) => { if (key === 'status') setStatusFilter(value as any); }}
                filterConfigs={SITE_FILTER_CONFIGS}
                sortBy={sortBy}
                onSortChange={setSortBy}
                sortOptions={SITE_SORT_OPTIONS}
                resultCount={filtered.length}
                loading={loading}
                onClear={() => { setSearch(''); setStatusFilter('all'); setSortBy(''); setShowFilters(false); }}
                showMobilePanel={showFilters}
                onToggleMobilePanel={() => setShowFilters((v) => !v)}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center bg-[#111d35] border border-[#1e2d4d] rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-[#162036] text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <i className="ri-grid-fill text-sm"></i>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-[#162036] text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <i className="ri-list-unordered text-sm"></i>
                </button>
              </div>
              <button
                onClick={() => { setEditingSite(null); setShowForm(true); }}
                className="bg-teal-500 text-white px-5 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
              >
                <i className="ri-add-line"></i>
                Add Site
              </button>
            </div>
          </div>

          {loadError ? (
            <div className="bg-[#111d35] rounded-2xl border border-red-500/20 p-10 md:p-16 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <i className="ri-error-warning-line text-4xl text-red-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Failed to load sites</h3>
              <p className="text-slate-500 text-sm mb-6">{errorMessage || 'We could not load your saved sites. Please check your connection and try again.'}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={() => { loadSites(false, 1); loadStats(); }} className="inline-flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]">
                  <i className="ri-refresh-line"></i>Retry
                </button>
                <Link href="/client/support" className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-red-500/20 transition-colors cursor-pointer whitespace-nowrap border border-red-500/25">
                  <i className="ri-customer-service-2-line"></i>Contact Support
                </Link>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] p-10 md:p-16 text-center">
              <div className="w-16 h-16 bg-[#162036] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ri-building-line text-3xl text-slate-600"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">
                {search || statusFilter !== 'all' ? 'No sites match your filters' : 'No saved sites yet'}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {search || statusFilter !== 'all' ? 'Try changing your filters or search term' : 'Save your regular security sites to post jobs faster and pre-fill location details'}
              </p>
              {!search && statusFilter === 'all' && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button onClick={() => { setEditingSite(null); setShowForm(true); }} className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-add-line"></i>Add Your First Site
                  </button>
                  <Link href="/client/post-job" className="inline-flex items-center gap-2 bg-[#162036] text-slate-300 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]">
                    <i className="ri-briefcase-line"></i>Post a Job
                  </Link>
                </div>
              )}
              {(search || statusFilter !== 'all') && (
                <button onClick={() => { setSearch(''); setStatusFilter('all'); setSortBy(''); }} className="inline-flex items-center gap-2 bg-[#162036] text-teal-400 text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d]">
                  <i className="ri-close-circle-line"></i>Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'flex flex-col gap-3'}>
                {filtered.map(site => (
                  <SiteCard
                    key={site.id}
                    site={site}
                    onView={setViewingSite}
                    onEdit={(s) => { setEditingSite(s); setShowForm(true); }}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onArchive={handleArchive}
                    onUse={handleUse}
                    confirmDelete={confirmDelete}
                    setConfirmDelete={setConfirmDelete}
                    viewMode={viewMode}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="mt-6 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="inline-flex items-center gap-2 bg-[#162036] text-teal-400 px-6 py-3 rounded-xl font-semibold hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap border border-[#1e2d4d] disabled:opacity-50"
                  >
                    {loading ? (
                      <><div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>Loading...</>
                    ) : (
                      <><i className="ri-arrow-down-line"></i>Load More</>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <MobileClientNav />

      {showForm && (
        <SiteFormModal
          site={editingSite}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingSite(null); }}
          saving={saving}
        />
      )}

      <SiteDetailDrawer
        site={viewingSite}
        onClose={() => setViewingSite(null)}
        onEdit={(s) => { setViewingSite(null); setEditingSite(s); setShowForm(true); }}
        onUse={handleUse}
        onDuplicate={handleDuplicate}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />
    </div>
  );
}