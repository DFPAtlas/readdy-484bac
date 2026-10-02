import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';
  const authHeader = req.headers.get('Authorization') || '';

  if (authHeader !== `Bearer ${serviceKey}`) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      db: { schema: 'app' },
    });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: admin } = await userClient.from('admin_users').select('id,is_active').eq('user_id', user.id).maybeSingle();
    if (!admin?.is_active) {
      return new Response(JSON.stringify({ error: 'Active admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'app' } });

  try {
    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: jobData } = await supabase.from('jobs').select('*').eq('id', job_id).maybeSingle();
    if (!jobData) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: clientData } = await supabase.from('clients').select('company_name, contact_name').eq('id', jobData.client_id).maybeSingle();
    const { data: assignments } = await supabase.from('job_assignments').select('guard_id').eq('job_id', job_id);

    if (!assignments?.length) {
      return new Response(JSON.stringify({ success: true, message: 'No assigned guards' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const guardIds = assignments.map((a: any) => a.guard_id);
    const { data: guardsData } = await supabase.from('guards').select('id, user_id, first_name, last_name, full_name, email').in('id', guardIds);

    const clientName = clientData?.company_name || clientData?.contact_name || 'The client';
    const startDate = new Date(jobData.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    let emailsSent = 0;
    const errors: string[] = [];

    for (const guard of guardsData || []) {
      if (!guard.email) continue;

      const variables = {
        guard_name: guard.full_name || `${guard.first_name || ''} ${guard.last_name || ''}`.trim() || 'Guard',
        client_name: clientName,
        job_title: jobData.job_title,
        venue: `${jobData.venue_name || ''}${jobData.venue_city ? ', ' + jobData.venue_city : ''}`,
        start_date: startDate,
        start_time: jobData.start_time || '',
        end_time: jobData.end_time || '',
        location: `${jobData.venue_name || ''}${jobData.venue_city ? ', ' + jobData.venue_city : ''}`,
        dashboard_url: `${siteUrl}/guard/earnings`,
        year: String(new Date().getFullYear()),
      };

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({
            template_slug: 'job_completed_guard',
            to: guard.email,
            variables,
            from: 'QuickGuard <notifications@quickguard.uk>',
            related_user_id: guard.user_id || guard.id,
            related_job_id: job_id,
          }),
        });

        if (!res.ok) {
          errors.push(`${guard.email}: ${await res.text()}`);
          continue;
        }
        emailsSent++;
      } catch (e: any) {
        errors.push(`${guard.email}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, emails_sent: emailsSent, errors }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Failed to send', details: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
