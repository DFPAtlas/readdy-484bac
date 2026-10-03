import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RetirementClassification = "active" | "retired_removable" | "retired_disabled" | "needs_verification";

interface RetirementRecord {
  slug: string;
  name: string;
  classification: RetirementClassification;
  replacement: string | null;
  lastInvocation: string;
  knownCallers: string;
  cronWebhook: string;
  securityRisk: string;
  reviewer: string;
  reviewDate: string;
  evidence: string;
}

const RETIREMENT_REGISTER: RetirementRecord[] = [
  {
    slug: "release-guard-payment",
    name: "Release Guard Payment",
    classification: "needs_verification",
    replacement: "create-guard-payout + auto-release-guard-payments + approve-job-completion",
    lastInvocation: "None — returns 410. Only referenced by non-functional system-status health ping (retired:true).",
    knownCallers: "None in code. Referenced only by the system-status health ping (retired:true) and static registry lists.",
    cronWebhook: "None. Not in CRON_SETUP.md. Not called by enhanced-stripe-webhook.",
    securityRisk: "Payout endpoint. Returns 410 and is fully replaced, but is payment-classified — requires explicit administrator approval to delete.",
    reviewer: "Dependency audit (read-only)",
    reviewDate: "2026-08-26",
    evidence: "Returns 410 with migrateTo=create-guard-payout. approve-job-completion invokes create-guard-payout (index.ts:518); auto-release-guard-payments is the cron payout. No live caller found.",
  },
  {
    slug: "create-super-admin",
    name: "Create Super Admin",
    classification: "retired_removable",
    replacement: "admin-register (super_admin-only, role allowlist)",
    lastInvocation: "None — returns 410 immediately",
    knownCallers: "None",
    cronWebhook: "None",
    securityRisk: "Low — already returns 410 with no business logic.",
    reviewer: "Dependency audit (read-only)",
    reviewDate: "2026-08-26",
    evidence: "Returns 410. No frontend/backend references. Replacement admin-register is super_admin-gated with role allowlist.",
  },
  {
    slug: "set-admin-password",
    name: "Set Admin Password",
    classification: "retired_removable",
    replacement: "admin-change-password",
    lastInvocation: "None — returns 410 immediately",
    knownCallers: "None",
    cronWebhook: "None",
    securityRisk: "Low — already returns 410.",
    reviewer: "Dependency audit (read-only)",
    reviewDate: "2026-08-26",
    evidence: "Returns 410. No callers. Replaced by admin-change-password (self-read + no hash exposure).",
  },
  {
    slug: "debug-hash",
    name: "Debug Hash",
    classification: "retired_removable",
    replacement: null,
    lastInvocation: "None — returns 410 immediately",
    knownCallers: "None",
    cronWebhook: "None",
    securityRisk: "Low — debug endpoint, already returns 410.",
    reviewer: "Dependency audit (read-only)",
    reviewDate: "2026-08-26",
    evidence: "Returns 410. No callers. Debug-only; no replacement required.",
  },
  {
    slug: "fix-admin-password",
    name: "Fix Admin Password",
    classification: "retired_removable",
    replacement: "admin-change-password",
    lastInvocation: "None — returns 410 immediately",
    knownCallers: "None",
    cronWebhook: "None",
    securityRisk: "Low — already returns 410.",
    reviewer: "Dependency audit (read-only)",
    reviewDate: "2026-08-26",
    evidence: "Returns 410. No callers. Replaced by admin-change-password.",
  },
  {
    slug: "fix-admin-auth",
    name: "Fix Admin Auth",
    classification: "retired_removable",
    replacement: "repair-account",
    lastInvocation: "None — returns 410 immediately",
    knownCallers: "None",
    cronWebhook: "None",
    securityRisk: "Low — already returns 410.",
    reviewer: "Dependency audit (read-only)",
    reviewDate: "2026-08-26",
    evidence: "Returns 410. No callers. Replaced by repair-account (super_admin-only, dry-run default).",
  },
  {
    slug: "create-admin-martin",
    name: "Create Admin Martin",
    classification: "retired_disabled",
    replacement: "admin-register",
    lastInvocation: "None — returns 410 Gone (retired P0 Security Repair 01, 2026-09-15)",
    knownCallers: "None in code. Historically bootstrapped martin.hewett@quickguard.uk (2026-03-01); now retired.",
    cronWebhook: "None. No cron/webhook/n8n reference.",
    securityRisk: "Resolved — replaced with fail-closed 410 handler; no DB/Auth/service-role access.",
    reviewer: "P0 Security Repair 01",
    reviewDate: "2026-09-15",
    evidence: "Redeployed as fail-closed retirement handler (returns HTTP 410 Gone with only the retirement error). No service-role client, no DB read/write, no Auth administration. Fixed credentials removed from source. Verified via endpoint probe.",
  },
  {
    slug: "set-martin-password",
    name: "Set Martin Password",
    classification: "retired_disabled",
    replacement: "admin-change-password",
    lastInvocation: "None — returns 410 Gone (retired P0 Security Repair 01, 2026-09-15)",
    knownCallers: "None in code. One-time password bootstrap for martin.hewett@quickguard.uk; now retired.",
    cronWebhook: "None. No cron/webhook/n8n reference.",
    securityRisk: "Resolved — replaced with fail-closed 410 handler; no fixed password/hash logic.",
    reviewer: "P0 Security Repair 01",
    reviewDate: "2026-09-15",
    evidence: "Redeployed as fail-closed retirement handler (returns HTTP 410 Gone with only the retirement error). Fixed password/hash logic removed from source. No service-role client, no DB read/write, no Auth administration. Verified via endpoint probe.",
  },
  {
    slug: "debug-admin-lookup",
    name: "Debug Admin Lookup",
    classification: "retired_disabled",
    replacement: null,
    lastInvocation: "None — returns 410 Gone (retired P0 Security Repair 01, 2026-09-15)",
    knownCallers: "None in code. Legacy debug endpoint; now retired.",
    cronWebhook: "None. No cron/webhook/n8n reference.",
    securityRisk: "Resolved — replaced with fail-closed 410 handler; no admin data returned.",
    reviewer: "P0 Security Repair 01",
    reviewDate: "2026-09-15",
    evidence: "Redeployed as fail-closed retirement handler (returns HTTP 410 Gone with only the retirement error). Reveals no admin ID, email, role, hash, or account status. No DB read/write. Verified via endpoint probe.",
  },
  {
    slug: "connect-guard-payout",
    name: "Connect Guard Payout (Deprecated)",
    classification: "needs_verification",
    replacement: "create-guard-payout + create-guard-connect-account",
    lastInvocation: "None — now returns HTTP 410 Gone",
    knownCallers: "None in code (frontend/backend/cron/webhook/n8n). Only static registry entries in security-dashboard.",
    cronWebhook: "None",
    securityRisk: "Payout-adjacent. Now returns 410 Gone, performs no payouts, exposes no secrets. Payment-classified — requires administrator approval to delete.",
    reviewer: "Dependency audit + DB invocation inspection",
    reviewDate: "2026-08-26",
    evidence: "Dependency audit confirmed zero callers (grep found only docs + its own file + static registry lists). Changed from 200 deprecation notice to 410 Gone. Replaced by create-guard-payout (manual admin) + create-guard-connect-account (onboarding).",
  },
  {
    slug: "cancel-stale-subscriptions",
    name: "Cancel Stale Subscriptions",
    classification: "needs_verification",
    replacement: "backfill-subscription-payments (subscription reconciliation)",
    lastInvocation: "No observable effect — 0 cancelled subscriptions in DB (all trialing/active)",
    knownCallers: "None in code. No scheduled/webhook/external caller identified.",
    cronWebhook: "None — CRON_SETUP.md lists only publish-scheduled-posts, auto-release-guard-payments, run-cleanup-now.",
    securityRisk: "Subscription cancellation. No reconciliation/cancellation schedule exists in repo; external schedulers remain unverifiable.",
    reviewer: "Dependency audit + DB invocation inspection",
    reviewDate: "2026-08-26",
    evidence: "Live-only (no repo directory). DB inspection: app.subscriptions has only trialing (6) and active (2) — zero cancelled rows, zero cancellation_reason — confirming no cancellation effect. CRON_SETUP.md has no subscription schedule. External scheduler (cron-job.org/n8n/GitHub Actions) outside repo cannot be verified → remains needs human verification.",
  },
];

