import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceRoleKey
  );

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: err1, count: c1 } = await supabase
    .from("rate_limit_events")
    .delete({ count: "exact" })
    .lt("attempted_at", cutoff);

  if (err1) {
    return new Response(JSON.stringify({ error: err1.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error: err2, count: c2 } = await supabase
    .schema("app")
    .from("rate_limit_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (err2) {
    return new Response(JSON.stringify({ error: err2.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      purged_public: c1 ?? 0,
      purged_app: c2 ?? 0,
      cutoff,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});