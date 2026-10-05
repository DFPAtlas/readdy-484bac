import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';

  if (req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Service role required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'app' } });
    const body = await req.json();

    const guardId = body.guard_id;
    const jobId = body.job_id;
    if (!guardId || !jobId) {
      return new Response(JSON.stringify({ error: 'guard_id and job_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: guard } = await supabase
      .from('guards')
      .select('email, full_name, user_id')
      .eq('id', guardId)
      .maybeSingle();

    const guardEmail = body.guard_email || guard?.email || '';
    const guardName = body.guard_name || guard?.full_name || 'Guard';
    const guardUserId = guard?.user_id || '';

    if (!guardEmail) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'No guard email found' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (guardUserId) {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('guard_confirmations')
        .eq('user_id', guardUserId)
        .maybeSingle();

      if (prefs?.guard_confirmations === false) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'Guard disabled booking confirmations' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const cutoff = new Date(Date.now() - 86400000).toISOString();
    const { data: existing } = await supabase
      .from('email_send_log')
      .select('id')
      .eq('template', 'guard_booking_confirmation')
      .eq('related_user_id', guardUserId || guardId)
      .eq('related_job_id', jobId)
      .eq('status', 'sent')
      .gte('sent_at', cutoff)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'Duplicate prevented' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let jobTitle = body.job_title || '';
    let venue = body.venue || '';
    let startDate = body.start_date || '';
    let startTime = body.start_time || '';
    let endTime = body.end_time || '';
    let hourlyRate = body.hourly_rate || 0;
    let clientName = body.client_name || '';

    if (!jobTitle || !clientName) {
      const { data: job } = await supabase
        .from('jobs')
        .select('job_title, venue_name, venue_city, start_date, start_time, end_time, hourly_rate, client_id')
        .eq('id', jobId)
        .maybeSingle();

      if (job) {
        jobTitle ||= job.job_title || 'Unknown Job';
        venue ||= `${job.venue_name || ''}${job.venue_city ? ', ' + job.venue_city : ''}`;
        startDate ||= job.start_date || '';
        startTime ||= job.start_time?.slice(0, 5) || '';
        endTime ||= job.end_time?.slice(0, 5) || '';
        hourlyRate ||= job.hourly_rate || 0;

        if (!clientName && job.client_id) {
          const { data: client } = await supabase
            .from('clients')
            .select('company_name, contact_name')
            .eq('id', job.client_id)
            .maybeSingle();
          clientName = client?.company_name || client?.contact_name || 'the client';
        }
      }
    }

    const variables = {
      guard_name: guardName,
      client_name: clientName || 'the client',
      job_title: jobTitle || 'Unknown Job',
      venue: venue || 'TBC',
      start_date: startDate || 'TBC',
      start_time: startTime || 'TBC',
      end_time: endTime || 'TBC',
      hourly_rate: String(hourlyRate || 0),
      dashboard_url: `${siteUrl}/guard/dashboard`,
      job_url: `${siteUrl}/jobs/detail?id=${encodeURIComponent(jobId)}`,
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        template_slug: 'guard_booking_confirmation',
        to: guardEmail,
        variables,
        from: 'QuickGuard <bookings@quickguard.uk>',
        related_user_id: guardUserId || guardId,
        related_job_id: jobId,
      }),
    });

    if (!renderRes.ok) throw new Error(`Guard booking confirmation send failed: ${await renderRes.text()}`);
    const sent = await renderRes.json();

    return new Response(JSON.stringify({
      success: true,
      message: 'Guard booking confirmation sent',
      email_id: sent.email_id,
      to: guardEmail,
      subject: sent.subject,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
