import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_ALLOWLIST = [
  'https://quickguard.uk',
  'https://www.quickguard.uk',
];

function getAllowedOrigin(origin: string | null): string {
  if (origin && CORS_ALLOWLIST.includes(origin)) return origin;
  return 'https://quickguard.uk';
}

function corsResponse(origin: string | null, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getAllowedOrigin(origin),
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

interface EmailRequest {
  clientEmail: string;
  clientName: string;
  jobTitle: string;
  jobId: string;
  venue: string;
  startDate: string;
  startTime: string;
  numberOfGuards: number;
  hourlyRate: number;
}

serve(async (req: Request) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': getAllowedOrigin(origin),
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return corsResponse(origin, 405, { error: 'Method not allowed' });
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromDomain = Deno.env.get('RESEND_FROM_DOMAIN') || 'quickguard.uk';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!resendApiKey) {
    return corsResponse(origin, 500, { error: 'Email service is not configured' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return corsResponse(origin, 500, { error: 'Server configuration error' });
  }

  try {
    const { clientEmail, clientName, jobTitle, jobId, venue, startDate, startTime, numberOfGuards, hourlyRate }: EmailRequest = await req.json();

    if (!clientEmail) {
      return corsResponse(origin, 400, { error: 'Recipient email is required' });
    }

    const variables: Record<string, string> = {
      client_name: clientName,
      job_title: jobTitle,
      venue: venue,
      start_date: new Date(startDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      start_time: startTime,
      number_of_guards: String(numberOfGuards),
      hourly_rate: hourlyRate.toFixed(2),
      dashboard_url: 'https://quickguard.uk/client/dashboard',
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ template_slug: 'job_posted', to: clientEmail, variables, dry_run: true }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      throw new Error(`Template render failed: ${errText}`);
    }

    const rendered = await renderRes.json();
    const emailSubject = rendered.subject || `Job Posted: ${jobTitle}`;
    const emailHtml = rendered.body_html;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `QuickGuard <noreply@${fromDomain}>`,
        to: [clientEmail],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      throw new Error(`Resend send failed (${resendRes.status}): ${errText}`);
    }

    const result = await resendRes.json();

    return corsResponse(origin, 200, {
      success: true,
      message: 'Email sent successfully',
      message_id: result.id,
    });
  } catch (error) {
    console.error('Error sending job posted email:', error);
    return corsResponse(origin, 500, {
      success: false,
      error: (error as Error).message,
    });
  }
});
