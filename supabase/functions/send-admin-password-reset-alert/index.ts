import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const { email, timestamp, ip } = await req.json();

    const formattedTime = new Date(timestamp || Date.now()).toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      dateStyle: 'full',
      timeStyle: 'long',
    });

    const ipBlock = ip ? `<p style="margin:6px 0;color:#111827;font-size:13px;"><strong>IP Address:</strong> ${ip}</p>` : '';

    const variables: Record<string, string> = {
      email: email || 'unknown',
      timestamp: formattedTime,
      ip_block: ipBlock,
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({
        template_slug: 'admin_password_reset_alert',
        to: Deno.env.get('ADMIN_ALERT_EMAIL') || 'admin@quickguard.uk',
        variables,
        from: 'noreply@quickguard.uk',
      }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      console.error('render-email-template error:', errText);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://quickguard.uk' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://quickguard.uk' },
    });
  }
});
