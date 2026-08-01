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

async function findAdminInSchema(supabase: any, schema: string, userId: string, email?: string | null) {
  console.log(`[AdminLogin v5] Searching ${schema}.admin_users for userId=${userId}, email=${email}`);

  const { data: byUserId, error: userIdErr } = await supabase
    .schema(schema)
    .from("admin_users")
    .select("id, user_id, full_name, email, role, permissions, is_active, last_login, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (byUserId) {
    console.log(`[AdminLogin v5] Found in ${schema}.admin_users by user_id`);
    return byUserId;
  }
  if (userIdErr) console.error(`[AdminLogin v5] ${schema} user_id lookup error:`, userIdErr.message);

  if (email) {
    const { data: byEmail, error: emailErr } = await supabase
      .schema(schema)
      .from("admin_users")
      .select("id, user_id, full_name, email, role, permissions, is_active, last_login, created_at")
      .eq("email", email)
      .eq("is_active", true)
      .maybeSingle();

    if (byEmail) {
      console.log(`[AdminLogin v5] Found in ${schema}.admin_users by email, syncing user_id`);
      await supabase.schema(schema).from("admin_users").update({ user_id: userId, updated_at: new Date().toISOString() }).eq("id", byEmail.id);
      return { ...byEmail, user_id: userId };
    }
    if (emailErr) console.error(`[AdminLogin v5] ${schema} email lookup error:`, emailErr.message);
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
    const body = await req.json().catch(() => ({ email: "" }));
    const authHeader = req.headers.get("authorization");
    const jwt = authHeader?.replace("Bearer ", "").trim() || "";

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "Missing authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = decodeJwtPayload(jwt);
    if (!payload || !payload.sub) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = payload.sub;
    const email = payload.email || body.email || null;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[AdminLogin v5] Decoded JWT:", { userId, email });

    let adminUser = await findAdminInSchema(supabaseAdmin, "app", userId, email);

    if (!adminUser) {
      adminUser = await findAdminInSchema(supabaseAdmin, "public", userId, email);
    }

    if (!adminUser) {
      console.error("[AdminLogin v5] No admin record found:", { userId, email });
      return new Response(
        JSON.stringify({
          error: "You do not have admin access",
          debug: {
            userId,
            email,
            jwtSub: payload.sub,
            jwtEmail: payload.email,
            bodyEmail: body.email,
            message: "No admin record found in app or public schema.",
          },
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!adminUser.is_active) {
      return new Response(
        JSON.stringify({ error: "Account is not active", debug: { isActive: adminUser.is_active } }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validRoles = ["super_admin", "admin", "finance_admin"];
    if (!validRoles.includes(adminUser.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions", debug: { role: adminUser.role } }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      await supabaseAdmin.schema("app").from("admin_users").update({ last_login: new Date().toISOString() }).eq("id", adminUser.id);
    } catch (e) {
      console.log("[AdminLogin v5] app last_login update failed (may be public schema user):", e);
    }
    try {
      await supabaseAdmin.schema("public").from("admin_users").update({ last_login: new Date().toISOString() }).eq("id", adminUser.id);
    } catch (e) {
      console.log("[AdminLogin v5] public last_login update failed (may be app schema user):", e);
    }

    console.log("[AdminLogin v5] Success:", adminUser.email, adminUser.role);

    return new Response(
      JSON.stringify({
        success: true,
        admin: {
          id: adminUser.id,
          email: adminUser.email,
          fullName: adminUser.full_name,
          role: adminUser.role,
          permissions: adminUser.permissions,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[AdminLogin v5] Crash:", error.message || error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message || "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});