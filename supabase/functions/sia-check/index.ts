
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
  const n8nWebhookUrl = Deno.env.get("N8N_SIA_CHECK_WEBHOOK_URL");

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
    const webhookConfigured = !!n8nWebhookUrl;

    await supabase.from("admin_activity_log").insert({
      action_type: "sia_check_performed",
      action_description: `SIA check started for guard: ${guard.full_name}${checkedBy === 'self' ? ' (self-triggered)' : checkedBy === 'admin' ? ' (admin-triggered)' : ''}`,
      target_type: "guard",
      target_name: guard.full_name,
      metadata: { guardId: guard_id, sia_licence_number, triggeredBy: checkedBy, webhookConfigured },
      created_at: now,
    }).catch(() => {});

    await supabase.from("guard_verification_audit").insert({
      guard_id,
      action: "sia_check_started",
      raw_result_json: { source: checkedBy, sia_licence_number, webhook_configured: webhookConfigured },
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

    if (!n8nWebhookUrl) {
      console.log("WARNING: N8N_SIA_CHECK_WEBHOOK_URL is not configured. Falling back to manual_review.");

      await supabase.from("guards").update({
        verification_status: "manual_review",
        is_active: false,
        dashboard_access: false,
        sia_check_status: "webhook_missing",
        updated_at: new Date().toISOString(),
      }).eq("id", guard_id);

      await supabase.from("admin_activity_log").insert({
        action_type: "sia_check_fallback",
        action_description: `SIA check webhook NOT CONFIGURED for guard: ${guard.full_name}. Set to manual review.`,
        target_type: "guard",
        target_name: guard.full_name,
        metadata: { guardId: guard_id, reason: "webhook_missing" },
        created_at: new Date().toISOString(),
      }).catch(() => {});

      await logSiaVerification(supabase, {
        guard_id,
        user_id: guard.user_id,
        sia_licence_number,
        status: "manual_review",
        result: "webhook_missing",
        webhook_configured: false,
        webhook_response_code: null,
        error_message: "N8N_SIA_CHECK_WEBHOOK_URL is not configured",
        checked_at: now,
        checked_by: checkedBy,
      });

      await createAdminNotification(
        supabase,
        "SIA Webhook Missing - Manual Review Required",
        `Guard ${guard.full_name} (${guard.sia_licence_number}) requires manual SIA verification. The N8N webhook is not configured.`,
        { guard_id, reason: "webhook_missing", sia_licence_number }
      );

      return new Response(
        JSON.stringify({
          guard_id,
          verification_status: "manual_review",
          sia_check_status: "webhook_missing",
          message: "SIA check webhook not configured. Your application requires manual admin review.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let n8nResult: any = null;
    let webhookResponseCode: number | null = null;
    let webhookErrorMessage: string | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const n8nResponse = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guard_id,
          sia_licence_number,
          full_name: guard.full_name,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      webhookResponseCode = n8nResponse.status;

      if (n8nResponse.ok) {
        n8nResult = await n8nResponse.json();
        console.log("n8n response:", JSON.stringify(n8nResult));
      } else {
        webhookErrorMessage = `n8n webhook returned status ${n8nResponse.status}`;
        console.error(webhookErrorMessage);
        try {
          const errorBody = await n8nResponse.text();
          webhookErrorMessage += `: ${errorBody}`;
        } catch {}
      }
    } catch (fetchError: any) {
      webhookErrorMessage = fetchError.name === "AbortError"
        ? "n8n webhook request timed out after 30 seconds"
        : `n8n webhook fetch error: ${fetchError.message}`;
      console.error(webhookErrorMessage);

      await supabase.from("guard_verification_audit").insert({
        guard_id,
        action: "sia_check_webhook_error",
        raw_result_json: { error: webhookErrorMessage, sia_licence_number },
        created_at: now,
      }).catch(() => {});

      await supabase.from("guards").update({
        verification_status: "manual_review",
        is_active: false,
        dashboard_access: false,
        sia_check_status: "webhook_error",
        updated_at: new Date().toISOString(),
      }).eq("id", guard_id);

      await logSiaVerification(supabase, {
        guard_id,
        user_id: guard.user_id,
        sia_licence_number,
        status: "manual_review",
        result: "webhook_error",
        webhook_configured: true,
        webhook_response_code: webhookResponseCode,
        error_message: webhookErrorMessage,
        checked_at: now,
        checked_by: checkedBy,
      });

      await createAdminNotification(
        supabase,
        "SIA Webhook Error - Manual Review Required",
        `Guard ${guard.full_name} (${guard.sia_licence_number}) SIA check failed. Webhook error: ${webhookErrorMessage}`,
        { guard_id, reason: "webhook_error", sia_licence_number, error: webhookErrorMessage }
      );

      return new Response(
        JSON.stringify({
          guard_id,
          verification_status: "manual_review",
          sia_check_status: "webhook_error",
          message: "SIA check encountered an error. Your application requires manual admin review.",
          error: webhookErrorMessage,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (n8nResult) {
      const siaCheckStatus = n8nResult.verification_status === "verified"
        ? "passed"
        : n8nResult.verification_status === "rejected"
        ? "failed"
        : "pending";

      await supabase.from("guard_verification_audit").insert({
        guard_id,
        action: "sia_check_completed",
        result: n8nResult.verification_status,
        confidence_score: n8nResult.confidence_score,
        mismatch_reason: n8nResult.mismatch_reason,
        raw_result_json: n8nResult,
        created_at: now,
      }).catch(() => {});

      const updatePayload: any = {
        sia_scraped_name: n8nResult.scraped_name || null,
        sia_scraped_status: n8nResult.scraped_status || null,
        sia_scraped_expiry_date: n8nResult.scraped_expiry_date || null,
        sia_confidence_score: n8nResult.confidence_score || null,
        sia_mismatch_reason: n8nResult.mismatch_reason || null,
        sia_check_status: siaCheckStatus,
        sia_raw_result_json: n8nResult,
        sia_checked_at: now,
        updated_at: now,
      };

      if (n8nResult.verification_status === "verified") {
        updatePayload.verification_status = "approved";
        updatePayload.is_active = true;
        updatePayload.sia_verified = true;
        updatePayload.dashboard_access = true;
        updatePayload.verified_at = now;
      } else if (n8nResult.verification_status === "rejected") {
        updatePayload.verification_status = "rejected";
        updatePayload.is_active = false;
        updatePayload.sia_verified = false;
        updatePayload.dashboard_access = false;
        updatePayload.rejected_at = now;
        updatePayload.rejection_reason = n8nResult.rejection_reason || "SIA licence could not be verified";
      } else {
        updatePayload.verification_status = "manual_review";
        updatePayload.is_active = false;
        updatePayload.dashboard_access = false;
      }

      await supabase.from("guards").update(updatePayload).eq("id", guard_id);

      await logSiaVerification(supabase, {
        guard_id,
        user_id: guard.user_id,
        sia_licence_number,
        status: updatePayload.verification_status,
        result: JSON.stringify(n8nResult),
        webhook_configured: true,
        webhook_response_code: webhookResponseCode,
        error_message: null,
        checked_at: now,
        checked_by: checkedBy,
      });

      if (n8nResult.verification_status === "verified" || n8nResult.verification_status === "rejected") {
        const logAction = n8nResult.verification_status === "verified" ? "guard_auto_verified" : "guard_auto_rejected";
        await supabase.from("admin_activity_log").insert({
          action_type: logAction,
          action_description: `Auto-${n8nResult.verification_status === "verified" ? "approved" : "rejected"} guard: ${guard.full_name} via n8n SIA check (${checkedBy}-triggered)`,
          target_type: "guard",
          target_name: guard.full_name,
          metadata: { guardId: guard_id, confidence: n8nResult.confidence_score, triggeredBy: checkedBy },
          created_at: now,
        }).catch(() => {});
      }

      return new Response(
        JSON.stringify({
          guard_id,
          verification_status: updatePayload.verification_status,
          sia_check_status: siaCheckStatus,
          sia_scraped_name: n8nResult.scraped_name,
          sia_scraped_status: n8nResult.scraped_status,
          confidence_score: n8nResult.confidence_score,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("guards").update({
      verification_status: "manual_review",
      is_active: false,
      dashboard_access: false,
      sia_check_status: "webhook_error",
      updated_at: new Date().toISOString(),
    }).eq("id", guard_id);

    await supabase.from("guard_verification_audit").insert({
      guard_id,
      action: "sia_check_failed",
      raw_result_json: { error: "n8n webhook returned no result", sia_licence_number },
      created_at: now,
    }).catch(() => {});

    await logSiaVerification(supabase, {
      guard_id,
      user_id: guard.user_id,
      sia_licence_number,
      status: "manual_review",
      result: "no_result",
      webhook_configured: true,
      webhook_response_code: webhookResponseCode,
      error_message: "n8n webhook returned no parseable result",
      checked_at: now,
      checked_by: checkedBy,
    });

    return new Response(
      JSON.stringify({
        guard_id,
        verification_status: "manual_review",
        sia_check_status: "webhook_error",
        message: "SIA check webhook did not return a usable result. Set to manual review.",
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
