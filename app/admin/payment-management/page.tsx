'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

const TIMELINE_STORAGE_KEY = 'admin_payment_test_timeline';

interface TimelineEntry {
  id: string;
  timestamp: string;
  action: string;
  label: string;
  status: 'success' | 'error' | 'pending';
  detail: string;
  auditLogId?: string | null;
  stripeId?: string | null;
}

interface StatusSnapshot {
  job: { id: string; title: string; status: string; payment_status: string; stripe_session_id: string | null; stripe_payment_intent_id: string | null; agreed_amount: number | null; platform_fee: number | null; guard_payout_amount: number | null; currency: string | null; client_id: string | null } | null;
  assignment: { id: string; status: string; payment_status: string; guard_net_payout: number | null; stripe_transfer_id: string | null; gross_guard_amount: number | null; guard_id: string | null } | null;
  transaction: { id: string; status: string; stripe_session_id: string | null; stripe_payment_intent: string | null; amount: number | null; created_at: string | null } | null;
  completionRequest: { id: string; status: string; guard_id: string | null } | null;
  payout: { id: string; status: string; stripe_transfer_id: string | null; amount: number | null; net_amount: number | null } | null;
}

function loadTimelineFromStorage(): TimelineEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TIMELINE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTimelineToStorage(entries: TimelineEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(entries.slice(-50)));
  } catch {}
}

