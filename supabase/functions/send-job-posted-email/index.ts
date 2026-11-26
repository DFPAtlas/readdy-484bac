import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
  numberOfGuards: number | string;
  hourlyRate: number | string;
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return corsResponse(origin, 500, { error: 'Server configuration error' });
  }

  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${supabaseServiceKey}`) {
    return corsResponse(origin, 403, { error: 'Forbidden' });
  }

  try {
    const { clientEmail, clientName, jobTitle, jobId, venue, startDate, startTime, numberOfGuards, hourlyRate }: EmailRequest = await req.json();

    if (!clientEmail) {
      return corsResponse(origin, 400, { error: 'Recipient email is required' });
    }

    const rate = typeof hourlyRate === 'number' || typeof hourlyRate === 'string'
      ? Number(hourlyRate) : NaN;
    const guards = typeof numberOfGuards === 'number' || typeof numberOfGuards === 'string'
      ? Number(numberOfGuards) : NaN;
    if (!Number.isFinite(rate) || rate <= 0 || rate > 1000
        || !Number.isInteger(guards) || guards < 1 || guards > 100) {
      return corsResponse(origin, 400, { error: 'Valid hourly rate and guard count are required' });
    }

    // Project-private delivery control. A read failure or unknown value must
    // never fall back to sending. Missing retains the existing send behavior.
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'app' }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: setting, error: settingError } = await supabase.from('settings')
      .select('value').eq('key', 'job_posted_email_delivery_mode').maybeSingle();
    const mode = setting ? setting.value : 'send';
    if (settingError || !['send', 'dry_run', 'paused'].includes(mode)) {
      return corsResponse(origin, 503, { success: false, error: 'Email delivery configuration unavailable' });
    }
    if (mode === 'paused') {
      return corsResponse(origin, 503, { success: false, delivered: false, error: 'Email delivery is paused' });
    }
    const dryRun = mode === 'dry_run';

    // Publication state is authoritative in the saved job, never caller input.
    // A scheduled draft must not receive the existing "now live" confirmation.
    const { data: job, error: jobError } = await supabase.from('jobs')
      .select('status,is_draft,publish_at').eq('id', jobId).maybeSingle();
    if (jobError) {
      return corsResponse(origin, 503, { success: false, error: 'Job publication status unavailable' });
    }
    if (!job || !['open', 'draft'].includes(job.status)) {
      return corsResponse(origin, 409, { success: false, error: 'Job is not awaiting publication confirmation' });
    }
    const scheduled = job.status === 'draft' && job.is_draft === true;
    const publishAt = typeof job.publish_at === 'string' ? new Date(job.publish_at) : null;
    if ((job.status === 'draft' && !scheduled) || (job.status === 'open' && job.is_draft)
        || (scheduled && (!publishAt || Number.isNaN(publishAt.getTime())))) {
      return corsResponse(origin, 409, { success: false, error: 'Job publication status needs review' });
    }

    const variables: Record<string, string> = {
      client_name: clientName,
      job_title: jobTitle,
      venue: venue,
      start_date: new Date(startDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      start_time: startTime,
      number_of_guards: String(guards),
      hourly_rate: rate.toFixed(2),
      dashboard_url: 'https://quickguard.uk/client/dashboard',
      year: String(new Date().getFullYear()),
    };
    if (scheduled && publishAt) {
      variables.publish_at = publishAt.toLocaleString('en-GB', {
        timeZone: 'Europe/London', weekday: 'long', year: 'numeric', month: 'long',
        day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      });
    }

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({
        template_slug: scheduled ? 'job_scheduled' : 'job_posted',
        to: clientEmail,
        variables,
        from: 'QuickGuard <notifications@quickguard.uk>',
        related_job_id: jobId,
        dry_run: dryRun,
      }),
    });

    if (!renderRes.ok) {
      throw new Error(`Template request failed (${renderRes.status})`);
    }

    const result: unknown = await renderRes.json();
    if (!result || typeof result !== 'object') throw new Error('Invalid template response');
    if (dryRun) {
      if (!('subject' in result) || typeof result.subject !== 'string'
          || !('body_html' in result) || typeof result.body_html !== 'string') {
        throw new Error('Template preview was not confirmed');
      }
      return corsResponse(origin, 200, { success: true, delivered: false, dry_run: true });
    }
    if (!('success' in result) || result.success !== true
        || !('email_id' in result) || typeof result.email_id !== 'string' || !result.email_id.trim()) {
      throw new Error('Email provider acceptance was not confirmed');
    }

    return corsResponse(origin, 200, {
      success: true,
      delivered: true,
      message: 'Email sent successfully',
      message_id: result.email_id,
    });
  } catch (error) {
    console.error('Error sending job posted email:', error);
    return corsResponse(origin, 500, {
      success: false,
      error: 'Job confirmation email could not be sent',
    });
  }
});
