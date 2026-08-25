"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import GuardProfilesStats from './GuardProfilesStats';
import GuardProfileCard from './GuardProfileCard';
import GuardProfileDetailModal from './GuardProfileDetailModal';
import Pagination from '@/components/Pagination';

interface Guard {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  postcode: string | null;
  bio: string | null;
  sia_licence_number: string | null;
  sia_expiry_date: string | null;
  sia_verified: boolean | null;
  sia_verified_at: string | null;
  verification_status: string | null;
  verified_at: string | null;
  rating: number | null;
  total_reviews: number | null;
  total_jobs_completed: number | null;
  total_earnings: number | null;
  years_experience: number | null;
  hourly_rate: number | null;
  licence_types: string[] | null;
  certifications: string[] | null;
  profile_completed: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
  profile_image_url: string | null;
  availability_status: string | null;
  willing_to_travel: boolean | null;
  has_transport: boolean | null;
  max_distance_miles: number | null;
  bank_account_verified: boolean | null;
  rejection_reason: string | null;
  notes?: string | null;
}

interface Stats {
  total: number;
  siaVerified: number;
  approved: number;
  pending: number;
  totalEarnings: number;
  avgRating: number;
  scope?: string;
}

type ViewMode = 'grid' | 'list';
type SortKey = 'joined' | 'name' | 'rating' | 'jobs' | 'earnings';
type FilterStatus = 'all' | 'approved' | 'pending' | 'rejected' | 'sia_verified' | 'inactive';

const filterLabels: Record<FilterStatus, string> = {
  all: 'All Guards',
  approved: 'Approved',
  pending: 'Pending Review',
  rejected: 'Rejected',
  sia_verified: 'SIA Verified',
  inactive: 'Inactive',
};

const sortLabels: Record<SortKey, string> = {
  joined: 'Date Joined',
  name: 'Name (A–Z)',
  rating: 'Highest Rated',
  jobs: 'Most Jobs',
  earnings: 'Most Earned',
};

