
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';

  try {
    const body = await req.json();

    const email = body.email || body.guard_email || body.clientEmail || '';
    const name = body.name || body.guard_name || body.clientName || 'User';
    const job_title = body.job_title || body.jobTitle || '';
    const job_id = body.job_id || body.jobId || '';
    const deletion_reason = body.deletion_reason || body.deletionReason || 'This posting has been removed by the administrator.';

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: 'No recipient email provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const variables: Record<string, string> = {
      guard_name: name,
      job_title: job_title,
      job_url: `${siteUrl}/jobs`,
      dashboard_url: `${siteUrl}/guard/dashboard`,
      year: String(new Date().getFullYear()),
      deletion_reason: deletion_reason,
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({
        template_slug: 'job_deleted',
        to: email,
        variables,
        from: 'QuickGuard <notifications@quickguard.co.uk>',
      }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      throw new Error(`Template render failed: ${errText}`);
    }

    const renderData = await renderRes.json();
    return new Response(JSON.stringify({ success: true, email_id: renderData.email_id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
