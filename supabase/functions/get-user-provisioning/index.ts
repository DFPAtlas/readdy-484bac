import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserRecord {
  id: string;
  email: string;
  accountType: string;
  role: string;
  profileCompleted: boolean;
  subscriptionStatus: string;
  verificationStatus: string;
  onboardingStatus: string;
  hasEntitlements: boolean;
  hasNotificationPrefs: boolean;
  hasSubscription: boolean;
  createdAt: string;
  dashboardStatus: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const page = body.page ?? 0;
    const pageSize = body.pageSize ?? 25;
    const search = (body.search ?? "").trim().toLowerCase();
    const accountFilter = body.accountFilter ?? "all";
    const statusFilter = body.statusFilter ?? "all";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appClient = createClient(supabaseUrl, serviceRoleKey, {
      db: { schema: "app" },
      auth: { persistSession: false },
    });

    const { data: authUsers, error: rpcErr } = await appClient.rpc("get_auth_users");

    if (rpcErr) {
      console.error("RPC error:", rpcErr.message, rpcErr.code, rpcErr.details);
      throw new Error(`Auth users query failed: ${rpcErr.message}`);
    }

    if (!authUsers || authUsers.length === 0) {
      return new Response(
        JSON.stringify({ users: [], totalCount: 0, page, pageSize }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailFiltered = authUsers;
    if (search) {
      emailFiltered = authUsers.filter(
        (u) => (u.email ?? "").toLowerCase().includes(search)
      );
    }

    const filteredIds = emailFiltered.map((u) => u.id);

    if (filteredIds.length === 0) {
      return new Response(
        JSON.stringify({ users: [], totalCount: 0, page, pageSize }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [
      guardsRes,
      clientsRes,
      entitlementsRes,
      notifRes,
      subsRes,
      adminsRes,
    ] = await Promise.all([
      appClient
        .from("guards")
        .select("user_id, profile_completed, verification_status, subscription_status, onboarding_status, created_at")
        .in("user_id", filteredIds),
      appClient
        .from("clients")
        .select("user_id, profile_completed, verification_status, subscription_status, onboarding_status, created_at")
        .in("user_id", filteredIds),
      appClient
        .from("user_entitlements_data")
        .select("user_id")
        .in("user_id", filteredIds),
      appClient
        .from("notification_preferences")
        .select("user_id")
        .in("user_id", filteredIds),
      appClient
        .from("subscriptions")
        .select("user_id")
        .in("user_id", filteredIds),
      appClient
        .from("admin_users")
        .select("user_id")
        .in("user_id", filteredIds),
    ]);

    const guardMap = new Map((guardsRes.data ?? []).map((g: any) => [g.user_id, g]));
    const clientMap = new Map((clientsRes.data ?? []).map((c: any) => [c.user_id, c]));
    const entSet = new Set((entitlementsRes.data ?? []).map((e: any) => e.user_id));
    const notifSet = new Set((notifRes.data ?? []).map((n: any) => n.user_id));
    const subSet = new Set((subsRes.data ?? []).map((s: any) => s.user_id));
    const adminSet = new Set((adminsRes.data ?? []).map((a: any) => a.user_id));

    const records: UserRecord[] = emailFiltered.map((u: any) => {
      const guard = guardMap.get(u.id) as any;
      const client = clientMap.get(u.id) as any;
      const isAdmin = adminSet.has(u.id);

      let accountType = "";
      let profileCompleted = false;
      let verificationStatus = "none";
      let subscriptionStatus = "none";
      let onboardingStatus = "none";
      let createdAt = u.created_at;
      let role = "";

      if (guard) {
        accountType = "guard";
        profileCompleted = guard.profile_completed ?? false;
        verificationStatus = guard.verification_status ?? "none";
        subscriptionStatus = guard.subscription_status ?? "none";
        onboardingStatus = guard.onboarding_status ?? "none";
        createdAt = guard.created_at ?? u.created_at;
      } else if (client) {
        accountType = "client";
        profileCompleted = client.profile_completed ?? false;
        verificationStatus = client.verification_status ?? "none";
        subscriptionStatus = client.subscription_status ?? "none";
        onboardingStatus = client.onboarding_status ?? "none";
        createdAt = client.created_at ?? u.created_at;
      } else if (isAdmin) {
        accountType = "admin";
        profileCompleted = true;
        verificationStatus = "approved";
        subscriptionStatus = "admin";
        onboardingStatus = "admin";
      }

      if (isAdmin) role = "super_admin";
      else if (accountType === "guard") role = "guard";
      else if (accountType === "client") role = "client";

      const dashboardStatus =
        !accountType
          ? "missing"
          : profileCompleted && entSet.has(u.id) && notifSet.has(u.id) && subSet.has(u.id)
          ? "complete"
          : "partial";

      return {
        id: u.id,
        email: u.email ?? "",
        accountType: accountType || "unknown",
        role,
        profileCompleted,
        subscriptionStatus,
        verificationStatus,
        onboardingStatus,
        hasEntitlements: entSet.has(u.id),
        hasNotificationPrefs: notifSet.has(u.id),
        hasSubscription: subSet.has(u.id),
        createdAt,
        dashboardStatus,
      };
    });

    let result = records;
    if (accountFilter !== "all") {
      result = result.filter((r) => r.accountType === accountFilter);
    }
    if (statusFilter === "complete") {
      result = result.filter((r) => r.dashboardStatus === "complete");
    } else if (statusFilter === "partial") {
      result = result.filter((r) => r.dashboardStatus === "partial");
    } else if (statusFilter === "missing") {
      result = result.filter((r) => r.dashboardStatus === "missing");
    }

    const totalCount = result.length;
    const start = page * pageSize;
    const paged = result.slice(start, start + pageSize);

    return new Response(
      JSON.stringify({ users: paged, totalCount, page, pageSize }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("get-user-provisioning error:", err.message || err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Unknown server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
