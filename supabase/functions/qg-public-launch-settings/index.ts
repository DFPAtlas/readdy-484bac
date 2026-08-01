import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PUBLIC_SETTINGS_KEYS = [
  "exit_popup_enabled",
  "exit_popup_show_on_homepage",
  "exit_popup_show_on_rewards_page",
  "exit_popup_show_on_all_public_pages",
  "exit_popup_mobile_enabled",
  "exit_popup_mobile_delay_seconds",
  "exit_popup_cooldown_days",
  "exit_popup_test_icon_enabled",
];

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": req.headers.get("origin") || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: "app" },
    });

    const { data, error } = await supabase
      .from("qg_launch_reward_settings")
      .select("key,value")
      .in("key", PUBLIC_SETTINGS_KEYS);

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to load settings" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const settings: Record<string, unknown> = {};
    for (const row of data || []) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }

    return new Response(JSON.stringify({ settings }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
