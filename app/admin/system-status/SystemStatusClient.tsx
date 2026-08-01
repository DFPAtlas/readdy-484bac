'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import StorageUsageWidget from '@/components/admin/StorageUsageWidget';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vnywjfpkepjgclkbcmsj.supabase.co';
const WEBSITE_URL = 'https://quickguard.uk';

// ── Types ──────────────────────────────────────────────────────────────

interface AdminStatusData {
  status: string;
  timestamp: string;
  version: string;
  instance: string;
  checks: Record<string, HealthCheck>;
  schema_errors?: string[];
  metrics: {
    failed_emails_24h: number;
    failed_payments_24h: number;
    failed_sub_payments_24h: number;
    failed_txn_payments_24h: number;
    unread_admin_alerts: number;
    jobs_posted_24h: number;
    active_users_24h: number;
    active_guards_24h: number;
    active_clients_24h: number;
  };
  payment_pipeline: {
    counts: Record<string, number>;
    stuck: {
      funded_over_24h: number;
      awaiting_release_over_72h: number;
      pending_payouts: number;
      failed_payouts: number;
    };
    values: {
      total_unreleased_client: number;
      total_guard_payout_pending: number;
    };
  };
  cron_jobs: CronJobData[];
  cleanup: {
    status: string;
    last_run: { table: string; at: string; rows_removed: number } | null;
    last_failure: { table: string; at: string; error: string } | null;
  };
}

interface HealthCheck {
  status: string;
  latency_ms?: number;
  error?: string;
}

interface CronJobData {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: {
    status: string;
    start_time: string;
    end_time: string;
    return_message: string;
  } | null;
  run_count_7d: number;
}

interface EdgeFunctionPing {
  name: string;
  slug: string;
  status: 'healthy' | 'degraded' | 'offline';
  latency: number;
  httpStatus: number;
  error?: string;
  checkedAt: string;
}

