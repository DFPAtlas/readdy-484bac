import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Service role required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const recipient = body.guard_email;
    if (!recipient) {
      return new Response(JSON.stringify({ error: 'guard_email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const variables = {
      guard_name: body.guard_name || 'Guard',
      digest_date: body.digest_date || '',
      digest_content: body.digest_content || '',
      dashboard_url: 'https://quickguard.uk/guard/dashboard',
      year: String(new Date().getFullYear()),
    };

    const sendRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        template_slug: 'daily_digest',
        to: recipient,
        variables,
        from: 'QuickGuard <digest@quickguard.uk>',
      }),
    });

    if (!sendRes.ok) {
      return new Response(JSON.stringify({ error: 'Digest send failed', details: await sendRes.text() }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sent = await sendRes.json();
    return new Response(JSON.stringify({ success: true, email_id: sent.email_id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
