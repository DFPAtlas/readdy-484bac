import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  if (!publicKey) {
    return new Response(JSON.stringify({ error: "VAPID not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ publicKey }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
