
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApplicationStatusPayload {
  guard_id: string;
  guard_email?: string;
  guard_name?: string;
  guard_user_id?: string;
  job_id: string;
  job_title?: string;
  client_name?: string;
  status: 'accepted' | 'declined' | 'rejected' | 'shortlisted';
  job_date?: string;
  job_time?: string;
  location?: string;
  hourly_rate?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;
  let isAdmin = false;
  let isClientOwner = false;
  let clientUserId: string | null = null;

  if (!isServiceRole) {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      db: { schema: 'app' },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: adminCheck } = await userClient
      .from('admin_users')
      .select('id, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminCheck && adminCheck.is_active) {
      isAdmin = true;
    }

    if (!isAdmin) {
      const { data: clientCheck } = await userClient
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (clientCheck) {
        clientUserId = clientCheck.id;
      }
    }

    if (!isAdmin && !clientUserId) {
      return new Response(
        JSON.stringify({ error: 'Active admin or client access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    const payload: ApplicationStatusPayload = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!isServiceRole && !isAdmin && clientUserId) {
      if (payload.status !== 'declined' && payload.status !== 'rejected') {
        return new Response(
          JSON.stringify({ error: 'Clients can only send declined status notifications' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: job } = await supabase
        .from('jobs')
        .select('client_id')
        .eq('id', payload.job_id)
        .maybeSingle();

      if (!job || job.client_id !== clientUserId) {
        return new Response(
          JSON.stringify({ error: 'You do not own this job' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const templateSlugMap: Record<string, string> = {
      accepted: 'application_accepted',
      declined: 'application_declined',
      rejected: 'application_declined',
      shortlisted: 'application_shortlisted',
    };
    const templateSlugForDedup = templateSlugMap[payload.status] || 'application_declined';

    const { data: existingEmail } = await supabase
      .from('email_send_log')
      .select('id')
      .eq('template', templateSlugForDedup)
      .eq('related_user_id', payload.guard_id)
      .eq('related_job_id', payload.job_id)
      .eq('status', 'sent')
      .gte('sent_at', cutoff)
      .maybeSingle();

    if (existingEmail) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Duplicate prevented — notification already sent for this job+guard within 24 hours' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let guardEmail = payload.guard_email;
    let guardName = payload.guard_name;
    let guardUserId = payload.guard_user_id;

    if (!guardEmail || !guardName || !guardUserId) {
      const { data: guard } = await supabase.from('guards').select('email, full_name, user_id').eq('id', payload.guard_id).maybeSingle();
      if (guard) {
        guardEmail = guardEmail || guard.email || '';
        guardName = guardName || guard.full_name || 'Guard';
        guardUserId = guardUserId || guard.user_id || '';
      }
    }

    if (!guardEmail) {
      return new Response(JSON.stringify({ message: 'Guard email not found, skipping' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let jobTitle = payload.job_title;
    let clientName = payload.client_name;
    let location = payload.location;
    let jobDate = payload.job_date;
    let jobTime = payload.job_time;
    let hourlyRate = payload.hourly_rate;

    if (!jobTitle || !clientName) {
      const { data: job } = await supabase.from('jobs').select('job_title, venue_city, client_id, start_date, start_time, end_time, hourly_rate').eq('id', payload.job_id).maybeSingle();
      if (job) {
        jobTitle = jobTitle || job.job_title || 'Unknown Job';
        location = location || job.venue_city || '';
        jobDate = jobDate || job.start_date || '';
        jobTime = jobTime || (job.start_time && job.end_time ? `${job.start_time} - ${job.end_time}` : job.start_time || '');
        hourlyRate = hourlyRate || job.hourly_rate || 0;
        if (!clientName && job.client_id) {
          const { data: client } = await supabase.from('clients').select('company_name, contact_name').eq('id', job.client_id).maybeSingle();
          clientName = client?.company_name || client?.contact_name || 'the client';
        }
      }
    }

    clientName = clientName || 'the client';
    jobTitle = jobTitle || 'Unknown Job';

    const { data: preferences } = await supabase.from('notification_preferences').select('application_updates').eq('user_id', payload.guard_id).maybeSingle();
    if (preferences && preferences.application_updates === false) {
      return new Response(JSON.stringify({ message: 'User disabled application update notifications' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const status = payload.status;
    const isAccepted = status === 'accepted';
    const isShortlisted = status === 'shortlisted';

    const templateSlug = isAccepted ? 'application_accepted' : isShortlisted ? 'application_shortlisted' : 'application_declined';

    let notificationTitle = 'Application Update';
    let notificationMessage = `Your application status for ${jobTitle} has been updated.`;

    if (isAccepted) {
      notificationTitle = 'Application Accepted!';
      notificationMessage = `${clientName} has accepted your application for ${jobTitle}.`;
    } else if (isShortlisted) {
      notificationTitle = 'You Were Shortlisted';
      notificationMessage = `You were shortlisted for ${jobTitle}. The client is still reviewing candidates.`;
    } else {
      notificationTitle = 'Application Not Selected';
      notificationMessage = `Your application for ${jobTitle} was not selected. New jobs are posted daily.`;
    }

    const variables: Record<string, string> = {
      guard_name: guardName,
      client_name: clientName,
      job_title: jobTitle,
      job_date: jobDate || 'TBC',
      job_time: jobTime || 'TBC',
      location: location || 'TBC',
      hourly_rate: String(hourlyRate),
      dashboard_url: `${siteUrl}/guard/dashboard`,
      job_url: `${siteUrl}/jobs/${payload.job_id}`,
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({
        template_slug: templateSlug,
        to: guardEmail,
        variables,
        from: 'QuickGuard <notifications@quickguard.co.uk>',
        related_user_id: payload.guard_id,
        related_job_id: payload.job_id,
      }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      throw new Error(`Template render failed: ${errText}`);
    }

    const renderData = await renderRes.json();

    if (guardUserId) {
      await supabase.from('notifications').insert({
        user_id: guardUserId,
        user_type: 'guard',
        title: notificationTitle,
        message: notificationMessage,
        type: 'application_status',
        is_read: false,
        link: `/guard/dashboard#notifications`,
        data: { job_id: payload.job_id, status },
        created_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Application status notification sent', email_id: renderData.email_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending application status notification:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send notification', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
