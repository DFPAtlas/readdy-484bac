import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

Deno.serve(async (req: Request) => {
  const xCron = req.headers.get("x-cron-secret") || "";
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if (!cronSecret || xCron !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const functions = [
    "fn_cleanup_rate_limit_events",
    "fn_cleanup_email_send_log",
    "fn_cleanup_admin_registration_audit",
    "fn_cleanup_email_queue",
    "fn_cleanup_notifications",
    "fn_cleanup_processed_stripe_events",
  ];

  const results: Record<string, { status: string; error?: string }> = {};

  for (const fn of functions) {
    try {
      const { error } = await supabase.rpc(fn);
      results[fn] = { status: error ? "failed" : "completed" };
      if (error) results[fn].error = error.message;
    } catch (e) {
      results[fn] = { status: "failed", error: (e as Error).message };
    }
  }

  return new Response(
    JSON.stringify({ results, timestamp: new Date().toISOString() }),
    { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
  );
});
