import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587;

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SMTP_USER = Deno.env.get('SMTP_USER');
  const SMTP_PASS = Deno.env.get('SMTP_PASS');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!SMTP_USER || !SMTP_PASS) {
    console.error('Missing SMTP_USER or SMTP_PASS');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { clientEmail, clientName, jobTitle, jobId, venue, startDate, startTime, numberOfGuards, hourlyRate }: EmailRequest = await req.json();

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
    const emailSubject = rendered.subject;
    const emailHtml = rendered.body_html;

    const textContent = `Job Posted Successfully!\n\nDear ${clientName},\n\nYour security job "${jobTitle}" has been posted.\n\nVenue: ${venue}\nStart Date: ${new Date(startDate).toLocaleDateString('en-GB')}\nStart Time: ${startTime}\nNumber of Guards: ${numberOfGuards}\nHourly Rate: £${hourlyRate.toFixed(2)}/hour\n\nView your dashboard: https://quickguard.uk/client/dashboard`;

    const boundary = '----=_Part_' + Date.now();
    const emailBody = [
      `From: QuickGuard <noreply@quickguard.uk>`,
      `To: ${clientEmail}`,
      `Subject: ${emailSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      textContent,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      emailHtml,
      ``,
      `--${boundary}--`,
    ].join('\r\n');

    const conn = await Deno.connect({ hostname: SMTP_HOST, port: SMTP_PORT });
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function readResponse(): Promise<string> {
      const buffer = new Uint8Array(1024);
      const n = await conn.read(buffer);
      return decoder.decode(buffer.subarray(0, n || 0));
    }

    async function sendCommand(command: string): Promise<string> {
      await conn.write(encoder.encode(command + '\r\n'));
      return await readResponse();
    }

    await readResponse();
    await sendCommand(`EHLO quickguard.uk`);
    await sendCommand(`STARTTLS`);

    const tlsConn = await Deno.startTls(conn, { hostname: SMTP_HOST });

    async function readTlsResponse(): Promise<string> {
      const buffer = new Uint8Array(1024);
      const n = await tlsConn.read(buffer);
      return decoder.decode(buffer.subarray(0, n || 0));
    }

    async function sendTlsCommand(command: string): Promise<string> {
      await tlsConn.write(encoder.encode(command + '\r\n'));
      return await readTlsResponse();
    }

    await sendTlsCommand(`EHLO quickguard.uk`);
    await sendTlsCommand(`AUTH LOGIN`);
    await sendTlsCommand(btoa(SMTP_USER));
    await sendTlsCommand(btoa(SMTP_PASS));
    await sendTlsCommand(`MAIL FROM:<noreply@quickguard.uk>`);
    await sendTlsCommand(`RCPT TO:<${clientEmail}>`);
    await sendTlsCommand(`DATA`);
    await sendTlsCommand(emailBody + '\r\n.');
    await sendTlsCommand(`QUIT`);

    tlsConn.close();

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
