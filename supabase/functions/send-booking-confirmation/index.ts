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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization') || '';

  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (authHeader !== `Bearer ${serviceKey}`) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      db: { schema: 'app' },
    });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: admin } = await userClient.from('admin_users').select('id,is_active').eq('user_id', user.id).maybeSingle();
    if (!admin?.is_active) {
      return new Response(JSON.stringify({ error: 'Active admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'app' } });
    const { jobId } = await req.json();
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'jobId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: job } = await supabase
      .from('jobs')
      .select('id, job_title, client_id, hourly_rate, number_of_guards, number_of_days, start_date, end_date, start_time, end_time, venue_name, venue_city')
      .eq('id', jobId)
      .maybeSingle();

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: client } = await supabase
      .from('clients')
      .select('email, contact_name, company_name, user_id')
      .eq('id', job.client_id)
      .maybeSingle();

    if (!client?.email) {
      return new Response(JSON.stringify({ error: 'Client email not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const start = new Date(`1970-01-01T${job.start_time}`);
    const end = new Date(`1970-01-01T${job.end_time}`);
    let hours = (end.getTime() - start.getTime()) / 3600000;
    if (hours <= 0) hours += 24;

    const variables = {
      client_name: client.contact_name || client.company_name || 'Client',
      job_title: job.job_title,
      venue: `${job.venue_name}${job.venue_city ? ', ' + job.venue_city : ''}`,
      start_date: job.start_date,
      start_time: job.start_time?.slice(0, 5) || '',
      end_time: job.end_time?.slice(0, 5) || '',
      number_of_guards: String(job.number_of_guards || 1),
      hourly_rate: String(job.hourly_rate || 0),
      hours_per_shift: String(hours),
      number_of_days: String(Math.max(1, Number(job.number_of_days ?? 1))),
      dashboard_url: 'https://quickguard.uk/client/dashboard',
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        template_slug: 'booking_confirmation',
        to: client.email,
        variables,
        from: 'QuickGuard <bookings@quickguard.uk>',
        related_user_id: client.user_id || null,
        related_job_id: jobId,
      }),
    });

    if (!renderRes.ok) throw new Error(`Booking confirmation send failed: ${await renderRes.text()}`);
    const rendered = await renderRes.json();

    return new Response(JSON.stringify({
      success: true,
      email_id: rendered.email_id,
      payload: { to: client.email, subject: rendered.subject },
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
