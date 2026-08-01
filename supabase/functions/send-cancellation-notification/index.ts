import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { cancellation_id } = await req.json();
    if (!cancellation_id) {
      return new Response(JSON.stringify({ error: 'cancellation_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: cancellation } = await supabase
      .from('job_cancellations')
      .select('*, jobs:job_id(id, job_title, venue_name, venue_city, start_date, start_time)')
      .eq('id', cancellation_id)
      .maybeSingle();

    if (!cancellation) {
      return new Response(JSON.stringify({ error: 'Cancellation not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const job = cancellation.jobs;
    const { data: clientData } = await supabase.from('clients').select('id, company_name, contact_name, user_id, users:user_id(email, full_name)').eq('id', cancellation.client_id).maybeSingle();
    const { data: guardData } = await supabase.from('guards').select('id, full_name, user_id, users:user_id(email, full_name)').eq('id', cancellation.guard_id).maybeSingle();

    const clientEmail = clientData?.users?.email || '';
    const clientName = clientData?.company_name || clientData?.contact_name || clientData?.users?.full_name || 'Client';
    const guardEmail = guardData?.users?.email || '';
    const guardName = guardData?.full_name || guardData?.users?.full_name || 'Guard';

    const cancelledBy = cancellation.cancelled_by;
    const refundTotal = cancellation.refund_total || 0;
    const reason = cancellation.reason || cancellation.cancellation_reason || 'No reason provided';
    const startDate = job?.start_date ? new Date(job.start_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A';
    const startTime = job?.start_time || 'N/A';

    const refundInfo = refundTotal > 0 ? `<p style="margin:6px 0;color:#4b5563;"><strong>Refund amount:</strong> £${refundTotal.toFixed(2)}</p>` : '';

    const results: any[] = [];

    if (clientEmail) {
      const cvars: Record<string, string> = {
        client_name: clientName,
        job_title: job?.job_title || 'N/A',
        venue: `${job?.venue_name || ''}, ${job?.venue_city || ''}`,
        start_date: startDate,
        start_time: startTime,
        cancelled_by: cancelledBy || 'N/A',
        reason,
        refund_info: refundInfo,
        dashboard_url: `${siteUrl}/client/jobs`,
        year: String(new Date().getFullYear()),
      };

      const rres = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ template_slug: 'job_cancelled_client', to: clientEmail, variables: cvars, from: 'QuickGuard <notifications@quickguard.co.uk>' }),
      });

      if (rres.ok) {
        const rd = await rres.json();
        results.push({ recipient: 'client', email_id: rd.email_id });
      } else {
        results.push({ recipient: 'client', error: await rres.text() });
      }
    }

    if (guardEmail) {
      const gvars: Record<string, string> = {
        guard_name: guardName,
        job_title: job?.job_title || 'N/A',
        venue: `${job?.venue_name || ''}, ${job?.venue_city || ''}`,
        start_date: startDate,
        start_time: startTime,
        cancelled_by: cancelledBy || 'N/A',
        reason,
        refund_info: refundInfo,
        dashboard_url: `${siteUrl}/guard/dashboard`,
        year: String(new Date().getFullYear()),
      };

      const rres = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ template_slug: 'job_cancelled_guard', to: guardEmail, variables: gvars, from: 'QuickGuard <notifications@quickguard.co.uk>' }),
      });

      if (rres.ok) {
        const rd = await rres.json();
        results.push({ recipient: 'guard', email_id: rd.email_id });
      } else {
        results.push({ recipient: 'guard', error: await rres.text() });
      }
    }

    const notifications = [];
    if (clientData?.user_id) {
      notifications.push({
        user_id: clientData.user_id, user_type: 'client', type: 'job_cancelled',
        title: 'Job Cancelled', message: reason, link: '/client/dashboard#notifications',
        is_read: false, created_at: new Date().toISOString(), related_id: cancellation.job_id,
      });
    }
    if (guardData?.user_id) {
      notifications.push({
        user_id: guardData.user_id, user_type: 'guard', type: 'job_cancelled',
        title: 'Job Cancelled', message: `Job cancelled by ${cancelledBy}. ${reason}`,
        link: '/guard/dashboard#notifications', is_read: false, created_at: new Date().toISOString(), related_id: cancellation.job_id,
      });
    }

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }

    return new Response(JSON.stringify({ success: true, cancellation_id, results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Cancellation notification error:', error);
    return new Response(JSON.stringify({ error: 'Failed to send', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
