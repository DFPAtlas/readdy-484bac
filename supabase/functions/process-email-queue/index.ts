import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendEmailViaResend(apiKey: string, from: string, to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (res.ok) return { success: true, data: await res.json() };
  return { success: false, error: await res.text() };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!RESEND_API_KEY || !supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });
  const functionsBaseUrl = supabaseUrl.replace('.co', '.co/functions/v1');

  try {
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch pending emails: ${fetchError.message}`);
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No pending emails' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sent = 0;
    let failed = 0;
    let delegated = 0;
    const errors: string[] = [];

    for (const email of pendingEmails) {
      const metadata = email.metadata || {};
      const emailType = email.email_type;

      if (emailType === 'cancellation_notification' && metadata.cancellation_id) {
        try {
          const res = await fetch(`${functionsBaseUrl}/send-cancellation-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ cancellation_id: metadata.cancellation_id }),
          });
          if (res.ok) {
            await supabase.from('email_queue').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', email.id);
            delegated++;
          } else {
            const err = await res.text();
            throw new Error(err);
          }
        } catch (err: any) {
          const retryCount = (email.retry_count || 0) + 1;
          const maxRetries = email.max_retries || 3;
          const newStatus = retryCount >= maxRetries ? 'failed' : 'pending';
          await supabase.from('email_queue').update({ status: newStatus, error_message: err.message, retry_count: retryCount, updated_at: new Date().toISOString() }).eq('id', email.id);
          failed++;
          errors.push(`Email ${email.id}: ${err.message}`);
        }
        continue;
      }

      if (emailType === 'refund_notification' && metadata.refund_request_id) {
        try {
          const res = await fetch(`${functionsBaseUrl}/send-refund-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ refund_request_id: metadata.refund_request_id }),
          });
          if (res.ok) {
            await supabase.from('email_queue').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', email.id);
            delegated++;
          } else {
            const err = await res.text();
            throw new Error(err);
          }
        } catch (err: any) {
          const retryCount = (email.retry_count || 0) + 1;
          const maxRetries = email.max_retries || 3;
          const newStatus = retryCount >= maxRetries ? 'failed' : 'pending';
          await supabase.from('email_queue').update({ status: newStatus, error_message: err.message, retry_count: retryCount, updated_at: new Date().toISOString() }).eq('id', email.id);
          failed++;
          errors.push(`Email ${email.id}: ${err.message}`);
        }
        continue;
      }

      if (!email.recipient_email || !email.body_html) {
        await supabase.from('email_queue').update({ status: 'failed', error_message: 'Missing recipient or body', updated_at: new Date().toISOString() }).eq('id', email.id);
        failed++;
        errors.push(`Email ${email.id}: Missing recipient or body`);
        continue;
      }

      const result = await sendEmailViaResend(
        RESEND_API_KEY,
        'QuickGuard <notifications@quickguard.co.uk>',
        email.recipient_email,
        email.subject,
        email.body_html || email.body_text || ''
      );

      if (result.success) {
        await supabase.from('email_queue').update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null, updated_at: new Date().toISOString() }).eq('id', email.id);
        sent++;
      } else {
        const retryCount = (email.retry_count || 0) + 1;
        const maxRetries = email.max_retries || 3;
        const newStatus = retryCount >= maxRetries ? 'failed' : 'pending';
        await supabase.from('email_queue').update({ status: newStatus, error_message: result.error, retry_count: retryCount, updated_at: new Date().toISOString() }).eq('id', email.id);
        failed++;
        errors.push(`Email ${email.id}: ${result.error}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: pendingEmails.length, sent, failed, delegated, errors }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Process email queue error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process email queue', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});