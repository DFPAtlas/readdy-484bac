import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const PROD_ORIGINS = ["https://quickguard.uk", "https://www.quickguard.uk"];
const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;
const ADMIN_ROLES = ["super_admin", "admin", "finance_admin"];

type AdminRecord = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean | null;
};

function isAllowedOrigin(origin: string): boolean {
  if (PROD_ORIGINS.includes(origin)) return true;
  if (origin === "https://readdy.ai" || origin.endsWith(".readdy.ai")) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : PROD_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

function getClientIp(req: Request): string {
  const value = req.headers.get("cf-connecting-ip")
    || req.headers.get("x-forwarded-for")?.split(",")[0]
    || req.headers.get("x-real-ip")
    || "unknown";
  return value.trim().slice(0, 128) || "unknown";
}

async function recordAttempt(
  serviceClient: ReturnType<typeof createClient>,
  email: string,
  ipAddress: string,
  success: boolean,
): Promise<void> {
  const { error } = await serviceClient.schema("app").from("admin_login_attempts").insert({
    email: email || "unknown",
    ip_address: ipAddress,
    attempted_at: new Date().toISOString(),
    success,
  });

  if (error) throw new Error(`Unable to persist admin login audit: ${error.message}`);
}

async function recordActivity(
  serviceClient: ReturnType<typeof createClient>,
  details: {
    admin?: AdminRecord | null;
    email: string;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    reason?: string;
  },
): Promise<void> {
  const { error } = await serviceClient.schema("app").from("admin_activity_log").insert({
    admin_user_id: details.admin?.id || null,
    admin_username: details.admin?.email || details.email || "unknown",
    admin_name: details.admin?.full_name || details.admin?.email || details.email || "Unknown",
    action_type: details.success ? "login" : "login_failed",
    action_description: details.success ? "Admin login successful" : "Admin login failed",
    target_type: "admin_user",
    target_name: details.email || null,
    ip_address: details.ipAddress,
    user_agent: details.userAgent,
    metadata: {
      authentication_path: "admin-login",
      reason: details.reason || (details.success ? "authenticated" : "invalid_credentials"),
    },
  });

  if (error) console.error("[AdminLogin] Activity audit failed", error.message);
}

async function failureCounts(
  serviceClient: ReturnType<typeof createClient>,
  email: string,
  ipAddress: string,
): Promise<{ email: number; ip: number }> {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const base = () => serviceClient
    .schema("app")
    .from("admin_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("success", false)
    .gte("attempted_at", cutoff);

  const [emailResult, ipResult] = await Promise.all([
    base().eq("email", email || "unknown"),
    base().eq("ip_address", ipAddress),
  ]);

  if (emailResult.error || ipResult.error) {
    throw new Error("Unable to verify admin login rate limit");
  }

  return { email: emailResult.count || 0, ip: ipResult.count || 0 };
}

async function recordRateLimit(
  serviceClient: ReturnType<typeof createClient>,
  email: string,
  ipAddress: string,
  userAgent: string,
): Promise<void> {
  const { error } = await serviceClient.schema("app").from("rate_limit_events").insert({
    event_type: "admin_login",
    email: email || null,
    ip_address: ipAddress,
    user_agent: userAgent,
    blocked: true,
    reason: `Exceeded failed-login limit within ${RATE_LIMIT_WINDOW_MINUTES} minutes`,
    created_at: new Date().toISOString(),
  });

  if (error) console.error("[AdminLogin] Rate-limit event failed", error.message);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return json(req, 500, { error: "Admin login is not configured" });
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ipAddress = getClientIp(req);
  const userAgent = (req.headers.get("user-agent") || "unknown").slice(0, 512);

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    await recordAttempt(serviceClient, "unknown", ipAddress, false).catch(() => undefined);
    return json(req, 400, { error: "Email and password are required" });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 320) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password || password.length > 1024) {
    await recordAttempt(serviceClient, email || "unknown", ipAddress, false).catch(() => undefined);
    return json(req, 400, { error: "Email and password are required" });
  }

  try {
    const failures = await failureCounts(serviceClient, email, ipAddress);
    if (failures.email >= MAX_FAILURES_PER_EMAIL || failures.ip >= MAX_FAILURES_PER_IP) {
      await Promise.all([
        recordAttempt(serviceClient, email, ipAddress, false),
        recordRateLimit(serviceClient, email, ipAddress, userAgent),
        recordActivity(serviceClient, {
          email, ipAddress, userAgent, success: false, reason: "rate_limited",
        }),
      ]);
      return new Response(JSON.stringify({ error: "Too many login attempts. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders(req), "Retry-After": String(RATE_LIMIT_WINDOW_MINUTES * 60) },
      });
    }
  } catch (error) {
    console.error("[AdminLogin] Rate-limit check failed", error instanceof Error ? error.message : "unknown");
    return json(req, 503, { error: "Admin login is temporarily unavailable" });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email, password });

  if (authError || !authData.user || !authData.session) {
    await Promise.all([
      recordAttempt(serviceClient, email, ipAddress, false).catch((error) =>
        console.error("[AdminLogin] Failed-attempt audit failed", error instanceof Error ? error.message : "unknown")
      ),
      recordActivity(serviceClient, {
        email, ipAddress, userAgent, success: false, reason: "invalid_credentials",
      }),
    ]);
    return json(req, 401, { error: "Invalid email or password" });
  }

  const { data: adminData, error: adminError } = await serviceClient
    .schema("app")
    .from("admin_users")
    .select("id, user_id, email, full_name, role, is_active")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  const admin = adminData as AdminRecord | null;
  const isValidAdmin = !!admin && admin.is_active === true && ADMIN_ROLES.includes(admin.role);

  if (adminError || !isValidAdmin) {
    await authClient.auth.signOut().catch(() => undefined);
    await Promise.all([
      recordAttempt(serviceClient, email, ipAddress, false).catch((error) =>
        console.error("[AdminLogin] Rejected-user audit failed", error instanceof Error ? error.message : "unknown")
      ),
      recordActivity(serviceClient, {
        admin, email, ipAddress, userAgent, success: false, reason: "not_authorized_admin",
      }),
    ]);
    return json(req, 401, { error: "Invalid email or password" });
  }

  try {
    await recordAttempt(serviceClient, admin.email || email, ipAddress, true);
  } catch (error) {
    console.error("[AdminLogin] Successful-login audit failed", error instanceof Error ? error.message : "unknown");
    await authClient.auth.signOut().catch(() => undefined);
    return json(req, 503, { error: "Admin login is temporarily unavailable" });
  }

  const now = new Date().toISOString();
  const [{ error: lastLoginError }] = await Promise.all([
    serviceClient.schema("app").from("admin_users").update({ last_login: now, updated_at: now }).eq("id", admin.id),
    recordActivity(serviceClient, { admin, email, ipAddress, userAgent, success: true }),
  ]);
  if (lastLoginError) console.error("[AdminLogin] last_login update failed", lastLoginError.message);

  return json(req, 200, {
    success: true,
    session: {
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      expires_in: authData.session.expires_in,
      expires_at: authData.session.expires_at,
      token_type: authData.session.token_type,
    },
  });
});
