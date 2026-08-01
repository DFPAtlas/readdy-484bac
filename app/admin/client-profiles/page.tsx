'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import ClientProfilesStats from './ClientProfilesStats';
import ClientProfileCard from './ClientProfileCard';
import ClientProfileDetailModal from './ClientProfileDetailModal';
import Pagination from '@/components/Pagination';

interface Client {
  id: string;
  contact_name: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  company_type: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  verified: boolean | null;
  profile_completed: boolean | null;
  total_jobs_posted: number | null;
  active_jobs: number | null;
  total_spent: number | null;
  created_at: string | null;
  last_login: string | null;
  notes: string | null;
  is_suspended?: boolean | null;
  subscription_plan?: string | null;
  subscription_tier?: string | null;
  vat_number?: string | null;
  billing_email?: string | null;
}

interface Stats {
  total: number;
  verified: number;
  profileComplete: number;
  suspended: number;
  totalSpent: number;
}

type ViewMode = 'grid' | 'list';
type SortKey = 'name' | 'joined' | 'jobs' | 'spent';
type FilterStatus = 'all' | 'verified' | 'unverified' | 'suspended' | 'complete' | 'incomplete';

export default function ClientProfilesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, verified: 0, profileComplete: 0, suspended: 0, totalSpent: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortKey>('joined');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('admin-clients', {
        body: {
          action: 'list',
          page: currentPage,
          pageSize: itemsPerPage,
          search,
          filter,
          sortBy,
        },
      });

      if (fnError) {
        setError(fnError.message || 'Failed to load clients');
        setClients([]);
      } else if (!data?.success) {
        setError(data?.error || 'Failed to load clients');
        setClients([]);
      } else {
        setClients(data.data || []);
        setTotalCount(data.totalCount || 0);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, search, filter, sortBy]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, sortBy]);

  const handleRetry = () => {
    fetchClients();
  };

  const filterLabels: Record<FilterStatus, string> = {
    all: 'All Clients',
    verified: 'Verified',
    unverified: 'Unverified',
    suspended: 'Suspended',
    complete: 'Profile Complete',
    incomplete: 'Profile Incomplete',
  };

  const sortLabels: Record<SortKey, string> = {
    joined: 'Date Joined',
    name: 'Name (A–Z)',
    jobs: 'Most Jobs',
    spent: 'Most Spent',
  };

  if (loading && clients.length === 0) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading client profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <div className="bg-[#111d35] border-b border-[#1a2b4a] px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Client Profiles</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Browse and manage all registered client accounts
            </p>
          </div>
          <button
            onClick={fetchClients}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a2b4a] text-slate-400 rounded-lg hover:bg-[#1e2d4d] hover:text-white transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line"></i>
            Refresh
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center bg-red-500/20 rounded-lg">
                <i className="ri-error-warning-line text-lg text-red-400"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-red-300">Failed to load client profiles</p>
                <p className="text-xs text-red-400/70">{error}</p>
              </div>
            </div>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg text-sm font-medium hover:bg-red-500/30 cursor-pointer whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        )}

        <ClientProfilesStats
          total={stats.total}
          verified={stats.verified}
          profileComplete={stats.profileComplete}
          suspended={stats.suspended}
          totalSpent={stats.totalSpent}
        />

        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
            <input
              type="text"
              placeholder="Search by name, email, company, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-[#1a2b4a] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#111d35] text-white placeholder-slate-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
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
                <div className="absolute right-0 top-full mt-2 w-44 bg-[#111d35] rounded-xl shadow-lg border border-[#1a2b4a] py-2 z-10">
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

        {!loading && !error && clients.length === 0 ? (
          <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] py-20 text-center">
            <div className="w-16 h-16 flex items-center justify-center bg-[#1a2b4a] rounded-full mx-auto mb-4">
              <i className="ri-building-line text-3xl text-slate-500"></i>
            </div>
            <p className="text-slate-400 font-medium">No clients found</p>
            <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filter</p>
            <button
              onClick={() => { setSearch(''); setFilter('all'); }}
              className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-500 cursor-pointer whitespace-nowrap"
            >
              Clear Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <>
            <div className="grid grid-cols-4 gap-6 mb-6 p-2 -m-2">
              {clients.map((client) => (
                <ClientProfileCard
                  key={client.id}
                  client={client}
                  onClick={setSelectedClient}
                />
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
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Company</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Location</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Jobs</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Spent</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2b4a]">
                  {clients.map((client) => {
                    const name =
                      client.first_name && client.last_name
                        ? `${client.first_name} ${client.last_name}`
                        : client.contact_name || 'Unknown';
                    const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                    return (
                      <tr
                        key={client.id}
                        onClick={() => setSelectedClient(client)}
                        className="hover:bg-[#0a1628] cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full text-white font-semibold text-sm flex-shrink-0">
                              {initials}
                            </div>
                            <div>
                              <p className="font-medium text-white text-sm">{name}</p>
                              <p className="text-xs text-slate-400">{client.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-300">{client.company_name || '—'}</p>
                          <p className="text-xs text-slate-500">{client.industry || client.company_type || '—'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-300">{client.city || '—'}</p>
                          <p className="text-xs text-slate-500">{client.postcode || ''}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <p className="text-sm font-semibold text-white">{client.total_jobs_posted || 0}</p>
                              <p className="text-xs text-slate-500">Total</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold text-teal-400">{client.active_jobs || 0}</p>
                              <p className="text-xs text-slate-500">Active</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-purple-400">£{(client.total_spent || 0).toLocaleString()}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {client.is_suspended ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 w-fit">
                                <i className="ri-forbid-line text-xs"></i> Suspended
                              </span>
                            ) : client.verified ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 w-fit">
                                <i className="ri-checkbox-circle-fill text-xs"></i> Verified
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 w-fit">Unverified</span>
                            )}
                            {client.profile_completed ? (
                              <span className="text-xs text-emerald-400">Complete</span>
                            ) : (
                              <span className="text-xs text-amber-400">Incomplete</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {client.created_at
                            ? new Date(client.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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

      {selectedClient && (
        <ClientProfileDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdate={() => { fetchClients(); setSelectedClient(null); }}
        />
      )}
    </div>
  );
}