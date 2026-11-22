import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { emailConfiguration, stripeHealth } from '../_shared/admin-service-health.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

interface MaintenanceSnapshot {
  cron_jobs: { jobid: number; jobname: string; schedule: string; active: boolean;
    last_run: { status: string; start_time: string; end_time: string | null; return_message: string } | null;
    run_count_7d: number }[] | null;
  cleanup: {
    status: string;
    last_run: { table: string; at: string; rows_removed: number } | null;
    last_failure: { table: string; at: string; error: string } | null;
    logs: { id: string; table_name: string; started_at: string; status: string;
      rows_removed: number | null; retention_days: number | null;
      finished_at: string | null; error_message: string | null }[] | null;
    total_count: number | null;
  };
}

function getAal(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(base64 + pad)).aal || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("authorization");
  const jwt = authHeader?.replace("Bearer ", "").trim() || "";

  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAuth = createClient(supabaseUrl, serviceKey, { db: { schema: "app" } });

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (getAal(jwt) !== "aal2") {
    return new Response(JSON.stringify({ error: "MFA required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: adminUser } = await supabaseAuth
    .from("admin_users")
    .select("id, role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminUser) {
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!adminUser.is_active) {
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const validRoles = ["super_admin", "admin", "finance_admin"];
  if (!validRoles.includes(adminUser.role)) {
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const app = createClient(supabaseUrl, serviceKey, { db: { schema: "app" } });

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  let overallStatus = "healthy";
  const checks: Record<string, any> = {};
  const schemaErrors: string[] = [];

  // Private schemas remain outside the Data API. The service-only invoker RPC
  // reads maintenance metadata after the admin/MFA checks above.
  let maintenance: MaintenanceSnapshot;
  try {
    const url = new URL(req.url);
    const offset = Number(url.searchParams.get("cleanup_offset") || 0);
    const limit = Number(url.searchParams.get("cleanup_limit") || 20);
    if (!Number.isSafeInteger(offset) || offset < 0 ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return new Response(JSON.stringify({ error: "Invalid cleanup pagination" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data, error } = await app.rpc("get_admin_maintenance_snapshot", {
      p_offset: offset, p_limit: limit,
    });
    if (error || !data) throw new Error(error?.message || "Missing maintenance snapshot");
    maintenance = data;
  } catch (error: unknown) {
    schemaErrors.push(`Maintenance snapshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    overallStatus = overallStatus === "critical" ? "critical" : "degraded";
    maintenance = { cron_jobs: null, cleanup: {
      status: "unknown", last_run: null, last_failure: null, logs: null, total_count: null,
    } };
  }

  if (new URL(req.url).searchParams.get("section") === "maintenance") {
    return new Response(JSON.stringify(maintenance.cleanup.status === "unknown"
      ? { error: "Unable to load maintenance records" } : maintenance), {
      status: maintenance.cleanup.status === "unknown" ? 503 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  // --- Database health ---
  const startDb = Date.now();
  try {
    const { error: dbErr } = await app.from("jobs").select("id").limit(1);
    if (dbErr) {
      checks.database = { status: "unhealthy", latency_ms: Date.now() - startDb, error: dbErr.message };
      schemaErrors.push(`Database check failed: ${dbErr.message}`);
      overallStatus = "degraded";
    } else {
      checks.database = { status: "healthy", latency_ms: Date.now() - startDb };
    }
  } catch (e: any) {
    checks.database = { status: "unhealthy", latency_ms: Date.now() - startDb, error: e.message };
    schemaErrors.push(`Database check exception: ${e.message}`);
    overallStatus = "critical";
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  checks.stripe = await stripeHealth(stripeKey);
  checks.email = emailConfiguration(name => Deno.env.get(name));
  if (checks.stripe.status !== 'healthy' || checks.email.status !== 'configured') {
    overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
  }
  checks.environment = { status: stripeKey && checks.email.status === 'configured' ? 'healthy' : 'degraded' };
  const { data: serviceMetrics, error: serviceMetricsError } = await app.rpc('get_admin_service_metrics');
  if (serviceMetricsError || !serviceMetrics?.stripe || !serviceMetrics?.email) {
    return new Response(JSON.stringify({ error: 'Admin service metrics could not be loaded' }), {
      status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  // --- Parallel business queries (app schema) ---
  const metricPromises = [
    app.from("email_send_log").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since24h),
    app.from("subscription_payments").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since24h),
    app.from("transactions").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since24h),
    app.from("jobs").select("*", { count: "exact", head: true }).eq("is_deleted", false).gte("created_at", since24h),
    app.from("guards").select("*", { count: "exact", head: true }).gte("updated_at", since24h),
    app.from("clients").select("*", { count: "exact", head: true }).gte("updated_at", since24h),
    app.from("admin_alerts").select("*", { count: "exact", head: true }).eq("status", "unread"),
  ];

  const results = await Promise.allSettled(metricPromises);

  const failedEmails = results[0].status === "fulfilled" ? (results[0].value.count ?? 0) : 0;
  const failedSubPayments = results[1].status === "fulfilled" ? (results[1].value.count ?? 0) : 0;
  const failedTxnPayments = results[2].status === "fulfilled" ? (results[2].value.count ?? 0) : 0;
  const jobsPosted24h = results[3].status === "fulfilled" ? (results[3].value.count ?? 0) : 0;
  const activeGuards = results[4].status === "fulfilled" ? (results[4].value.count ?? 0) : 0;
  const activeClients = results[5].status === "fulfilled" ? (results[5].value.count ?? 0) : 0;
  const unreadAlerts = results[6].status === "fulfilled" ? (results[6].value.count ?? 0) : 0;

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const labels = ["email_send_log", "subscription_payments", "transactions", "jobs", "guards", "clients", "admin_alerts"];
      schemaErrors.push(`Metric query "${labels[i]}" failed: ${(r.reason as any)?.message || "Unknown error"}`);
    }
  });

  // --- Payment pipeline (app schema) ---
  const pipelineCounts: Record<string, number> = {};
  try {
    const { data: statusRows, error: statusErr } = await app
      .from("job_assignments")
      .select("payment_status");
    if (statusErr) {
      schemaErrors.push(`Payment pipeline query failed: ${statusErr.message}`);
    } else if (statusRows) {
      statusRows.forEach((row: any) => {
        const s = row.payment_status || "unknown";
        pipelineCounts[s] = (pipelineCounts[s] || 0) + 1;
      });
    }
  } catch (e: any) {
    schemaErrors.push(`Payment pipeline exception: ${e.message}`);
  }

  let stuckFundedOver24h = 0;
  let stuckAwaitingOver72h = 0;
  const pendingPayoutsCount = serviceMetrics.stripe.pendingPayouts;
  const failedPayoutsCount = serviceMetrics.stripe.failedPayouts;

  try {
    const [{ data: allAssignments, error: allErr }, overdueCompletions] = await Promise.all([
      app
      .from("job_assignments")
      .select("payment_status, payment_date, completed_at, assigned_at, updated_at"),
      app.from("job_completion_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .lte("requested_at", since72h),
    ]);
    if (overdueCompletions.error) {
      schemaErrors.push(`Overdue completion query failed: ${overdueCompletions.error.message}`);
    } else {
      stuckAwaitingOver72h = overdueCompletions.count ?? 0;
    }
    if (!allErr && allAssignments) {
      for (const a of allAssignments) {
        const ps = a.payment_status;
        if (ps === "pending") {
          const assignedDate = a.assigned_at ? new Date(a.assigned_at) : null;
          if (assignedDate && assignedDate < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
            stuckFundedOver24h++;
          }
        }
      }
    }
  } catch (e: any) {
    schemaErrors.push(`Stuck assignment query failed: ${e.message}`);
  }

  let totalUnreleasedClient = 0;
  try {
    const { data: unreleasedData, error: unreleasedErr } = await app
      .from("job_assignments")
      .select("payment_amount")
      .eq("payment_status", "pending");
    if (!unreleasedErr && unreleasedData) {
      totalUnreleasedClient = unreleasedData.reduce((sum: number, r: any) => sum + (Number(r.payment_amount) || 0), 0);
    } else if (unreleasedErr) {
      schemaErrors.push(`Unreleased value query failed: ${unreleasedErr.message}`);
    }
  } catch (e: any) {
    schemaErrors.push(`Unreleased value exception: ${e.message}`);
  }

  const totalGuardPayoutPending = Number(serviceMetrics.pendingPayoutAmount);

  return new Response(
    JSON.stringify({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: "soft-launch",
      instance: "quickguard-prod",
      checks,
      schema_errors: schemaErrors.length > 0 ? schemaErrors : undefined,
      metrics: {
        failed_emails_24h: failedEmails,
        failed_payments_24h: failedSubPayments + failedTxnPayments,
        failed_sub_payments_24h: failedSubPayments,
        failed_txn_payments_24h: failedTxnPayments,
        unread_admin_alerts: unreadAlerts,
        jobs_posted_24h: jobsPosted24h,
        active_users_24h: activeGuards + activeClients,
        active_guards_24h: activeGuards,
        active_clients_24h: activeClients,
      },
      payment_pipeline: {
        counts: pipelineCounts,
        stuck: {
          funded_over_24h: stuckFundedOver24h,
          awaiting_release_over_72h: stuckAwaitingOver72h,
          pending_payouts: pendingPayoutsCount,
          failed_payouts: failedPayoutsCount,
        },
        values: {
          total_unreleased_client: totalUnreleasedClient,
          total_guard_payout_pending: totalGuardPayoutPending,
        },
      },
      cron_jobs: maintenance.cron_jobs,
      cleanup: maintenance.cleanup,
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
