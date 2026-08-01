import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(base64 + padding);
}

function decodeJwtPayload(jwt: string): any {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

async function verifyAdmin(supabaseUrl: string, serviceKey: string, jwt: string) {
  const payload = decodeJwtPayload(jwt);
  if (!payload || !payload.sub) return null;

  const supabaseApp = createClient(supabaseUrl, serviceKey, { db: { schema: "app" } });

  const { data: adminUser } = await supabaseApp
    .from("admin_users")
    .select("id, role, is_active")
    .eq("user_id", payload.sub)
    .maybeSingle();

  if (adminUser && adminUser.is_active) {
    const validRoles = ["super_admin", "admin", "finance_admin"];
    if (validRoles.includes(adminUser.role)) return adminUser;
  }

  if (payload.email) {
    const { data: byEmail } = await supabaseApp
      .from("admin_users")
      .select("id, role, is_active")
      .eq("email", payload.email)
      .eq("is_active", true)
      .maybeSingle();
    if (byEmail) {
      const validRoles = ["super_admin", "admin", "finance_admin"];
      if (validRoles.includes(byEmail.role)) {
        await supabaseApp.from("admin_users").update({ user_id: payload.sub, updated_at: new Date().toISOString() }).eq("id", byEmail.id);
        return byEmail;
      }
    }
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    return new Response(JSON.stringify({ error: "Unauthorized: Missing authentication token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminUser = await verifyAdmin(supabaseUrl, serviceKey, jwt);
  if (!adminUser) {
    return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const app = createClient(supabaseUrl, serviceKey, { db: { schema: "app" } });
  const publicDb = createClient(supabaseUrl, serviceKey, { db: { schema: "public" } });
  const cronDb = createClient(supabaseUrl, serviceKey, { db: { schema: "cron" } });

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  let overallStatus = "healthy";
  const checks: Record<string, any> = {};
  const schemaErrors: string[] = [];

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

  // --- Stripe health ---
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (stripeKey) {
    const startStripe = Date.now();
    try {
      const res = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      checks.stripe = { status: res.ok ? "healthy" : "unhealthy", latency_ms: Date.now() - startStripe };
      if (!res.ok) overallStatus = overallStatus === "healthy" ? "degraded" : overallStatus;
    } catch (e: any) {
      checks.stripe = { status: "unhealthy", error: e.message };
      overallStatus = overallStatus === "healthy" ? "degraded" : overallStatus;
    }
  } else {
    checks.stripe = { status: "not_configured" };
  }

  // --- Email config ---
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  checks.email = { status: smtpUser && smtpPass ? "configured" : "not_configured" };

  // --- Environment ---
  checks.environment = {
    status: (!!supabaseUrl && !!serviceKey && !!stripeKey && !!smtpUser && !!smtpPass) ? "healthy" : "degraded",
  };

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
  // First discover all actual payment_status values in use
  let pipelineCounts: Record<string, number> = {};
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

  // Stuck assignments based on actual data
  let stuckFundedOver24h = 0;
  let stuckAwaitingOver72h = 0;
  let pendingPayoutsCount = 0;
  let failedPayoutsCount = 0;

  try {
    const { data: allAssignments, error: allErr } = await app
      .from("job_assignments")
      .select("payment_status, payment_date, completed_at, assigned_at, updated_at");
    if (!allErr && allAssignments) {
      for (const a of allAssignments) {
        const ps = a.payment_status;
        // Stuck: pending assignments older than 24h (not yet paid)
        if (ps === "pending") {
          const assignedDate = a.assigned_at ? new Date(a.assigned_at) : null;
          if (assignedDate && assignedDate < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
            stuckFundedOver24h++;
          }
          // Completed but still pending after 72h
          if (a.completed_at) {
            const completedDate = new Date(a.completed_at);
            if (completedDate < new Date(Date.now() - 72 * 60 * 60 * 1000)) {
              stuckAwaitingOver72h++;
            }
          }
          // All pending count as pending payouts
          pendingPayoutsCount++;
        }
        // Failed: payment_date set but payment_status not "paid"
        if (ps === "failed" || (a.payment_date && ps !== "paid" && ps !== "pending")) {
          failedPayoutsCount++;
        }
      }
    }
  } catch (e: any) {
    schemaErrors.push(`Stuck assignment query failed: ${e.message}`);
  }

  // Total unreleased value (pending assignments)
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

  // Total guard payout pending
  let totalGuardPayoutPending = 0;
  try {
    const { data: payoutData, error: payoutErr } = await app
      .from("guard_payouts")
      .select("net_amount")
      .in("status", ["pending", "processing"]);
    if (!payoutErr && payoutData) {
      totalGuardPayoutPending = payoutData.reduce((sum: number, r: any) => sum + (Number(r.net_amount) || 0), 0);
    } else if (payoutErr) {
      schemaErrors.push(`Payout value query failed: ${payoutErr.message}`);
    }
  } catch (e: any) {
    schemaErrors.push(`Payout value exception: ${e.message}`);
  }

  // --- Cron jobs (cron schema) ---
  let cronJobs: any[] = [];
  try {
    const { data: cronJobList, error: cronErr } = await cronDb.from("job").select("jobid, jobname, schedule, active, command");
    if (cronErr) {
      schemaErrors.push(`Cron job query failed: ${cronErr.message}`);
    } else if (cronJobList && cronJobList.length > 0) {
      const jobIds = cronJobList.map((j: any) => j.jobid);
      const { data: recentRuns, error: runsErr } = await cronDb
        .from("job_run_details")
        .select("jobid, status, start_time, end_time, return_message")
        .in("jobid", jobIds)
        .order("start_time", { ascending: false });

      if (runsErr) {
        schemaErrors.push(`Cron run details query failed: ${runsErr.message}`);
      }

      const runsByJob: Record<number, any[]> = {};
      (recentRuns || []).forEach((run: any) => {
        if (!runsByJob[run.jobid]) runsByJob[run.jobid] = [];
        runsByJob[run.jobid].push(run);
      });

      cronJobs = cronJobList.map((job: any) => {
        const runs = runsByJob[job.jobid] || [];
        const lastRun = runs[0] || null;
        return {
          jobid: job.jobid,
          jobname: job.jobname,
          schedule: job.schedule,
          active: job.active,
          last_run: lastRun
            ? {
                status: lastRun.status,
                start_time: lastRun.start_time,
                end_time: lastRun.end_time,
                return_message: lastRun.return_message,
              }
            : null,
          run_count_7d: runs.filter((r: any) => new Date(r.start_time) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
        };
      });
    }
  } catch (e: any) {
    schemaErrors.push(`Cron exception: ${e.message}`);
  }

  // --- Cleanup status (public schema — where cleanup_log data lives) ---
  let cleanupStatus = "healthy";
  let lastCleanupRun = null;
  let lastCleanupFailure = null;
  try {
    const { data: lastFail, error: failErr } = await publicDb
      .from("cleanup_log")
      .select("table_name, started_at, error_message")
      .eq("status", "failed")
      .order("started_at", { ascending: false })
      .limit(1);
    if (failErr) {
      schemaErrors.push(`Cleanup failure query failed: ${failErr.message}`);
    } else if (lastFail && lastFail.length > 0) {
      cleanupStatus = "degraded";
      lastCleanupFailure = { table: lastFail[0].table_name, at: lastFail[0].started_at, error: lastFail[0].error_message };
    }

    const { data: lastOk, error: okErr } = await publicDb
      .from("cleanup_log")
      .select("table_name, started_at, rows_removed")
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(1);
    if (okErr) {
      schemaErrors.push(`Cleanup run query failed: ${okErr.message}`);
    } else if (lastOk && lastOk.length > 0) {
      lastCleanupRun = { table: lastOk[0].table_name, at: lastOk[0].started_at, rows_removed: lastOk[0].rows_removed };
    }
  } catch (e: any) {
    schemaErrors.push(`Cleanup exception: ${e.message}`);
  }

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
      cron_jobs: cronJobs,
      cleanup: {
        status: cleanupStatus,
        last_run: lastCleanupRun,
        last_failure: lastCleanupFailure,
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