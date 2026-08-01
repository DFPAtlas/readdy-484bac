
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Unsubscribed - QuickGuard</title></head>
<body style="font-family:Arial,sans-serif;background:#0B1933;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<div style="text-align:center;max-width:480px;padding:40px">
<div style="background:#111d35;border:1px solid #1a2b4a;border-radius:16px;padding:40px">
<h1 style="color:#14b8a6;font-size:24px;margin:0 0 16px">Unsubscribed</h1>
<p id="msg" style="color:#94a3b8;font-size:14px;line-height:1.6">Processing your request...</p>
<a href="/qg-launch-rewards" style="display:inline-block;margin-top:24px;background:#14b8a6;color:#0f172a;padding:12px 32px;border-radius:12px;font-weight:bold;font-size:14px;text-decoration:none">Back to QG Launch Rewards</a>
</div></div>
<script>
(function(){var u=new URL(window.location);var e=u.searchParams.get("email");var t=u.searchParams.get("token");var m=document.getElementById("msg");if(!e||!t){m.textContent="Invalid unsubscribe link. Please contact support if you believe this is an error.";return}fetch(u.origin+"/functions/v1/qg-launch-unsubscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,token:t})}).then(function(r){return r.json().then(function(d){if(r.ok&&d.success){m.textContent="You have been unsubscribed from QG Launch Rewards marketing emails."}else{m.textContent=d.error||"Something went wrong. Please try again or contact support."}})}).catch(function(){m.textContent="Something went wrong. Please try again or contact support."})})();
</script>
</body></html>`;

Deno.serve(async function(req) {
  if (req.method === 'GET') {
    return new Response(HTML_PAGE, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { email, token } = body;

    if (!email || !token) {
      return new Response(JSON.stringify({ error: 'Email and token are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const emailLower = email.toLowerCase().trim();

    const expectedToken = btoa(`qg_unsub_${emailLower}_2025`).replace(/=/g, '').substring(0, 32);
    if (token !== expectedToken) {
      return new Response(JSON.stringify({ error: 'Invalid unsubscribe token' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    const { data: existing } = await supabase.from('email_suppression_list').select('id').eq('email', emailLower).maybeSingle();

    if (!existing) {
      await supabase.from('email_suppression_list').insert({
        email: emailLower,
        reason: 'unsubscribed',
        source: 'qg_launch_rewards',
        created_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Unsubscribed successfully' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[qg-launch-unsubscribe] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
