import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_MAX_PER_IP = 60;
const RATE_LIMIT_WINDOW_MINUTES = 1;

function extractIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

async function checkRateLimit(client: any, ip: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count } = await client
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("lookup_key", `ip:${ip}`)
    .eq("action_type", "geocode")
    .gte("created_at", cutoff);

  if ((count || 0) >= RATE_LIMIT_MAX_PER_IP) {
    console.warn(`[Geocode] Rate limited by IP: ${ip} (${count} requests)`);
    return false;
  }

  return true;
}

async function recordRequest(client: any, ip: string, userAgent: string, success: boolean) {
  const now = new Date().toISOString();
  try {
    await client.from("rate_limit_events").insert({
      lookup_key: `ip:${ip}`,
      action_type: "geocode",
      attempted_at: now,
      success,
      ip_address: ip,
      user_agent: userAgent,
      blocked: !success,
      created_at: now,
    });
  } catch (e: any) {
    console.error("[Geocode] Failed to record event:", e.message);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const ip = extractIp(req);
  const userAgent = req.headers.get("user-agent") || "unknown";
  const publicClient = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: "public" } });

  try {
    const allowed = await checkRateLimit(publicClient, ip);
    if (!allowed) {
      await recordRequest(publicClient, ip, userAgent, false);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please slow down." }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(RATE_LIMIT_WINDOW_MINUTES * 60),
          },
        }
      );
    }

    const { query, postcode } = await req.json();
    const searchQuery = query || (postcode ? `${postcode}, UK` : null);

    if (!searchQuery) {
      await recordRequest(publicClient, ip, userAgent, false);
      return new Response(JSON.stringify({ error: "query or postcode required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_GEOCODING_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Geocoding not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&region=uk&key=${apiKey}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    const data = await res.json();

    if (data.status !== "OK" || !data.results?.[0]) {
      await recordRequest(publicClient, ip, userAgent, false);
      return new Response(JSON.stringify({
        error: data.status === "ZERO_RESULTS" ? "Address not found" : "Geocoding provider failed",
        hint: data.status === "REQUEST_DENIED" ? (/billing/i.test(data.error_message || "") ? "Google Cloud billing must be enabled." : /not authorized|not enabled|disabled/i.test(data.error_message || "") ? "Enable Geocoding API and allow it in the server key restrictions." : /referer|referrer/i.test(data.error_message || "") ? "The server key has incompatible browser referrer restrictions." : /IP address/i.test(data.error_message || "") ? "The server IP is not allowed by the key restrictions." : /invalid|expired/i.test(data.error_message || "") ? "The Google server API key is invalid or expired." : "Check Google Cloud API access, billing and server key restrictions.") : undefined,
        code: ["ZERO_RESULTS", "REQUEST_DENIED", "OVER_QUERY_LIMIT", "OVER_DAILY_LIMIT", "INVALID_REQUEST", "UNKNOWN_ERROR"].includes(data.status) ? data.status : "PROVIDER_ERROR",
      }), {
        status: data.status === "ZERO_RESULTS" ? 404 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await recordRequest(publicClient, ip, userAgent, true);

    const r = data.results[0];
    return new Response(
      JSON.stringify({
        latitude: r.geometry.location.lat,
        longitude: r.geometry.location.lng,
        formatted_address: r.formatted_address,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[Geocode] Request failed");
    await recordRequest(publicClient, ip, userAgent, false);
    return new Response(JSON.stringify({ error: "Geocoding temporarily unavailable", code: "GEOCODING_UNAVAILABLE" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