interface Check {
  id: string;
  category: "critical" | "warning";
  label: string;
  status: "pass" | "fail" | "warning" | "not_verified";
  method: "auto" | "manual";
  notes: string;
  instruction: string | null;
  lastChecked: string;
  verifiedBy?: string;
  evidence?: string;
  signedOffBy?: string;
  signedOffAt?: string | null;
}

function nowIso() {
  return new Date().toISOString();
}

function manual(
  id: string,
  category: "critical" | "warning",
  label: string,
  instruction: string
): Check {
  return {
    id,
    category,
    label,
    status: "not_verified",
    method: "manual",
    notes: "Manual verification required",
    instruction,
    lastChecked: nowIso(),
  };
}

function auto(
  id: string,
  category: "critical" | "warning",
  label: string,
  status: Check["status"],
  notes: string
): Check {
  return { id, category, label, status, method: "auto", notes, instruction: null, lastChecked: nowIso() };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("authorization");
  const jwt = authHeader?.replace("Bearer ", "") || "";
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized: missing token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized: invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: adminApp } = await supabaseAdmin.schema("app").from("admin_users")
    .select("id, role, is_active, full_name, email").eq("user_id", user.id).eq("is_active", true).maybeSingle();
  let admin = adminApp;
  if (!admin) {
    const { data: adminPub } = await supabaseAdmin.schema("public").from("admin_users")
      .select("id, role, is_active, full_name, email").eq("user_id", user.id).eq("is_active", true).maybeSingle();
    admin = adminPub;
  }

  if (!admin || !["super_admin", "admin", "finance_admin"].includes(admin.role)) {
    return new Response(JSON.stringify({ error: "Forbidden: admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isSuperAdmin = admin.role === "super_admin";
  const supabaseQ = createClient(supabaseUrl, serviceKey, { db: { schema: "app" } });

  async function invokeFunction(slug: string, body: Record<string, unknown>) {
    const res = await fetch(`${supabaseUrl}/functions/v1/${slug}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return res;
  }

  async function evaluateAutoChecks(): Promise<Check[]> {
    const checks: Check[] = [];

    checks.push(auto("supabase_auth", "critical", "Supabase authentication works", "pass",
      "Admin session verified via a valid Supabase JWT. Auth service is responding."));

    const entitlementsRes = await supabaseQ.from("user_entitlements")
      .select("user_id", { count: "exact", head: true }).eq("is_active", true);
    if (entitlementsRes.error) {
      checks.push(auto("user_entitlements", "critical", "User entitlements created & activated", "fail",
        "Entitlements table unavailable: " + entitlementsRes.error.message));
    } else if ((entitlementsRes.count ?? 0) > 0) {
      checks.push(auto("user_entitlements", "critical", "User entitlements created & activated", "pass",
        `Found ${entitlementsRes.count} active entitlement record(s).`));
    } else {
      checks.push(auto("user_entitlements", "critical", "User entitlements created & activated", "not_verified",
        "No active entitlement records found — verify provisioning creates and activates entitlements for new users."));
    }

    const geocodingKey = Deno.env.get("GOOGLE_GEOCODING_API_KEY") || "";
    checks.push(auto("geocoding_secret", "critical", "Geocoding secret configured in Edge Functions", geocodingKey ? "pass" : "fail",
      geocodingKey ? "GOOGLE_GEOCODING_API_KEY secret is present." : "GOOGLE_GEOCODING_API_KEY secret is missing from Edge Function secrets."));

    let geocodeOk = false;
    let geocodeNote = "Geocode function did not respond.";
    if (geocodingKey) {
      try {
        const res = await invokeFunction("geocode-address", { query: "10 Downing Street, London" });
        if (res.ok) {
          const data = await res.json();
          if (typeof data?.latitude === "number" && typeof data?.longitude === "number") {
            geocodeOk = true;
            geocodeNote = `Test address returned coordinates (${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}).`;
          } else {
            geocodeNote = "Geocode function returned no coordinates.";
          }
        } else {
          const failure = await res.json().catch(() => ({}));
          geocodeNote = `Geocode function returned HTTP ${res.status}${failure.code ? ` (${failure.code})` : ""}. ${failure.hint || ""}`.trim();
        }
      } catch (e) {
        geocodeNote = "Geocode function unreachable: " + (e as Error).message;
      }
    } else {
      geocodeNote = "Skipped — geocoding secret not configured.";
    }
    checks.push(auto("geocoding_function", "critical", "Address geocoding returns coordinates", geocodeOk ? "pass" : geocodingKey ? "fail" : "not_verified",
      geocodeNote));

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!stripeKey) {
      checks.push(auto("stripe_mode", "critical", "Stripe payment in production mode", "fail",
        "STRIPE_SECRET_KEY secret is missing."));
    } else if (stripeKey.startsWith("sk_live_")) {
      checks.push(auto("stripe_mode", "critical", "Stripe payment in production mode", "pass",
        "Stripe is configured in live (production) mode."));
    } else if (stripeKey.startsWith("sk_test_")) {
      checks.push(auto("stripe_mode", "critical", "Stripe payment in production mode", "warning",
        "Stripe is in test mode. Switch to a live key before public launch."));
    } else {
      checks.push(auto("stripe_mode", "critical", "Stripe payment in production mode", "warning",
        "Stripe key present but mode could not be determined."));
    }

    let maintenanceData: any[] = [];
    try {
      const r = await supabaseQ.from("settings").select("key, value")
        .in("key", ["maintenance_mode", "emergency_maintenance_mode", "maintenance_scheduled_start", "maintenance_scheduled_end"]);
      maintenanceData = r.data || [];
    } catch { /* ignore */ }
    const getVal = (k: string) => maintenanceData.find((d: any) => d.key === k)?.value || "";

    const regularMM = getVal("maintenance_mode") === "true";
    const emergencyMM = getVal("emergency_maintenance_mode") === "true";
    checks.push(auto("maintenance_off", "critical", "Maintenance mode is off", regularMM || emergencyMM ? "fail" : "pass",
      regularMM || emergencyMM ? "Maintenance mode is currently ON — public site is in maintenance." : "Maintenance mode is off."));

    const schedStart = getVal("maintenance_scheduled_start");
    const schedEnd = getVal("maintenance_scheduled_end");
    let schedActive = false;
    if (schedStart && schedEnd) {
      const now = Date.now();
      schedActive = now >= new Date(schedStart).getTime() && now <= new Date(schedEnd).getTime();
    }
    checks.push(auto("scheduled_maintenance", "critical", "No scheduled maintenance is active", schedActive ? "fail" : "pass",
      schedActive ? "A scheduled maintenance window is currently active." :
        (schedStart && schedEnd ? "No maintenance window currently active." : "No scheduled maintenance configured.")));

    let healthOk = false;
    let healthNote = "system-health function did not respond.";
    try {
      const res = await invokeFunction("system-health", {});
      if (res.ok) {
        const data = await res.json();
        if (data?.status && ["healthy", "degraded"].includes(data.status)) {
          healthOk = true;
          healthNote = `Core runtime healthy (status: ${data.status}).`;
        } else {
          healthNote = `Core runtime reported status: ${data?.status || "unknown"}.`;
        }
      } else {
        healthNote = `system-health returned HTTP ${res.status}.`;
      }
    } catch (e) {
      healthNote = "system-health unreachable: " + (e as Error).message;
    }
    checks.push(auto("edge_functions", "critical", "Required Edge Functions deployed & healthy",
      healthOk ? "pass" : "fail", healthNote));

    let rlsStatus: Check["status"] = "not_verified";
    let rlsNote = "RLS table inventory could not be verified automatically.";
    try {
      const { data: tables, error } = await supabaseQ.rpc("launch_rls_inventory");
      if (error) {
        rlsNote = `RLS audit query failed (${error.code || "unknown"}); coverage is unverified.`;
      } else {
        const appTables = (tables || []).filter((t: any) => t.schema_name === "app");
        const withoutRLS = appTables.filter((t: any) => !t.rls_enabled);
        if (appTables.length > 0) {
          rlsStatus = withoutRLS.length ? "fail" : "pass";
          rlsNote = withoutRLS.length
            ? `RLS missing on: ${withoutRLS.map((t: any) => t.table_name).join(", ")}`
            : `RLS enabled on all ${appTables.length} app tables. Policy effectiveness requires separate access tests.`;
        } else {
          rlsNote = "RLS audit returned no app tables; coverage is unverified.";
        }
      }
    } catch { /* unavailable audits must never pass */ }
    checks.push(auto("rls_policies", "critical", "RLS enabled on application tables", rlsStatus, rlsNote));
    checks.push(auto("rls_policy_effectiveness", "critical", "RLS policies prevent unauthorised access", "not_verified",
      "Table coverage alone does not prove policy effectiveness. Verify anonymous and cross-account access before sign-off."));

    let domainStatus: Check["status"] = "not_verified";
    let domainNote = "Production HTTPS could not be verified.";
    try {
      const response = await fetch("https://quickguard.uk", { signal: AbortSignal.timeout(10000), redirect: "follow" });
      const destination = new URL(response.url);
      const html = await response.text();
      const validDestination = destination.protocol === "https:" && ["quickguard.uk", "www.quickguard.uk"].includes(destination.hostname);
      domainStatus = response.ok && validDestination && /quickguard/i.test(html) ? "pass" : "fail";
      domainNote = domainStatus === "pass"
        ? "Verified https://quickguard.uk responds successfully over HTTPS with QuickGuard content."
        : `Production site verification failed (HTTP ${response.status}); check HTTPS, redirects and site content.`;
    } catch { /* network failures remain unverified */ }
    checks.push(auto("production_domain", "critical", "Production domain & HTTPS working", domainStatus, domainNote));

    const needsVerification = RETIREMENT_REGISTER.filter((r) => r.classification === "needs_verification");
    const safelyRemovable = RETIREMENT_REGISTER.filter((r) => r.classification === "retired_removable");
    const keptDisabled = RETIREMENT_REGISTER.filter((r) => r.classification === "retired_disabled");
    const active = RETIREMENT_REGISTER.filter((r) => r.classification === "active");

    const retiredStatus: Check["status"] = needsVerification.length > 0 ? "warning" : "pass";
    const retiredNote = needsVerification.length > 0
      ? `${needsVerification.length} retired function(s) still need human verification: ${needsVerification.map((r) => r.slug).join(", ")}. ${safelyRemovable.length} confirmed safely removable (reviewed).`
      : `All retired functions reviewed. ${safelyRemovable.length} safely removable, ${keptDisabled.length} kept disabled, ${active.length} active.`;
    checks.push(auto("retired_functions", "warning", "Retired Edge Functions reviewed & classified", retiredStatus, retiredNote));

    const retiredBootstrapSlugs = ["create-admin-martin", "set-martin-password", "debug-admin-lookup"];
    const bootstrapProbes = await Promise.all(retiredBootstrapSlugs.map(async (slug) => {
      try {
        const res = await invokeFunction(slug, {});
        return { slug, status: res.status, retired: res.status === 410 || res.status === 404 };
      } catch {
        return { slug, status: 0, retired: false };
      }
    }));
    const stillReachable = bootstrapProbes.filter((p) => !p.retired);
    checks.push(auto("bootstrap_endpoints_retired", "critical", "Legacy admin bootstrap endpoints return 404/410",
      stillReachable.length === 0 ? "pass" : "fail",
      stillReachable.length === 0
        ? "create-admin-martin, set-martin-password and debug-admin-lookup all return HTTP 404/410 with no privileged action."
        : `Still reachable: ${stillReachable.map((p) => `${p.slug}(${p.status})`).join(", ")}`));

    return checks;
  }

  async function manualChecks(): Promise<Check[]> {
    return [
      manual("client_registration", "critical", "Client registration and login work",
        "Create a new client account end-to-end, confirm the account is created and you can log in successfully."),
      manual("guard_registration", "critical", "Guard registration and login work",
        "Register a new guard, complete onboarding, and confirm the guard can log in."),
      manual("post_job_wizard", "critical", "Post-job wizard opens and saves",
        "Open the post-job wizard, complete every step, and confirm the job saves and appears in the jobs list."),
      manual("maps_embed_preview", "critical", "Maps Embed API preview displays correctly",
        "Confirm the embedded map preview below renders correctly with the configured key."),
      manual("guard_matching", "critical", "Distance-based guard matching works",
        "Post a job and confirm nearby guards are matched by distance and receive notifications."),
      manual("payment_confirmation", "critical", "Payment confirmation updates the job correctly",
        "Complete a test payment and confirm the job status and payment records update correctly."),
      manual("console_errors", "critical", "No critical console or network errors",
        "Browse the public site and key flows with the browser devtools open; confirm no critical console or network errors."),
      manual("apple_auth", "warning", "Apple authentication enabled or intentionally disabled",
        "Confirm Apple Sign-In is either enabled or intentionally disabled for this launch."),
      manual("analytics", "warning", "Analytics and monitoring configured",
        "Confirm analytics and error monitoring are configured for the production environment."),
      manual("support_contact", "warning", "Support contact details published",
        "Confirm support contact details are published on the site."),
      manual("legal_links", "warning", "Privacy policy and terms links available",
        "Confirm privacy policy and terms of service links are present and resolve correctly."),
    ];
  }

  async function applySignoffs(checks: Check[]): Promise<Check[]> {
    const { data: signoffs } = await supabaseQ.from("launch_readiness_check_signoffs").select("*");
    if (!Array.isArray(signoffs) || signoffs.length === 0) return checks;
    const map = new Map<string, any>(signoffs.map((s: any) => [s.check_id, s]));
    return checks.map((c) => {
      if (c.method !== "manual") return c;
      const s = map.get(c.id);
      if (!s) return c;
      return {
        ...c,
        status: s.status,
        verifiedBy: s.verified_by || "",
        evidence: s.evidence || "",
        signedOffBy: s.signed_off_by || "",
        signedOffAt: s.signed_off_at || null,
        lastChecked: s.updated_at || c.lastChecked,
      };
    });
  }

  try {
    const body = await req.json().catch((_err) => ({ action: "" }));
    const action = body.action;

    if (action === "run" || action === "recheck") {
      const [autoChecks, manualOnes] = await Promise.all([evaluateAutoChecks(), manualChecks()]);
      let checks = [...autoChecks, ...manualOnes];
      if (action === "recheck" && body.checkId) {
        checks = checks.filter((c) => c.id === body.checkId);
      }
      checks = await applySignoffs(checks);
      const domainCheck = autoChecks.find((c) => c.id === "production_domain");
      return new Response(JSON.stringify({
        timestamp: nowIso(),
        environment: {
          host: "quickguard.uk",
          https: domainCheck?.status === "pass",
          isDev: false,
        },
        checks,
        retirement_register: RETIREMENT_REGISTER,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "history") {
      const { data } = await supabaseQ.from("launch_readiness_decisions")
        .select("*").order("created_at", { ascending: false }).limit(20);
      return new Response(JSON.stringify({ decisions: data || [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "retirement_history") {
      const { data } = await supabaseQ.from("edge_function_retirements")
        .select("*").order("created_at", { ascending: false }).limit(100);
      return new Response(JSON.stringify({ approvals: data || [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve_retirement") {
      if (!isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: Super Admin approval required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { function_slug, decision, evidence, reason } = body;
      if (!function_slug || !["delete", "disable", "keep"].includes(decision)) {
        return new Response(JSON.stringify({ error: "Invalid request: function_slug and a valid decision are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const record = RETIREMENT_REGISTER.find((r) => r.slug === function_slug);
      if (!record) {
        return new Response(JSON.stringify({ error: "Unknown function slug" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: inserted, error: insertError } = await supabaseQ.from("edge_function_retirements")
        .insert({
          function_slug: record.slug,
          function_name: record.name,
          classification: record.classification,
          decision,
          replacement: record.replacement,
          evidence: evidence || record.evidence,
          reason: reason || `${decision === "delete" ? "Removal" : decision === "disable" ? "Permanent disable" : "Keep"} of retired function approved by Super Admin after dependency audit.`,
          approved_by: admin.full_name || admin.email,
          approved_by_email: admin.email,
          approved_by_user_id: user.id,
        }).select("id").maybeSingle();

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseQ.from("admin_activity_log").insert({
        admin_username: admin.email,
        admin_name: admin.full_name || admin.email,
        action_type: "edge_function_retirement_approved",
        action_description: `Edge function retirement approved: ${record.slug} -> ${decision}`,
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
      }).catch(() => {});

      return new Response(JSON.stringify({ success: true, id: inserted?.id || null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sign_off_check") {
      const { check_id, status, verified_by, evidence } = body;
      if (!check_id || !["pass", "fail", "warning", "not_verified"].includes(status)) {
        return new Response(JSON.stringify({ error: "Invalid request: check_id and a valid status are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: upserted, error: upsertError } = await supabaseQ.from("launch_readiness_check_signoffs")
        .upsert({
          check_id,
          status,
          verified_by: verified_by || admin.full_name || admin.email,
          evidence: evidence || null,
          signed_off_by: admin.full_name || admin.email,
          signed_off_by_email: admin.email,
          signed_off_by_user_id: user.id,
          updated_at: nowIso(),
        }, { onConflict: "check_id" }).select("id").maybeSingle();

      if (upsertError) {
        return new Response(JSON.stringify({ error: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseQ.from("admin_activity_log").insert({
        admin_username: admin.email,
        admin_name: admin.full_name || admin.email,
        action_type: "launch_check_signed_off",
        action_description: `Launch check signed off: ${check_id} -> ${status}`,
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
      }).catch(() => {});

      return new Response(JSON.stringify({ success: true, id: upserted?.id || null, check_id, status }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_decision") {
      if (!isSuperAdmin && admin.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden: insufficient permissions" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { decision, notes, results, confirmed } = body;
      if (!confirmed) {
        return new Response(JSON.stringify({ error: "You must confirm the launch decision" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!["GO", "CONDITIONAL GO", "NO-GO"].includes(decision)) {
        return new Response(JSON.stringify({ error: "Invalid decision" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const resultsArr = Array.isArray(results) ? results : [];
      if (decision === "GO") {
        const blockers = resultsArr.filter((c: any) =>
          c.category === "critical" && (c.status === "fail" || c.status === "not_verified"));
        if (blockers.length > 0) {
          return new Response(JSON.stringify({
            error: `Cannot approve GO — ${blockers.length} critical check(s) are failing or unverified.`,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const { data: inserted, error: insertError } = await supabaseQ.from("launch_readiness_decisions")
        .insert({
          decision,
          notes: notes || null,
          approved_by: admin.full_name || admin.email,
          approved_by_email: admin.email,
          approved_by_user_id: user.id,
          results: resultsArr,
        }).select("id").maybeSingle();

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseQ.from("admin_activity_log").insert({
        admin_username: admin.email,
        admin_name: admin.full_name || admin.email,
        action_type: "launch_decision_saved",
        action_description: `Launch decision saved: ${decision}`,
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
      }).catch(() => {});

      return new Response(JSON.stringify({ success: true, id: inserted?.id || null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("launch-readiness error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
