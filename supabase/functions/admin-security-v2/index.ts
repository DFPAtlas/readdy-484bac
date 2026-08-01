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
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing authentication token" }),
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
    const email = payload.email || null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id, role, is_active, full_name, email")
      .eq("user_id", userId)
      .maybeSingle();

    if (!adminUser) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!adminUser.is_active) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Account not active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseQ = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    const guardRes = await supabaseQ
      .from('guards')
      .select('id', { count: 'exact', head: true })
      .in('verification_status', ['manual_review', 'pending_sia_check']);

    return new Response(
      JSON.stringify({
        guardVerifications: guardRes.count ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[AdminSecurity v2] Crash:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});