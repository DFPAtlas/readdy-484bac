import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRating(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}

function cleanText(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "app" },
  });

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json(401, { error: "Authentication required" });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json(401, { error: "Authentication required" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid request body" });
  }

  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  const guardId = typeof body.guardId === "string" ? body.guardId : "";
  if (!UUID_RE.test(jobId) || !UUID_RE.test(guardId)) {
    return json(400, { error: "Invalid job or guard identifier" });
  }

  const rating = body.rating;
  if (!isRating(rating)) {
    return json(400, { error: "Overall rating must be an integer from 1 to 5" });
  }

  const catRating = (v: unknown): number | null => (isRating(v) ? v : null);
  const punctuality = catRating(body.punctuality);
  const professionalism = catRating(body.professionalism);
  const communication = catRating(body.communication);
  const appearance = catRating(body.appearance);
  const reliability = catRating(body.reliability);

  const reviewText = cleanText(body.reviewText);
  const privateNote = cleanText(body.privateNote);
  const issueReported = body.issueReported === true;
  const issueCategory = issueReported ? cleanText(body.issueCategory, 100) : null;
  const issueDescription = issueReported ? cleanText(body.issueDescription) : null;
  const wouldHireAgain = typeof body.wouldHireAgain === "boolean" ? body.wouldHireAgain : null;
  const siteInstructionsFollowed = typeof body.siteInstructionsFollowed === "boolean" ? body.siteInstructionsFollowed : null;
  const attendanceStatus = ["present", "late", "no_show"].includes(String(body.attendanceStatus))
    ? String(body.attendanceStatus)
    : "present";

  const { data, error } = await supabase.rpc("submit_client_review", {
    p_actor: user.id,
    p_request: { jobId, guardId, rating, reviewText, privateNote, punctuality, professionalism,
      communication, appearance, reliability, wouldHireAgain, siteInstructionsFollowed,
      attendanceStatus, issueReported, issueCategory, issueDescription,
      operationId: typeof body.operationId === "string" && UUID_RE.test(body.operationId) ? body.operationId : null },
  });
  if (error) {
    const code = error.code === "42501" ? 403 : error.code === "23505" ? 409 : error.code === "22023" || error.code === "22P02" ? 400 : 500;
    return json(code, { error: code === 403 ? "This review is not permitted" : code === 409 ? "This guard has already been reviewed with different details" : "Review submission could not be confirmed. Retry the same review." });
  }
  if (data?.success !== true || !data.review_id || !["closed", "review_pending"].includes(data.job_status)) return json(500, { error: "Review submission could not be confirmed" });
  return json(200, data);
});
