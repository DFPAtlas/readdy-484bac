import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { refund_request_id } = await req.json();
    if (!refund_request_id) return new Response(JSON.stringify({ error: 'refund_request_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: refund } = await supabase.from('refund_requests').select('*, jobs:job_id(id, job_title, venue_name, venue_city, start_date, start_time), job_cancellations:cancellation_id(id, cancelled_by, reason, refund_total)').eq('id', refund_request_id).maybeSingle();
    if (!refund) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const job = refund.jobs;
    const { data: clientData } = await supabase.from('clients').select('id, company_name, contact_name, user_id, users:user_id(email, full_name)').eq('id', refund.client_id).maybeSingle();
    const { data: guardData } = await supabase.from('guards').select('id, full_name, user_id, users:user_id(email, full_name)').eq('id', refund.guard_id).maybeSingle();

    const clientEmail = clientData?.users?.email || '';
    const clientName = clientData?.company_name || clientData?.contact_name || clientData?.users?.full_name || 'Client';
    const guardEmail = guardData?.users?.email || '';
    const guardName = guardData?.full_name || guardData?.users?.full_name || 'Guard';
    const status = refund.status || 'pending';
    const statusLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending Review';
    const statusColor = status === 'approved' ? '#16a34a' : status === 'rejected' ? '#dc2626' : '#d97706';
    const amount = (refund.approved_amount || refund.requested_amount || 0).toFixed(2);
    const startDate = job?.start_date ? new Date(job.start_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A';

    const results: any[] = [];

    if (clientEmail) {
      const cvars: Record<string, string> = {
        client_name: clientName, job_title: job?.job_title || 'N/A',
        venue: `${job?.venue_name || ''}, ${job?.venue_city || ''}`,
        start_date: startDate, start_time: job?.start_time || 'N/A',
        amount, status_label: statusLabel, status_color: statusColor,
        reason: refund.reason || 'No reason provided',
        dashboard_url: `${siteUrl}/client/payment-history`, year: String(new Date().getFullYear()),
      };
      const r = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ template_slug: 'refund_notification_client', to: clientEmail, variables: cvars, from: 'QuickGuard <notifications@quickguard.co.uk>' }),
      });
      if (r.ok) { const d = await r.json(); results.push({ recipient: 'client', email_id: d.email_id }); }
      else results.push({ recipient: 'client', error: await r.text() });
    }

    if (guardEmail) {
      const gvars: Record<string, string> = {
        guard_name: guardName, job_title: job?.job_title || 'N/A',
        venue: `${job?.venue_name || ''}, ${job?.venue_city || ''}`,
        start_date: startDate, start_time: job?.start_time || 'N/A',
        amount, status_label: statusLabel, status_color: statusColor,
        reason: refund.reason || 'No reason provided',
        dashboard_url: `${siteUrl}/guard/dashboard`, year: String(new Date().getFullYear()),
      };
      const r = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ template_slug: 'refund_notification_guard', to: guardEmail, variables: gvars, from: 'QuickGuard <notifications@quickguard.co.uk>' }),
      });
      if (r.ok) { const d = await r.json(); results.push({ recipient: 'guard', email_id: d.email_id }); }
      else results.push({ recipient: 'guard', error: await r.text() });
    }

    const notifications = [];
    if (clientData?.user_id) notifications.push({ user_id: clientData.user_id, user_type: 'client', type: 'refund_request', title: `Refund ${statusLabel}`, message: `£${amount} refund for ${job?.job_title || 'job'} is ${statusLabel.toLowerCase()}.`, link: '/client/dashboard#notifications', is_read: false, created_at: new Date().toISOString(), related_id: refund.job_id });
    if (guardData?.user_id) notifications.push({ user_id: guardData.user_id, user_type: 'guard', type: 'refund_request', title: `Refund ${statusLabel}`, message: `A refund for ${job?.job_title || 'job'} is ${statusLabel.toLowerCase()}.`, link: '/guard/dashboard#notifications', is_read: false, created_at: new Date().toISOString(), related_id: refund.job_id });
    if (notifications.length > 0) await supabase.from('notifications').insert(notifications);

    return new Response(JSON.stringify({ success: true, refund_request_id, results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
