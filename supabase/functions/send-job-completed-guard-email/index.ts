import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
    const { job_id, sent_by_admin } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: jobData } = await supabase.from('jobs').select('*').eq('id', job_id).maybeSingle();
    if (!jobData) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: clientData } = await supabase.from('clients').select('company_name, contact_name').eq('id', jobData.client_id).maybeSingle();
    const { data: assignments } = await supabase.from('job_assignments').select('guard_id').eq('job_id', job_id);

    if (!assignments || assignments.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No assigned guards' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const guardIds = assignments.map((a: any) => a.guard_id);
    const { data: guardsData } = await supabase.from('guards').select('id, first_name, last_name, email').in('id', guardIds);

    if (!guardsData || guardsData.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No guard records' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const clientName = clientData?.company_name || clientData?.contact_name || 'The client';
    const startDate = new Date(jobData.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    let emailsSent = 0;
    const errors: string[] = [];

    for (const guard of guardsData) {
      if (!guard.email) continue;

      const variables: Record<string, string> = {
        guard_name: `${guard.first_name} ${guard.last_name}`,
        client_name: clientName,
        job_title: jobData.job_title,
        venue: `${jobData.venue_name || ''}, ${jobData.venue_city || ''}`,
        start_date: startDate,
        start_time: jobData.start_time || '',
        end_time: jobData.end_time || '',
        location: `${jobData.venue_name || ''}, ${jobData.venue_city || ''}`,
        dashboard_url: `${siteUrl}/guard/earnings`,
        year: String(new Date().getFullYear()),
      };

      try {
        const rres = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
          body: JSON.stringify({ template_slug: 'job_completed_guard', to: guard.email, variables, from: 'QuickGuard <notifications@quickguard.uk>' }),
        });

        if (rres.ok) {
          emailsSent++;
          await supabase.from('email_queue').insert({
            user_id: guard.id,
            email_type: 'job_completed_guard_notification',
            recipient_email: guard.email,
            subject: `Job Completed: ${jobData.job_title}`,
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: { job_id },
          });
        } else {
          errors.push(`Guard ${guard.first_name}: ${await rres.text()}`);
        }
      } catch (e: any) {
        errors.push(`Guard ${guard.first_name}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, emails_sent: emailsSent, errors }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Failed to send', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