export default function AdminPaymentManagementPage() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [stripeModeError, setStripeModeError] = useState(false);
  const [stripeMode, setStripeMode] = useState<'test' | 'live' | 'unknown'>('unknown');
  const [edgeFunctionReachable, setEdgeFunctionReachable] = useState(false);
  const [stripeModeLastError, setStripeModeLastError] = useState('');
  const [stripeModeLastChecked, setStripeModeLastChecked] = useState('');
  const [snapshotError, setSnapshotError] = useState(false);

  const [clients, setClients] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [guards, setGuards] = useState<any[]>([]);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [selectedGuardId, setSelectedGuardId] = useState('');
  const [testAmount, setTestAmount] = useState('100.00');

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [snapshot, setSnapshot] = useState<StatusSnapshot | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeline(loadTimelineFromStorage()); }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const addTimelineEntry = useCallback((entry: Omit<TimelineEntry, 'id' | 'timestamp'>) => {
    const newEntry: TimelineEntry = { ...entry, id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString() };
    setTimeline(prev => { const updated = [...prev, newEntry]; saveTimelineToStorage(updated); return updated; });
    setTimeout(() => timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: 'smooth' }), 100);
  }, []);

  const callEdgeFunction = useCallback(async (action: string, payload: Record<string, any>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-test-job-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Edge function returned an error');
    return data;
  }, []);

  const fetchStatusSnapshot = useCallback(async () => {
    if (!selectedJobId) return;
    setSnapshotError(false);
    try {
      const data = await callEdgeFunction('get_status_snapshot', {
        jobId: selectedJobId,
        assignmentId: selectedAssignmentId || undefined,
      });
      setSnapshot(data.data);
    } catch {
      setSnapshotError(true);
    }
  }, [selectedJobId, selectedAssignmentId, callEdgeFunction]);

  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setCheckingRole(false); return; }
        const { data: adminCheck } = await supabase.from('admin_users').select('id, role, is_active').eq('user_id', session.user.id).maybeSingle();
        const allowedRoles = ['super_admin', 'finance_admin'];
        if (adminCheck && adminCheck.is_active && allowedRoles.includes(adminCheck.role)) {
          setIsAuthorized(true);
        }
      } catch {} finally { setCheckingRole(false); }
    }
    init();
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    async function loadSelectors() {
      const [clientsRes, jobsRes] = await Promise.all([
        supabase.from('clients').select('id, company_name, contact_name, email, stripe_customer_id').order('company_name', { ascending: true }).limit(200),
        supabase.from('jobs').select('id, job_title, client_id, payment_status, status, venue_city').eq('is_deleted', false).order('created_at', { ascending: false }).limit(200),
      ]);
      if (clientsRes.data) setClients(clientsRes.data);
      if (jobsRes.data) setJobs(jobsRes.data);
    }
    loadSelectors();
  }, [isAuthorized]);

  useEffect(() => {
    async function checkStripeMode() {
      setStripeModeError(false);
      setStripeModeLastError('');
      setEdgeFunctionReachable(false);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-test-job-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'check_mode' }),
        });
        const data = await res.json();
        setEdgeFunctionReachable(true);
        setStripeModeLastChecked(new Date().toISOString());
        if (data.success) {
          const detectedMode = data.mode || data.data?.mode;
          if (data.isLiveMode === true || detectedMode === 'live') {
            setIsLiveMode(true);
            setStripeMode('live');
          } else if (data.isTestMode === true || detectedMode === 'test') {
            setIsLiveMode(false);
            setStripeMode('test');
            setStripeModeError(false);
          } else {
            setIsLiveMode(false);
            setStripeMode('unknown');
            setStripeModeError(true);
            setStripeModeLastError('Edge function returned success but mode could not be determined');
          }
        } else {
          setIsLiveMode(false);
          setStripeMode('unknown');
          setStripeModeError(true);
          setStripeModeLastError(data.error || 'Edge function returned an error');
        }
      } catch (err: any) {
        setEdgeFunctionReachable(false);
        setIsLiveMode(false);
        setStripeMode('unknown');
        setStripeModeError(true);
        setStripeModeLastError(err.message || 'Network error — edge function unreachable');
        setStripeModeLastChecked(new Date().toISOString());
      }
    }
    if (isAuthorized) checkStripeMode();
  }, [isAuthorized]);

  useEffect(() => {
    if (!selectedJobId) return;
    async function loadAssignmentsAndGuards() {
      const { data: assignmentData } = await supabase.from('job_assignments').select('id, guard_id, status, payment_status, gross_guard_amount, guard_net_payout').eq('job_id', selectedJobId);
      if (assignmentData) {
        setAssignments(assignmentData);
        const guardIds = [...new Set(assignmentData.map((a: any) => a.guard_id).filter(Boolean))];
        if (guardIds.length > 0) {
          const { data: guardData } = await supabase.from('guards').select('id, full_name, email, stripe_account_id').in('id', guardIds);
          if (guardData) setGuards(guardData);
        }
      }
    }
    loadAssignmentsAndGuards();
  }, [selectedJobId]);

  useEffect(() => {
    if (selectedAssignmentId && assignments.length > 0) {
      const found = assignments.find((a: any) => a.id === selectedAssignmentId);
      if (found?.guard_id) setSelectedGuardId(found.guard_id);
    }
  }, [selectedAssignmentId, assignments]);

  useEffect(() => { fetchStatusSnapshot(); }, [fetchStatusSnapshot]);

  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId);
    setSelectedAssignmentId('');
    setSelectedGuardId('');
    setAssignments([]);
    setGuards([]);
    const job = jobs.find((j: any) => j.id === jobId);
    if (job?.client_id) setSelectedClientId(job.client_id);
  };

  const handleAssignmentChange = (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    const assignment = assignments.find((a: any) => a.id === assignmentId);
    if (assignment) setSelectedGuardId(assignment.guard_id || '');
  };

  const toastSuccess = (msg: string) => setToast({ message: msg, type: 'success' });
  const toastError = (msg: string) => setToast({ message: msg, type: 'error' });

  const handleCreateCheckout = async () => {
    if (!selectedJobId || !selectedClientId || !testAmount) { toastError('Please fill all required fields'); return; }
    setActionLoading('checkout');
    try {
      const data = await callEdgeFunction('create_checkout', {
        jobId: selectedJobId, clientId: selectedClientId,
        amount: parseFloat(testAmount), assignmentId: selectedAssignmentId || undefined,
      });
      addTimelineEntry({ action: 'create_checkout', label: 'Stripe Checkout Created', status: 'success', detail: `Session: ${data.data.sessionId.slice(0, 18)}...`, stripeId: data.data.sessionId, auditLogId: data.auditLogId });
      toastSuccess('Checkout session created');
      if (data.data.url) { window.open(data.data.url, '_blank'); try { await navigator.clipboard.writeText(data.data.url); } catch {} }
      await fetchStatusSnapshot();
    } catch (err: any) {
      addTimelineEntry({ action: 'create_checkout', label: 'Stripe Checkout Failed', status: 'error', detail: err.message });
      toastError(err.message);
    } finally { setActionLoading(''); }
  };

  const handleSimulateFunded = async () => {
    if (!selectedJobId) { toastError('No job selected'); return; }
    setActionLoading('funded');
    try {
      const data = await callEdgeFunction('simulate_funded', { jobId: selectedJobId, assignmentId: selectedAssignmentId || undefined });
      addTimelineEntry({ action: 'simulate_funded', label: 'Payment Funded (Simulated)', status: 'success', detail: `Payment intent: ${data.data.fakePaymentIntent}`, stripeId: data.data.fakePaymentIntent, auditLogId: data.auditLogId });
      toastSuccess('Funding simulated — transactions→completed, jobs→funded');
      await fetchStatusSnapshot();
    } catch (err: any) {
      addTimelineEntry({ action: 'simulate_funded', label: 'Funded Simulation Failed', status: 'error', detail: err.message });
      toastError(err.message);
    } finally { setActionLoading(''); }
  };

  const handleSimulateCompletion = async () => {
    if (!selectedJobId || !selectedGuardId) { toastError('No guard selected'); return; }
    setActionLoading('completion');
    try {
      const job = jobs.find((j: any) => j.id === selectedJobId);
      const data = await callEdgeFunction('simulate_completion', { jobId: selectedJobId, guardId: selectedGuardId, assignmentId: selectedAssignmentId || undefined, clientId: job?.client_id || undefined });
      addTimelineEntry({ action: 'simulate_completion', label: 'Completion Requested', status: 'success', detail: `Request ID: ${data.data.completionRequestId.slice(0, 8)}...`, auditLogId: data.auditLogId });
      toastSuccess('Completion request created — awaiting client release');
      await fetchStatusSnapshot();
    } catch (err: any) {
      addTimelineEntry({ action: 'simulate_completion', label: 'Completion Failed', status: 'error', detail: err.message });
      toastError(err.message);
    } finally { setActionLoading(''); }
  };

  const handleReleaseGuard = async () => {
    if (!selectedJobId || !selectedGuardId || !selectedAssignmentId) { toastError('Missing guard/assignment'); return; }
    setActionLoading('release');
    setShowReleaseConfirm(false);
    try {
      const amount = parseFloat(testAmount);
      const data = await callEdgeFunction('release_guard', { jobId: selectedJobId, guardId: selectedGuardId, assignmentId: selectedAssignmentId, amount, adminNotes: 'Admin test console release' });
      addTimelineEntry({ action: 'release_guard', label: 'Guard Payment Released', status: 'success', detail: `Transfer: ${data.data.transferId.slice(0, 18)}...`, stripeId: data.data.transferId, auditLogId: data.auditLogId });
      toastSuccess(data.message);
      await fetchStatusSnapshot();
    } catch (err: any) {
      addTimelineEntry({ action: 'release_guard', label: 'Release Failed', status: 'error', detail: err.message });
      toastError(err.message);
    } finally { setActionLoading(''); }
  };

  const handleReset = async () => {
    if (!selectedJobId) { toastError('No job selected'); return; }
    setActionLoading('reset');
    setShowResetConfirm(false);
    try {
      const data = await callEdgeFunction('reset_test_flow', { jobId: selectedJobId, assignmentId: selectedAssignmentId || undefined });
      addTimelineEntry({ action: 'reset_test_flow', label: 'Test Flow Reset', status: 'success', detail: data.data.updatesApplied.join(', '), auditLogId: data.auditLogId });
      toastSuccess('Test flow reset to initial state');
      setSelectedAssignmentId(''); setSelectedGuardId('');
      await fetchStatusSnapshot();
    } catch (err: any) {
      addTimelineEntry({ action: 'reset_test_flow', label: 'Reset Failed', status: 'error', detail: err.message });
      toastError(err.message);
    } finally { setActionLoading(''); }
  };

  const amount = parseFloat(testAmount) || 0;
  const guardGross = amount;
  const platformFee = amount * 0.10;
  const stripeFee = amount * 0.015 + 0.20;
  const clientTotal = amount + platformFee + stripeFee;
  const guardNet = amount;

  const statusBadge = (status: string | null | undefined) => {
    const s = (status || 'unknown').toLowerCase();
    let cls = 'bg-slate-500/10 text-slate-400 ring-slate-500/20';
    if (s === 'funded' || s === 'completed' || s === 'confirmed') cls = 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20';
    else if (s === 'payment_pending' || s === 'pending') cls = 'bg-amber-500/10 text-amber-400 ring-amber-500/20';
    else if (s === 'payout_processing' || s === 'processing') cls = 'bg-sky-500/10 text-sky-400 ring-sky-500/20';
    else if (s === 'awaiting_client_release' || s === 'client_released') cls = 'bg-blue-500/10 text-blue-400 ring-blue-500/20';
    else if (s === 'disputed') cls = 'bg-orange-500/10 text-orange-400 ring-orange-500/20';
    else if (s === 'failed' || s === 'cancelled') cls = 'bg-red-500/10 text-red-400 ring-red-500/20';
    else if (s === 'unpaid') cls = 'bg-slate-500/10 text-slate-500 ring-slate-500/20';
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ring-1 ${cls}`}>{status || '—'}</span>;
  };

  if (checkingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B1933]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-teal-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-400 text-sm font-medium">Checking admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 flex items-center justify-center bg-red-500/10 rounded-2xl mx-auto mb-4">
            <i className="ri-shield-keyhole-line text-3xl text-red-400"></i>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-sm text-slate-400 mb-6">This page is restricted to Super Admin and Finance Admin roles only.</p>
          <Link href="/admin/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-900/50">
                <i className="ri-flask-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight tracking-tight">Payment Flow Test Console</h1>
                <p className="text-[11px] text-slate-500 font-medium">Admin-only Stripe test sandbox</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/payments-jobs" className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap">Payments & Jobs</Link>
              <Link href="/admin/held-payments" className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap">Held Payments</Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-8">
        {isLiveMode && (
          <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 flex items-center justify-center bg-red-500/20 rounded-xl flex-shrink-0">
              <i className="ri-alert-fill text-xl text-red-400"></i>
            </div>
            <div>
              <h3 className="font-bold text-red-400 text-base">LIVE MODE DETECTED</h3>
              <p className="text-sm text-red-300 mt-1">Your Stripe secret key is a live key (sk_live_*). This test console is locked. Switch to Stripe test mode keys to use the test console.</p>
            </div>
          </div>
        )}

        {stripeModeError && (
          <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 flex items-center justify-center bg-red-500/20 rounded-xl flex-shrink-0">
              <i className="ri-error-warning-line text-xl text-red-400"></i>
            </div>
            <div>
              <h3 className="font-bold text-red-400 text-base">Stripe Mode Check Failed</h3>
              <p className="text-sm text-red-300 mt-1">Unable to confirm Stripe is in test mode. The edge function may be unreachable or returned an error.</p>
              {stripeModeLastError && (
                <p className="text-xs text-red-400/70 mt-1.5 font-mono">{stripeModeLastError}</p>
              )}
            </div>
          </div>
        )}

        {stripeMode === 'test' && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-amber-500/20 rounded-lg flex-shrink-0">
              <i className="ri-error-warning-line text-lg text-amber-400"></i>
            </div>
            <p className="text-sm text-amber-300 font-medium">Stripe test mode only &mdash; do not use for live client funds. All Stripe actions run against test keys and simulated webhook events.</p>
          </div>
        )}

        {/* Debug Status Box */}
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-500/10 ring-1 ring-slate-500/20">
              <i className="ri-dashboard-line text-sm text-slate-400"></i>
            </div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Stripe Connection Status</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Edge Function</p>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${edgeFunctionReachable ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                <span className={`text-xs font-bold ${edgeFunctionReachable ? 'text-emerald-400' : 'text-red-400'}`}>{edgeFunctionReachable ? 'Reachable' : 'Unreachable'}</span>
              </div>
            </div>
            <div className="bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Stripe Mode</p>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${stripeMode === 'test' ? 'bg-amber-400' : stripeMode === 'live' ? 'bg-red-400' : 'bg-slate-500'}`}></span>
                <span className={`text-xs font-bold ${stripeMode === 'test' ? 'text-amber-400' : stripeMode === 'live' ? 'text-red-400' : 'text-slate-500'}`}>{stripeMode === 'test' ? 'Test / Sandbox' : stripeMode === 'live' ? 'Live' : 'Unknown'}</span>
              </div>
            </div>
            <div className="bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-3 sm:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Last Error</p>
              <p className={`text-xs font-medium ${stripeModeLastError ? 'text-red-400' : 'text-slate-600'}`}>{stripeModeLastError || 'None'}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-600">
            <span>Last checked: {stripeModeLastChecked ? new Date(stripeModeLastChecked).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}</span>
            <button
              onClick={() => {
                const check = async () => {
                  setStripeModeError(false);
                  setStripeModeLastError('');
                  setEdgeFunctionReachable(false);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.access_token) return;
                    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-test-job-payment`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                      body: JSON.stringify({ action: 'check_mode' }),
                    });
                    const data = await res.json();
                    setEdgeFunctionReachable(true);
                    setStripeModeLastChecked(new Date().toISOString());
                    if (data.success) {
                      const detectedMode = data.mode || data.data?.mode;
                      if (data.isLiveMode === true || detectedMode === 'live') {
                        setIsLiveMode(true);
                        setStripeMode('live');
                      } else if (data.isTestMode === true || detectedMode === 'test') {
                        setIsLiveMode(false);
                        setStripeMode('test');
                        setStripeModeError(false);
                      } else {
                        setIsLiveMode(false);
                        setStripeMode('unknown');
                        setStripeModeError(true);
                        setStripeModeLastError('Mode could not be determined from response');
                      }
                    } else {
                      setIsLiveMode(false);
                      setStripeMode('unknown');
                      setStripeModeError(true);
                      setStripeModeLastError(data.error || 'Edge function error');
                    }
                  } catch (err: any) {
                    setEdgeFunctionReachable(false);
                    setIsLiveMode(false);
                    setStripeMode('unknown');
                    setStripeModeError(true);
                    setStripeModeLastError(err.message || 'Network error');
                    setStripeModeLastChecked(new Date().toISOString());
                  }
                };
                check();
              }}
              className="text-slate-500 hover:text-teal-400 cursor-pointer transition-colors font-medium whitespace-nowrap"
            >
              <i className="ri-refresh-line mr-1"></i>Re-check
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
          <div className="xl:col-span-3 space-y-8">
            {/* SECTION 1: Setup */}
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-teal-500/10 ring-1 ring-teal-500/20">
                  <i className="ri-settings-3-line text-lg text-teal-400"></i>
                </div>
                <h2 className="text-lg font-bold text-white">Test Job Payment Setup</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Client</label>
                  <div className="relative">
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full bg-[#0a1628] border border-[#1a2b4a] rounded-xl px-4 py-3 pr-10 text-sm text-white appearance-none cursor-pointer focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    >
                      <option value="">Select client...</option>
                      {clients.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.company_name || c.contact_name || c.email || c.id}</option>
                      ))}
                    </select>
                    <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Job</label>
                  <div className="relative">
                    <select
                      value={selectedJobId}
                      onChange={(e) => handleJobChange(e.target.value)}
                      className="w-full bg-[#0a1628] border border-[#1a2b4a] rounded-xl px-4 py-3 pr-10 text-sm text-white appearance-none cursor-pointer focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    >
                      <option value="">Select job...</option>
                      {jobs.map((j: any) => (
                        <option key={j.id} value={j.id}>{j.job_title} {j.venue_city ? `— ${j.venue_city}` : ''} ({j.payment_status || 'unpaid'})</option>
                      ))}
                    </select>
                    <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Assignment / Guard</label>
                  <div className="relative">
                    <select
                      value={selectedAssignmentId}
                      onChange={(e) => handleAssignmentChange(e.target.value)}
                      className="w-full bg-[#0a1628] border border-[#1a2b4a] rounded-xl px-4 py-3 pr-10 text-sm text-white appearance-none cursor-pointer focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none disabled:opacity-50"
                      disabled={!selectedJobId}
                    >
                      <option value="">Select assignment...</option>
                      {assignments.map((a: any) => {
                        const g = guards.find((g2: any) => g2.id === a.guard_id);
                        return <option key={a.id} value={a.id}>{g?.full_name || 'Unknown Guard'} — {a.payment_status || 'unpaid'}</option>;
                      })}
                    </select>
                    <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Test Amount (GBP)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">£</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.50"
                      value={testAmount}
                      onChange={(e) => setTestAmount(e.target.value)}
                      className="w-full bg-[#0a1628] border border-[#1a2b4a] rounded-xl pl-8 pr-4 py-3 text-sm text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-4 grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: 'Guard Gross', value: guardGross, cls: 'text-white' },
                  { label: 'Platform Fee (10%)', value: platformFee, cls: 'text-amber-400' },
                  { label: 'Stripe Fee (est.)', value: stripeFee, cls: 'text-sky-400' },
                  { label: 'Client Total', value: clientTotal, cls: 'text-emerald-400' },
                  { label: 'Guard Net', value: guardNet, cls: 'text-teal-400' },
                ].map((row, i) => (
                  <div key={i} className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{row.label}</p>
                    <p className={`text-base font-extrabold ${row.cls}`}>£{row.value.toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-2 text-[11px] text-slate-500">
                <i className="ri-information-line text-sm"></i>
                <span>{selectedGuardId ? `Guard ID: ${selectedGuardId.slice(0, 8)}...` : 'Select a guard/assignment to enable completion + release'} &middot; {selectedAssignmentId ? `Assignment: ${selectedAssignmentId.slice(0, 8)}...` : 'No assignment'}</span>
              </div>
            </div>

            {/* SECTION 2: Flow Buttons */}
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-teal-500/10 ring-1 ring-teal-500/20">
                  <i className="ri-play-circle-line text-lg text-teal-400"></i>
                </div>
                <h2 className="text-lg font-bold text-white">Payment Flow Steps</h2>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleCreateCheckout}
                  disabled={!!actionLoading || !selectedJobId || isLiveMode}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-xl font-semibold text-sm transition-all cursor-pointer whitespace-nowrap ${actionLoading === 'checkout' ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-600 hover:bg-teal-500 text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="flex items-center gap-3">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10"><i className="ri-shopping-cart-2-line"></i></div>
                    <span className="text-left"><span className="block">Button 1: Create Stripe Held Payment</span><span className="block text-xs font-normal opacity-70">Creates checkout session → transaction pending</span></span>
                  </span>
                  {actionLoading === 'checkout' ? <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div> : <i className="ri-arrow-right-line text-lg"></i>}
                </button>

                <button
                  onClick={handleSimulateFunded}
                  disabled={!!actionLoading || !selectedJobId || isLiveMode}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-xl font-semibold text-sm transition-all cursor-pointer whitespace-nowrap ${actionLoading === 'funded' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="flex items-center gap-3">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10"><i className="ri-webhook-line"></i></div>
                    <span className="text-left"><span className="block">Button 2: Simulate Webhook / Confirm Funded</span><span className="block text-xs font-normal opacity-70">Copies checkout.session.completed → funded</span></span>
                  </span>
                  {actionLoading === 'funded' ? <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div> : <i className="ri-arrow-right-line text-lg"></i>}
                </button>

                <button
                  onClick={handleSimulateCompletion}
                  disabled={!!actionLoading || !selectedGuardId || isLiveMode}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-xl font-semibold text-sm transition-all cursor-pointer whitespace-nowrap ${actionLoading === 'completion' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-600 hover:bg-blue-500 text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="flex items-center gap-3">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10"><i className="ri-check-double-line"></i></div>
                    <span className="text-left"><span className="block">Button 3: Request / Simulate Job Completion</span><span className="block text-xs font-normal opacity-70">Creates completion request → awaiting release</span></span>
                  </span>
                  {actionLoading === 'completion' ? <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div> : <i className="ri-arrow-right-line text-lg"></i>}
                </button>

                <button
                  onClick={() => setShowReleaseConfirm(true)}
                  disabled={!!actionLoading || !selectedGuardId || !selectedAssignmentId || isLiveMode}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-xl font-semibold text-sm transition-all cursor-pointer whitespace-nowrap ${actionLoading === 'release' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-600 hover:bg-emerald-500 text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="flex items-center gap-3">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10"><i className="ri-send-plane-line"></i></div>
                    <span className="text-left"><span className="block">Button 4: Release Guard Payment</span><span className="block text-xs font-normal opacity-70">Creates real Stripe test transfer to guard</span></span>
                  </span>
                  {actionLoading === 'release' ? <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div> : <i className="ri-arrow-right-line text-lg"></i>}
                </button>

                <button
                  onClick={() => setShowResetConfirm(true)}
                  disabled={!!actionLoading || !selectedJobId || isLiveMode}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-xl font-semibold text-sm transition-all cursor-pointer whitespace-nowrap ${actionLoading === 'reset' ? 'bg-red-500/10 text-red-400' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 ring-1 ring-red-500/20'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="flex items-center gap-3">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10"><i className="ri-restart-line"></i></div>
                    <span className="text-left"><span className="block">Button 5: Reset Test Flow</span><span className="block text-xs font-normal opacity-70">Reverts job/assignment/transaction to unpaid state</span></span>
                  </span>
                  {actionLoading === 'reset' ? <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div> : <i className="ri-arrow-right-line text-lg"></i>}
                </button>
              </div>
            </div>

            {/* SECTION 3: Timeline */}
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-teal-500/10 ring-1 ring-teal-500/20">
                    <i className="ri-history-line text-lg text-teal-400"></i>
                  </div>
                  <h2 className="text-lg font-bold text-white">Action Timeline</h2>
                </div>
                <button
                  onClick={() => { setTimeline([]); saveTimelineToStorage([]); }}
                  className="text-xs text-slate-500 hover:text-slate-300 font-medium cursor-pointer transition-colors whitespace-nowrap"
                >
                  Clear
                </button>
              </div>

              <div ref={timelineRef} className="max-h-80 overflow-y-auto pr-1 space-y-2">
                {timeline.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 bg-[#0a1628] rounded-xl flex items-center justify-center mx-auto mb-3 ring-1 ring-[#1a2b4a]">
                      <i className="ri-timeline-view text-2xl text-slate-500"></i>
                    </div>
                    <p className="text-sm text-slate-500">No actions yet. Run the flow steps above to see them here.</p>
                  </div>
                ) : (
                  [...timeline].reverse().map((entry) => (
                    <div key={entry.id} className={`flex items-start gap-3 p-3 rounded-xl ${entry.status === 'error' ? 'bg-red-500/5 border border-red-500/10' : entry.status === 'pending' ? 'bg-amber-500/5 border border-amber-500/10' : 'bg-[#0a1628] border border-[#1a2b4a]'}`}>
                      <div className={`w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 mt-0.5 ${entry.status === 'error' ? 'bg-red-500/10 text-red-400' : entry.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        <i className={`text-sm ${entry.status === 'error' ? 'ri-close-line' : entry.status === 'pending' ? 'ri-time-line' : 'ri-check-line'}`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-extrabold uppercase tracking-wider ${entry.status === 'error' ? 'text-red-400' : entry.status === 'pending' ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {entry.label}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${entry.status === 'error' ? 'bg-red-500/10 text-red-400' : entry.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {entry.status === 'error' ? 'ERROR' : entry.status === 'pending' ? 'PENDING' : 'SUCCESS'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{entry.detail}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-600">
                          <span>{new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          {entry.stripeId && <span>Stripe: {entry.stripeId.slice(0, 12)}...</span>}
                          {entry.auditLogId && <span>Audit: {entry.auditLogId.slice(0, 8)}...</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: Status Snapshot */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-6 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-teal-500/10 ring-1 ring-teal-500/20">
                    <i className="ri-dashboard-3-line text-lg text-teal-400"></i>
                  </div>
                  <h2 className="text-lg font-bold text-white">Status Snapshot</h2>
                </div>
                <button onClick={fetchStatusSnapshot} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] text-slate-500 hover:text-white transition-all cursor-pointer" title="Refresh snapshot">
                  <i className="ri-refresh-line text-sm"></i>
                </button>
              </div>

              {!selectedJobId ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 bg-[#0a1628] rounded-xl flex items-center justify-center mx-auto mb-3 ring-1 ring-[#1a2b4a]">
                    <i className="ri-eye-off-line text-2xl text-slate-500"></i>
                  </div>
                  <p className="text-sm text-slate-500">Select a job to view live DB status</p>
                </div>
              ) : snapshotError ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mx-auto mb-3 ring-1 ring-red-500/20">
                    <i className="ri-error-warning-line text-2xl text-red-400"></i>
                  </div>
                  <p className="text-sm text-red-400 font-medium">Failed to load snapshot</p>
                  <p className="text-xs text-slate-500 mt-1">The edge function returned an error</p>
                  <button onClick={fetchStatusSnapshot} className="mt-3 px-4 py-2 bg-[#1a2b4a] hover:bg-[#223456] text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-refresh-line mr-1.5"></i>Retry
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Job Payment Status', value: snapshot?.job?.payment_status, icon: 'ri-briefcase-line' },
                    { label: 'Job Status', value: snapshot?.job?.status, icon: 'ri-flag-line' },
                    { label: 'Assignment Status', value: snapshot?.assignment?.status, icon: 'ri-user-settings-line' },
                    { label: 'Assignment Payment', value: snapshot?.assignment?.payment_status, icon: 'ri-secure-payment-line' },
                    { label: 'Transaction Status', value: snapshot?.transaction?.status, icon: 'ri-bank-card-line' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between bg-[#0a1628] rounded-xl px-4 py-3 border border-[#1a2b4a]">
                      <span className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <i className={`${row.icon} text-sm text-slate-500`}></i>
                        {row.label}
                      </span>
                      {statusBadge(row.value)}
                    </div>
                  ))}

                  <div className="bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Stripe Session ID</span>
                      <span className="text-slate-400 font-mono text-[11px] truncate ml-2 max-w-[200px]">{snapshot?.transaction?.stripe_session_id || snapshot?.job?.stripe_session_id || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Stripe Payment Intent</span>
                      <span className="text-slate-400 font-mono text-[11px] truncate ml-2 max-w-[200px]">{snapshot?.transaction?.stripe_payment_intent || snapshot?.job?.stripe_payment_intent_id || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Stripe Transfer ID</span>
                      <span className="text-slate-400 font-mono text-[11px] truncate ml-2 max-w-[200px]">{snapshot?.assignment?.stripe_transfer_id || snapshot?.payout?.stripe_transfer_id || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Guard Payout Amount</span>
                      <span className="text-white font-bold">{snapshot?.payout?.amount ? `£${Number(snapshot.payout.amount).toFixed(2)}` : snapshot?.assignment?.guard_net_payout ? `£${Number(snapshot.assignment.guard_net_payout).toFixed(2)}` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Platform Fee</span>
                      <span className="text-slate-400">{snapshot?.job?.platform_fee ? `£${Number(snapshot.job.platform_fee).toFixed(2)}` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Completion Request</span>
                      <span className="text-slate-400">{snapshot?.completionRequest ? statusBadge(snapshot.completionRequest.status) : '—'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Release Confirmation Modal */}
      {showReleaseConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="bg-[#111d35] rounded-2xl max-w-md w-full border border-[#1a2b4a] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500/10">
                <i className="ri-alert-line text-xl text-amber-400"></i>
              </div>
              <h3 className="text-lg font-bold text-white">Confirm Guard Payment Release</h3>
            </div>
            <p className="text-sm text-slate-400 mb-2">This will create a real Stripe test transfer to the guard&apos;s connected account.</p>
            <div className="bg-[#0a1628] rounded-xl border border-[#1a2b4a] p-3 mb-5 space-y-1 text-sm">
              <p className="text-slate-400">Amount: <span className="text-white font-bold">£{parseFloat(testAmount).toFixed(2)}</span></p>
              <p className="text-slate-400">Guard: <span className="text-white">{guards.find((g: any) => g.id === selectedGuardId)?.full_name || selectedGuardId}</span></p>
              <p className="text-slate-400">Assignment: <span className="text-white font-mono text-xs">{selectedAssignmentId?.slice(0, 12)}...</span></p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowReleaseConfirm(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-[#1a2b4a] text-slate-300 font-semibold text-sm hover:bg-[#223456] transition-colors cursor-pointer whitespace-nowrap">Cancel</button>
              <button onClick={handleReleaseGuard} disabled={!!actionLoading} className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">Release</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="bg-[#111d35] rounded-2xl max-w-md w-full border border-[#1a2b4a] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10">
                <i className="ri-error-warning-line text-xl text-red-400"></i>
              </div>
              <h3 className="text-lg font-bold text-white">Reset Test Flow</h3>
            </div>
            <p className="text-sm text-slate-400 mb-5">This will revert the selected job, assignment, transaction, and completion request back to unpaid/pending test state. No production records will be deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowResetConfirm(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-[#1a2b4a] text-slate-300 font-semibold text-sm hover:bg-[#223456] transition-colors cursor-pointer whitespace-nowrap">Cancel</button>
              <button onClick={handleReset} disabled={!!actionLoading} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-24 right-6 z-50 shadow-lg px-5 py-3 rounded-xl flex items-center gap-3 animate-bounce-in ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <i className={`text-lg ${toast.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'}`}></i>
          <span className="text-sm font-medium max-w-md">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-white/70 hover:text-white cursor-pointer"><i className="ri-close-line"></i></button>
        </div>
      )}
    </div>
  );
}