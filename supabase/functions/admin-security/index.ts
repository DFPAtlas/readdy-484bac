import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

async function findAdminUser(supabaseUrl: string, serviceKey: string, userId: string, email?: string | null) {
  const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'app' } });

  const { data: appAdminUser, error: appErr } = await supabase
    .from("admin_users")
    .select("id, role, is_active, full_name, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (appAdminUser) {
    console.log("[AdminSecurity v5] Admin found in app schema by user_id");
    return appAdminUser;
  }
  if (appErr) console.error("[AdminSecurity v5] app user_id lookup error:", appErr.message);

  if (email) {
    const { data: appByEmail, error: appEmailErr } = await supabase
      .from("admin_users")
      .select("id, role, is_active, full_name, email")
      .eq("email", email)
      .eq("is_active", true)
      .maybeSingle();

    if (appByEmail) {
      console.log("[AdminSecurity v5] Admin found in app schema by email, syncing user_id");
      await supabase.from("admin_users").update({ user_id: userId, updated_at: new Date().toISOString() }).eq("id", appByEmail.id);
      return appByEmail;
    }
    if (appEmailErr) console.error("[AdminSecurity v5] app email lookup error:", appEmailErr.message);
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("authorization");
    const jwt = authHeader?.replace("Bearer ", "").trim() || "";

    if (!jwt || jwt === Deno.env.get("SUPABASE_ANON_KEY")) {
      console.error("[AdminSecurity v5] Missing or anon JWT");
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = decodeJwtPayload(jwt);
    if (!payload || !payload.sub) {
      console.error("[AdminSecurity v5] Invalid JWT payload");
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = payload.sub;
    const email = payload.email || null;
    console.log("[AdminSecurity v5] Decoded JWT:", { userId, email });

    const adminUser = await findAdminUser(supabaseUrl, supabaseServiceKey, userId, email);

    if (!adminUser) {
      console.error("[AdminSecurity v5] No admin record:", userId, email);
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required", userId }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!adminUser.is_active) {
      console.error("[AdminSecurity v5] Admin not active:", adminUser.id);
      return new Response(
        JSON.stringify({ error: "Forbidden: Account not active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validRoles = ['super_admin', 'admin', 'finance_admin'];
    if (!validRoles.includes(adminUser.role)) {
      console.error("[AdminSecurity v5] Bad role:", adminUser.role);
      return new Response(
        JSON.stringify({ error: "Forbidden: Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const { action } = body;

    if (!action || action === 'verify') {
      return new Response(
        JSON.stringify({
          verified: true,
          role: adminUser.role,
          fullName: adminUser.full_name,
          email: adminUser.email,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseQ = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    if (action === 'dashboard_stats') {
      const [
        failedRes,
        guardRes,
        siaRes,
        heldRes,
        contactRes
      ] = await Promise.all([
        supabaseQ.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        supabaseQ.from('guards').select('id', { count: 'exact', head: true }).in('verification_status', ['manual_review', 'pending_sia_check']),
        supabaseQ.from('sia_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabaseQ.from('guard_payouts').select('id', { count: 'exact', head: true }).eq('status', 'held'),
        supabaseQ.from('contact_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      ]);

      return new Response(
        JSON.stringify({
          failedPayments: failedRes.count ?? 0,
          guardVerifications: guardRes.count ?? 0,
          siaVerifications: siaRes.count ?? 0,
          heldPayments: heldRes.count ?? 0,
          complaints: 0,
          contactSubmissions: contactRes.count ?? 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'security_data') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [loginRes, resetRes] = await Promise.all([
        supabaseQ.from('admin_activity_log').select('*').in('action_type', ['login', 'login_failed', 'logout']).order('created_at', { ascending: false }).limit(50),
        supabaseQ.from('admin_activity_log').select('*').in('action_type', ['password_reset_requested', 'password_reset_completed', 'password_reset_failed']).order('created_at', { ascending: false }).limit(50),
      ]);

      const logins = loginRes.data || [];
      const resets = resetRes.data || [];
      const todayLogins = logins.filter((e: any) => new Date(e.created_at) >= todayStart && e.action_type === 'login');
      const failedLogins = logins.filter((e: any) => new Date(e.created_at) >= todayStart && e.action_type === 'login_failed');
      const todayResets = resets.filter((e: any) => new Date(e.created_at) >= todayStart);
      const uniqueAdmins = new Set(logins.map((e: any) => e.admin_username)).size;

      return new Response(
        JSON.stringify({
          loginEvents: logins,
          resetEvents: resets,
          stats: {
            loginsToday: todayLogins.length,
            failedLogins: failedLogins.length,
            resetsToday: todayResets.length,
            uniqueAdmins,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[AdminSecurity v5] Crash:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});