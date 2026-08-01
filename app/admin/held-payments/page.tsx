'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface HeldPayment {
  assignment_id: string;
  job_id: string;
  guard_id: string;
  job_title: string;
  venue_city: string;
  client_name: string;
  guard_name: string;
  guard_email: string;
  payment_amount: number;
  payment_status: string;
  completed_at: string;
  days_held: number;
}

type StatusFilter = 'all' | 'ready' | 'awaiting';
type DaysFilter = 'all' | '3' | '7' | '14' | '30';
type SortField = 'completed_at' | 'days_held' | 'amount';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  client_released: { label: 'Ready to Release', color: 'bg-emerald-500/10 text-emerald-400' },
  pending: { label: 'Awaiting Client', color: 'bg-amber-500/10 text-amber-400' },
  held: { label: 'Held', color: 'bg-orange-500/10 text-orange-400' },
};

function getStatusBadge(status: string | null) {
  const s = status || 'null';
  const config = STATUS_LABELS[s] || { label: 'Awaiting Client', color: 'bg-amber-500/10 text-amber-400' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${config.color}`}>
      {config.label}
    </span>
  );
}

export default function AdminHeldPayments() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allPayments, setAllPayments] = useState<HeldPayment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseSuccess, setReleaseSuccess] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [daysFilter, setDaysFilter] = useState<DaysFilter>('all');
  const [sortField, setSortField] = useState<SortField>('completed_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const [confirmModal, setConfirmModal] = useState<HeldPayment | null>(null);
  const [confirmNotes, setConfirmNotes] = useState('');

  useEffect(() => {
    fetchHeldPayments();
  }, []);

  const fetchHeldPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: assignments, error: assignmentsError } = await supabase
        .from('job_assignments')
        .select('id, job_id, guard_id, status, payment_status, payment_amount, completed_at, assigned_at')
        .eq('status', 'completed')
        .or('payment_status.eq.pending,payment_status.eq.held,payment_status.eq.client_released,payment_status.is.null')
        .order('completed_at', { ascending: false });

      if (assignmentsError) throw new Error(assignmentsError.message);

      if (!assignments || assignments.length === 0) {
        setAllPayments([]);
        setLoading(false);
        return;
      }

      const jobIds = [...new Set(assignments.map(a => a.job_id).filter(Boolean))];
      const guardIds = [...new Set(assignments.map(a => a.guard_id).filter(Boolean))];

      const [jobsRes, guardsRes] = await Promise.all([
        jobIds.length > 0
          ? supabase.from('jobs').select('id, job_title, venue_city, client_id, contact_name').in('id', jobIds)
          : Promise.resolve({ data: [], error: null }),
        guardIds.length > 0
          ? supabase.from('guards').select('id, full_name, email').in('id', guardIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (jobsRes.error) throw new Error(jobsRes.error.message);
      if (guardsRes.error) throw new Error(guardsRes.error.message);

      const jobsMap = new Map((jobsRes.data || []).map(j => [j.id, j]));
      const guardsMap = new Map((guardsRes.data || []).map(g => [g.id, g]));

      const clientIds = [...new Set((jobsRes.data || []).map(j => j.client_id).filter(Boolean))];
      let clientsMap = new Map<string, any>();
      if (clientIds.length > 0) {
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, company_name, first_name, last_name')
          .in('id', clientIds);
        clientsMap = new Map((clientsData || []).map(c => [c.id, c]));
      }

      const today = new Date();
      const held: HeldPayment[] = assignments.map(a => {
        const job = jobsMap.get(a.job_id);
        const guard = guardsMap.get(a.guard_id);
        const client = job ? clientsMap.get(job.client_id) : null;

        const completedDate = a.completed_at ? new Date(a.completed_at) : null;
        const daysHeld = completedDate
          ? Math.max(0, Math.floor((today.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        const clientName = client?.company_name ||
          (client?.first_name && client?.last_name ? `${client.first_name} ${client.last_name}` : null) ||
          job?.contact_name ||
          'Unknown Client';

        return {
          assignment_id: a.id,
          job_id: a.job_id,
          guard_id: a.guard_id,
          job_title: job?.job_title || '\u2014',
          venue_city: job?.venue_city || '\u2014',
          client_name: clientName,
          guard_name: guard?.full_name || '\u2014',
          guard_email: guard?.email || '\u2014',
          payment_amount: a.payment_amount ?? 0,
          payment_status: a.payment_status || 'null',
          completed_at: a.completed_at,
          days_held: daysHeld,
        };
      });

      setAllPayments(held);
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Error fetching held payments:', err?.message || err);
      setError(err?.message || 'Failed to load held payments');
    } finally {
      setLoading(false);
    }
  };

  const confirmRelease = async () => {
    if (!confirmModal) return;

    const payment = confirmModal;
    setReleasingId(payment.assignment_id);
    setReleaseError(null);
    setReleaseSuccess(null);
    setEmailWarning(null);
    setConfirmModal(null);
    setConfirmNotes('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setReleaseError('Your admin session has expired. Please sign in again.');
        setReleasingId(null);
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-guard-payout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            assignmentId: payment.assignment_id,
            jobId: payment.job_id,
          }),
        }
      );

      const result = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setReleaseError('Your session has expired. Please sign in again.');
        } else if (res.status === 403) {
          setReleaseError('Finance administrator access is required to release payouts. Only super admins and finance admins can perform this action.');
        } else if (res.status === 400) {
          setReleaseError(result.error || 'This assignment is not eligible for payout. The guard may not have a ready Stripe account, or the client has not yet released funds.');
        } else if (res.status === 404) {
          setReleaseError('Assignment not found.');
        } else if (res.status === 409) {
          setReleaseError(result.error || 'This payout has already been completed, is currently processing, or requires finance review.');
        } else {
          setReleaseError(result.error || 'The payout could not be processed safely.');
        }
        return;
      }

      setReleaseSuccess(result.message || `Payout of £${result.netAmount} released successfully.${result.recovered ? ' (Recovered from processing state)' : ''}`);

      if (result.emailSent === false) {
        setEmailWarning(`Receipt email could not be sent to ${payment.guard_name}. The Stripe transfer was still processed successfully.`);
      }

      setAllPayments(prev => prev.filter(p => p.assignment_id !== payment.assignment_id));
    } catch (err: any) {
      setReleaseError(err.message || 'Something went wrong');
    } finally {
      setReleasingId(null);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setCurrentPage(1);
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <i className="ri-arrow-up-down-line text-slate-600 text-xs" />;
    }
    return sortDir === 'asc'
      ? <i className="ri-sort-asc text-teal-400 text-xs" />
      : <i className="ri-sort-desc text-teal-400 text-xs" />;
  };

  const filteredPayments = useMemo(() => {
    let filtered = [...allPayments];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.job_title.toLowerCase().includes(q) ||
        p.guard_name.toLowerCase().includes(q) ||
        p.client_name.toLowerCase().includes(q)
      );
    }

    if (statusFilter === 'ready') {
      filtered = filtered.filter(p => p.payment_status === 'client_released');
    } else if (statusFilter === 'awaiting') {
      filtered = filtered.filter(p => p.payment_status !== 'client_released');
    }

    if (daysFilter !== 'all') {
      const threshold = parseInt(daysFilter, 10);
      filtered = filtered.filter(p => p.days_held >= threshold);
    }

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'completed_at') {
        cmp = new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime();
      } else if (sortField === 'days_held') {
        cmp = a.days_held - b.days_held;
      } else if (sortField === 'amount') {
        cmp = a.payment_amount - b.payment_amount;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [allPayments, searchQuery, statusFilter, daysFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPayments = filteredPayments.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalHeld = allPayments.reduce((sum, p) => sum + (Number(p.payment_amount) || 0), 0);
  const totalFiltered = filteredPayments.reduce((sum, p) => sum + (Number(p.payment_amount) || 0), 0);
  const readyCount = allPayments.filter(p => p.payment_status === 'client_released').length;
  const awaitingCount = allPayments.filter(p => p.payment_status !== 'client_released').length;

  const canRelease = (p: HeldPayment) => p.payment_status === 'client_released';

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <div className="bg-[#111d35] border-b border-[#1a2b4a] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard" className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#1a2b4a] cursor-pointer transition-colors">
            <i className="ri-arrow-left-line text-slate-400 text-lg w-6 h-6 flex items-center justify-center"></i>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Held Payments</h1>
            <p className="text-sm text-slate-400">Manage held job payments for completed jobs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-blue-500/10 rounded-lg">
            <span className="text-sm font-semibold text-blue-400">
              {allPayments.length} Held &middot; &pound;{totalHeld.toFixed(2)}
            </span>
          </div>
          <button
            onClick={() => { setLoading(true); fetchHeldPayments(); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#111d35] border border-[#1a2b4a] rounded-lg text-sm text-slate-400 hover:bg-[#1a2b4a] hover:text-white cursor-pointer transition-colors whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-refresh-line text-sm"></i></div>
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {releaseError && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 bg-red-500/15 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-error-warning-line text-xl text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-400">Release failed</p>
              <p className="text-sm text-red-300 whitespace-pre-wrap">{releaseError}</p>
            </div>
            <button onClick={() => { setReleaseError(null); setEmailWarning(null); }} className="text-slate-400 hover:text-white cursor-pointer flex-shrink-0"><i className="ri-close-line" /></button>
          </div>
        )}

        {releaseSuccess && (
          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-500/15 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-checkbox-circle-line text-xl text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-emerald-400">Payment released</p>
              <p className="text-sm text-emerald-300">{releaseSuccess}</p>
              {emailWarning && (
                <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-mail-close-line text-amber-400 text-sm" />
                  </div>
                  <p className="text-sm text-amber-300">{emailWarning}</p>
                </div>
              )}
            </div>
            <button onClick={() => { setReleaseSuccess(null); setEmailWarning(null); }} className="text-slate-400 hover:text-white cursor-pointer flex-shrink-0"><i className="ri-close-line" /></button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="bg-[#111d35] rounded-xl border border-red-500/20 flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 flex items-center justify-center rounded-full bg-red-500/10">
              <i className="ri-error-warning-line text-3xl text-red-400 w-8 h-8 flex items-center justify-center"></i>
            </div>
            <p className="text-red-400 text-base font-medium">{error}</p>
            <button onClick={fetchHeldPayments} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap">Try Again</button>
          </div>
        ) : allPayments.length === 0 ? (
          <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 flex items-center justify-center rounded-full bg-[#1a2b4a]">
              <i className="ri-lock-line text-3xl text-slate-500 w-8 h-8 flex items-center justify-center"></i>
            </div>
            <p className="text-slate-400 text-base">No payments held with Stripe</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-search-line text-slate-500 text-sm" />
                </div>
                <input
                  type="text"
                  placeholder="Search by job, guard, or client..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-4 py-2 bg-[#111d35] border border-[#1a2b4a] rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 transition-colors"
                />
              </div>

              <div className="flex items-center bg-[#111d35] border border-[#1a2b4a] rounded-full px-1 py-1">
                {(['all', 'ready', 'awaiting'] as StatusFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => { setStatusFilter(f); setCurrentPage(1); }}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      statusFilter === f
                        ? 'bg-teal-500/20 text-teal-400'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f === 'all' ? `All (${allPayments.length})` : f === 'ready' ? `Ready (${readyCount})` : `Awaiting (${awaitingCount})`}
                  </button>
                ))}
              </div>

              <select
                value={daysFilter}
                onChange={(e) => { setDaysFilter(e.target.value as DaysFilter); setCurrentPage(1); }}
                className="bg-[#111d35] border border-[#1a2b4a] rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-teal-500/50 cursor-pointer pr-8"
              >
                <option value="all">All durations</option>
                <option value="3">&gt; 3 days held</option>
                <option value="7">&gt; 7 days held</option>
                <option value="14">&gt; 14 days held</option>
                <option value="30">&gt; 30 days held</option>
              </select>
            </div>

            <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a2b4a] bg-[#0a1628]">
                    <th className="text-left px-6 py-3 font-semibold text-slate-400">Job</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-400">Guard</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-400">Client</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-400">Status</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-400 cursor-pointer select-none" onClick={() => handleSort('completed_at')}>
                      <span className="inline-flex items-center gap-1">Completed {sortIcon('completed_at')}</span>
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-400 cursor-pointer select-none" onClick={() => handleSort('days_held')}>
                      <span className="inline-flex items-center gap-1">Days Held {sortIcon('days_held')}</span>
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-400 cursor-pointer select-none" onClick={() => handleSort('amount')}>
                      <span className="inline-flex items-center gap-1">Amount {sortIcon('amount')}</span>
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-slate-500">
                        {searchQuery.trim() || statusFilter !== 'all' || daysFilter !== 'all'
                          ? 'No payments match your filters'
                          : 'No payments found'}
                      </td>
                    </tr>
                  ) : (
                    paginatedPayments.map((payment, idx) => (
                      <tr key={payment.assignment_id} className={`border-b border-[#1a2b4a] hover:bg-[#0a1628] transition-colors ${idx === paginatedPayments.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-6 py-4">
                          <p className="font-medium text-white">{payment.job_title}</p>
                          <p className="text-xs text-slate-400">{payment.venue_city}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-white font-medium">{payment.guard_name}</p>
                          <p className="text-xs text-slate-400">{payment.guard_email}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-300">{payment.client_name}</td>
                        <td className="px-6 py-4">{getStatusBadge(payment.payment_status)}</td>
                        <td className="px-6 py-4 text-slate-400">
                          {payment.completed_at
                            ? new Date(payment.completed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '\u2014'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${payment.days_held > 7 ? 'bg-orange-500/10 text-orange-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {payment.days_held} day{payment.days_held !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-white font-semibold">&pound;{Number(payment.payment_amount).toFixed(2)}</td>
                        <td className="px-6 py-4">
                          {canRelease(payment) ? (
                            <button
                              onClick={() => { setConfirmModal(payment); setConfirmNotes(''); }}
                              disabled={releasingId === payment.assignment_id}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap flex items-center gap-2"
                            >
                              {releasingId === payment.assignment_id ? (
                                <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Releasing...</>
                              ) : (
                                <><i className="ri-send-plane-line" /> Release Funds</>
                              )}
                            </button>
                          ) : (
                            <button
                              disabled
                              className="px-4 py-1.5 bg-slate-700/50 text-slate-500 text-xs font-semibold rounded-lg cursor-not-allowed whitespace-nowrap flex items-center gap-2"
                              title="The client must approve the job completion and release funds before a payout can be made"
                            >
                              <i className="ri-time-line" /> Not Ready
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredPayments.length > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4 text-sm">
                <p className="text-slate-400">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}\u2013{Math.min(safePage * PAGE_SIZE, filteredPayments.length)} of {filteredPayments.length} results
                  {searchQuery.trim() || statusFilter !== 'all' || daysFilter !== 'all' ? (
                    <span className="text-slate-500"> (filtered from {allPayments.length} total)</span>
                  ) : null}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="px-3 py-1.5 bg-[#111d35] border border-[#1a2b4a] rounded-lg text-slate-400 hover:bg-[#1a2b4a] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap text-xs"
                  >
                    Previous
                  </button>
                  <span className="text-slate-400 px-2">Page {safePage} of {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="px-3 py-1.5 bg-[#111d35] border border-[#1a2b4a] rounded-lg text-slate-400 hover:bg-[#1a2b4a] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap text-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="px-6 py-5 border-b border-[#1a2b4a] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Confirm Payment Release</h2>
                <p className="text-sm text-slate-400 mt-0.5">This triggers a real Stripe transfer</p>
              </div>
              <button onClick={() => setConfirmModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#1a2b4a] text-slate-400 hover:text-white cursor-pointer transition-colors">
                <i className="ri-close-line" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="bg-[#0a1628] rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Job</span>
                  <span className="text-white text-sm font-medium text-right">{confirmModal.job_title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Guard</span>
                  <span className="text-white text-sm font-medium text-right">{confirmModal.guard_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Client</span>
                  <span className="text-white text-sm font-medium text-right">{confirmModal.client_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Amount</span>
                  <span className="text-emerald-400 text-sm font-bold">&pound;{Number(confirmModal.payment_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Assignment ID</span>
                  <span className="text-slate-500 text-xs font-mono text-right">{confirmModal.assignment_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Days Held</span>
                  <span className="text-white text-sm">{confirmModal.days_held} day{confirmModal.days_held !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-500/15 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ri-alert-line text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-400">This action cannot be undone</p>
                  <p className="text-sm text-amber-300/80 mt-0.5">A real Stripe transfer will be created and funds will be sent to the guard&apos;s connected bank account. Please verify all details above before confirming.</p>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1.5">Admin notes (optional)</label>
                <textarea
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Add any notes about this release..."
                  className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#1a2b4a] flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-lg text-sm text-slate-400 hover:bg-[#1a2b4a] hover:text-white cursor-pointer transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={confirmRelease}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap flex items-center gap-2"
              >
                <i className="ri-send-plane-line" /> Confirm Release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}