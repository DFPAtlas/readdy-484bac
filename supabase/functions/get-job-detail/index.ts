import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const PROD_ORIGINS = ['https://quickguard.uk', 'https://www.quickguard.uk'];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (origin === 'https://readdy.ai' || origin.endsWith('.readdy.ai')) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

function buildCorsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : PROD_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "Missing jobId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      { db: { schema: 'app' } }
    );

    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .select(`
        id,
        client_id,
        job_title,
        job_description,
        security_type,
        number_of_guards,
        start_date,
        end_date,
        start_time,
        end_time,
        urgency,
        sia_licence_required,
        required_licence_types,
        experience_level,
        venue_name,
        venue_address_line1,
        venue_address_line2,
        venue_city,
        venue_postcode,
        uniform_required,
        uniform_details,
        additional_requirements,
        hourly_rate,
        payment_terms,
        status,
        views,
        created_at,
        clients (
          id,
          company_name
        )
      `)
      .eq("id", jobId)
      .maybeSingle();

    if (error) {
      console.error("DB error:", error);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!job || job.is_deleted === true) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [{ data: clientProfile }, { data: guardProfile }] = await Promise.all([
      supabaseAdmin.from("clients").select("id").eq("user_id", user.id).maybeSingle(),
      supabaseAdmin.from("guards").select("id, verification_status, is_active").eq("user_id", user.id).maybeSingle(),
    ]);

    const isOwnerClient = !!clientProfile && clientProfile.id === job.client_id;
    const isEligibleGuard = !!guardProfile &&
      guardProfile.is_active === true &&
      ['verified', 'approved'].includes(guardProfile.verification_status || '');

    if (!isOwnerClient && !isEligibleGuard) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (isEligibleGuard && !['open', 'awaiting_guard_selection'].includes(job.status)) {
      const { data: existingApplication } = await supabaseAdmin
        .from("job_applications")
        .select("id")
        .eq("job_id", job.id)
        .eq("guard_id", guardProfile.id)
        .maybeSingle();
      const { data: existingAssignment } = await supabaseAdmin
        .from("job_assignments")
        .select("id")
        .eq("job_id", job.id)
        .eq("guard_id", guardProfile.id)
        .maybeSingle();

      if (!existingApplication && !existingAssignment) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    const safeJob = {
      ...job,
      venue_address_line1: isOwnerClient ? job.venue_address_line1 : null,
      venue_address_line2: isOwnerClient ? job.venue_address_line2 : null,
    };

    return new Response(
      JSON.stringify({ job: safeJob }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
