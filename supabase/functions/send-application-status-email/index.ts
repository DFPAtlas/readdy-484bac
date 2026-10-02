import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-qg-email-worker-token',
};

interface Payload {
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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';
  const authHeader = req.headers.get('Authorization') || '';
  const workerToken = req.headers.get('x-qg-email-worker-token') || '';
  const serviceClient = createClient(supabaseUrl, serviceKey, { db: { schema: 'app' } });

  let isWorker = false;
  if (workerToken) {
    const { data: validWorker, error: workerError } = await serviceClient.rpc('validate_email_worker_token', { p_token: workerToken });
    isWorker = !workerError && validWorker === true;
  }

  const isServiceRole = authHeader === `Bearer ${serviceKey}`;
  let isAdmin = false;
  let clientId: string | null = null;

  if (!isWorker && !isServiceRole && !authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!isWorker && !isServiceRole) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      db: { schema: 'app' },
    });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: admin } = await userClient.from('admin_users').select('id,is_active').eq('user_id', user.id).maybeSingle();
    isAdmin = !!admin?.is_active;

    if (!isAdmin) {
      const { data: client } = await userClient.from('clients').select('id').eq('user_id', user.id).maybeSingle();
      clientId = client?.id || null;
    }

    if (!isAdmin && !clientId) {
      return new Response(JSON.stringify({ error: 'Active admin or client access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const payload: Payload = await req.json();
    const supabase = serviceClient;

    if (!isWorker && !isServiceRole && !isAdmin && clientId) {
      if (!['declined', 'rejected'].includes(payload.status)) {
        return new Response(JSON.stringify({ error: 'Clients can only send declined status notifications' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: job } = await supabase.from('jobs').select('client_id').eq('id', payload.job_id).maybeSingle();
      if (!job || job.client_id !== clientId) {
        return new Response(JSON.stringify({ error: 'You do not own this job' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { data: guard } = await supabase
      .from('guards')
      .select('email, full_name, user_id')
      .eq('id', payload.guard_id)
      .maybeSingle();

    const guardEmail = payload.guard_email || guard?.email || '';
    const guardName = payload.guard_name || guard?.full_name || 'Guard';
    const guardUserId = payload.guard_user_id || guard?.user_id || '';

    if (!guardEmail) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'Guard email not found' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const templateSlug = payload.status === 'accepted'
      ? 'application_accepted'
      : payload.status === 'shortlisted'
        ? 'application_shortlisted'
        : 'application_declined';

    const cutoff = new Date(Date.now() - 86400000).toISOString();
    const { data: existing } = await supabase
      .from('email_send_log')
      .select('id')
      .eq('template', templateSlug)
      .eq('related_user_id', guardUserId || payload.guard_id)
      .eq('related_job_id', payload.job_id)
      .eq('status', 'sent')
      .gte('sent_at', cutoff)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'Duplicate prevented' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (guardUserId) {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('application_updates')
        .eq('user_id', guardUserId)
        .maybeSingle();
      if (prefs?.application_updates === false) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'Application updates disabled' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let jobTitle = payload.job_title || '';
    let clientName = payload.client_name || '';
    let location = payload.location || '';
    let jobDate = payload.job_date || '';
    let jobTime = payload.job_time || '';
    let hourlyRate = payload.hourly_rate || 0;

    if (!jobTitle || !clientName) {
      const { data: job } = await supabase
        .from('jobs')
        .select('job_title, venue_city, client_id, start_date, start_time, end_time, hourly_rate')
        .eq('id', payload.job_id)
        .maybeSingle();
      if (job) {
        jobTitle ||= job.job_title || 'Unknown Job';
        location ||= job.venue_city || '';
        jobDate ||= job.start_date || '';
        jobTime ||= job.start_time && job.end_time ? `${job.start_time} - ${job.end_time}` : job.start_time || '';
        hourlyRate ||= job.hourly_rate || 0;
        if (!clientName && job.client_id) {
          const { data: client } = await supabase.from('clients').select('company_name, contact_name').eq('id', job.client_id).maybeSingle();
          clientName = client?.company_name || client?.contact_name || 'the client';
        }
      }
    }

    const variables = {
      guard_name: guardName,
      client_name: clientName || 'the client',
      job_title: jobTitle || 'Unknown Job',
      job_date: jobDate || 'TBC',
      job_time: jobTime || 'TBC',
      location: location || 'TBC',
      hourly_rate: String(hourlyRate || 0),
      dashboard_url: `${siteUrl}/guard/dashboard`,
      job_url: `${siteUrl}/jobs/${payload.job_id}`,
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        template_slug: templateSlug,
        to: guardEmail,
        variables,
        from: 'QuickGuard <notifications@quickguard.uk>',
        related_user_id: guardUserId || payload.guard_id,
        related_job_id: payload.job_id,
      }),
    });

    if (!renderRes.ok) throw new Error(`Template send failed: ${await renderRes.text()}`);
    const renderData = await renderRes.json();

    if (guardUserId) {
      const title = payload.status === 'accepted'
        ? 'Application Accepted!'
        : payload.status === 'shortlisted'
          ? 'You Were Shortlisted'
          : 'Application Not Selected';

      await supabase.from('notifications').insert({
        user_id: guardUserId,
        user_type: 'guard',
        title,
        message: `Your application status for ${jobTitle || 'this job'} has been updated.`,
        type: 'application_status',
        is_read: false,
        link: '/guard/dashboard#notifications',
        data: { job_id: payload.job_id, status: payload.status },
        created_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ success: true, email_id: renderData.email_id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Failed to send notification', details: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
