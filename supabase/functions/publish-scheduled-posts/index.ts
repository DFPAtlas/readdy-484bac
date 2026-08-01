import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date().toISOString();

  const { data: scheduled, error: fetchError } = await supabase
    .from("social_media_posts")
    .select("id, title, scheduled_date")
    .eq("status", "scheduled")
    .not("scheduled_date", "is", null)
    .lte("scheduled_date", now);

  if (fetchError) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch scheduled posts", detail: fetchError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!scheduled || scheduled.length === 0) {
    return new Response(
      JSON.stringify({ published: 0, posts: [], timestamp: now }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  }

  const ids = scheduled.map((p) => p.id);
  const publishedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("social_media_posts")
    .update({ status: "published", updated_at: publishedAt })
    .in("id", ids);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: "Failed to publish posts", detail: updateError.message, candidates: scheduled.length }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const published = scheduled.map((p) => ({
    id: p.id,
    title: p.title,
    was_scheduled_for: p.scheduled_date,
    published_at: publishedAt,
  }));

  return new Response(
    JSON.stringify({ published: published.length, posts: published, timestamp: now }),
    { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
  );
});
