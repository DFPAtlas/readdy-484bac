import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// v2 (2026-11-14): app-schema client for jobs/email_send_log/subscription_payments/transactions/admin_alerts;
// public-schema client for cleanup_log (the live copy is public.cleanup_log). Previously everything hit `public`.

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const app = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "app" }, auth: { persistSession: false } });
  const pub = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "public" }, auth: { persistSession: false } });

  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};
  let overallStatus = "healthy";
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const startDb = Date.now();
  try {
    const { error } = await app.from("jobs").select("id").limit(1);
    checks.database = { status: error ? "unhealthy" : "healthy", latency_ms: Date.now() - startDb };
    if (error) { checks.database.error = error.message; overallStatus = "degraded"; }
  } catch (e) {
    checks.database = { status: "unhealthy", error: (e as Error).message };
    overallStatus = "critical";
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (stripeKey) {
    const startStripe = Date.now();
    try {
      const res = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${stripeKey}` } });
      checks.stripe = { status: res.ok ? "healthy" : "unhealthy", latency_ms: Date.now() - startStripe };
      if (!res.ok && overallStatus === "healthy") overallStatus = "degraded";
    } catch (e) {
      checks.stripe = { status: "unhealthy", error: (e as Error).message };
      overallStatus = "degraded";
    }
  } else {
    checks.stripe = { status: "not_configured" };
  }

  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  checks.email = { status: smtpUser && smtpPass ? "configured" : "not_configured" };
  const envChecks = { SUPABASE_URL: !!supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey, STRIPE_SECRET_KEY: !!stripeKey, SMTP_USER: !!smtpUser, SMTP_PASS: !!smtpPass };
  checks.environment = { status: Object.values(envChecks).every(Boolean) ? "healthy" : "degraded" };

  const count = async (client: typeof app, table: string, filters: (q: any) => any): Promise<number> => {
    try {
      const { count, error } = await filters(client.from(table).select("*", { count: "exact", head: true }));
      return error ? 0 : (count ?? 0);
    } catch { return 0; }
  };

  const failedEmails24h = await count(app, "email_send_log", (q) => q.eq("status", "failed").gte("created_at", since24h));
  const failedPayments24h =
    (await count(app, "subscription_payments", (q) => q.eq("status", "failed").gte("created_at", since24h))) +
    (await count(app, "transactions", (q) => q.eq("status", "failed").gte("created_at", since24h)));
  const unreadAlerts = await count(app, "admin_alerts", (q) => q.eq("status", "unread"));

  let cleanupStatus = "healthy";
  let lastFailure: { table: string; at: string } | null = null;
  let lastCleanupRun: unknown = null;
  try {
    const { data: failedLogs } = await pub.from("cleanup_log").select("table_name, started_at, error_message").eq("status", "failed").order("started_at", { ascending: false }).limit(1);
    if (failedLogs && failedLogs.length > 0) { cleanupStatus = "degraded"; lastFailure = { table: failedLogs[0].table_name, at: failedLogs[0].started_at }; }
    const { data: lastLog } = await pub.from("cleanup_log").select("table_name, started_at, rows_removed").eq("status", "completed").order("started_at", { ascending: false }).limit(1);
    if (lastLog && lastLog.length > 0) lastCleanupRun = lastLog[0];
  } catch { /* ignore */ }

  return new Response(
    JSON.stringify({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: "soft-launch",
      checks,
      metrics: { failed_emails_24h: failedEmails24h, failed_payments_24h: failedPayments24h, unread_admin_alerts: unreadAlerts },
      cleanup: { status: cleanupStatus, last_run: lastCleanupRun, last_failure: lastFailure },
    }),
    { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" } },
  );
});
