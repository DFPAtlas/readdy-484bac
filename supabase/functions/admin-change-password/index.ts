import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hashHex}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, newPassword } = await req.json();
    if (!email || !newPassword) {
      return new Response(JSON.stringify({ error: "Email and new password are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (newPassword.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!, { db: { schema: 'app' } });

    const passwordHash = await hashPassword(newPassword);

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id, user_id")
      .eq("email", email)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminUser) {
      return new Response(JSON.stringify({ error: "Admin not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error } = await supabase
      .from("admin_users")
      .update({ password_hash: passwordHash })
      .eq("id", adminUser.id);

    if (error) {
      console.error('[AdminChangePassword] DB update failed:', error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (adminUser.user_id) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(adminUser.user_id, { password: newPassword });
      if (authUpdateError) {
        const msg = authUpdateError.message || '';
        if (msg.toLowerCase().includes('new password should be different from the old password')) {
          return new Response(JSON.stringify({ error: 'Your new password must be different from your current password. Please choose a different one.' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        console.error('[AdminChangePassword] Auth password sync failed:', authUpdateError.message);
      } else {
        console.log('[AdminChangePassword] Auth password synced for user:', adminUser.user_id);
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error('[AdminChangePassword] Edge function error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
