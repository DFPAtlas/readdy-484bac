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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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
          company_name,
          email,
          first_name,
          last_name,
          phone
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

    return new Response(
      JSON.stringify({ job }),
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