interface WebsitePing {
  status: 'healthy' | 'degraded' | 'offline';
  latency: number;
  httpStatus: number;
  error?: string;
  checkedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  if (n === 0) return '£0.00';
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStatusBadge(status: string | undefined) {
  switch (status) {
    case 'healthy':
    case 'configured':
      return { label: 'Online', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    case 'degraded':
      return { label: 'Degraded', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    case 'critical':
    case 'unhealthy':
      return { label: 'Offline', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
    case 'not_configured':
      return { label: 'Not Set', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    default:
      return { label: 'Unknown', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
  }
}

function getPaymentStatusColor(status: string): string {
  switch (status) {
    case 'paid': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'paid_out': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'pending': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'funded': return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
    case 'awaiting_client_release': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'client_released': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'payout_processing': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'refunded': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    case 'disputed': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
}

function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    paid: 'Paid',
    unpaid: 'Unpaid',
    payment_pending: 'Payment Pending',
    funded: 'Funded',
    awaiting_client_release: 'Awaiting Release',
    client_released: 'Client Released',
    payout_processing: 'Payout Processing',
    paid_out: 'Paid Out',
    failed: 'Failed',
    refunded: 'Refunded',
    disputed: 'Disputed',
  };
  return labels[status] || status;
}

// ── Edge functions to ping ─────────────────────────────────────────────

const EDGE_FUNCTIONS: { name: string; slug: string; type: string; retired?: boolean }[] = [
  { name: 'Create Job Payment', slug: 'create-job-payment', type: 'payment' },
  { name: 'Create Guard Payout', slug: 'create-guard-payout', type: 'payment' },
  { name: 'Release Guard Payment (Retired)', slug: 'release-guard-payment', type: 'payment', retired: true },
  { name: 'Auto-Release Guard Payments', slug: 'auto-release-guard-payments', type: 'payment' },
  { name: 'Enhanced Stripe Webhook', slug: 'enhanced-stripe-webhook', type: 'stripe' },
  { name: 'Get Storage Usage', slug: 'get-storage-usage', type: 'storage' },
  { name: 'Run Cleanup Now', slug: 'run-cleanup-now', type: 'maintenance' },
];

// ── Main Component ─────────────────────────────────────────────────────

export default function SystemStatusClient() {
  const [adminData, setAdminData] = useState<AdminStatusData | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);

  const [websitePing, setWebsitePing] = useState<WebsitePing | null>(null);
  const [websiteLoading, setWebsiteLoading] = useState(true);

  const [edgePings, setEdgePings] = useState<EdgeFunctionPing[]>([]);
  const [edgeLoading, setEdgeLoading] = useState(true);

  const [cleanupLogs, setCleanupLogs] = useState<any[]>([]);
  const [cleanupLogsLoading, setCleanupLogsLoading] = useState(true);

  const [tableSizes, setTableSizes] = useState<Record<string, string>>();
  const [tableSizesLoading, setTableSizesLoading] = useState(true);

  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ ok: number; fail: number } | null>(null);

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logPage, setLogPage] = useState(0);
  const [logTotalCount, setLogTotalCount] = useState(0);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  const refreshingRef = useRef(false);
  const PER_PAGE = 15;

  // ── Fetch admin status (privileged data) ─────────────────────────────
  const fetchAdminStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-system-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Admin status endpoint returned ${res.status}`);
      }
      const data: AdminStatusData = await res.json();
      setAdminData(data);
      setAdminError(null);
    } catch (e: any) {
      setAdminError(e?.message || 'Failed to load admin status');
    } finally {
      setAdminLoading(false);
    }
  }, []);

  // ── Ping website ───────────────────────────────────────────────────
  const pingWebsite = useCallback(async () => {
    setWebsiteLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const start = performance.now();
    try {
      const res = await fetch(WEBSITE_URL, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
        redirect: 'follow',
      });
      clearTimeout(timeout);
      const latency = Math.round(performance.now() - start);
      const healthy = res.ok || (res.status >= 300 && res.status < 400);
      setWebsitePing({
        status: healthy ? 'healthy' : res.status >= 500 ? 'degraded' : 'healthy',
        latency,
        httpStatus: res.status,
        error: healthy ? undefined : `HTTP ${res.status}`,
        checkedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      clearTimeout(timeout);
      setWebsitePing({
        status: 'offline',
        latency: Math.round(performance.now() - start),
        httpStatus: 0,
        error: e.name === 'AbortError' ? 'Request timed out' : e.message,
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setWebsiteLoading(false);
    }
  }, []);

  // ── Ping edge functions ──────────────────────────────────────────────
  const pingEdgeFunctions = useCallback(async () => {
    setEdgeLoading(true);
    const pings: EdgeFunctionPing[] = [];

    let token = '';
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token || '';

    await Promise.all(
      EDGE_FUNCTIONS.map(async (fn) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const start = performance.now();
        try {
          const isRetired = fn.retired === true;
          const method = isRetired ? 'POST' : 'GET';
          const headers: Record<string, string> = {};
          if (isRetired && token) {
            headers['Authorization'] = `Bearer ${token}`;
            headers['Content-Type'] = 'application/json';
          }

          const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn.slug}`, {
            method,
            signal: controller.signal,
            cache: 'no-store',
            headers: Object.keys(headers).length ? headers : undefined,
            body: isRetired ? '' : undefined,
          });
          clearTimeout(timeout);
          const latency = Math.round(performance.now() - start);

          if (isRetired) {
            if (!token) {
              pings.push({
                name: fn.name,
                slug: fn.slug,
                status: 'degraded',
                latency,
                httpStatus: 0,
                error: 'Auth required for verification — sign in as admin',
                checkedAt: new Date().toISOString(),
              });
            } else if (res.status === 410) {
              pings.push({
                name: fn.name,
                slug: fn.slug,
                status: 'healthy',
                latency,
                httpStatus: 410,
                error: 'Retired: returns 410 as expected',
                checkedAt: new Date().toISOString(),
              });
            } else if (res.status === 403) {
              pings.push({
                name: fn.name,
                slug: fn.slug,
                status: 'degraded',
                latency,
                httpStatus: res.status,
                error: 'Auth check passed but role denied 403',
                checkedAt: new Date().toISOString(),
              });
            } else if (res.status === 401) {
              pings.push({
                name: fn.name,
                slug: fn.slug,
                status: 'degraded',
                latency,
                httpStatus: res.status,
                error: 'JWT validation failed 401',
                checkedAt: new Date().toISOString(),
              });
            } else if (res.status >= 500) {
              pings.push({
                name: fn.name,
                slug: fn.slug,
                status: 'offline',
                latency,
                httpStatus: res.status,
                error: `Unexpected HTTP ${res.status} — retired function should return 410`,
                checkedAt: new Date().toISOString(),
              });
            } else {
              pings.push({
                name: fn.name,
                slug: fn.slug,
                status: 'degraded',
                latency,
                httpStatus: res.status,
                error: `Expected 410, got HTTP ${res.status}`,
                checkedAt: new Date().toISOString(),
              });
            }
          } else {
            const isError = res.status >= 500;
            pings.push({
              name: fn.name,
              slug: fn.slug,
              status: isError ? 'degraded' : 'healthy',
              latency,
              httpStatus: res.status,
              error: isError ? `HTTP ${res.status}` : undefined,
              checkedAt: new Date().toISOString(),
            });
          }
        } catch (e: any) {
          clearTimeout(timeout);
          pings.push({
            name: fn.name,
            slug: fn.slug,
            status: 'offline',
            latency: Math.round(performance.now() - start),
            httpStatus: 0,
            error: e.name === 'AbortError' ? 'Timed out' : e.message,
            checkedAt: new Date().toISOString(),
          });
        }
      })
    );

    setEdgePings(pings);
    setEdgeLoading(false);
  }, []);

  // ── Fetch cleanup logs ───────────────────────────────────────────────
  const fetchCleanupLogs = useCallback(async () => {
    setCleanupLogsLoading(true);
    try {
      const { data } = await supabase.schema('public').from('cleanup_log').select('*').order('started_at', { ascending: false }).limit(20);
      setCleanupLogs(data || []);
    } catch {
      setCleanupLogs([]);
    } finally {
      setCleanupLogsLoading(false);
    }
  }, []);

  // ── Fetch table sizes ────────────────────────────────────────────────
  const fetchTableSizes = useCallback(async () => {
    setTableSizesLoading(true);
    const tables = [
      'email_send_log', 'admin_registration_audit', 'email_queue',
      'rate_limit_events', 'notifications', 'processed_stripe_events',
    ];
    const results: Record<string, string> = {};
    await Promise.all(
      tables.map(async (table) => {
        try {
          const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
          results[table] = count !== null ? `${count.toLocaleString('en-GB')} rows` : '? rows';
        } catch {
          results[table] = '? rows';
        }
      })
    );
    setTableSizes(results);
    setTableSizesLoading(false);
  }, []);

  // ── Run cleanup ──────────────────────────────────────────────────────
  const runCleanup = useCallback(async () => {
    setCleanupRunning(true);
    setCleanupResult(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/run-cleanup-now`, { method: 'POST' });
      const data = await res.json();
      const results = data.results as Record<string, { status: string }>;
      const ok = Object.values(results).filter((r: any) => r.status === 'completed').length;
      const fail = Object.values(results).filter((r: any) => r.status === 'failed').length;
      setCleanupResult({ ok, fail });
      // Immediate refresh
      await fetchCleanupLogs();
    } catch {
      setCleanupResult({ ok: 0, fail: 6 });
    } finally {
      setCleanupRunning(false);
    }
  }, [fetchCleanupLogs]);

  // ── Open full log modal ──────────────────────────────────────────────
  const openFullLog = useCallback(async (page: number) => {
    setLogLoading(true);
    try {
      const from = page * PER_PAGE;
      const to = from + PER_PAGE - 1;
      const [{ count }, { data }] = await Promise.all([
        supabase.schema('public').from('cleanup_log').select('*', { count: 'exact', head: true }),
        supabase.schema('public').from('cleanup_log').select('*').order('started_at', { ascending: false }).range(from, to),
      ]);
      setLogTotalCount(count ?? 0);
      setAllLogs(data ?? []);
      setLogPage(page);
    } catch {
      setLogTotalCount(0);
      setAllLogs([]);
    }
    setLogLoading(false);
  }, []);

  // ── Master refresh ─────────────────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);

    await Promise.allSettled([
      fetchAdminStatus(),
      pingWebsite(),
      pingEdgeFunctions(),
      fetchCleanupLogs(),
      fetchTableSizes(),
    ]);

    setLastRefreshed(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    refreshingRef.current = false;
    setIsRefreshing(false);
  }, [fetchAdminStatus, pingWebsite, pingEdgeFunctions, fetchCleanupLogs, fetchTableSizes]);

  // ── Effects ──────────────────────────────────────────────────────────
  useEffect(() => {
    refreshAll();
    const interval = setInterval(() => refreshAll(), 30000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  // ── Derived status ───────────────────────────────────────────────────
  const overall = (() => {
    if (adminLoading) return { label: 'Checking...', color: 'text-slate-400', icon: 'ri-loader-4-line animate-spin' };
    if (adminError || !adminData) return { label: 'Unreachable', color: 'text-red-400', icon: 'ri-close-circle-line' };
    switch (adminData.status) {
      case 'healthy': return { label: 'All Systems Operational', color: 'text-emerald-400', icon: 'ri-check-double-line' };
      case 'degraded': return { label: 'Degraded Service', color: 'text-amber-400', icon: 'ri-error-warning-line' };
      default: return { label: 'Service Disruption', color: 'text-red-400', icon: 'ri-close-circle-line' };
    }
  })();

  const health = adminData;

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0B1933]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-900/50">
                <i className="ri-heart-pulse-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight tracking-tight">System Status</h1>
                <p className="text-[11px] text-slate-500 font-medium">Infrastructure & operational health</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lastRefreshed && (
                <span className="text-[11px] text-slate-600 hidden sm:inline">
                  Refreshed {lastRefreshed}
                </span>
              )}
              {isRefreshing && (
                <span className="text-[11px] text-teal-400 flex items-center gap-1.5">
                  <i className="ri-loader-4-line animate-spin text-xs"></i>
                  Refreshing…
                </span>
              )}
              <button
                onClick={refreshAll}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-refresh-line text-base"></i>
                </div>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-8">

        {/* Global error */}
        {adminError && (
          <div className="rounded-2xl border-l-[5px] border-l-red-500 p-5 shadow-sm bg-[#111d35] flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-500/10 text-red-400">
              <i className="ri-error-warning-line text-lg"></i>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white">Admin status endpoint unreachable</h3>
              <p className="text-sm text-slate-400 mt-1">{adminError}</p>
            </div>
          </div>
        )}

        {/* Schema errors */}
        {adminData?.schema_errors && adminData.schema_errors.length > 0 && (
          <div className="rounded-2xl border-l-[5px] border-l-amber-500 p-5 shadow-sm bg-[#111d35] flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-500/10 text-amber-400">
              <i className="ri-alert-line text-lg"></i>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-amber-400">Schema Query Warnings</h3>
              <p className="text-xs text-slate-400 mt-1 mb-2">Some backend queries encountered errors. Metrics may be incomplete.</p>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {adminData.schema_errors.map((err, i) => (
                  <li key={i} className="text-[10px] text-amber-300/80 font-mono leading-relaxed">{err}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Overall status banner */}
        <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-6">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 flex items-center justify-center rounded-2xl ${
              health?.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400' :
              health?.status === 'degraded' ? 'bg-amber-500/10 text-amber-400' :
              'bg-red-500/10 text-red-400'
            }`}>
              <i className={`${overall.icon} text-2xl`}></i>
            </div>
            <div className="flex-1">
              <h2 className={`text-xl font-extrabold ${overall.color}`}>{overall.label}</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                {health ? `Last checked ${new Date(health.timestamp).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: 'numeric', month: 'short' })}` : 'No data available'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-medium text-slate-600 block">v{health?.version || '0.0.0'}</span>
              <span className="text-[10px] text-slate-700">{health?.instance || ''}</span>
            </div>
          </div>
        </div>

        {/* Infrastructure */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Infrastructure</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Website */}
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0a1628] text-slate-400">
                    <i className="ri-global-line text-lg"></i>
                  </div>
                  <span className="text-sm font-bold text-white">Website</span>
                </div>
                {websiteLoading ? (
                  <span className="text-[10px] text-slate-600">Checking…</span>
                ) : websitePing ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${getStatusBadge(websitePing.status).color}`}>
                    {getStatusBadge(websitePing.status).label}
                  </span>
                ) : (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${getStatusBadge(undefined).color}`}>
                    Unknown
                  </span>
                )}
              </div>
              {websitePing && !websiteLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-timer-line text-[10px]"></i>
                  </div>
                  <span>{websitePing.latency}ms · HTTP {websitePing.httpStatus || '—'}</span>
                </div>
              )}
              {websitePing?.error && (
                <p className="text-[10px] text-red-400 mt-2 leading-relaxed">{websitePing.error}</p>
              )}
            </div>

            {/* Database */}
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0a1628] text-slate-400">
                    <i className="ri-database-2-line text-lg"></i>
                  </div>
                  <span className="text-sm font-bold text-white">Supabase DB</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${getStatusBadge(health?.checks?.database?.status).color}`}>
                  {getStatusBadge(health?.checks?.database?.status).label}
                </span>
              </div>
              {health?.checks?.database?.latency_ms !== undefined && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-timer-line text-[10px]"></i>
                  </div>
                  <span>{health.checks.database.latency_ms}ms response</span>
                </div>
              )}
              {health?.checks?.database?.error && (
                <p className="text-[10px] text-red-400 mt-2 leading-relaxed">{health.checks.database.error}</p>
              )}
            </div>

            {/* Stripe */}
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0a1628] text-slate-400">
                    <i className="ri-bank-card-line text-lg"></i>
                  </div>
                  <span className="text-sm font-bold text-white">Stripe API</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${getStatusBadge(health?.checks?.stripe?.status).color}`}>
                  {getStatusBadge(health?.checks?.stripe?.status).label}
                </span>
              </div>
              {health?.checks?.stripe?.latency_ms !== undefined && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className="ri-timer-line text-[10px]"></i>
                  </div>
                  <span>{health.checks.stripe.latency_ms}ms response</span>
                </div>
              )}
              {health?.checks?.stripe?.error && (
                <p className="text-[10px] text-red-400 mt-2 leading-relaxed">{health.checks.stripe.error}</p>
              )}
            </div>

            {/* Email */}
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0a1628] text-slate-400">
                    <i className="ri-mail-send-line text-lg"></i>
                  </div>
                  <span className="text-sm font-bold text-white">Email (SMTP)</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${getStatusBadge(health?.checks?.email?.status).color}`}>
                  {getStatusBadge(health?.checks?.email?.status).label}
                </span>
              </div>
              {health?.checks?.email?.status === 'not_configured' && (
                <p className="text-[10px] text-amber-400 mt-2">SMTP credentials not set</p>
              )}
            </div>
          </div>
        </section>

        {/* Edge Functions Health */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Edge Functions</h2>
            {edgeLoading && (
              <span className="text-[11px] text-slate-600 flex items-center gap-1.5">
                <i className="ri-loader-4-line animate-spin text-xs"></i>
                Pinging…
              </span>
            )}
          </div>
          {edgeLoading && !edgePings.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5 animate-pulse">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-32 h-4 bg-[#1a2b4a] rounded"></div>
                    <div className="w-14 h-5 bg-[#1a2b4a] rounded-full"></div>
                  </div>
                  <div className="w-20 h-3 bg-[#1a2b4a] rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {EDGE_FUNCTIONS.map((fn) => {
                const ping = edgePings.find((p) => p.slug === fn.slug);
                const badge = getStatusBadge(ping?.status);
                return (
                  <div key={fn.slug} className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0a1628] text-slate-400">
                          <i className={`${
                            fn.type === 'payment' ? 'ri-money-pound-circle-line' :
                            fn.type === 'stripe' ? 'ri-bank-card-line' :
                            fn.type === 'storage' ? 'ri-database-2-line' :
                            'ri-tools-line'
                          } text-lg`}></i>
                        </div>
                        <span className="text-sm font-bold text-white">{fn.name}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    {ping && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-3 h-3 flex items-center justify-center">
                          <i className="ri-timer-line text-[10px]"></i>
                        </div>
                        <span>{ping.latency}ms · HTTP {ping.httpStatus || '—'}</span>
                      </div>
                    )}
                    {ping?.error && (
                      <p className={`text-[10px] mt-2 leading-relaxed ${
                        fn.retired && ping.status === 'healthy' ? 'text-emerald-400' :
                        fn.retired && ping.status === 'degraded' ? 'text-amber-400' :
                        'text-red-400'
                      }`}>{ping.error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Payment Pipeline */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Payment Pipeline</h2>
            {adminLoading && (
              <span className="text-[11px] text-slate-600 flex items-center gap-1.5">
                <i className="ri-loader-4-line animate-spin text-xs"></i>
                Loading…
              </span>
            )}
          </div>

          {adminLoading && !adminData ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5 animate-pulse">
                  <div className="w-24 h-3 bg-[#1a2b4a] rounded mb-3"></div>
                  <div className="w-12 h-6 bg-[#1a2b4a] rounded"></div>
                </div>
              ))}
            </div>
          ) : adminData?.payment_pipeline ? (
            <div className="space-y-6">
              {/* Status count cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-5 gap-4">
                {Object.entries(adminData.payment_pipeline.counts)
                  .filter(([status]) => status !== 'unpaid' || adminData.payment_pipeline.counts[status] > 0)
                  .map(([status, count]) => (
                    <div key={status} className={`bg-[#111d35] rounded-2xl border p-5 ${count > 0 ? 'border-[#1a2b4a]' : 'border-[#1a2b4a]/50 opacity-60'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${getPaymentStatusColor(status)}`}>
                          {getPaymentStatusLabel(status)}
                        </span>
                      </div>
                      <p className={`text-2xl font-extrabold ${count > 0 ? 'text-white' : 'text-slate-600'}`}>
                        {count}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-1">assignments</p>
                    </div>
                  ))}
              </div>

              {/* Stuck assignments & values */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Stuck panel */}
                <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                      <i className="ri-alert-line text-sm"></i>
                    </div>
                    Stuck Assignments
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Funded over 24h', value: adminData.payment_pipeline.stuck.funded_over_24h, color: 'amber', icon: 'ri-time-line' },
                      { label: 'Awaiting release over 72h', value: adminData.payment_pipeline.stuck.awaiting_release_over_72h, color: 'red', icon: 'ri-hourglass-line', highlight: true },
                      { label: 'Pending payouts', value: adminData.payment_pipeline.stuck.pending_payouts, color: 'blue', icon: 'ri-loader-2-line' },
                      { label: 'Failed payouts', value: adminData.payment_pipeline.stuck.failed_payouts, color: 'red', icon: 'ri-close-circle-line' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 flex items-center justify-center rounded-lg ${
                            item.color === 'amber' ? 'bg-amber-500/10 text-amber-400' :
                            item.color === 'red' ? 'bg-red-500/10 text-red-400' :
                            'bg-blue-500/10 text-blue-400'
                          }`}>
                            <i className={`${item.icon} text-xs`}></i>
                          </div>
                          <span className={`text-sm ${item.highlight && item.value > 0 ? 'text-amber-300 font-semibold' : 'text-slate-400'}`}>
                            {item.label}
                          </span>
                        </div>
                        <span className={`text-sm font-extrabold ${
                          item.value > 0 ?
                            item.color === 'red' ? 'text-red-400' :
                            item.color === 'amber' ? 'text-amber-400' :
                            'text-blue-400'
                          : 'text-slate-600'
                        }`}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  {adminData.payment_pipeline.stuck.awaiting_release_over_72h > 0 && (
                    <div className="mt-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                      <p className="text-[11px] text-amber-300 leading-relaxed">
                        <i className="ri-information-line mr-1"></i>
                        {adminData.payment_pipeline.stuck.awaiting_release_over_72h} assignment{adminData.payment_pipeline.stuck.awaiting_release_over_72h > 1 ? 's' : ''} past the 72-hour auto-release window. The auto-release cron runs every 6 hours.
                      </p>
                    </div>
                  )}
                </div>

                {/* Value summary */}
                <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                      <i className="ri-funds-line text-sm"></i>
                    </div>
                    Value Summary
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Total unreleased client funds</span>
                      <span className="text-lg font-extrabold text-white">
                        {formatCurrency(adminData.payment_pipeline.values.total_unreleased_client)}
                      </span>
                    </div>
                    <div className="w-full h-px bg-[#1a2b4a]"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Total guard payout pending</span>
                      <span className="text-lg font-extrabold text-white">
                        {formatCurrency(adminData.payment_pipeline.values.total_guard_payout_pending)}
                      </span>
                    </div>
                    <div className="w-full h-px bg-[#1a2b4a]"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Held by QuickGuard</span>
                      <span className="text-lg font-extrabold text-amber-400">
                        {formatCurrency(
                          adminData.payment_pipeline.values.total_unreleased_client -
                          adminData.payment_pipeline.values.total_guard_payout_pending
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Cron Jobs */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Scheduled Jobs</h2>
            {adminLoading && (
              <span className="text-[11px] text-slate-600 flex items-center gap-1.5">
                <i className="ri-loader-4-line animate-spin text-xs"></i>
                Loading…
              </span>
            )}
          </div>
          {adminLoading && !adminData ? (
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5 animate-pulse">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-32 h-4 bg-[#1a2b4a] rounded"></div>
                    <div className="w-20 h-4 bg-[#1a2b4a] rounded"></div>
                    <div className="w-16 h-4 bg-[#1a2b4a] rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : adminData?.cron_jobs && adminData.cron_jobs.length > 0 ? (
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1a2b4a] bg-[#0a1628]">
                      <th className="text-left px-4 py-3 font-semibold text-slate-400">Job</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-400">Schedule</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-400">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-400">Last Run</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-400">7d Runs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2b4a]">
                    {adminData.cron_jobs.map((job) => {
                      const isAutoRelease = job.jobname === 'auto-release-guard-payments';
                      return (
                        <tr key={job.jobid} className={`hover:bg-[#0a1628]/50 transition-colors ${isAutoRelease ? 'bg-teal-500/5' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isAutoRelease && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400 whitespace-nowrap">AUTO</span>
                              )}
                              <span className="text-white font-mono text-[11px]">{job.jobname}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-400 font-mono text-[11px]">{job.schedule}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                              job.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                            }`}>
                              {job.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {job.last_run ? (
                              <div className="space-y-0.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                  job.last_run.status === 'succeeded' ? 'bg-emerald-500/10 text-emerald-400' :
                                  job.last_run.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                                  'bg-amber-500/10 text-amber-400'
                                }`}>
                                  {job.last_run.status}
                                </span>
                                <span className="text-[10px] text-slate-600 block">
                                  {new Date(job.last_run.start_time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-600">Never run</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-slate-400 font-mono text-[11px]">{job.run_count_7d}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : adminData?.cron_jobs && adminData.cron_jobs.length === 0 ? (
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-8 text-center">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0a1628] text-slate-600 mx-auto mb-3">
                <i className="ri-calendar-line text-lg"></i>
              </div>
              <p className="text-sm text-slate-500">No cron jobs configured</p>
              <p className="text-[11px] text-slate-700 mt-1">Jobs will appear here once scheduled via pg_cron</p>
            </div>
          ) : null}
        </section>

        {/* Application Metrics — Last 24 Hours */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Application Metrics — Last 24 Hours</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Failed Emails', value: health?.metrics?.failed_emails_24h ?? 0, icon: 'ri-mail-close-line', critical: (health?.metrics?.failed_emails_24h ?? 0) > 0, href: '/admin/email-queue' },
              { label: 'Failed Payments', value: health?.metrics?.failed_payments_24h ?? 0, icon: 'ri-money-pound-circle-line', critical: (health?.metrics?.failed_payments_24h ?? 0) > 0, href: '/admin/failed-payments', detail: `${health?.metrics?.failed_sub_payments_24h ?? 0} subs / ${health?.metrics?.failed_txn_payments_24h ?? 0} txns` },
              { label: 'Jobs Posted', value: health?.metrics?.jobs_posted_24h ?? 0, icon: 'ri-briefcase-line', critical: false, href: '/admin/jobs' },
              { label: 'Active Users', value: health?.metrics?.active_users_24h ?? 0, icon: 'ri-user-line', critical: false, href: '/admin/accounts', detail: `${health?.metrics?.active_guards_24h ?? 0} guards / ${health?.metrics?.active_clients_24h ?? 0} clients` },
              { label: 'Admin Alerts', value: health?.metrics?.unread_admin_alerts ?? 0, icon: 'ri-notification-3-line', critical: (health?.metrics?.unread_admin_alerts ?? 0) > 0, href: '/admin/dashboard' },
            ].map((metric) => (
              <Link
                key={metric.label}
                href={metric.href}
                className={`bg-[#111d35] rounded-2xl border p-5 transition-all cursor-pointer hover:border-teal-500/30 ${
                  metric.critical ? 'border-red-500/30' : 'border-[#1a2b4a]'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 flex items-center justify-center rounded-xl ${metric.critical ? 'bg-red-500/10 text-red-400' : 'bg-[#0a1628] text-slate-400'}`}>
                    <i className={`${metric.icon} text-lg`}></i>
                  </div>
                  {metric.critical && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                </div>
                <p className={`text-2xl font-extrabold ${metric.critical ? 'text-red-400' : 'text-white'}`}>
                  {metric.value}
                </p>
                <p className="text-xs text-slate-500 font-medium mt-1">{metric.label}</p>
                {metric.detail && (
                  <p className="text-[10px] text-slate-600 mt-0.5">{metric.detail}</p>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* Database Maintenance */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Database Maintenance</h2>
              <div className="flex items-center gap-2">
                {cleanupResult && (
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cleanupResult.fail > 0 ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'}`}>
                    {cleanupResult.ok} done{cleanupResult.fail > 0 ? ` / ${cleanupResult.fail} failed` : ''}
                  </span>
                )}
                <button
                  onClick={runCleanup}
                  disabled={cleanupRunning}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-teal-600 text-white hover:bg-teal-500 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-3 h-3 flex items-center justify-center">
                    <i className={`${cleanupRunning ? 'ri-loader-4-line animate-spin' : 'ri-play-line'} text-xs`}></i>
                  </div>
                  {cleanupRunning ? 'Running…' : 'Run Cleanup Now'}
                </button>
              </div>
            </div>

            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1a2b4a] bg-[#0a1628]">
                      <th className="text-left px-4 py-3 font-semibold text-slate-400">Table</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-400">Retention</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-400">Size</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-400">Last Run</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2b4a]">
                    {[
                      { table: 'email_send_log', retention: '90 days', icon: 'ri-mail-line' },
                      { table: 'admin_registration_audit', retention: '180 days', icon: 'ri-admin-line' },
                      { table: 'email_queue', retention: '90 days', icon: 'ri-stack-line' },
                      { table: 'rate_limit_events', retention: '7 days', icon: 'ri-speed-mini-line' },
                      { table: 'notifications', retention: '180 days', icon: 'ri-notification-line' },
                      { table: 'processed_stripe_events', retention: '365 days', icon: 'ri-bank-card-line' },
                    ].map((row) => {
                      const log = cleanupLogs.find((l: any) => l.table_name === row.table && l.status === 'completed');
                      const failLog = cleanupLogs.find((l: any) => l.table_name === row.table && l.status === 'failed');
                      return (
                        <tr key={row.table} className="hover:bg-[#0a1628]/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 flex items-center justify-center rounded-md bg-[#0a1628] text-teal-400">
                                <i className={`${row.icon} text-[11px]`}></i>
                              </div>
                              <span className="text-white font-mono text-[11px]">{row.table}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className="text-slate-400 text-[11px]">{row.retention}</span></td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-slate-400 text-[11px]">
                              {tableSizesLoading ? '…' : (tableSizes[row.table] || '-')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {failLog ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 whitespace-nowrap">Failed</span>
                            ) : log ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 whitespace-nowrap">
                                {new Date(log.started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Cleanup Activity */}
            <div className="mt-4 bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-slate-400">Recent Cleanup Activity</p>
                {cleanupLogs.length > 0 && (
                  <button
                    onClick={() => { setLogModalOpen(true); openFullLog(0); }}
                    className="text-[10px] font-semibold text-teal-400 hover:text-teal-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    View Full Log
                  </button>
                )}
              </div>
              {cleanupLogsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <i className="ri-loader-4-line animate-spin text-teal-400 text-sm"></i>
                </div>
              ) : cleanupLogs.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-[11px] text-slate-600">No cleanup activity logged yet.</p>
                  <p className="text-[10px] text-slate-700 mt-1">Run Cleanup Now to populate this section.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cleanupLogs.slice(0, 5).map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${log.status === 'completed' ? 'bg-emerald-500' : log.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                        <span className="text-slate-400 font-mono">{log.table_name}</span>
                        <span className="text-slate-600">{log.retention_days}d, {log.rows_removed} removed</span>
                      </div>
                      <span className={`font-medium ${log.status === 'completed' ? 'text-emerald-400' : log.status === 'failed' ? 'text-red-400' : 'text-amber-400'}`}>
                        {log.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Uptime Monitoring Setup */}
          <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Uptime Monitoring Setup</h2>
            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-white mb-2">Health Endpoints</p>
                <div className="space-y-2">
                  {[
                    { url: `${SUPABASE_URL}/functions/v1/system-health`, label: 'Public Health (JSON)' },
                    { url: `${SUPABASE_URL}/functions/v1/admin-system-status`, label: 'Admin Status (Auth)' },
                  ].map((check) => (
                    <div key={check.url} className="flex items-center gap-3 text-xs">
                      <div className="w-4 h-4 flex items-center justify-center text-slate-600">
                        <i className="ri-link text-sm"></i>
                      </div>
                      <code className="text-slate-400 font-mono text-[11px] truncate flex-1">{check.url}</code>
                      <span className="text-[10px] text-slate-600 font-medium whitespace-nowrap">{check.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-[#1a2b4a] pt-4">
                <p className="text-sm font-semibold text-white mb-2">Page Checks</p>
                <div className="space-y-2">
                  {[
                    { url: WEBSITE_URL, label: 'Homepage' },
                    { url: `${WEBSITE_URL}/client/login`, label: 'Client Login' },
                    { url: `${WEBSITE_URL}/guard/login`, label: 'Guard Login' },
                    { url: `${WEBSITE_URL}/admin/login`, label: 'Admin Login' },
                  ].map((check) => (
                    <div key={check.url} className="flex items-center gap-3 text-xs">
                      <div className="w-4 h-4 flex items-center justify-center text-slate-600">
                        <i className="ri-link text-sm"></i>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px] truncate flex-1">{check.url}</span>
                      <span className="text-[10px] text-slate-600 font-medium whitespace-nowrap">{check.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-[#1a2b4a] pt-4">
                <p className="text-sm font-semibold text-white mb-2">Recommended Providers</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {['Uptime Kuma', 'UptimeRobot', 'Better Uptime'].map((p) => (
                    <span key={p} className="text-[11px] font-medium text-slate-400 bg-[#0a1628] px-3 py-1.5 rounded-lg whitespace-nowrap">{p}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Environment Variables */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Environment Variables</h2>
          <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { key: 'SUPABASE_URL', status: health?.checks?.environment?.status === 'healthy' },
                { key: 'SERVICE_ROLE_KEY', status: health?.checks?.environment?.status === 'healthy' },
                { key: 'STRIPE_SECRET_KEY', status: health?.checks?.stripe?.status !== 'not_configured' },
                { key: 'SMTP_USER', status: health?.checks?.email?.status === 'configured' },
                { key: 'SMTP_PASS', status: health?.checks?.email?.status === 'configured' },
              ].map((env) => (
                <div key={env.key} className="flex items-center gap-2 bg-[#0a1628] rounded-xl px-3 py-2.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${env.status ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  <span className={`text-[11px] font-mono font-medium truncate ${env.status ? 'text-slate-300' : 'text-red-400'}`}>
                    {env.key}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Storage Usage */}
        <StorageUsageWidget />

        {/* Footer */}
        {health && (
          <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-6">
            <p className="text-[11px] text-slate-600 text-center">
              Health dashboard refreshes every 30 seconds. Data sourced from live database queries, edge function pings, and cron job telemetry.
              Version: {health.version} | Instance: {health.instance}
            </p>
          </div>
        )}

        {/* Cleanup Log Modal */}
        {logModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setLogModalOpen(false)}>
            <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2b4a]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#0a1628] text-teal-400">
                    <i className="ri-history-line text-sm"></i>
                  </div>
                  <h3 className="text-sm font-bold text-white">Cleanup History</h3>
                  <span className="text-[10px] text-slate-500 ml-1">{logTotalCount} records</span>
                </div>
                <button onClick={() => setLogModalOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer">
                  <i className="ri-close-line text-sm"></i>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-3">
                {logLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-5 h-5 flex items-center justify-center text-teal-400">
                      <i className="ri-loader-4-line animate-spin text-lg"></i>
                    </div>
                  </div>
                ) : allLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-slate-500">No cleanup records found</p>
                  </div>
                ) : (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-[#1a2b4a]">
                        <th className="text-left py-2 font-semibold text-slate-500 w-36">Time</th>
                        <th className="text-left py-2 font-semibold text-slate-500">Table</th>
                        <th className="text-right py-2 font-semibold text-slate-500">Retention</th>
                        <th className="text-right py-2 font-semibold text-slate-500">Removed</th>
                        <th className="text-right py-2 font-semibold text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a2b4a]">
                      {allLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-[#0a1628]/50">
                          <td className="py-2.5 text-slate-400 font-mono text-[10px]">
                            {new Date(log.started_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 text-white font-mono">{log.table_name}</td>
                          <td className="py-2.5 text-slate-500 text-right">{log.retention_days}d</td>
                          <td className="py-2.5 text-slate-400 text-right font-mono">{log.rows_removed}</td>
                          <td className="py-2.5 text-right">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              log.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                              log.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                              'bg-amber-500/10 text-amber-400'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="flex items-center justify-between px-6 py-3 border-t border-[#1a2b4a]">
                <span className="text-[10px] text-slate-500">
                  Page {logPage + 1} of {Math.max(1, Math.ceil(logTotalCount / PER_PAGE))}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openFullLog(0)} disabled={logPage === 0 || logLoading} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                    <i className="ri-skip-left-line text-xs"></i>
                  </button>
                  <button onClick={() => openFullLog(Math.max(0, logPage - 1))} disabled={logPage === 0 || logLoading} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                    <i className="ri-arrow-left-s-line text-xs"></i>
                  </button>
                  <span className="text-[10px] text-slate-400 font-mono px-2">{logPage + 1}</span>
                  <button onClick={() => openFullLog(logPage + 1)} disabled={(logPage + 1) * PER_PAGE >= logTotalCount || logLoading} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                    <i className="ri-arrow-right-s-line text-xs"></i>
                  </button>
                  <button onClick={() => openFullLog(Math.floor((logTotalCount - 1) / PER_PAGE))} disabled={(logPage + 1) * PER_PAGE >= logTotalCount || logLoading} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                    <i className="ri-skip-right-line text-xs"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}