import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function mapGuardStatus(status: string): string {
  switch (status) {
    case "approved": return "verified";
    case "rejected": return "rejected";
    case "pending_sia_check":
    case "manual_review": return "pending";
    default: return status || "unknown";
  }
}

async function computeStats(supabase: any) {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString().split("T")[0];
  const thirtyDaysIso = thirtyDaysFromNow.toISOString().split("T")[0];

  const [
    { count: totalPending },
    { count: totalVerified },
    { count: totalRejected },
    { count: totalExpired },
    { count: expiringIn30Days },
  ] = await Promise.all([
    supabase.from("guards").select("*", { count: "exact", head: true }).not("sia_licence_number", "is", null).in("verification_status", ["pending_sia_check", "manual_review"]),
    supabase.from("guards").select("*", { count: "exact", head: true }).not("sia_licence_number", "is", null).eq("verification_status", "approved"),
    supabase.from("guards").select("*", { count: "exact", head: true }).not("sia_licence_number", "is", null).eq("verification_status", "rejected"),
    supabase.from("guards").select("*", { count: "exact", head: true }).not("sia_licence_number", "is", null).eq("sia_scraped_status", "expired"),
    supabase.from("guards").select("*", { count: "exact", head: true }).not("sia_licence_number", "is", null).gte("sia_scraped_expiry_date", nowIso).lte("sia_scraped_expiry_date", thirtyDaysIso),
  ]);

  return {
    totalPending: totalPending || 0,
    totalVerified: totalVerified || 0,
    totalRejected: totalRejected || 0,
    totalExpired: totalExpired || 0,
    expiringIn30Days: expiringIn30Days || 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: "app" } });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { data: adminUser } = await supabase
    .from("admin_users")
    .select("id, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminUser || !adminUser.is_active) {
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "list") {
      const { page = 1, pageSize = 10, search = "", filter = "all", sortBy = "date" } = body;

      let guardQuery = supabase
        .from("guards")
        .select("id,user_id,verification_status,sia_verified,sia_check_status,sia_licence_number,sia_confidence_score,sia_scraped_status,sia_scraped_expiry_date,sia_checked_at,sia_verified_at,profile_image_path,sia_licence_front_path,sia_licence_back_path,sia_supporting_document_path,full_name", { count: "exact" })
        .not("sia_licence_number", "is", null);

      if (filter === "pending") {
        guardQuery = guardQuery.in("verification_status", ["pending_sia_check", "manual_review"]);
      } else if (filter === "verified") {
        guardQuery = guardQuery.eq("verification_status", "approved");
      } else if (filter === "rejected") {
        guardQuery = guardQuery.eq("verification_status", "rejected");
      } else if (filter === "expired") {
        guardQuery = guardQuery.eq("sia_scraped_status", "expired");
      }

      const isLicenceSearch = /^\d+$/.test(search.trim());
      if (search && isLicenceSearch) {
        guardQuery = guardQuery.ilike("sia_licence_number", "%" + search + "%");
      }

      if (sortBy === "expiry") {
        guardQuery = guardQuery.order("sia_scraped_expiry_date", { ascending: true, nullsFirst: false });
      } else {
        guardQuery = guardQuery.order("sia_checked_at", { ascending: false, nullsFirst: false });
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      guardQuery = guardQuery.range(from, to);

      const { data: guards, error, count } = await guardQuery;
      if (error) throw error;

      const stats = await computeStats(supabase);

      if (!guards || guards.length === 0) {
        return new Response(JSON.stringify({ data: [], totalCount: count || 0, stats }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const userIds = [...new Set(guards.map((g: any) => g.user_id))];
      const { data: users } = await supabase
        .from("users")
        .select("id,full_name,email,sia_license_number,sia_license_status,sia_license_expiry,sia_sectors,sia_verification_details,sia_verified_at,created_at")
        .in("id", userIds);

      const userMap: Record<string, any> = {};
      if (users) users.forEach((u: any) => { userMap[u.id] = u; });

      let combined = guards.map((g: any) => {
        const u = userMap[g.user_id] || {};
        return {
          guardId: g.id,
          userId: g.user_id,
          fullName: g.full_name || u.full_name || "N/A",
          email: u.email || "",
          siaLicenseNumber: g.sia_licence_number || u.sia_license_number || "N/A",
          verificationStatus: mapGuardStatus(g.verification_status),
          siaVerified: g.sia_verified,
          siaCheckStatus: g.sia_check_status,
          licenseStatus: g.sia_scraped_status || u.sia_license_status,
          licenseExpiry: g.sia_scraped_expiry_date || u.sia_license_expiry,
          siaSectors: u.sia_sectors,
          verificationDetails: u.sia_verification_details,
          siaVerifiedAt: g.sia_verified_at || u.sia_verified_at || g.sia_checked_at,
          createdAt: u.created_at,
          confidenceScore: g.sia_confidence_score,
          guardDocs: {
            profile_image_path: g.profile_image_path,
            sia_licence_front_path: g.sia_licence_front_path,
            sia_licence_back_path: g.sia_licence_back_path,
            sia_supporting_document_path: g.sia_supporting_document_path,
          },
        };
      });

      if (search && !isLicenceSearch) {
        const s = search.toLowerCase();
        combined = combined.filter((item: any) =>
          item.fullName.toLowerCase().includes(s) ||
          item.email.toLowerCase().includes(s)
        );
      }

      if (sortBy === "name") {
        combined.sort((a: any, b: any) => a.fullName.localeCompare(b.fullName));
      }

      return new Response(JSON.stringify({
        data: combined,
        totalCount: count || 0,
        stats,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "stats") {
      const stats = await computeStats(supabase);
      return new Response(JSON.stringify({ stats }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("admin-sia-verifications error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
