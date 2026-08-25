'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface UserRecord {
  id: string;
  email: string;
  accountType: string;
  role: string;
  profileCompleted: boolean;
  subscriptionStatus: string;
  verificationStatus: string;
  onboardingStatus: string;
  hasEntitlements: boolean;
  hasNotificationPrefs: boolean;
  hasSubscription: boolean;
  createdAt: string;
  dashboardStatus: string;
}

interface ProvisionResult {
  step: string;
  status: string;
  error?: string;
}

interface ProvisioningResponse {
  users: UserRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  error?: string;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const EDGE_FUNCTION = `${SUPABASE_URL}/functions/v1/get-user-provisioning`;
const REPAIR_FUNCTION = `${SUPABASE_URL}/functions/v1/admin-provision-user`;
const PAGE_SIZE = 25;

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

function StatusBadge({ status, positive = 'active', negative = 'inactive' }: { status: string | boolean; positive?: string; negative?: string }) {
  const s = typeof status === 'boolean' ? (status ? positive : negative) : status;
  const isGood = s === 'active' || s === 'completed' || s === 'approved' || s === 'provisioned' || s === positive || s === true;
  const isBad = s === 'missing' || s === 'incomplete' || s === 'rejected' || s === 'pending' || s === negative || s === false;
  const cls = isGood
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : isBad
    ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isGood ? 'bg-emerald-400' : isBad ? 'bg-red-400' : 'bg-amber-400'}`}></span>
      {typeof status === 'string' ? status : status ? positive : negative}
    </span>
  );
}

function DashboardHealth({ record }: { record: UserRecord }) {
  const allOkay = record.profileCompleted && record.hasEntitlements && record.hasNotificationPrefs && record.hasSubscription;

  if (!record.profileCompleted && !record.hasEntitlements && !record.hasNotificationPrefs && !record.hasSubscription) {
    return <StatusBadge status="missing" />;
  }
  if (allOkay) {
    return <StatusBadge status="complete" />;
  }
  return <StatusBadge status="partial" />;
}

export default function UserProvisioningClient() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repairing, setRepairing] = useState<string | null>(null);
  const [repairAllActive, setRepairAllActive] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [repairResults, setRepairResults] = useState<Record<string, ProvisionResult[]>>({});
  const [showRepairModal, setShowRepairModal] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const prevFiltersRef = useRef({ search: '', account: 'all', status: 'all' });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadUsers = useCallback(async (pageNum: number, search: string, acctFilter: string, stFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(EDGE_FUNCTION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify({
          page: pageNum,
          pageSize: PAGE_SIZE,
          search,
          accountFilter: acctFilter,
          statusFilter: stFilter,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }

      const data: ProvisioningResponse = await res.json();
      if (data.error) throw new Error(data.error);

      setUsers(data.users);
      setTotalCount(data.totalCount);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError(err.message || 'Failed to load users');
      setUsers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged =
      prev.search !== activeSearch ||
      prev.account !== accountFilter ||
      prev.status !== statusFilter;

    if (filtersChanged) {
      prevFiltersRef.current = { search: activeSearch, account: accountFilter, status: statusFilter };
      setPage(0);
      loadUsers(0, activeSearch, accountFilter, statusFilter);
    } else {
      loadUsers(page, activeSearch, accountFilter, statusFilter);
    }
  }, [page, activeSearch, accountFilter, statusFilter, loadUsers]);

  const handleSearch = () => {
    setActiveSearch(searchInput.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const clearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
  };

  const handleFilterChange = (type: 'account' | 'status', value: string) => {
    if (type === 'account') setAccountFilter(value);
    else setStatusFilter(value);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  const handleRepair = async (userId: string, accountType: string) => {
    setRepairing(userId);
    try {
      const res = await fetch(REPAIR_FUNCTION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify({ userId, accountType: accountType || 'guard' }),
      });
      const data = await res.json();
      setRepairResults(prev => ({ ...prev, [userId]: data.results || [] }));
      setShowRepairModal(userId);
      loadUsers(page, activeSearch, accountFilter, statusFilter);
    } catch (err) {
      console.error('Repair failed:', err);
      showToast('Repair request failed');
    }
    setRepairing(null);
  };

  const handleRegenerateDashboard = async (userId: string, accountType: string) => {
    setRepairing(userId);
    try {
      const res = await fetch(REPAIR_FUNCTION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify({ userId, accountType: accountType || 'guard', forceRegenerate: true }),
      });
      const data = await res.json();
      setRepairResults(prev => ({ ...prev, [userId]: data.results || [] }));
      setShowRepairModal(userId);
      loadUsers(page, activeSearch, accountFilter, statusFilter);
    } catch (err) {
      console.error('Regenerate failed:', err);
      showToast('Regenerate request failed');
    }
    setRepairing(null);
  };

  const handleResetOnboarding = async (userId: string, accountType: string) => {
    setRepairing(userId);
    try {
      const table = accountType === 'guard' ? 'guards' : accountType === 'client' ? 'clients' : null;
      if (!table) {
        showToast(`Cannot reset onboarding for ${accountType}`);
        setRepairing(null);
        return;
      }
      const { error: updateErr } = await supabase.from(table).update({ onboarding_status: 'pending', profile_completed: false }).eq('user_id', userId);
      if (updateErr) throw updateErr;
      showToast(`Onboarding reset for ${accountType}`);
      loadUsers(page, activeSearch, accountFilter, statusFilter);
    } catch (err: any) {
      console.error('Reset onboarding failed:', err);
      showToast(err.message || 'Failed to reset onboarding');
    }
    setRepairing(null);
  };

  const handleActivateSubscription = async (userId: string) => {
    setRepairing(userId);
    try {
      const { error: e1 } = await supabase.from('user_entitlements_data').upsert({ user_id: userId, subscription_status: 'active', is_active: true }, { onConflict: 'user_id' });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('subscriptions').upsert({ user_id: userId, status: 'active' }, { onConflict: 'user_id' });
      if (e2) throw e2;
      showToast('Subscription activated');
      loadUsers(page, activeSearch, accountFilter, statusFilter);
    } catch (err: any) {
      console.error('Activate subscription failed:', err);
      showToast(err.message || 'Failed to activate subscription');
    }
    setRepairing(null);
  };

  const handleSuspendUser = async (userId: string) => {
    setRepairing(userId);
    try {
      const { error: updateErr } = await supabase.from('user_entitlements_data').update({ is_active: false, subscription_status: 'suspended' }).eq('user_id', userId);
      if (updateErr) throw updateErr;
      showToast('User suspended');
      loadUsers(page, activeSearch, accountFilter, statusFilter);
    } catch (err: any) {
      console.error('Suspend user failed:', err);
      showToast(err.message || 'Failed to suspend user');
    }
    setRepairing(null);
  };

  const handleReactivateUser = async (userId: string) => {
    setRepairing(userId);
    try {
      const { error: updateErr } = await supabase.from('user_entitlements_data').update({ is_active: true, subscription_status: 'active' }).eq('user_id', userId);
      if (updateErr) throw updateErr;
      showToast('User reactivated');
      loadUsers(page, activeSearch, accountFilter, statusFilter);
    } catch (err: any) {
      console.error('Reactivate user failed:', err);
      showToast(err.message || 'Failed to reactivate user');
    }
    setRepairing(null);
  };

  const handleForceRebuild = async (userId: string, accountType: string) => {
    setRepairing(userId);
    try {
      const table = accountType === 'guard' ? 'guards' : accountType === 'client' ? 'clients' : null;
      if (!table) {
        showToast(`Cannot rebuild profile for ${accountType}`);
        setRepairing(null);
        return;
      }
      const { data: profile, error: profileErr } = await supabase.from(table).select('id').eq('user_id', userId).maybeSingle();
      if (profileErr) throw profileErr;
      if (!profile) { showToast('Profile not found'); setRepairing(null); return; }

      const { error: d1 } = await supabase.from('user_entitlements_data').delete().eq('user_id', userId);
      if (d1) throw d1;
      const { error: d2 } = await supabase.from('notification_preferences').delete().eq('user_id', userId);
      if (d2) throw d2;
      const { error: d3 } = await supabase.from('subscriptions').delete().eq('user_id', userId);
      if (d3) throw d3;

      const res = await fetch(REPAIR_FUNCTION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify({ userId, accountType: accountType || 'guard', forceRegenerate: true }),
      });
      const data = await res.json();
      setRepairResults(prev => ({ ...prev, [userId]: data.results || [] }));
      setShowRepairModal(userId);
      showToast('Profile rebuilt successfully');
      loadUsers(page, activeSearch, accountFilter, statusFilter);
    } catch (err: any) {
      console.error('Force rebuild failed:', err);
      showToast(err.message || 'Failed to rebuild profile');
    }
    setRepairing(null);
  };

  const handleRepairAll = async () => {
    if (repairAllActive) return;
    setRepairAllActive(true);

    try {
      const res = await fetch(EDGE_FUNCTION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify({
          page: 0,
          pageSize: 500,
          search: activeSearch,
          accountFilter,
          statusFilter,
        }),
      });
      const data: ProvisioningResponse = await res.json();
      if (data.error) throw new Error(data.error);

      const needsRepair = (data.users || []).filter(
        u => u.dashboardStatus !== 'complete' && u.accountType !== 'unknown' && u.accountType !== 'admin'
      );

      if (needsRepair.length === 0) {
        showToast('No users need repair');
        setRepairAllActive(false);
        return;
      }

      let repaired = 0;
      for (const u of needsRepair) {
        try {
          await fetch(REPAIR_FUNCTION, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${await getAccessToken()}`,
            },
            body: JSON.stringify({ userId: u.id, accountType: u.accountType || 'guard' }),
          });
          repaired++;
        } catch (err) {
          console.error(`Repair failed for ${u.email}:`, err);
        }
      }
      showToast(`Repaired ${repaired} of ${needsRepair.length} accounts`);
      loadUsers(page, activeSearch, accountFilter, statusFilter);
    } catch (err: any) {
      console.error('Repair all failed:', err);
      showToast(err.message || 'Repair all failed');
    }
    setRepairAllActive(false);
  };

  const getDashboardUrl = (accountType: string) => {
    if (accountType === 'guard') return '/guard/dashboard';
    if (accountType === 'client') return '/client/dashboard';
    if (accountType === 'company') return '/company/dashboard';
    return '/admin/dashboard';
  };

  const needsRepairCount = users.filter(u => u.dashboardStatus !== 'complete' && u.accountType !== 'unknown' && u.accountType !== 'admin').length;
  const counts = { guard: 0, client: 0, admin: 0, unknown: 0, complete: 0, partial: 0, missing: 0 };
  users.forEach(u => {
    counts[u.accountType as keyof typeof counts] = (counts[u.accountType as keyof typeof counts] || 0) + 1;
    counts[u.dashboardStatus as keyof typeof counts] = (counts[u.dashboardStatus as keyof typeof counts] || 0) + 1;
  });

  return (
    <div className="p-6">
      <div className="max-w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">User Provisioning</h1>
            <p className="text-sm text-slate-400">Monitor and repair user account provisioning across the platform</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRepairAll}
              disabled={needsRepairCount === 0 || repairAllActive || repairing !== null}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-900 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              {repairAllActive ? (
                <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-tools-line"></i></div>
              )}
              Repair All ({needsRepairCount})
            </button>
            <button
              onClick={() => loadUsers(page, activeSearch, accountFilter, statusFilter)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a2b4a] hover:bg-[#243656] text-slate-300 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
            >
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line"></i></div>
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 px-5 py-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center bg-red-500/20 rounded-full flex-shrink-0">
                <i className="ri-error-warning-line text-red-400 text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-medium text-red-300">Failed to load users</p>
                <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={() => loadUsers(page, activeSearch, accountFilter, statusFilter)}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center inline mr-1.5">
                <i className="ri-refresh-line"></i>
              </div>
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Guards</p>
            <p className="text-2xl font-bold text-white">{counts.guard}</p>
          </div>
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Clients</p>
            <p className="text-2xl font-bold text-white">{counts.client}</p>
          </div>
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Admins</p>
            <p className="text-2xl font-bold text-white">{counts.admin}</p>
          </div>
          <div className="bg-[#111d35] border border-emerald-500/20 rounded-xl p-4">
            <p className="text-xs text-emerald-400 mb-1">Complete</p>
            <p className="text-2xl font-bold text-emerald-400">{counts.complete}</p>
          </div>
          <div className="bg-[#111d35] border border-amber-500/20 rounded-xl p-4">
            <p className="text-xs text-amber-400 mb-1">Partial</p>
            <p className="text-2xl font-bold text-amber-400">{counts.partial}</p>
          </div>
          <div className="bg-[#111d35] border border-red-500/20 rounded-xl p-4">
            <p className="text-xs text-red-400 mb-1">Missing</p>
            <p className="text-2xl font-bold text-red-400">{counts.missing}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-search-line text-slate-500 text-sm"></i></div>
            </div>
            <input
              type="text"
              placeholder="Search by email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-10 py-2.5 bg-[#111d35] border border-[#1a2b4a] rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />
            {activeSearch && (
              <button
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-white cursor-pointer"
              >
                <i className="ri-close-circle-fill text-sm"></i>
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-500 transition-colors cursor-pointer whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center inline mr-1.5">
              <i className="ri-search-line"></i>
            </div>
            Search
          </button>
          <div className="flex items-center gap-1 bg-[#111d35] border border-[#1a2b4a] rounded-xl px-1 py-1">
            {['all', 'guard', 'client', 'admin'].map(t => (
              <button
                key={t}
                onClick={() => handleFilterChange('account', t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  accountFilter === t ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t === 'all' ? 'All' : t === 'guard' ? 'Guards' : t === 'client' ? 'Clients' : 'Admins'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-[#111d35] border border-[#1a2b4a] rounded-xl px-1 py-1">
            {['all', 'complete', 'partial', 'missing'].map(s => (
              <button
                key={s}
                onClick={() => handleFilterChange('status', s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === s ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl p-12 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a2b4a]">
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Account</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Dashboard</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Profile</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Sub</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Verify</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Entitle</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Notif</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2b4a]">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-[#1a2b4a]/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-white text-sm font-medium truncate max-w-[200px]">{u.email}</p>
                        <p className="text-[11px] text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.accountType} positive="guard" negative="unknown" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-300 text-xs font-medium">{u.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <DashboardHealth record={u} />
                      </td>
                      <td className="px-4 py-3">
                        {u.accountType === 'admin' ? (
                          <span className="text-slate-500 text-xs">N/A</span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-xs ${u.profileCompleted ? 'text-emerald-400' : 'text-red-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.profileCompleted ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                            {u.profileCompleted ? 'Yes' : 'No'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.subscriptionStatus} positive="active" negative="incomplete" />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.verificationStatus} positive="approved" negative="pending" />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs ${u.hasEntitlements ? 'text-emerald-400' : 'text-red-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.hasEntitlements ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                          {u.hasEntitlements ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs ${u.hasNotificationPrefs ? 'text-emerald-400' : 'text-red-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.hasNotificationPrefs ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                          {u.hasNotificationPrefs ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {u.accountType !== 'unknown' && u.accountType !== 'admin' && (
                            <>
                              <div className="relative group">
                                <button className="px-2 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer">
                                  <i className="ri-more-2-fill text-sm"></i>
                                </button>
                                <div className="absolute right-0 top-full mt-1 w-56 bg-[#0B1933] border border-[#1a2b4a] rounded-xl shadow-2xl py-1 z-50 hidden group-hover:block">
                                  <button onClick={() => handleRepair(u.id, u.accountType)} disabled={repairing === u.id} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-[#1a2b4a] hover:text-white transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap">
                                    <i className="ri-tools-line text-teal-400"></i> Repair Account
                                  </button>
                                  <button onClick={() => handleRegenerateDashboard(u.id, u.accountType)} disabled={repairing === u.id} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-[#1a2b4a] hover:text-white transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap">
                                    <i className="ri-refresh-line text-blue-400"></i> Regenerate Dashboard
                                  </button>
                                  <button onClick={() => handleResetOnboarding(u.id, u.accountType)} disabled={repairing === u.id} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-[#1a2b4a] hover:text-white transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap">
                                    <i className="ri-restart-line text-amber-400"></i> Reset Onboarding
                                  </button>
                                  <button onClick={() => handleForceRebuild(u.id, u.accountType)} disabled={repairing === u.id} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-[#1a2b4a] hover:text-white transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap">
                                    <i className="ri-hammer-line text-red-400"></i> Force Profile Rebuild
                                  </button>
                                  <div className="border-t border-[#1a2b4a] my-1"></div>
                                  <button onClick={() => handleActivateSubscription(u.id)} disabled={repairing === u.id} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-[#1a2b4a] hover:text-white transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap">
                                    <i className="ri-check-double-line text-emerald-400"></i> Activate Subscription
                                  </button>
                                  <button onClick={() => handleSuspendUser(u.id)} disabled={repairing === u.id} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-[#1a2b4a] hover:text-white transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap">
                                    <i className="ri-pause-circle-line text-amber-400"></i> Suspend User
                                  </button>
                                  <button onClick={() => handleReactivateUser(u.id)} disabled={repairing === u.id} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-[#1a2b4a] hover:text-white transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap">
                                    <i className="ri-play-circle-line text-emerald-400"></i> Reactivate User
                                  </button>
                                  <div className="border-t border-[#1a2b4a] my-1"></div>
                                  <Link href={getDashboardUrl(u.accountType)} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-[#1a2b4a] hover:text-white transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap block">
                                    <i className="ri-eye-line text-violet-400"></i> View User Dashboard
                                  </Link>
                                  {u.accountType === 'guard' && (
                                    <Link href="/admin/guard-profiles" className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-[#1a2b4a] hover:text-white transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap block">
                                      <i className="ri-user-line text-slate-400"></i> View Guard Profile
                                    </Link>
                                  )}
                                  {u.accountType === 'client' && (
                                    <Link href="/admin/client-profiles" className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-[#1a2b4a] hover:text-white transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap block">
                                      <i className="ri-user-line text-slate-400"></i> View Client Profile
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                          {u.accountType === 'admin' && (
                            <span className="text-xs text-slate-600">N/A</span>
                          )}
                          {u.accountType === 'unknown' && (
                            <span className="text-xs text-slate-600">Unknown</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && !error && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                        {activeSearch || accountFilter !== 'all' || statusFilter !== 'all'
                          ? 'No users match the current filters'
                          : 'No users found'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalCount > 0 && (
              <div className="px-4 py-3 border-t border-[#1a2b4a] flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} users
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={!hasPrev}
                    className="px-3 py-1.5 rounded-lg bg-[#1a2b4a] text-slate-300 text-xs font-medium hover:bg-[#243656] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                  >
                    <div className="w-4 h-4 flex items-center justify-center inline mr-1">
                      <i className="ri-arrow-left-s-line"></i>
                    </div>
                    Previous
                  </button>
                  <span className="text-slate-500 text-xs px-2">
                    Page {page + 1} of {totalPages || 1}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasNext}
                    className="px-3 py-1.5 rounded-lg bg-[#1a2b4a] text-slate-300 text-xs font-medium hover:bg-[#243656] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                  >
                    Next
                    <div className="w-4 h-4 flex items-center justify-center inline ml-1">
                      <i className="ri-arrow-right-s-line"></i>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showRepairModal && repairResults[showRepairModal] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRepairModal(null)}></div>
          <div className="relative bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Repair Results</h3>
              <button onClick={() => setShowRepairModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] text-slate-400 cursor-pointer">
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="space-y-2">
              {repairResults[showRepairModal].map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-[#0B1933] rounded-xl">
                  <span className="text-sm text-slate-300 capitalize">{r.step.replace(/_/g, ' ')}</span>
                  <StatusBadge status={r.status} positive="created" negative="error" />
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowRepairModal(null)}
              className="w-full mt-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-900 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[80] bg-[#111d35] border border-[#1a2b4a] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <i className="ri-checkbox-circle-fill text-teal-400"></i>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}