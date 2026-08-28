import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const jwt = authHeader?.replace("Bearer ", "").trim() || "";

    if (!jwt || jwt === Deno.env.get("SUPABASE_ANON_KEY")) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing authentication token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (getAal(jwt) !== "aal2") {
      return new Response(JSON.stringify({ error: "Multi-factor authentication required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id, role, is_active, full_name, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminUser) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!adminUser.is_active) {
      return new Response(JSON.stringify({ error: "Forbidden: Account not active" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const validRoles = ['super_admin', 'admin', 'finance_admin'];
    if (!validRoles.includes(adminUser.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: Insufficient permissions" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        JSON.stringify({ verified: true, role: adminUser.role, fullName: adminUser.full_name, email: adminUser.email }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'dashboard_stats') {
      const [failedRes, guardRes, siaRes, heldRes, contactRes] = await Promise.all([
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('guards').select('id', { count: 'exact', head: true }).in('verification_status', ['manual_review', 'pending_sia_check']),
        supabase.from('sia_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('guard_payouts').select('id', { count: 'exact', head: true }).eq('status', 'held'),
        supabase.from('contact_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
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
        supabase.from('admin_activity_log').select('*').in('action_type', ['login', 'login_failed', 'logout']).order('created_at', { ascending: false }).limit(50),
        supabase.from('admin_activity_log').select('*').in('action_type', ['password_reset_requested', 'password_reset_completed', 'password_reset_failed']).order('created_at', { ascending: false }).limit(50),
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
          stats: { loginsToday: todayLogins.length, failedLogins: failedLogins.length, resetsToday: todayResets.length, uniqueAdmins },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("[AdminSecurity v6] Crash:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
