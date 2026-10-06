import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const APPLY_ERRORS: Record<string, [number, string, Record<string, unknown>?]> = {
  invalid_request: [400, "guardId and jobId are required"],
  guard_not_found: [404, "Guard not found"],
  forbidden: [403, "Forbidden: You can only apply as yourself"],
  invite_not_found: [404, "Invitation not found"],
  invite_not_pending: [409, "This invitation is no longer open"],
  already_applied: [409, "Already applied", { alreadyApplied: true }],
  job_not_found: [404, "Job not found"],
  job_removed: [400, "This job has been removed"],
  job_closed: [400, "Job is no longer open for applications"],
  guard_inactive: [403, "Your account is not active. Contact support."],
  guard_not_verified: [403, "Your profile is not yet verified. You cannot apply for jobs until verification is complete."],
  sia_expired: [403, "Your SIA licence has expired. Please update your licence details."],
  sia_required: [403, "A verified SIA licence is required for this job"],
  sia_expiry_missing: [403, "Your SIA licence expiry date is missing"],
  licence_mismatch: [400, "You don't hold the required SIA licence types for this job"],
  no_plan: [400, "No subscription plan found"],
  plan_not_found: [400, "Plan not found"],
  tier_locked: [400, "Upgrade required to access this job tier", { tierLocked: true }],
  limit_reached: [400, "Monthly application limit reached", { limitReached: true }],
};

function applicationError(error: any) {
  const message = String(error?.message || "");
  const match = /qg_apply:([a-z_]+)(?::([a-z_]+))?/.exec(message);
  if (error?.code === "23505") return json({ error: "Already applied", alreadyApplied: true }, 409);
  if (!match) {
    console.error("[apply-to-job] Application failed:", error?.code, message);
    return json({ error: "Unable to submit application. Please try again." }, 500);
  }
  const [status, text, extra] = APPLY_ERRORS[match[1]] || [400, "Unable to submit application"];
  let usage: Record<string, unknown> = {};
  if (match[1] === "limit_reached" && error?.details) {
    try {
      const u = JSON.parse(error.details);
      usage = { limit: u.limit, used: u.used, planSlug: u.plan_slug, planName: u.plan_name, resetDate: u.period_end };
    } catch { /* detail is optional */ }
  }
  return json({ error: text, code: match[1], ...(extra || {}), ...(match[2] ? { requiredLevel: match[2] } : {}), ...usage }, status);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();

    if (!jwt || jwt === Deno.env.get("SUPABASE_ANON_KEY")) {
      return json({ error: "Unauthorized: Missing authentication token" }, 401);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: "app" } });
    // Verify the token with Supabase Auth (not just decode it).
    const { data: authData, error: authError } = await supabaseClient.auth.getUser(jwt);
    if (authError || !authData?.user) {
      return json({ error: "Invalid token" }, 401);
    }
    const authUserId = authData.user.id;

    const body = await req.json().catch(() => ({}));
    const { guardId, jobId, coverMessage, inviteId } = body;

    if (!guardId || !jobId) {
      return json({ error: "guardId and jobId are required" }, 400);
    }

    const { data: adminData, error: adminError } = await supabaseClient
      .from("admin_users")
      .select("id, is_active")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (adminError) return json({ error: "Unable to verify account" }, 500);
    const isAdmin = !!adminData?.is_active;

    // Single authoritative path: ownership, eligibility, tier, duplicate and
    // usage checks, invitation acceptance and the insert commit atomically.
    const { data: submitted, error: submitError } = await supabaseClient.rpc("submit_job_application", {
      p_actor_user_id: authUserId,
      p_guard_id: guardId,
      p_job_id: jobId,
      p_cover_message: typeof coverMessage === "string" ? coverMessage.slice(0, 5000) : "",
      p_invite_id: inviteId || null,
      p_is_admin: isAdmin,
    });

    if (submitError || !submitted?.applicationId) {
      return applicationError(submitError);
    }

    const application = { id: submitted.applicationId as string };
    const now = new Date().toISOString();

    if (submitted.replayed) {
      return json({ success: true, applicationId: application.id, replayed: true, warnings: [] }, 200);
    }

    const { data: jobData } = await supabaseClient
      .from("jobs")
      .select("id, job_title, hourly_rate, clients(id, user_id, email, company_name, first_name, last_name)")
      .eq("id", jobId)
      .maybeSingle();
    const guardData = { user_id: submitted.guardUserId as string };

    const warnings: string[] = [];

    try {
      const { data: guardInfo } = await supabaseClient
        .from("guards")
        .select("full_name, email, phone, years_experience, sia_licence_number")
        .eq("id", guardId)
        .maybeSingle();

      if (guardInfo && jobData?.clients) {
        const client = jobData.clients as any;
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-job-application-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            client_email: client.email || "",
            client_name: client.company_name || `${client.first_name || ""} ${client.last_name || ""}`.trim(),
            guard_name: guardInfo.full_name || "Guard",
            job_title: jobData?.job_title || "",
            job_id: jobId,
            proposed_rate: jobData?.hourly_rate || 0,
            cover_message: coverMessage || "",
            guard_id: guardId,
          }),
        });

        if (!emailResponse.ok) {
          const emailError = await emailResponse.text();
          console.error("[apply-to-job] Client application email failed:", emailResponse.status, emailError);
          warnings.push("client_application_email_failed");
        }
      }
    } catch (emailError) {
      console.error("[apply-to-job] Client application email error:", emailError);
      warnings.push("client_application_email_failed");
    }

    try {
      await supabaseClient.from("notifications").insert({
        user_id: guardData.user_id || authUserId,
        user_type: "guard",
        title: "Application Submitted",
        message: `You've applied to ${jobData?.job_title || "a job"}. The client will review your application.`,
        type: "info",
        is_read: false,
        link: `/guard/dashboard#notifications`,
        data: { job_id: jobId, application_id: application.id },
        created_at: now,
      });
    } catch {
    }

    if (submitted.inviteAccepted && (jobData?.clients as any)?.user_id) {
      const { error: inviteNoticeError } = await supabaseClient.from("notifications").insert({
        user_id: (jobData!.clients as any).user_id,
        user_type: "client",
        type: "job_application",
        title: "Invited Guard Applied",
        message: `An invited guard accepted your invite and applied for "${jobData?.job_title || "your job"}".`,
        link: `/client/jobs/applicants?id=${encodeURIComponent(jobId)}`,
        is_read: false,
      });
      if (inviteNoticeError) warnings.push("client_invite_notification_failed");
    }

    return new Response(JSON.stringify({ success: true, applicationId: application.id, warnings }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err && typeof err === 'object' && 'message' in err ? (err as Error).message : String(err);
    return new Response(JSON.stringify({ error: msg || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});