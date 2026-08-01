import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const checks: Record<string, { status: string; latency_ms?: number }> = {};
  let overallStatus = "healthy";

  const startDb = Date.now();
  try {
    const { data, error } = await supabase.from("jobs").select("id").limit(1);
    checks.database = { status: error ? "unhealthy" : "healthy", latency_ms: Date.now() - startDb };
    if (error) {
      checks.database.error = error.message;
      overallStatus = "degraded";
    }
  } catch (e) {
    checks.database = { status: "unhealthy", error: (e as Error).message };
    overallStatus = "critical";
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (stripeKey) {
    const startStripe = Date.now();
    try {
      const res = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      checks.stripe = { status: res.ok ? "healthy" : "unhealthy", latency_ms: Date.now() - startStripe };
      if (!res.ok) {
        overallStatus = overallStatus === "healthy" ? "degraded" : overallStatus;
      }
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

  const envChecks = {
    SUPABASE_URL: !!supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey,
    STRIPE_SECRET_KEY: !!stripeKey,
    SMTP_USER: !!smtpUser,
    SMTP_PASS: !!smtpPass,
  };
  checks.environment = { status: Object.values(envChecks).every(Boolean) ? "healthy" : "degraded" };

  let failedEmails24h = 0;
  try {
    const { count, error: emailErr } = await supabase
      .from("email_send_log")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (!emailErr) failedEmails24h = count ?? 0;
  } catch { /* ignore */ }

  let failedPayments24h = 0;
  try {
    const { count: subCount } = await supabase
      .from("subscription_payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    const { count: txnCount } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    failedPayments24h = (subCount ?? 0) + (txnCount ?? 0);
  } catch { /* ignore */ }

  let unreadAlerts = 0;
  try {
    const { count } = await supabase
      .from("admin_alerts")
      .select("*", { count: "exact", head: true })
      .eq("status", "unread");
    unreadAlerts = count ?? 0;
  } catch { /* ignore */ }

  let cleanupStatus = "healthy";
  let lastCleanupFailed = null;
  let lastCleanupFailedTable = null;
  try {
    const { data: failedLogs, error: cleanupErr } = await supabase
      .from("cleanup_log")
      .select("table_name, started_at, error_message")
      .eq("status", "failed")
      .order("started_at", { ascending: false })
      .limit(1);
    if (!cleanupErr && failedLogs && failedLogs.length > 0) {
      cleanupStatus = "degraded";
      lastCleanupFailed = failedLogs[0].started_at;
      lastCleanupFailedTable = failedLogs[0].table_name;
    }
  } catch { /* ignore */ }

  let lastCleanupRun = null;
  try {
    const { data: lastLog } = await supabase
      .from("cleanup_log")
      .select("table_name, started_at, rows_removed")
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(1);
    if (lastLog && lastLog.length > 0) {
      lastCleanupRun = lastLog[0];
    }
  } catch { /* ignore */ }

  return new Response(
    JSON.stringify({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: "soft-launch",
      checks,
      metrics: {
        failed_emails_24h: failedEmails24h,
        failed_payments_24h: failedPayments24h,
        unread_admin_alerts: unreadAlerts,
      },
      cleanup: {
        status: cleanupStatus,
        last_run: lastCleanupRun,
        last_failure: lastCleanupFailed ? { table: lastCleanupFailedTable, at: lastCleanupFailed } : null,
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    }
  );
});