import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const PLAN_ACCESS: Record<string, number> = {
  guard_starter: 0,
  "guard-basic": 1,
  "guard-pro": 2,
  "guard-elite": 3,
};

const JOB_LEVEL: Record<string, number> = {
  basic: 0,
  professional: 1,
  premium: 2,
  elite: 3,
};

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
      return new Response(JSON.stringify({ error: "Unauthorized: Missing authentication token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = decodeJwtPayload(jwt);
    if (!payload || !payload.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authUserId = payload.sub;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: "app" } });

    const body = await req.json();
    const { guardId, jobId, coverMessage } = body;

    if (!guardId || !jobId) {
      return new Response(JSON.stringify({ error: "guardId and jobId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: guardData, error: guardError } = await supabaseClient
      .from("guards")
      .select("id, user_id, created_at, verification_status, licence_types, sia_licence_number, sia_expiry_date, is_active")
      .eq("id", guardId)
      .maybeSingle();

    if (guardError || !guardData) {
      return new Response(JSON.stringify({ error: "Guard not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminData } = await supabaseClient
      .from("admin_users")
      .select("id")
      .eq("user_id", authUserId)
      .maybeSingle();

    const isAdmin = !!adminData;

    if (!isAdmin && guardData.user_id !== authUserId) {
      return new Response(JSON.stringify({ error: "Forbidden: You can only apply as yourself" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAdmin) {
      if (!guardData.is_active) {
        return new Response(JSON.stringify({ error: "Your account is not active. Contact support." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (guardData.verification_status !== "verified" && guardData.verification_status !== "approved") {
        return new Response(JSON.stringify({
          error: "Your profile is not yet verified. You cannot apply for jobs until verification is complete.",
          verificationStatus: guardData.verification_status
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (guardData.sia_expiry_date) {
        const expiry = new Date(guardData.sia_expiry_date);
        if (expiry < new Date()) {
          return new Response(JSON.stringify({ error: "Your SIA licence has expired. Please update your licence details." }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const { data: jobData, error: jobError } = await supabaseClient
      .from("jobs")
      .select("id, status, sia_licence_required, required_licence_types, job_tier, job_access_level, job_title, start_date, venue_name, clients(id, email, company_name, first_name, last_name), is_deleted")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError || !jobData) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (jobData.is_deleted) {
      return new Response(JSON.stringify({ error: "This job has been removed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (jobData.status !== "open") {
      return new Response(JSON.stringify({ error: "Job is no longer open for applications" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (jobData.sia_licence_required && jobData.required_licence_types && jobData.required_licence_types.length > 0) {
      const guardLicences = guardData.licence_types || [];
      const hasRequired = jobData.required_licence_types.some((req: string) =>
        guardLicences.some((lic: string) => lic.toLowerCase() === req.toLowerCase())
      );
      if (!hasRequired) {
        return new Response(JSON.stringify({ error: "You don't hold the required SIA licence types for this job" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: existingApp } = await supabaseClient
      .from("job_applications")
      .select("id")
      .eq("job_id", jobId)
      .eq("guard_id", guardId)
      .maybeSingle();

    if (existingApp) {
      return new Response(JSON.stringify({ error: "Already applied", alreadyApplied: true }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAdmin) {
      const { data: entitlement } = await supabaseClient
        .from("user_entitlements_data")
        .select("plan_slug, plan_name, is_free_tier, current_period_end")
        .eq("user_id", guardData.user_id)
        .maybeSingle();

      if (!entitlement?.plan_slug) {
        return new Response(JSON.stringify({ error: "No subscription plan found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: plan } = await supabaseClient
        .from("plans")
        .select("job_limit_per_month, slug, name")
        .eq("slug", entitlement.plan_slug)
        .maybeSingle();

      if (!plan) {
        return new Response(JSON.stringify({ error: "Plan not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const jobAccessLevel = jobData.job_access_level || "basic";
      const guardLvl = PLAN_ACCESS[entitlement.plan_slug] ?? 0;
      const jobLvl = JOB_LEVEL[jobAccessLevel] ?? 0;

      if (guardLvl < jobLvl) {
        return new Response(JSON.stringify({ error: "Upgrade required to access this job tier", tierLocked: true, requiredLevel: jobAccessLevel }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (plan.job_limit_per_month !== null) {
        const { data: usageCheck, error: usageError } = await supabaseClient
          .rpc('check_monthly_usage', {
            p_user_id: guardData.user_id,
            p_feature_key: 'guard_application',
            p_increment: true,
          });

        if (usageError || !usageCheck) {
          return new Response(JSON.stringify({ error: "Failed to check usage limits" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (!usageCheck.allowed) {
          return new Response(JSON.stringify({
            error: "Monthly application limit reached",
            limitReached: true,
            limit: usageCheck.limit,
            used: usageCheck.used,
            planSlug: usageCheck.plan_slug,
            planName: usageCheck.plan_name,
            resetDate: usageCheck.period_end,
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const now = new Date().toISOString();
    const { data: application, error: insertError } = await supabaseClient
      .from("job_applications")
      .insert({
        job_id: jobId,
        guard_id: guardId,
        cover_message: coverMessage || "",
        status: "pending",
        applied_at: now,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(JSON.stringify({ error: "Already applied", alreadyApplied: true }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw insertError;
    }

    try {
      const { data: guardInfo } = await supabaseClient
        .from("guards")
        .select("full_name, email, phone, years_experience, sia_licence_number")
        .eq("id", guardId)
        .maybeSingle();

      if (guardInfo && jobData.clients) {
        const client = jobData.clients as any;
        await fetch(`${supabaseUrl}/functions/v1/send-job-application-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            clientEmail: client.email || "",
            clientName: client.company_name || `${client.first_name || ""} ${client.last_name || ""}`.trim(),
            guardName: guardInfo.full_name,
            jobTitle: jobData.job_title,
            jobVenue: jobData.venue_name || "",
            jobDate: jobData.start_date ? new Date(jobData.start_date).toLocaleDateString("en-GB", {
              weekday: "long", day: "numeric", month: "long", year: "numeric"
            }) : "",
            guardPhone: guardInfo.phone || "",
            guardEmail: guardInfo.email || "",
            guardExperience: guardInfo.years_experience || 0,
            siaLicense: guardInfo.sia_licence_number || "N/A",
            coverLetter: coverMessage || "",
          }),
        });
      }
    } catch {
    }

    try {
      await supabaseClient.from("notifications").insert({
        user_id: guardData.user_id || authUserId,
        user_type: "guard",
        title: "Application Submitted",
        message: `You've applied to ${jobData.job_title || "a job"}. The client will review your application.`,
        type: "info",
        is_read: false,
        link: `/guard/dashboard#notifications`,
        data: { job_id: jobId, application_id: application.id },
        created_at: now,
      });
    } catch {
    }

    return new Response(JSON.stringify({ success: true, applicationId: application.id }), {
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