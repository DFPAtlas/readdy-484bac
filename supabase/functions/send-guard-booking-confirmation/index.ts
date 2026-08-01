
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${supabaseServiceKey}`) {
    return new Response(
      JSON.stringify({ error: 'Service role required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    const {
      guard_id,
      guard_email,
      guard_name,
      job_id,
      job_title,
      venue,
      start_date,
      start_time,
      end_time,
      hourly_rate,
      client_name,
    } = await req.json();

    if (!guard_id || !job_id) {
      return new Response(
        JSON.stringify({ error: 'guard_id and job_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let guardEmail = guard_email;
    let guardName = guard_name;
    let jobTitle = job_title;
    let venueStr = venue;
    let startDate = start_date;
    let startTime = start_time;
    let endTime = end_time;
    let hourlyRate = hourly_rate;
    let clientName = client_name;

    if (!guardEmail || !guardName) {
      const { data: guard } = await supabase
        .from('guards')
        .select('email, full_name')
        .eq('id', guard_id)
        .maybeSingle();
      if (guard) {
        guardEmail = guardEmail || guard.email || '';
        guardName = guardName || guard.full_name || 'Guard';
      }
    }

    if (!guardEmail) {
      return new Response(
        JSON.stringify({ success: false, reason: 'No guard email found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!jobTitle || !clientName) {
      const { data: job } = await supabase
        .from('jobs')
        .select('job_title, venue_name, venue_city, start_date, start_time, end_time, hourly_rate, client_id')
        .eq('id', job_id)
        .maybeSingle();
      if (job) {
        jobTitle = jobTitle || job.job_title || 'Unknown Job';
        venueStr = venueStr || `${job.venue_name || ''}${job.venue_city ? ', ' + job.venue_city : ''}`;
        startDate = startDate || job.start_date || '';
        startTime = startTime || (job.start_time?.slice(0, 5) || '');
        endTime = endTime || (job.end_time?.slice(0, 5) || '');
        hourlyRate = hourlyRate || job.hourly_rate || 0;
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

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingEmail } = await supabase
      .from('email_send_log')
      .select('id')
      .eq('template', 'guard_booking_confirmation')
      .eq('related_user_id', guard_id)
      .eq('related_job_id', job_id)
      .eq('status', 'sent')
      .gte('sent_at', cutoff)
      .maybeSingle();

    if (existingEmail) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Duplicate prevented — already sent within 24 hours' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('booking_updates')
      .eq('user_id', guard_id)
      .maybeSingle();

    if (preferences && preferences.booking_updates === false) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Guard disabled booking notifications' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const variables: Record<string, string> = {
      guard_name: guardName || 'Guard',
      client_name: clientName || 'the client',
      job_title: jobTitle || 'Unknown Job',
      venue: venueStr || 'TBC',
      start_date: startDate || 'TBC',
      start_time: startTime || 'TBC',
      end_time: endTime || 'TBC',
      hourly_rate: String(hourlyRate || 0),
      dashboard_url: `${siteUrl}/guard/dashboard`,
      job_url: `${siteUrl}/jobs/${job_id}`,
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        template_slug: 'guard_booking_confirmation',
        to: guardEmail,
        variables,
        from: 'QuickGuard <bookings@quickguard.co.uk>',
        dry_run: true,
        related_user_id: guard_id,
        related_job_id: job_id,
      }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      console.error('[SendGuardBookingConfirmation] Template render failed:', errText);
      return new Response(
        JSON.stringify({ success: false, error: 'Template render failed', details: errText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rendered = await renderRes.json();

    const n8nWebhookUrl = Deno.env.get('N8N_EMAIL_WEBHOOK_URL');
    if (n8nWebhookUrl) {
      await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: guardEmail,
          subject: rendered.subject || `Booking Confirmed: ${jobTitle}`,
          html: rendered.body_html,
          template: 'guard_booking_confirmation',
          data: variables,
        }),
      });
    }

    console.log(`[SendGuardBookingConfirmation] Sent to ${guardEmail} for job ${job_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Guard booking confirmation sent',
        to: guardEmail,
        subject: rendered.subject,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[SendGuardBookingConfirmation] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
