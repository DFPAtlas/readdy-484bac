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

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!client) return json(403, { error: "Client account not found" });

  const { data: job } = await supabase
    .from("jobs")
    .select("id, client_id, status")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return json(400, { error: "Job not found" });
  if (job.client_id !== client.id) return json(403, { error: "You are not authorised to review this job" });
  if (job.status !== "paid_out" && job.status !== "review_pending") {
    return json(400, { error: "This job is not eligible for review yet" });
  }

  const { data: assignment } = await supabase
    .from("job_assignments")
    .select("id, status, payment_status")
    .eq("job_id", jobId)
    .eq("guard_id", guardId)
    .maybeSingle();

  if (!assignment) return json(400, { error: "This guard was not assigned to this job" });
  if (assignment.status !== "completed") return json(400, { error: "This guard has not completed the job yet" });
  if (assignment.payment_status !== "paid_out") return json(400, { error: "This guard's payout has not completed yet" });

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("assignment_id", assignment.id)
    .maybeSingle();

  if (existing) return json(409, { error: "You have already reviewed this guard for this job" });

  const now = new Date().toISOString();
  const { error: insertError } = await supabase.from("reviews").insert({
    job_id: jobId,
    guard_id: guardId,
    client_id: client.id,
    assignment_id: assignment.id,
    rating,
    review_text: reviewText,
    private_note: privateNote,
    punctuality,
    professionalism,
    communication,
    appearance,
    reliability,
    would_hire_again: wouldHireAgain,
    site_instructions_followed: siteInstructionsFollowed,
    attendance_status: attendanceStatus,
    issue_reported: issueReported,
    issue_category: issueCategory,
    issue_description: issueDescription,
    status: "hidden",
    review_status: issueReported ? "issue_reported" : "reviewed",
    created_at: now,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return json(409, { error: "You have already reviewed this guard for this job" });
    }
    console.error("create-review insert error", insertError.message);
    return json(500, { error: "Unable to submit review" });
  }

  const { data: ratingRows } = await supabase
    .from("reviews")
    .select("rating")
    .eq("guard_id", guardId)
    .eq("status", "published");

  const published = ratingRows || [];
  const totalReviews = published.length;
  const avgRating = totalReviews > 0
    ? Math.round((published.reduce((s, r) => s + (r.rating || 0), 0) / totalReviews) * 10) / 10
    : 0;

  await supabase
    .from("guards")
    .update({ rating: avgRating, total_reviews: totalReviews, updated_at: now })
    .eq("id", guardId);

  const { data: allAssignments } = await supabase
    .from("job_assignments")
    .select("id, payment_status, status")
    .eq("job_id", jobId);

  const requiredIds = (allAssignments || [])
    .filter((a) => a.payment_status === "paid_out" && a.status === "completed")
    .map((a) => a.id);

  const { data: jobReviews } = await supabase
    .from("reviews")
    .select("assignment_id")
    .eq("job_id", jobId);

  const reviewedIds = new Set((jobReviews || []).map((r) => r.assignment_id).filter(Boolean));
  const allReviewed = requiredIds.length > 0 && requiredIds.every((id) => reviewedIds.has(id));

  const nextStatus = allReviewed ? "closed" : "review_pending";
  await supabase
    .from("jobs")
    .update({ status: nextStatus, updated_at: now })
    .eq("id", jobId);

  return json(200, { success: true, message: "Review submitted for moderation", job_status: nextStatus });
});
