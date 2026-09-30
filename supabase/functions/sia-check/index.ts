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

function deriveNames(guard: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
}): { firstName: string | null; surname: string | null } {
  const firstRaw = (guard.first_name ?? "").toString().trim();
  const lastRaw = (guard.last_name ?? "").toString().trim();

  if (firstRaw || lastRaw) {
    return { firstName: firstRaw || null, surname: lastRaw || null };
  }

  const full = (guard.full_name ?? "").toString().trim();
  if (!full) return { firstName: null, surname: null };

  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, surname: null };

  const surname = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(" ") || null;
  return { firstName, surname };
}

async function createAdminNotification(
  supabase: any,
  title: string,
  message: string,
  metadata: Record<string, any>
) {
  try {
    const { data: activeAdmins } = await supabase
      .from("admin_users")
      .select("id, user_id")
      .eq("is_active", true);

    if (!activeAdmins || activeAdmins.length === 0) return;

    for (const admin of activeAdmins) {
      await supabase.from("admin_alerts").insert({
        alert_type: "sia_manual_review_required",
        severity: "warning",
        user_id: admin.user_id,
        title,
        message,
        metadata,
        status: "unread",
        created_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to create admin notification:", err);
  }
}

async function logSiaVerification(
  supabase: any,
  entry: {
    guard_id: string;
    user_id: string;
    sia_licence_number: string;
    status: string;
    result: string | null;
    webhook_configured: boolean;
    webhook_response_code: number | null;
    error_message: string | null;
    checked_at: string;
    checked_by: string;
  }
) {
  try {
    await supabase.from("sia_verifications").insert(entry);
  } catch (err) {
    console.error("Failed to log sia verification:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;
  let isSelfTrigger = false;
  let isAdminTrigger = false;
  let selfGuardId: string | null = null;
  let adminId: string | null = null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: "app" } });

  if (!isServiceRole) {
    const jwt = authHeader.replace("Bearer ", "").trim();

    if (!jwt || jwt === Deno.env.get("SUPABASE_ANON_KEY")) {
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
    const email = payload.email || null;

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id, is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (adminUser && adminUser.is_active) {
      isAdminTrigger = true;
      adminId = adminUser.id;
    } else {
      const { data: guardUser } = await supabase
        .from("guards")
        .select("id, verification_status")
        .eq("user_id", userId)
        .maybeSingle();

      if (guardUser) {
        isSelfTrigger = true;
        selfGuardId = guardUser.id;
      } else {
        if (email) {
          const { data: adminByEmail } = await supabase
            .from("admin_users")
            .select("id, is_active")
            .eq("email", email)
            .eq("is_active", true)
            .maybeSingle();

          if (!adminByEmail) {
            await supabase.from("admin_activity_log").insert({
              action_type: "sia_check_unauthorized",
              action_description: `Unauthorized SIA check attempt`,
              target_type: "user",
              target_name: email || userId,
              metadata: { userId },
              created_at: new Date().toISOString(),
            }).catch(() => {});

            return new Response(
              JSON.stringify({ error: "Admin or own guard access required" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          return new Response(
            JSON.stringify({ error: "Admin or own guard access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }
  }

  try {
    const body = await req.json();
    const { guard_id, sia_licence_number } = body;

    if (!guard_id || !sia_licence_number) {
      return new Response(
        JSON.stringify({ error: "Missing guard_id or sia_licence_number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isSelfTrigger && guard_id !== selfGuardId) {
      return new Response(
        JSON.stringify({ error: "You can only trigger SIA check for your own guard profile" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: guard, error: guardError } = await supabase
      .from("guards")
      .select("id, user_id, sia_licence_number, verification_status, full_name")
      .eq("id", guard_id)
      .maybeSingle();

    if (guardError || !guard) {
      return new Response(
        JSON.stringify({ error: "Guard not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();
    const checkedBy = isAdminTrigger ? "admin" : isSelfTrigger ? "self" : "system";
    const reason = isAdminTrigger ? "manual" : "onboarding";

    await supabase.from("admin_activity_log").insert({
      action_type: "sia_check_performed",
      action_description: `SIA check started for guard: ${guard.full_name}${checkedBy === 'self' ? ' (self-triggered)' : checkedBy === 'admin' ? ' (admin-triggered)' : ''}`,
      target_type: "guard",
      target_name: guard.full_name,
      metadata: { guardId: guard_id, sia_licence_number, triggeredBy: checkedBy, reason },
      created_at: now,
    }).catch(() => {});

    await supabase.from("guard_verification_audit").insert({
      guard_id,
      action: "sia_check_started",
      raw_result_json: { source: checkedBy, sia_licence_number, reason },
      created_at: now,
    }).catch(() => {});

    await supabase.from("guards").update({
      verification_status: "pending_sia_check",
      is_active: false,
      dashboard_access: false,
      sia_checked_at: now,
      sia_check_status: "pending",
      updated_at: now,
    }).eq("id", guard_id);

    const cleanedLicence = String(sia_licence_number).replace(/\s+/g, "");

    if (!/^\d{16}$/.test(cleanedLicence)) {
      await supabase.from("guards").update({
        verification_status: "manual_review",
        is_active: false,
        dashboard_access: false,
        sia_check_status: "invalid_licence_format",
        updated_at: new Date().toISOString(),
      }).eq("id", guard_id);

      await supabase.from("admin_activity_log").insert({
        action_type: "sia_check_fallback",
        action_description: `SIA check skipped for guard: ${guard.full_name}. Invalid licence format (${cleanedLicence.length} digits).`,
        target_type: "guard",
        target_name: guard.full_name,
        metadata: { guardId: guard_id, reason: "invalid_licence_format", cleanedLicence },
        created_at: new Date().toISOString(),
      }).catch(() => {});

      await logSiaVerification(supabase, {
        guard_id,
        user_id: guard.user_id,
        sia_licence_number,
        status: "manual_review",
        result: "invalid_licence_format",
        webhook_configured: false,
        webhook_response_code: null,
        error_message: "Licence number is not exactly 16 digits",
        checked_at: now,
        checked_by: checkedBy,
      });

      await createAdminNotification(
        supabase,
        "SIA Licence Format Invalid - Manual Review Required",
        `Guard ${guard.full_name} (${sia_licence_number}) has an invalid SIA licence format and requires manual verification.`,
        { guard_id, reason: "invalid_licence_format", sia_licence_number }
      );

      return new Response(
        JSON.stringify({
          guard_id,
          verification_status: "manual_review",
          sia_check_status: "invalid_licence_format",
          message: "SIA licence format is invalid. Your application requires manual admin review.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingCheck } = await supabase
      .from("sia_checks")
      .select("id")
      .eq("subject_type", "guard")
      .eq("subject_id", guard_id)
      .in("status", ["pending", "processing"])
      .limit(1)
      .maybeSingle();

    if (existingCheck) {
      await logSiaVerification(supabase, {
        guard_id,
        user_id: guard.user_id,
        sia_licence_number,
        status: "pending",
        result: "already_queued",
        webhook_configured: false,
        webhook_response_code: null,
        error_message: null,
        checked_at: now,
        checked_by: checkedBy,
      });

      return new Response(
        JSON.stringify({
          guard_id,
          verification_status: "pending_sia_check",
          message: "SIA check already queued",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { firstName, surname } = deriveNames(guard);

    const { error: insertError } = await supabase
      .from("sia_checks")
      .insert({
        subject_type: "guard",
        subject_id: guard_id,
        licence_number: cleanedLicence,
        expected_first_name: firstName,
        expected_surname: surname,
        reason,
      });

    if (insertError) {
      console.error("Failed to queue SIA check:", insertError);

      await supabase.from("guards").update({
        verification_status: "manual_review",
        is_active: false,
        dashboard_access: false,
        sia_check_status: "queue_error",
        updated_at: new Date().toISOString(),
      }).eq("id", guard_id);

      await supabase.from("admin_activity_log").insert({
        action_type: "sia_check_fallback",
        action_description: `SIA check could not be queued for guard: ${guard.full_name}. Set to manual review.`,
        target_type: "guard",
        target_name: guard.full_name,
        metadata: { guardId: guard_id, reason: "queue_error", error: insertError.message },
        created_at: new Date().toISOString(),
      }).catch(() => {});

      await logSiaVerification(supabase, {
        guard_id,
        user_id: guard.user_id,
        sia_licence_number,
        status: "manual_review",
        result: "queue_error",
        webhook_configured: false,
        webhook_response_code: null,
        error_message: insertError.message,
        checked_at: now,
        checked_by: checkedBy,
      });

      await createAdminNotification(
        supabase,
        "SIA Check Queue Error - Manual Review Required",
        `Guard ${guard.full_name} (${guard.sia_licence_number}) SIA check could not be queued. Error: ${insertError.message}`,
        { guard_id, reason: "queue_error", sia_licence_number }
      );

      return new Response(
        JSON.stringify({
          guard_id,
          verification_status: "manual_review",
          sia_check_status: "queue_error",
          message: "SIA check could not be queued. Your application requires manual admin review.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await logSiaVerification(supabase, {
      guard_id,
      user_id: guard.user_id,
      sia_licence_number,
      status: "pending",
      result: "SIA check queued",
      webhook_configured: false,
      webhook_response_code: null,
      error_message: null,
      checked_at: now,
      checked_by: checkedBy,
    });

    return new Response(
      JSON.stringify({
        guard_id,
        verification_status: "pending_sia_check",
        message: "SIA check queued",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("SIA check error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
