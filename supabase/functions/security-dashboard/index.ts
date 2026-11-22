
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { assessBackup } from '../_shared/backup-health.ts';
import type { BackupRecord } from '../_shared/backup-health.ts';
import { emailConfiguration, stripeHealth } from '../_shared/admin-service-health.ts';
import { isInfrastructureSnapshot, isInfrastructureBuckets } from '../_shared/admin-infrastructure.ts';

function hasMfaAssurance(token: string): boolean {
  try {
    const base=token.split('.')[1]?.replace(/-/g,'+').replace(/_/g,'/');
    if (!base) return false;
    const payload: unknown=JSON.parse(atob(base+'='.repeat((4-base.length%4)%4)));
    return typeof payload === 'object' && payload !== null && 'aal' in payload && payload.aal === 'aal2';
  } catch { return false; }
}

async function loadInfrastructure(app: ReturnType<typeof createClient>, admin: ReturnType<typeof createClient>) {
  const [snapshot, buckets] = await Promise.all([
    app.rpc('get_admin_infrastructure_snapshot'), admin.storage.listBuckets(),
  ]);
  const metadata: unknown=snapshot.data;
  const bucketRows: unknown=buckets.data;
  if (snapshot.error || !isInfrastructureSnapshot(metadata) || buckets.error || !isInfrastructureBuckets(bucketRows)) {
    throw new Error('Infrastructure audit could not be loaded');
  }
  return { ...metadata, buckets: bucketRows.map(b => ({ id:b.id,name:b.name,public:b.public,createdAt:b.created_at })) };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const KNOWN_FUNCTIONS_FALLBACK: Record<string, { name: string; verify_jwt: boolean }> = {
  "create-subscription-checkout": { name: "Create Subscription Checkout", verify_jwt: true },
  "create-job-payment": { name: "Create Job Payment", verify_jwt: true },
  "create-guard-payout": { name: "Create Guard Payout", verify_jwt: true },
  "process-overdue-guard-payouts": { name: "Overdue Guard Payout Worker", verify_jwt: false },
  "release-guard-payment": { name: "Release Guard Payment (Retired)", verify_jwt: true },
  "email-confirmation": { name: "Email Confirmation", verify_jwt: false },
  "send-job-posted-email": { name: "Send Job Posted Email", verify_jwt: true },
  "get-pending-verifications": { name: "Get Pending Verifications", verify_jwt: true },
  "sia-verification-webhook": { name: "SIA Verification Webhook", verify_jwt: false },
  "send-job-deleted-email": { name: "Send Job Deleted Email", verify_jwt: true },
  "send-job-match-email": { name: "Send Job Match Email", verify_jwt: true },
  "send-application-status-email": { name: "Send Application Status Email", verify_jwt: true },
  "send-payment-notification-email": { name: "Send Payment Notification Email", verify_jwt: true },
  "send-guard-approval-email": { name: "Send Guard Approval Email", verify_jwt: true },
  "enhanced-stripe-webhook": { name: "Enhanced Stripe Webhook", verify_jwt: false },
  "retry-failed-payment": { name: "Retry Failed Payment", verify_jwt: true },
  "send-payment-receipt": { name: "Send Payment Receipt", verify_jwt: true },
  "send-job-application-email": { name: "Send Job Application Email", verify_jwt: true },
  "send-accessibility-feedback-email": { name: "Send Accessibility Feedback Email", verify_jwt: false },
  "send-accessibility-feedback-confirmation": { name: "Send Accessibility Feedback Confirmation", verify_jwt: false },
  "send-job-payment-complete-email": { name: "Send Job Payment Complete Email", verify_jwt: true },
  "admin-register": { name: "Admin Register", verify_jwt: true },
  "admin-login": { name: "Admin Login", verify_jwt: false },
  "send-admin-password-reset-alert": { name: "Send Admin Password Reset Alert", verify_jwt: true },
  "create-super-admin": { name: "Create Super Admin", verify_jwt: true },
  "send-contact-form-email": { name: "Send Contact Form Email", verify_jwt: false },
  "send-job-completed-guard-email": { name: "Send Job Completed Guard Email", verify_jwt: true },
  "send-invoice-email": { name: "Send Invoice Email", verify_jwt: true },
  "send-maintenance-notification": { name: "Send Maintenance Notification", verify_jwt: true },
  "get-guards": { name: "Get Guards", verify_jwt: true },
  "notify-matching-guards": { name: "Notify Matching Guards", verify_jwt: true },
  "geocode-address": { name: "Geocode Address", verify_jwt: true },
  "set-admin-password": { name: "Set Admin Password", verify_jwt: true },
  "debug-hash": { name: "Debug Hash", verify_jwt: true },
  "fix-admin-password": { name: "Fix Admin Password", verify_jwt: true },
  "admin-verify-guard": { name: "Admin Verify Guard", verify_jwt: true },
  "cancel-job": { name: "Cancel Job", verify_jwt: true },
  "send-booking-confirmation": { name: "Send Booking Confirmation", verify_jwt: true },
  "assign-guard-promo-tier": { name: "Assign Guard Promo Tier", verify_jwt: true },
  "send-guard-promo-welcome": { name: "Send Guard Promo Welcome", verify_jwt: true },
  "send-client-tier-email": { name: "Send Client Tier Email", verify_jwt: true },
  "list-stripe-products": { name: "List Stripe Products", verify_jwt: true },
  "sync-stripe-prices": { name: "Sync Stripe Prices", verify_jwt: true },
  "cancel-subscription": { name: "Cancel Subscription", verify_jwt: true },
  "resume-subscription": { name: "Resume Subscription", verify_jwt: true },
  "create-wizard-checkout": { name: "Create Wizard Checkout", verify_jwt: true },
  "check-stripe-session": { name: "Check Stripe Session", verify_jwt: true },
  "admin-clients": { name: "Admin Clients", verify_jwt: true },
  "admin-security": { name: "Admin Security", verify_jwt: true },
  "create-admin-martin": { name: "Create Admin Martin", verify_jwt: true },
  "set-martin-password": { name: "Set Martin Password", verify_jwt: true },
  "admin-security-v2": { name: "Admin Security V2", verify_jwt: true },
  "debug-admin-lookup": { name: "Debug Admin Lookup", verify_jwt: true },
  "security-dashboard": { name: "Security Dashboard", verify_jwt: true },
  "admin-account-profile": { name: "Admin Account Profile", verify_jwt: true },
  "admin-change-password": { name: "Admin Change Password", verify_jwt: true },
  "send-profile-nudge": { name: "Send Profile Nudge", verify_jwt: true },
  "audit-stripe": { name: "Audit Stripe", verify_jwt: true },
  "get-vapid-public-key": { name: "Get VAPID Public Key", verify_jwt: true },
  "send-push-notification": { name: "Send Push Notification", verify_jwt: true },
  "setup-push-vapid": { name: "Setup Push VAPID", verify_jwt: true },
  "register-magic-link": { name: "Register Magic Link", verify_jwt: true },
  "update-after-payment": { name: "Update After Payment", verify_jwt: true },
  "create-connect-account": { name: "Create Connect Account", verify_jwt: true },
  "get-connect-status": { name: "Get Connect Status", verify_jwt: true },
  "get-client-dashboard-data": { name: "Get Client Dashboard Data", verify_jwt: true },
  "send-failed-payment-email": { name: "Send Failed Payment Email", verify_jwt: true },
  "send-cancellation-notification": { name: "Send Cancellation Notification", verify_jwt: true },
  "send-refund-notification": { name: "Send Refund Notification", verify_jwt: true },
  "process-email-queue": { name: "Process Email Queue", verify_jwt: true },
  "create-guard-from-admin": { name: "Create Guard from Admin", verify_jwt: true },
  "monthly-finance-snapshot": { name: "Monthly Finance Snapshot", verify_jwt: true },
  "send-daily-digest": { name: "Send Daily Digest", verify_jwt: true },
  "send-weekly-digest": { name: "Send Weekly Digest", verify_jwt: true },
  "get-job-detail": { name: "Get Job Detail", verify_jwt: true },
  "request-job-completion": { name: "Request Job Completion", verify_jwt: true },
  "approve-job-completion": { name: "Approve Job Completion", verify_jwt: true },
  "get-completion-requests": { name: "Get Completion Requests", verify_jwt: true },
  "connect-guard-payout": { name: "Connect Guard Payout (Deprecated)", verify_jwt: true },
  "dispute-job": { name: "Dispute Job", verify_jwt: true },
  "resolve-dispute": { name: "Resolve Dispute", verify_jwt: true },
  "get-guard-job-history": { name: "Get Guard Job History", verify_jwt: true },
  "get-client-job-history": { name: "Get Client Job History", verify_jwt: true },
  "calculate-job-fees": { name: "Calculate Job Fees", verify_jwt: true },
  "notify-free-tier-limits": { name: "Notify Free Tier Limits", verify_jwt: true },
  "fix-admin-auth-user": { name: "Fix Admin Auth User", verify_jwt: true },
  "provision-user-account": { name: "Provision User Account", verify_jwt: true },
  "repair-account": { name: "Repair Account", verify_jwt: true },
  "render-email-template": { name: "Render Email Template", verify_jwt: true },
  "send-welcome-email": { name: "Send Welcome Email", verify_jwt: true },
  "purge-rate-limit-events": { name: "Purge Rate Limit Events", verify_jwt: true },
  "system-health": { name: "System Health", verify_jwt: true },
  "run-cleanup-now": { name: "Run Cleanup Now", verify_jwt: true },
  "sia-check": { name: "SIA Check", verify_jwt: true },
  "apply-to-job": { name: "Apply to Job", verify_jwt: true },
  "cancel-stale-subscriptions": { name: "Cancel Stale Subscriptions", verify_jwt: true },
  "get-storage-usage": { name: "Get Storage Usage", verify_jwt: true },
  "send-plan-change-alert": { name: "Send Plan Change Alert to Admins", verify_jwt: true },
  "send-guard-booking-confirmation": { name: "Send Guard Booking Confirmation", verify_jwt: true },
  "admin-delete-user": { name: "Admin Delete User", verify_jwt: true },
  "backfill-subscription-payments": { name: "Backfill Subscription Payments", verify_jwt: true },
  "stripe-webhook": { name: "Stripe Webhook", verify_jwt: false },
};

const PUBLIC_WEBHOOK_PATTERNS = ["webhook", "stripe-webhook"];

function resolveVerifyJwt(slug: string, apiValue: any): boolean {
  const known = KNOWN_FUNCTIONS_FALLBACK[slug];
  if (known) {
    return known.verify_jwt;
  }
  const lower = slug.toLowerCase();
  if (PUBLIC_WEBHOOK_PATTERNS.some((p) => lower.includes(p))) {
    return false;
  }
  if (typeof apiValue === 'boolean') {
    return apiValue;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { action } = body;

  try {
    if (action === 'echo') {
      return new Response(
        JSON.stringify({ ok: true, action, timestamp: new Date().toISOString() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("authorization");
    const jwt = authHeader?.replace("Bearer ", "") || "";

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!hasMfaAssurance(jwt)) {
      return new Response(JSON.stringify({error:'MFA required'}), {
        status:403,headers:{...corsHeaders,'Content-Type':'application/json'},
      });
    }

    const { data: adminUser } = await supabaseAdmin
      .schema("app")
      .from("admin_users")
      .select("id, role, is_active, user_id, email")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    let resolvedAdmin = adminUser;
    if (!resolvedAdmin) {
      const { data: publicAdmin } = await supabaseAdmin
        .schema("public")
        .from("admin_users")
        .select("id, role, is_active, user_id, email")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      resolvedAdmin = publicAdmin;
    }

    if (!resolvedAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!['super_admin', 'admin', 'finance_admin'].includes(resolvedAdmin.role)) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isSuperAdmin = resolvedAdmin.role === 'super_admin';
    const supabaseQ = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    if (action === 'security_data') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        loginRes, resetRes, adminCountsRes, recentActivityRes,
        failedLogins24hRes, rateLimit24hRes, adminSessionsRes
      ] = await Promise.allSettled([
        supabaseQ.from('admin_activity_log').select('*')
          .in('action_type', ['login', 'login_failed', 'logout'])
          .order('created_at', { ascending: false }).limit(50),
        supabaseQ.from('admin_activity_log').select('*')
          .in('action_type', ['password_reset_requested', 'password_reset_completed', 'password_reset_failed'])
          .order('created_at', { ascending: false }).limit(50),
        supabaseQ.from('admin_users').select('role, is_active, last_login, email'),
        supabaseQ.from('admin_activity_log').select('*')
          .order('created_at', { ascending: false }).limit(20),
        supabaseAdmin.schema('app').from('admin_login_attempts').select('*')
          .gte('attempted_at', new Date(Date.now() - 24 * 3600000).toISOString())
          .order('attempted_at', { ascending: false }).limit(100),
        supabaseAdmin.schema('app').from('rate_limit_events').select('*')
          .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())
          .order('created_at', { ascending: false }).limit(100),
        supabaseQ.from('admin_sessions').select('*')
          .eq('is_active', true)
          .order('last_seen_at', { ascending: false }).limit(20),
      ]);

      const logins = loginRes.status === 'fulfilled' ? (loginRes.value.data || []) : [];
      const resets = resetRes.status === 'fulfilled' ? (resetRes.value.data || []) : [];
      const adms = adminCountsRes.status === 'fulfilled' ? (adminCountsRes.value.data || []) : [];
      const recentActivity = recentActivityRes.status === 'fulfilled' ? (recentActivityRes.value.data || []) : [];
      const failed24h = failedLogins24hRes.status === 'fulfilled' ? (failedLogins24hRes.value.data || []) : [];
      const rateLimits = rateLimit24hRes.status === 'fulfilled' ? (rateLimit24hRes.value.data || []) : [];
      const sessions = adminSessionsRes.status === 'fulfilled' ? (adminSessionsRes.value.data || []) : [];

      const todayLogins = logins.filter((e: any) => new Date(e.created_at) >= todayStart && e.action_type === 'login');
      const failedToday = logins.filter((e: any) => new Date(e.created_at) >= todayStart && e.action_type === 'login_failed');
      const todayResets = resets.filter((e: any) => new Date(e.created_at) >= todayStart);
      const uniqueAdmins = new Set(logins.map((e: any) => e.admin_username)).size;

      const superAdmins = adms.filter((a: any) => a.role === 'super_admin').length;
      const totalAdmins = adms.length;
      const inactiveAdmins = adms.filter((a: any) => !a.is_active || !a.last_login).length;
      const lockedAccounts = 0;
      const lastAdminLogin = adms.length > 0
        ? adms.reduce((latest: any, a: any) => a.last_login && new Date(a.last_login) > new Date(latest) ? a.last_login : latest, '1970-01-01')
        : null;

      const permissionChanges7d = recentActivity
        .filter((e: any) => ['permission_change', 'role_change', 'change_permissions'].includes(e.action_type)).length;

      const blockedIPs = new Set(failed24h.filter((e: any) => !e.success).map((e: any) => e.ip_address)).size;
      const rateLimitHits = rateLimits.filter((r: any) => r.blocked).length;
      const multiCountryLogins = 0;

      const timelineEvents = recentActivity.slice(0, 15).map((e: any) => ({
        id: e.id,
        type: e.action_type === 'login' ? 'login'
          : e.action_type === 'login_failed' ? 'failed_login'
          : e.action_type === 'logout' ? 'login'
          : e.action_type === 'password_reset_requested' ? 'password'
          : e.action_type === 'password_reset_completed' ? 'password'
          : e.action_type === 'password_reset_failed' ? 'password'
          : e.action_type === 'deploy_function' ? 'deploy'
          : e.action_type === 'emergency_setting_change' ? 'emergency'
          : e.action_type === 'stripe_webhook' ? 'stripe'
          : e.action_type === 'rls_policy_update' ? 'rls'
          : e.action_type === 'change_permissions' ? 'permission'
          : 'login',
        description: e.action_description || e.action_type,
        admin: e.admin_username || e.admin_name || 'System',
        time: e.created_at,
        ip: e.ip_address,
        severity: e.action_type.includes('failed') ? 'high' : e.action_type.includes('emergency') ? 'critical' : 'low',
      }));

      return new Response(JSON.stringify({
        loginEvents: logins,
        resetEvents: resets,
        stats: {
          loginsToday: todayLogins.length,
          failedLogins: failedToday.length,
          resetsToday: todayResets.length,
          uniqueAdmins,
        },
        adminCounts: {
          superAdmins,
          totalAdmins,
          inactiveAdmins,
          lockedAccounts,
          permissionChanges7d,
          lastAdminLogin,
        },
        suspiciousActivity: {
          failedLogins24h: failed24h.filter((e: any) => !e.success).length,
          blockedIPs,
          rateLimitHits,
          multiCountryLogins,
          apiAbuse: 0,
          passwordResetSpikes: todayResets.length > 5 ? todayResets.length : 0,
        },
        timeline: timelineEvents,
        activeSessions: sessions.map((s: any) => ({
          id: s.id,
          admin: s.email,
          role: 'admin',
          lastActivity: s.last_seen_at,
          status: (s.last_seen_at && new Date(s.last_seen_at).getTime() > Date.now() - 3600000) ? 'active' : 'idle',
        })),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'infrastructure_audit') {
      try {
        return new Response(JSON.stringify(await loadInfrastructure(supabaseQ,supabaseAdmin)), {
          status:200,headers:{...corsHeaders,'Content-Type':'application/json'},
        });
      } catch {
        return new Response(JSON.stringify({error:'Infrastructure audit could not be loaded'}), {
          status:503,headers:{...corsHeaders,'Content-Type':'application/json'},
        });
      }
    }

    if (action === 'edge_functions_audit') {
      const accessToken = Deno.env.get("SB_ACCESS_TOKEN");
      if (!accessToken) {
        const fallback = Object.entries(KNOWN_FUNCTIONS_FALLBACK).map(([slug, fn]) => ({
          name: fn.name,
          slug,
          version: 1,
          status: "ACTIVE" as const,
          verify_jwt: fn.verify_jwt,
          created_at: null,
          updated_at: null,
          source: "registry",
        }));
        const jwtCount = fallback.filter(f => f.verify_jwt).length;
        return new Response(JSON.stringify({
          functions: fallback,
          total: fallback.length,
          jwt_protected: jwtCount,
          jwt_pct: Math.round((jwtCount / fallback.length) * 100),
          source: "registry",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1] || "";
      if (!projectRef) {
        return new Response(JSON.stringify({ functions: [], error: "Could not parse project ref" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      try {
        const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions`, {
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        });

        if (!mgmtRes.ok) {
          const errText = await mgmtRes.text();
          console.error("[edge_functions_audit] Management API error:", mgmtRes.status, errText);
          return new Response(JSON.stringify({ functions: [], error: `Management API ${mgmtRes.status}` }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const functionsList = await mgmtRes.json();

        const enriched = (functionsList || []).map((fn: any) => {
          const slug = fn.slug || '';
          const known = KNOWN_FUNCTIONS_FALLBACK[slug];
          const verify_jwt = resolveVerifyJwt(slug, fn.verify_jwt);

          return {
            name: fn.name || known?.name || slug,
            slug,
            version: fn.version || 1,
            status: fn.status || 'ACTIVE',
            verify_jwt,
            created_at: fn.created_at || null,
            updated_at: fn.updated_at || null,
            source: "registry_authoritative",
          };
        });

        const jwtCount = enriched.filter((f: any) => f.verify_jwt).length;

        return new Response(JSON.stringify({
          functions: enriched,
          total: enriched.length,
          jwt_protected: jwtCount,
          jwt_pct: enriched.length > 0 ? Math.round((jwtCount / enriched.length) * 100) : 100,
          source: "registry_authoritative",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (mgmtErr: any) {
        console.error("[edge_functions_audit] Exception:", mgmtErr);
        const fallback = Object.entries(KNOWN_FUNCTIONS_FALLBACK).map(([slug, fn]) => ({
          name: fn.name,
          slug,
          version: 1,
          status: "ACTIVE" as const,
          verify_jwt: fn.verify_jwt,
          created_at: null,
          updated_at: null,
          source: "registry",
        }));
        const jwtCount = fallback.filter(f => f.verify_jwt).length;
        return new Response(JSON.stringify({
          functions: fallback,
          total: fallback.length,
          jwt_protected: jwtCount,
          jwt_pct: Math.round((jwtCount / fallback.length) * 100),
          source: "registry",
        }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === 'track_admin_session') {
      const { session_id, ip_address, user_agent, browser, os, country } = body;
      const now = new Date().toISOString();

      const { data: existing } = await supabaseQ.from('admin_sessions')
        .select('id')
        .eq('admin_user_id', resolvedAdmin.id)
        .eq('is_active', true)
        .order('login_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabaseQ.from('admin_sessions')
          .update({
            last_seen_at: now,
            ip_address: ip_address || null,
            user_agent: user_agent || null,
            browser: browser || null,
            os: os || null,
            country: country || null,
          })
          .eq('id', existing.id);
      } else {
        await supabaseQ.from('admin_sessions').insert({
          admin_user_id: resolvedAdmin.id,
          email: resolvedAdmin.email,
          session_id: session_id || null,
          ip_address: ip_address || null,
          user_agent: user_agent || null,
          browser: browser || null,
          os: os || null,
          country: country || null,
          login_at: now,
          last_seen_at: now,
          is_active: true,
        });
      }

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'revoke_admin_session') {
      if (!isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: Super Admin only" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { session_id } = body;
      if (!session_id) {
        return new Response(JSON.stringify({ error: "Missing session_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error } = await supabaseQ.from('admin_sessions')
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq('id', session_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabaseQ.from('admin_activity_log').insert({
        admin_username: resolvedAdmin.email || `admin_${resolvedAdmin.id}`,
        admin_name: 'Super Admin',
        action_type: 'session_revoked',
        action_description: `Revoked admin session ${session_id}`,
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
      });

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'revoke_all_other_admin_sessions') {
      if (!isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: Super Admin only" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error } = await supabaseQ.from('admin_sessions')
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .neq('admin_user_id', resolvedAdmin.id)
        .eq('is_active', true);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabaseQ.from('admin_activity_log').insert({
        admin_username: resolvedAdmin.email || `admin_${resolvedAdmin.id}`,
        admin_name: 'Super Admin',
        action_type: 'all_sessions_revoked',
        action_description: 'Emergency: revoked all other admin sessions',
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
      });

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'get_emergency_settings') {
      const { data, error } = await supabaseQ.from('settings').select('key, value').like('key', 'emergency_%');
      if (error) {
        return new Response(JSON.stringify({ settings: {}, error: error.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const settingsMap: Record<string, string> = {};
      (data || []).forEach((row: any) => { settingsMap[row.key] = row.value; });
      return new Response(JSON.stringify({ settings: settingsMap }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'set_emergency_setting') {
      const { key, value } = body;
      if (!key || !key.startsWith('emergency_')) {
        return new Response(JSON.stringify({ error: "Invalid setting key" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (resolvedAdmin.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Forbidden: Super Admin only" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await supabaseQ.from('settings').upsert(
        { key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' }
      );
      if (error) {
        return new Response(JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabaseQ.from('admin_activity_log').insert({
        admin_username: resolvedAdmin.email || `admin_${resolvedAdmin.id}`,
        admin_name: 'Super Admin',
        action_type: 'emergency_setting_change',
        action_description: `Emergency setting "${key}" set to "${value}"`,
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
      });
      return new Response(JSON.stringify({ success: true, key, value }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'api_secret_status') {
      if (!isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: Super Admin only" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const secretsToCheck: { service: string; key: string }[] = [
        { service: 'Supabase', key: 'SUPABASE_SERVICE_ROLE_KEY' },
        { service: 'Stripe', key: 'STRIPE_SECRET_KEY' },
        { service: 'SMTP (Resend)', key: 'SMTP_HOST' },
        { service: 'Google Maps', key: 'GOOGLE_MAPS_API_KEY' },
        { service: 'OpenAI', key: 'OPENAI_API_KEY' },
        { service: 'Google Gemini', key: 'GEMINI_API_KEY' },
        { service: 'reCAPTCHA', key: 'RECAPTCHA_SECRET_KEY' },
      ];
      const results = secretsToCheck.map((s) => ({
        service: s.service,
        configured: !!Deno.env.get(s.key),
        status: Deno.env.get(s.key) ? 'healthy' as const : 'warning' as const,
        last_checked: new Date().toISOString(),
      }));
      return new Response(JSON.stringify({ secrets: results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'payment_email_status') {
      const { data: metrics, error } = await supabaseQ.rpc('get_admin_service_metrics');
      if (error || !metrics?.stripe || !metrics?.email) {
        return new Response(JSON.stringify({ error: 'Admin service metrics could not be loaded' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const email = emailConfiguration(name => Deno.env.get(name));
      const apiHealth = await stripeHealth(Deno.env.get('STRIPE_SECRET_KEY'));
      return new Response(JSON.stringify({
        stripe: {
          ...metrics.stripe, apiHealth,
          signingSecret: Deno.env.get('STRIPE_WEBHOOK_SECRET') ? 'Configured' : 'Missing',
        },
        email: {
          ...metrics.email, provider: email.provider,
          configured: email.status === 'configured',
          smtpConnected: email.provider === 'SMTP' && email.status === 'configured',
        },
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'backup_compliance_status') {
      const [backupRes, complianceRes] = await Promise.allSettled([
        supabaseQ.from('security_backup_status').select('*').order('created_at', { ascending: true }),
        supabaseQ.from('compliance_status').select('*').order('created_at', { ascending: true }),
      ]);

      if (backupRes.status === 'rejected' || backupRes.value.error || complianceRes.status === 'rejected' || complianceRes.value.error) {
        return new Response(JSON.stringify({ error: 'Unable to load backup and compliance records' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const backups = (backupRes.value.data || []).map((record: BackupRecord) => ({
        ...record, recorded_status: record.status, ...assessBackup(record),
      }));
      const compliance = complianceRes.status === 'fulfilled' ? (complianceRes.value.data || []) : [];

      return new Response(JSON.stringify({
        backups: backups.length > 0 ? backups : [
          { backup_type: 'Database Backup', status: 'warning', last_backup_at: null, last_restore_test_at: null, retention_days: 30, notes: 'Needs Setup' },
          { backup_type: 'Storage Backup', status: 'warning', last_backup_at: null, last_restore_test_at: null, retention_days: 30, notes: 'Needs Setup' },
          { backup_type: 'Environment Backup', status: 'warning', last_backup_at: null, last_restore_test_at: null, retention_days: 14, notes: 'Needs Setup' },
          { backup_type: 'Edge Functions Backup', status: 'warning', last_backup_at: null, last_restore_test_at: null, retention_days: 7, notes: 'Needs Setup' },
        ],
        compliance: compliance.length > 0 ? compliance : [
          { key: 'gdpr', label: 'GDPR Compliance', status: 'review', notes: 'Manual verification needed' },
          { key: 'ico', label: 'ICO Registration', status: 'review', notes: 'Manual verification needed' },
          { key: 'privacy_policy', label: 'Privacy Policy', status: 'review', notes: 'Manual verification needed' },
        ],
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Preserve the recorded-check and log-search routes from deployed v63.
    if (action === 'security_checks') {
      const [checksRes,findingsRes]=await Promise.allSettled([
        supabaseQ.from('security_health_checks').select('*').order('last_checked_at',{ascending:false}),
        supabaseQ.from('security_findings').select('*').eq('status','open').order('created_at',{ascending:false}).limit(50),
      ]);
      if(checksRes.status==='rejected'||checksRes.value.error||findingsRes.status==='rejected'||findingsRes.value.error){
        return new Response(JSON.stringify({error:'Unable to load recorded security checks'}),{
          status:503,headers:{...corsHeaders,'Content-Type':'application/json'},
        });
      }
      const checks=checksRes.value.data||[];
      const findings=findingsRes.value.data||[];
      const lastChecked=checks.reduce((latest:string|null,c:{last_checked_at?:string|null})=>{
        if(!c.last_checked_at)return latest;
        return !latest||new Date(c.last_checked_at)>new Date(latest)?c.last_checked_at:latest;
      },null);
      return new Response(JSON.stringify({checks,findings,last_checked_at:lastChecked}),{
        status:200,headers:{...corsHeaders,'Content-Type':'application/json'},
      });
    }

    if(action==='search_audit_log'){
      const term=String(body.search||'').trim().toLowerCase();
      const {data,error}=await supabaseQ.from('admin_activity_log')
        .select('id, admin_username, admin_name, action_type, action_description, ip_address, created_at')
        .order('created_at',{ascending:false}).limit(200);
      if(error)return new Response(JSON.stringify({error:'Unable to search the audit log'}),{
        status:503,headers:{...corsHeaders,'Content-Type':'application/json'},
      });
      const rows=(data||[]).filter((row:{admin_username?:string;admin_name?:string;action_type?:string;action_description?:string;ip_address?:string})=>
        !term||[row.admin_username,row.admin_name,row.action_type,row.action_description,row.ip_address]
          .some((value:unknown)=>typeof value==='string'&&value.toLowerCase().includes(term)));
      return new Response(JSON.stringify({results:rows.slice(0,100),scanned:(data||[]).length}),{
        status:200,headers:{...corsHeaders,'Content-Type':'application/json'},
      });
    }

    if (action === 'run_security_scan') {
      if (!isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: Super Admin only" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let infrastructure;
      try {
        infrastructure=await loadInfrastructure(supabaseQ,supabaseAdmin);
      } catch {
        return new Response(JSON.stringify({error:'Infrastructure audit could not be loaded; scan was not saved'}), {
          status:503,headers:{...corsHeaders,'Content-Type':'application/json'},
        });
      }
      const tablesData=infrastructure.tables;
      const bucketsData=infrastructure.buckets;

      const appTables = tablesData.filter((t: any) => t.schema_name === 'app');
      const withoutRLS = appTables.filter((t: any) => !t.rls_enabled);
      const publicBuckets = (bucketsData || []).filter((b: any) => b.public);

      const checks: { check_key: string; category: string; label: string; status: string; score: number; details: any }[] = [
        {
          check_key: 'rls_coverage',
          category: 'Database',
          label: 'RLS Coverage',
          status: withoutRLS.length === 0 ? 'healthy' : 'critical',
          score: withoutRLS.length === 0 ? 100 : Math.max(0, 100 - withoutRLS.length * 10),
          details: { tablesWithoutRLS: withoutRLS.map((t: any) => t.table_name), totalTables: appTables.length },
        },
        {
          check_key: 'public_storage',
          category: 'Storage',
          label: 'Public Storage Buckets',
          status: publicBuckets.length === 0 ? 'healthy' : 'warning',
          score: publicBuckets.length === 0 ? 100 : Math.max(0, 100 - publicBuckets.length * 20),
          details: { publicBuckets: publicBuckets.map((b: any) => b.name) },
        },
        {
          check_key: 'jwt_functions',
          category: 'API',
          label: 'JWT-Protected Functions',
          status: 'warning',
          score: 0,
          details: { verification:'Not independently checked' },
        },
        {
          check_key: 'secret_config',
          category: 'API',
          label: 'Secret Configuration',
          status: Deno.env.get('STRIPE_SECRET_KEY') ? 'healthy' : 'warning',
          score: Deno.env.get('STRIPE_SECRET_KEY') ? 100 : 70,
          details: { hasStripe: !!Deno.env.get('STRIPE_SECRET_KEY'), hasSMTP: !!Deno.env.get('SMTP_HOST') },
        },
        {
          check_key: 'admin_sessions',
          category: 'Authentication',
          label: 'Admin Session Tracking',
          status: 'warning',
          score: 0,
          details: { verification:'Not independently checked' },
        },
      ];

      const findings: { category: string; severity: string; title: string; description: string; recommendation: string }[] = [];
      if (withoutRLS.length > 0) {
        findings.push({
          category: 'Database', severity: 'critical', title: 'Tables Without RLS',
          description: `${withoutRLS.map((t: any) => t.table_name).join(', ')} missing RLS`,
          recommendation: 'Enable RLS on all app schema tables immediately',
        });
      }
      if (publicBuckets.length > 0) {
        findings.push({
          category: 'Storage', severity: 'warning', title: 'Public Storage Buckets Exist',
          description: `${publicBuckets.map((b: any) => b.name).join(', ')}`,
          recommendation: 'Review public bucket access and restrict if unnecessary',
        });
      }

      for (const chk of checks) {
        const {error}=await supabaseQ.from('security_health_checks').upsert({
          check_key: chk.check_key, category: chk.category, label: chk.label,
          status: chk.status, score: chk.score, details: chk.details,
          last_checked_at: new Date().toISOString(),
        }, { onConflict: 'check_key' }).select('id').maybeSingle();
        if(error) throw new Error('Security check could not be saved');
      }

      for (const f of findings) {
        const {error}=await supabaseQ.from('security_findings').insert({
          category: f.category, severity: f.severity, title: f.title,
          description: f.description, recommendation: f.recommendation,
          status: 'open', source: 'automated_scan',
        });
        if(error) throw new Error('Security finding could not be saved');
      }

      await supabaseQ.from('admin_activity_log').insert({
        admin_username: resolvedAdmin.email || `admin_${resolvedAdmin.id}`,
        admin_name: 'Super Admin',
        action_type: 'security_scan_run',
        action_description: `Automated security scan completed \u2014 ${findings.length} findings, ${withoutRLS.length} tables without RLS`,
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
      });

      return new Response(JSON.stringify({
        success: true,
        checks: checks.map(c => ({ check_key: c.check_key, label: c.label, status: c.status, score: c.score })),
        findings: findings.map(f => ({ title: f.title, severity: f.severity })),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'export_audit_log_csv') {
      const { data } = await supabaseQ.from('admin_activity_log')
        .select('*').order('created_at', { ascending: false }).limit(500);
      const rows = data || [];

      const csvHeader = 'id,admin_username,admin_name,action_type,action_description,ip_address,created_at,user_agent';
      const csvRows = rows.map((r: any) =>
        `"${r.id}","${(r.admin_username || '').replace(/"/g, '""')}","${(r.admin_name || '').replace(/"/g, '""')}","${r.action_type}","${(r.action_description || '').replace(/"/g, '""')}","${r.ip_address || ''}","${r.created_at}","${(r.user_agent || '').replace(/"/g, '""')}"`
      );
      const csv = [csvHeader, ...csvRows].join('\n');

      return new Response(JSON.stringify({ csv }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === 'dashboard_stats') {
      const [failedRes, guardRes, siaRes, heldRes, contactRes] = await Promise.all([
        supabaseQ.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        supabaseQ.from('guards').select('id', { count: 'exact', head: true }).in('verification_status', ['manual_review', 'pending_sia_check']),
        supabaseQ.from('sia_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabaseQ.from('guard_payouts').select('id', { count: 'exact', head: true }).eq('status', 'held'),
        supabaseQ.from('contact_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      ]);
      return new Response(JSON.stringify({
        failedPayments: failedRes.count ?? 0, guardVerifications: guardRes.count ?? 0,
        siaVerifications: siaRes.count ?? 0, heldPayments: heldRes.count ?? 0,
        complaints: 0, contactSubmissions: contactRes.count ?? 0,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[SecurityDashboard] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
