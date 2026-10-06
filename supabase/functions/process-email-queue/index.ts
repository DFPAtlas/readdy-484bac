import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';


async function isWorkerAuthorized(
  supabaseUrl: string,
  serviceKey: string,
  req: Request,
): Promise<boolean> {
  if (req.headers.get('Authorization') === `Bearer ${serviceKey}`) return true;
  const token = req.headers.get('x-qg-email-worker-token') || '';
  if (!token) return false;
  const service = createClient(supabaseUrl, serviceKey, { db: { schema: 'app' } });
  const { data, error } = await service.rpc('validate_email_worker_token', { p_token: token });
  return !error && data === true;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendEmailViaResend(apiKey: string, to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: 'QuickGuard Notifications <notifications@quickguard.uk>',
      reply_to: 'support@quickguard.uk',
      to: [to],
      subject,
      html,
    }),
  });
  if (res.ok) return { success: true, data: await res.json() };
  return { success: false, error: await res.text() };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!RESEND_API_KEY || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!(await isWorkerAuthorized(supabaseUrl, serviceKey, req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized email worker' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'app' } });
  const functionsBaseUrl = `${supabaseUrl}/functions/v1`;

  try {
    const { data: claimed, error: claimError } = await supabase.rpc('claim_email_queue', { p_limit: 50 });
    if (claimError) throw new Error(`Failed to claim email queue: ${claimError.message}`);

    const emails = claimed || [];
    if (emails.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: 'No eligible queued emails' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    let failed = 0;
    let delegated = 0;
    const errors: string[] = [];

    for (const email of emails) {
      const metadata = email.metadata || {};
      try {
        if (email.email_type === 'cancellation_notification' && metadata.cancellation_id) {
          const res = await fetch(`${functionsBaseUrl}/send-cancellation-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
            body: JSON.stringify({ cancellation_id: metadata.cancellation_id }),
          });
          if (!res.ok) throw new Error(await res.text());
          await supabase.rpc('complete_email_queue', { p_queue_id: email.id });
          delegated++;
          continue;
        }

        if (email.email_type === 'refund_notification' && metadata.refund_request_id) {
          const res = await fetch(`${functionsBaseUrl}/send-refund-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
            body: JSON.stringify({ refund_request_id: metadata.refund_request_id }),
          });
          if (!res.ok) throw new Error(await res.text());
          await supabase.rpc('complete_email_queue', { p_queue_id: email.id });
          delegated++;
          continue;
        }

        if (email.email_type === 'job_match' && metadata.job_id && metadata.guard_id) {
          const res = await fetch(`${functionsBaseUrl}/send-job-match-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
            body: JSON.stringify(metadata),
          });
          if (!res.ok) throw new Error(await res.text());
          await supabase.rpc('complete_email_queue', { p_queue_id: email.id });
          delegated++;
          await supabase.rpc('recompute_job_notification_status', { p_job_id: metadata.job_id });
          continue;
        }

        if (!email.recipient_email || !(email.body_html || email.body_text || email.body) || !email.subject) {
          throw new Error('Missing recipient, subject, or body');
        }

        const result = await sendEmailViaResend(
          RESEND_API_KEY,
          email.recipient_email,
          email.subject,
          email.body_html || email.body_text || email.body
        );

        if (!result.success) throw new Error(result.error || 'Resend send failed');

        const now = new Date().toISOString();
        await supabase.from('email_send_log').insert({
          function_name: 'process-email-queue',
          template: email.template_key || email.template_name || email.email_type || 'queued_email',
          recipient: email.recipient_email,
          related_user_id: email.user_id || null,
          related_job_id: metadata.job_id || null,
          status: 'sent',
          provider_message_id: result.data?.id || null,
          sent_at: now,
          created_at: now,
        });

        const { error: completeError } = await supabase.rpc('complete_email_queue', { p_queue_id: email.id });
        if (completeError) throw new Error(`Email sent but queue completion failed: ${completeError.message}`);
        sent++;
      } catch (err: any) {
        const message = err?.message || 'Unknown email queue failure';
        await supabase.rpc('fail_email_queue', { p_queue_id: email.id, p_error: message });
        await supabase.from('email_send_log').insert({
          function_name: 'process-email-queue',
          template: email.template_key || email.template_name || email.email_type || 'queued_email',
          recipient: email.recipient_email || '',
          related_user_id: email.user_id || null,
          related_job_id: metadata.job_id || null,
          status: 'failed',
          error_message: message.slice(0, 1000),
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
        if (metadata.job_id) {
          try { await supabase.rpc('recompute_job_notification_status', { p_job_id: metadata.job_id }); } catch { /* keep the job intact */ }
        }
        failed++;
        errors.push(`Email ${email.id}: ${message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true, processed: emails.length, sent, failed, delegated, errors,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Process email queue error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process email queue', details: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
