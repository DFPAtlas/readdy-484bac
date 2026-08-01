import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

async function rpcCall(supabaseUrl: string, serviceRoleKey: string, schema: string, fn: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
      "Accept-Profile": schema,
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RPC ${fn} failed (${res.status}): ${errText}`);
  }
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const jwt = authHeader?.replace("Bearer ", "").trim() || "";

    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized — missing bearer token" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const payload = decodeJwtPayload(jwt);
    if (!payload || !payload.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized — invalid token" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = payload.sub;
    const email = payload.email || null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const appClient = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "app" } });
    const storageClient = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "storage" } });

    const { data: adminUser, error: adminErr } = await appClient
      .from("admin_users")
      .select("id, full_name, role, is_active, email")
      .eq("user_id", userId)
      .maybeSingle();

    let admin = adminUser;

    if (!admin && email) {
      const { data: byEmail } = await appClient
        .from("admin_users")
        .select("id, full_name, role, is_active, email")
        .eq("email", email)
        .eq("is_active", true)
        .maybeSingle();

      if (byEmail) {
        await appClient
          .from("admin_users")
          .update({ user_id: userId, updated_at: new Date().toISOString() })
          .eq("id", byEmail.id);
        admin = byEmail;
      }
    }

    if (!admin) {
      return new Response(JSON.stringify({ error: "Forbidden — admin access required" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    if (!admin.is_active) {
      return new Response(JSON.stringify({ error: "Forbidden — admin account not active" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const TARGET_BUCKETS = [
      "quickguard-email-assets",
      "guard-documents",
      "sia-licences",
      "avatars",
      "ID-images",
      "guard-profiles",
    ];

    const { data: buckets, error: bucketsErr } = await storageClient
      .from("buckets")
      .select("id, name, public, file_size_limit, allowed_mime_types")
      .in("name", TARGET_BUCKETS);

    if (bucketsErr) {
      return new Response(JSON.stringify({ error: "Failed to query storage buckets", details: bucketsErr.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    let objectStats: Record<string, { file_count: number; total_bytes: number }> = {};

    try {
      const rpcStats = await rpcCall(supabaseUrl, serviceRoleKey, "app", "get_storage_stats");
      if (rpcStats && Array.isArray(rpcStats)) {
        for (const row of rpcStats) {
          objectStats[row.bucket_id] = {
            file_count: Number(row.file_count),
            total_bytes: Number(row.total_bytes),
          };
        }
      }
    } catch {
      console.log("RPC get_storage_stats failed, using fallback");
    }

    if (Object.keys(objectStats).length === 0) {
      const { data: fallbackObjects, error: fallbackErr } = await storageClient
        .from("objects")
        .select("bucket_id, metadata");

      if (!fallbackErr && fallbackObjects) {
        const agg: Record<string, { file_count: number; total_bytes: number }> = {};
        for (const obj of fallbackObjects) {
          const bid = obj.bucket_id;
          if (!agg[bid]) agg[bid] = { file_count: 0, total_bytes: 0 };
          agg[bid].file_count += 1;
          const size = obj.metadata && typeof obj.metadata === "object" && "size" in obj.metadata
            ? Number((obj.metadata as Record<string, unknown>).size) || 0
            : 0;
          agg[bid].total_bytes += size;
        }
        objectStats = agg;
      }
    }

    let policyMap: Record<string, boolean> = {};

    try {
      const rpcPolicies = await rpcCall(supabaseUrl, serviceRoleKey, "app", "get_storage_policies");
      if (rpcPolicies && Array.isArray(rpcPolicies)) {
        for (const p of rpcPolicies) {
          if (p.bucket_name) {
            policyMap[p.bucket_name] = true;
          }
        }
      }
    } catch {
      console.log("RPC get_storage_policies failed");
    }

    const buckets_data = TARGET_BUCKETS.map((name) => {
      const bucket = (buckets || []).find((b: any) => b.name === name);
      const stats = objectStats[name] || { file_count: 0, total_bytes: 0 };
      const hasPolicies = policyMap[name] || false;
      const limit = bucket?.file_size_limit ? Number(bucket.file_size_limit) : null;

      let percentageUsed = null;
      if (limit && limit > 0) {
        percentageUsed = Math.min(100, Math.round((stats.total_bytes / limit) * 100));
      }

      const nearLimit = limit && limit > 0 && stats.total_bytes > limit * 0.9;

      let warnings: string[] = [];

      if ((name === "avatars" || name === "guard-profiles") && bucket?.public) {
        warnings.push("Public bucket — sensitive files may be exposed");
      }
      if ((name === "sia-licences" || name === "guard-documents") && bucket?.public) {
        warnings.push("Public bucket — sensitive documents may be exposed");
      }
      if (!hasPolicies) {
        warnings.push("No RLS policies configured");
      }
      if (nearLimit) {
        warnings.push("Storage near or exceeding file size limit");
      }

      return {
        name,
        public: bucket?.public ?? false,
        file_count: stats.file_count,
        total_bytes: stats.total_bytes,
        file_size_limit: limit,
        allowed_mime_types: bucket?.allowed_mime_types || [],
        percentage_used: percentageUsed,
        has_rls_policies: hasPolicies,
        warnings,
      };
    });

    const totalFiles = buckets_data.reduce((sum, b) => sum + b.file_count, 0);
    const totalBytes = buckets_data.reduce((sum, b) => sum + b.total_bytes, 0);
    const largestBucket = buckets_data.reduce(
      (max, b) => (b.total_bytes > (max?.total_bytes || -1) ? b : max),
      buckets_data[0] || null
    );
    const bucketsWithoutPolicies = buckets_data.filter((b) => !b.has_rls_policies).map((b) => b.name);
    const publicBuckets = buckets_data.filter((b) => b.public).map((b) => b.name);
    const publicBucketWarnings = buckets_data.filter((b) => {
      const sensitiveBuckets = ["avatars", "guard-profiles", "sia-licences", "guard-documents"];
      return b.public && sensitiveBuckets.includes(b.name);
    }).map((b) => b.name);

    const adminName = admin.full_name || admin.email || "unknown";

    await appClient.from("admin_activity_log").insert({
      admin_username: adminName,
      admin_name: adminName,
      admin_user_id: admin.id,
      action_type: "storage_usage_query",
      action_description: "Queried storage usage across all buckets",
      target_type: "storage",
      target_name: "all_buckets",
      ip_address: req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || null,
      metadata: {
        total_files: totalFiles,
        total_bytes: totalBytes,
        bucket_count: buckets_data.length,
      },
    });

    return new Response(
      JSON.stringify({
        buckets: buckets_data,
        summary: {
          total_files: totalFiles,
          total_bytes: totalBytes,
          largest_bucket: largestBucket?.name || null,
          largest_bucket_bytes: largestBucket?.total_bytes || 0,
          buckets_without_policies: bucketsWithoutPolicies,
          public_buckets: publicBuckets,
          public_bucket_warnings: publicBucketWarnings,
        },
        queried_at: new Date().toISOString(),
        queried_by: adminName,
      }),
      { headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: (err as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
