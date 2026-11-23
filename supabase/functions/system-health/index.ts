import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { emailConfiguration, stripeHealth, type ServiceHealth } from '../_shared/admin-service-health.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
};
type CleanupHealth = {
  status: 'healthy' | 'degraded' | 'unknown';
  last_run: { table_name: string; started_at: string; rows_removed: number | null } | null;
  last_failure: { table: string; at: string } | null;
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isCleanupEntry(value: unknown): value is { table: string; at: string; rows_removed?: unknown } {
  return isRecord(value) && typeof value.table === 'string' && !!value.table.trim() &&
    typeof value.at === 'string' && Number.isFinite(Date.parse(value.at));
}

Deno.serve(async (req: Request) => {
  const respond = (data: unknown, status = 200) => new Response(req.method === 'HEAD' ? null : JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (!['GET', 'HEAD', 'POST'].includes(req.method)) return respond({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return respond({ status: 'critical', timestamp: new Date().toISOString(), version: 'soft-launch',
      checks: { environment: { status: 'not_configured', error: 'Health service configuration is incomplete.' } },
      metrics: { failed_emails_24h: null, failed_payments_24h: null, unread_admin_alerts: null },
      cleanup: { status: 'unknown', last_run: null, last_failure: null } }, 503);
  }

  // Public is deliberately outside the Data API. Read maintenance through its service-only app RPC.
  const app = createClient(supabaseUrl, serviceRoleKey, { db: { schema: 'app' }, auth: { persistSession: false } });
  const signal = AbortSignal.timeout(8000);
  const since24h = new Date(Date.now() - 86400000).toISOString();
  async function databaseHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const { error } = await app.from('jobs').select('id').limit(1).abortSignal(signal);
      return { status: error ? 'unhealthy' : 'healthy', latency_ms: Date.now() - start,
        ...(error ? { error: 'Database health query was not confirmed.' } : {}) };
    } catch {
      return { status: 'unknown', latency_ms: Date.now() - start, error: 'Database health query could not be completed.' };
    }
  }
  async function countRows(table: 'email_send_log' | 'subscription_payments' | 'transactions' | 'admin_alerts'): Promise<number | null> {
    try {
      let query = app.from(table).select('*', { count: 'exact', head: true })
        .eq('status', table === 'admin_alerts' ? 'unread' : 'failed');
      if (table !== 'admin_alerts') query = query.gte('created_at', since24h);
      const { count, error } = await query.abortSignal(signal);
      return !error && typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null;
    } catch { return null; }
  }
  async function cleanupHealth(): Promise<CleanupHealth> {
    const unknown: CleanupHealth = { status: 'unknown', last_run: null, last_failure: null };
    try {
      const { data, error } = await app.rpc('get_admin_maintenance_snapshot', { p_offset: 0, p_limit: 1 }).abortSignal(signal);
      if (error || !isRecord(data) || !isRecord(data.cleanup)) return unknown;
      const cleanup = data.cleanup;
      if (!['healthy', 'degraded'].includes(String(cleanup.status))) return unknown;
      const failure = cleanup.last_failure;
      const run = cleanup.last_run;
      if ((failure !== null && !isCleanupEntry(failure)) || (run !== null && !isCleanupEntry(run))) return unknown;
      const lastRun = isCleanupEntry(run) ? { table_name: run.table, started_at: run.at,
        rows_removed: typeof run.rows_removed === 'number' && Number.isSafeInteger(run.rows_removed) && run.rows_removed >= 0 ? run.rows_removed : null } : null;
      const lastFailure = isCleanupEntry(failure) ? { table: failure.table, at: failure.at } : null;
      const age = lastRun ? Date.now() - Date.parse(lastRun.started_at) : NaN;
      const confirmed = cleanup.required_tables === 6 && cleanup.recent_completed_tables === 6 &&
        lastRun?.rows_removed !== null && Number.isFinite(age) && age >= 0 && age <= 48 * 60 * 60 * 1000;
      return { status: lastFailure ? 'degraded' : confirmed ? cleanup.status === 'healthy' ? 'healthy' : 'degraded' : 'unknown',
        last_run: lastRun, last_failure: lastFailure };
    } catch { return unknown; }
  }

  const [database, stripe, failedEmails, failedSubscriptions, failedTransactions, unreadAlerts, cleanup] = await Promise.all([
    databaseHealth(), stripeHealth(Deno.env.get('STRIPE_SECRET_KEY')), countRows('email_send_log'),
    countRows('subscription_payments'), countRows('transactions'), countRows('admin_alerts'), cleanupHealth(),
  ]);
  const email = emailConfiguration(name => Deno.env.get(name));
  const paymentTotal = failedSubscriptions === null || failedTransactions === null ? null : failedSubscriptions + failedTransactions;
  const failedPayments = paymentTotal !== null && Number.isSafeInteger(paymentTotal) ? paymentTotal : null;
  const metricsKnown = [failedEmails, failedPayments, unreadAlerts].every(count => count !== null);
  const checks: Record<string, { status: string; latency_ms?: number; error?: string; provider?: string }> = {
    database, stripe, email,
    environment: { status: Deno.env.get('STRIPE_SECRET_KEY') && email.status === 'configured' ? 'healthy' : 'degraded' },
    metrics: { status: metricsKnown ? 'healthy' : 'unknown' },
    cleanup: { status: cleanup.status },
  };
  // Compute once so another service failure cannot downgrade a critical database failure.
  const overallStatus = database.status !== 'healthy' ? 'critical'
    : stripe.status !== 'healthy' || email.status !== 'configured' || !metricsKnown || cleanup.status !== 'healthy' ||
      (failedEmails !== null && failedEmails > 0) || (failedPayments !== null && failedPayments > 0) ? 'degraded' : 'healthy';
  return respond({ status: overallStatus, timestamp: new Date().toISOString(), version: 'soft-launch', checks,
    metrics: { failed_emails_24h: failedEmails, failed_payments_24h: failedPayments, unread_admin_alerts: unreadAlerts },
    cleanup }, overallStatus === 'critical' ? 503 : 200);
});