export default function GuardProfilesPage() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortKey>('joined');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedGuard, setSelectedGuard] = useState<Guard | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<Stats>({ total: 0, siaVerified: 0, approved: 0, pending: 0, totalEarnings: 0, avgRating: 0 });
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 300);
  };

  const clearSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearch('');
    setDebouncedSearch('');
  };

  const getToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData?.session?.access_token || null;
  };

  const fetchGuards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError('Not authenticated. Please log in again.');
        setLoading(false);
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-guards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'list',
            page: currentPage,
            pageSize: itemsPerPage,
            search: debouncedSearch,
            filter,
            sortBy,
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || `Request failed (${res.status})`);
        setLoading(false);
        return;
      }

      const result = await res.json();
      setGuards(result.data || []);
      setTotalCount(result.totalCount || 0);
      if (result.stats) setStats(result.stats);
    } catch (err: any) {
      setError(err?.message || 'Failed to load guard profiles');
    }
    setLoading(false);
  }, [currentPage, itemsPerPage, debouncedSearch, filter, sortBy]);

  useEffect(() => {
    fetchGuards();
  }, [fetchGuards]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filter, sortBy]);

  const fetchStats = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-guards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'stats' }),
        }
      );

      if (res.ok) {
        const result = await res.json();
        if (result.stats) setStats(result.stats);
      }
    } catch {}
  }, []);

  const handleUpdate = async (guardId: string, updates: Record<string, any>) => {
    try {
      const token = await getToken();
      if (!token) return { success: false, error: 'Not authenticated' };

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-guards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'update', id: guardId, updates }),
        }
      );

      const result = await res.json();
      return result;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error — check your connection and try again' };
    }
  };

  const handleAfterMutation = useCallback((guardId: string, updates: Record<string, any>) => {
    setGuards((prev) => prev.map((g) => (g.id === guardId ? { ...g, ...updates } : g)));
    setSelectedGuard((prev) => (prev && prev.id === guardId ? { ...prev, ...updates } : prev));
    fetchStats();
  }, [fetchStats]);

  const initializedGuards = guards.map((g) => ({
    ...g,
    full_name: g.full_name || '',
    email: g.email || '',
  }));

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <i key={i} className={`text-xs ${i < Math.round(rating) ? 'ri-star-fill text-yellow-400' : 'ri-star-line text-gray-300'}`}></i>
    ));

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <div className="bg-[#111d35] border-b border-[#1a2b4a] px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Guard Profiles</h1>
            <p className="text-slate-400 text-sm mt-0.5">Browse and manage all registered security guard accounts</p>
          </div>
          <button
            onClick={() => fetchGuards()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a2b4a] text-slate-400 rounded-lg hover:bg-[#1e2d4d] hover:text-white transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line"></i>
            Refresh
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        <GuardProfilesStats stats={stats} />

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center bg-red-500/20 rounded-lg">
                <i className="ri-error-warning-line text-red-400 text-lg"></i>
              </div>
              <div>
                <p className="text-red-400 font-medium text-sm">Failed to load guard profiles</p>
                <p className="text-red-400/70 text-xs mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={() => fetchGuards()}
              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 cursor-pointer whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
            <input
              type="text"
              placeholder="Search by name, email, location, SIA number..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-[#1a2b4a] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#111d35] text-white placeholder-slate-500"
            />
            {search && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium cursor-pointer whitespace-nowrap transition-colors ${
                  filter !== 'all'
                    ? 'border-teal-500/30 bg-teal-500/10 text-teal-400'
                    : 'border-[#1a2b4a] text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                }`}
              >
                <i className="ri-filter-3-line"></i>
                {filterLabels[filter]}
                {filter !== 'all' && <span className="w-2 h-2 bg-teal-500 rounded-full"></span>}
              </button>
              {showFilterMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#111d35] rounded-xl shadow-lg border border-[#1a2b4a] py-2 z-10">
                  {(Object.keys(filterLabels) as FilterStatus[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => { setFilter(key); setShowFilterMenu(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#1a2b4a] cursor-pointer flex items-center justify-between ${
                        filter === key ? 'text-teal-400 font-medium' : 'text-slate-400'
                      }`}
                    >
                      {filterLabels[key]}
                      {filter === key && <i className="ri-check-line text-teal-400"></i>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white cursor-pointer whitespace-nowrap"
              >
                <i className="ri-sort-desc"></i>
                {sortLabels[sortBy]}
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#111d35] rounded-xl shadow-lg border border-[#1a2b4a] py-2 z-10">
                  {(Object.keys(sortLabels) as SortKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => { setSortBy(key); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#1a2b4a] cursor-pointer flex items-center justify-between ${
                        sortBy === key ? 'text-teal-400 font-medium' : 'text-slate-400'
                      }`}
                    >
                      {sortLabels[key]}
                      {sortBy === key && <i className="ri-check-line text-teal-400"></i>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 bg-[#1a2b4a] p-1 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-[#111d35] shadow-sm text-teal-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                <i className="ri-grid-line text-base"></i>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-[#111d35] shadow-sm text-teal-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                <i className="ri-list-check text-base"></i>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-400">
            Showing <span className="font-semibold text-white">{totalCount}</span> guard{totalCount !== 1 ? 's' : ''}
            {filter !== 'all' && <span className="text-teal-400"> · {filterLabels[filter]}</span>}
          </p>
          {(debouncedSearch || filter !== 'all') && (
            <button
              onClick={() => { clearSearch(); setFilter('all'); }}
              className="text-sm text-teal-400 hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-14 h-14 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Loading guard profiles...</p>
            </div>
          </div>
        ) : guards.length === 0 && !error ? (
          <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] py-20 text-center">
            <div className="w-16 h-16 flex items-center justify-center bg-[#1a2b4a] rounded-full mx-auto mb-4">
              <i className="ri-shield-user-line text-3xl text-slate-500"></i>
            </div>
            <p className="text-slate-400 font-medium">No guards found</p>
            <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filter</p>
            <button
              onClick={() => { clearSearch(); setFilter('all'); }}
              className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-500 cursor-pointer whitespace-nowrap"
            >
              Clear Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <>
            <div className="grid grid-cols-4 gap-5 mb-6">
              {initializedGuards.map((guard) => (
                <GuardProfileCard key={guard.id} guard={guard} onClick={(g) => setSelectedGuard(g)} />
              ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalItems={totalCount}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
            />
          </>
        ) : (
          <>
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden mb-6">
              <table className="w-full">
                <thead className="bg-[#0a1628] border-b border-[#1a2b4a]">
                  <tr>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Guard</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Location</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">SIA Status</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Rating</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Jobs / Earnings</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2b4a]">
                  {initializedGuards.map((guard) => {
                    const initials = guard.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                    const siaExpired = guard.sia_expiry_date ? new Date(guard.sia_expiry_date) < new Date() : false;
                    return (
                      <tr
                        key={guard.id}
                        onClick={() => setSelectedGuard(guard)}
                        className="hover:bg-[#0a1628] cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full text-white font-semibold text-sm flex-shrink-0">
                              {initials}
                            </div>
                            <div>
                              <p className="font-medium text-white text-sm">{guard.full_name}</p>
                              <p className="text-xs text-slate-400">{guard.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-300">{guard.location || '—'}</p>
                          <p className="text-xs text-slate-500">{guard.postcode || ''}</p>
                        </td>
                        <td className="px-6 py-4">
                          {guard.sia_verified ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
                                <i className="ri-id-card-line text-xs"></i> SIA Verified
                              </span>
                              {siaExpired && (
                                <p className="text-xs text-red-400 mt-0.5">Licence expired</p>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400">Not verified</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {guard.rating && guard.rating > 0 ? (
                            <div>
                              <div className="flex items-center gap-0.5">{renderStars(guard.rating)}</div>
                              <p className="text-xs text-slate-400 mt-0.5">{Number(guard.rating).toFixed(1)} ({guard.total_reviews || 0})</p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">No reviews</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <p className="text-sm font-semibold text-teal-400">{guard.total_jobs_completed || 0}</p>
                              <p className="text-xs text-slate-500">Jobs</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold text-purple-400">£{(guard.total_earnings || 0).toLocaleString()}</p>
                              <p className="text-xs text-slate-500">Earned</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            guard.verification_status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                            guard.verification_status === 'pending' || guard.verification_status === 'manual_review' || guard.verification_status === 'pending_sia_check' ? 'bg-amber-500/10 text-amber-400' :
                            guard.verification_status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                            'bg-slate-500/10 text-slate-400'
                          }`}>
                            {guard.verification_status || 'Unverified'}
                          </span>
                          {!guard.is_active && (
                            <p className="text-xs text-red-400 mt-0.5">Inactive</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {guard.created_at
                            ? new Date(guard.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalItems={totalCount}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
            />
          </>
        )}
      </div>

      {selectedGuard && (
        <GuardProfileDetailModal
          guard={selectedGuard}
          onClose={() => setSelectedGuard(null)}
          onUpdate={handleUpdate}
          onAfterMutation={handleAfterMutation}
        />
      )}
    </div>
  );
}