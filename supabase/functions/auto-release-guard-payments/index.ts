import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  const xCron = req.headers.get("x-cron-secret") || "";
  const cronSecret = Deno.env.get("CRON_SECRET") || "";

  if (!cronSecret || xCron !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    error: "This auto-release payout endpoint has been retired.",
    retired: true,
    migrateTo: "process-overdue-guard-payouts",
  }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  });
});
