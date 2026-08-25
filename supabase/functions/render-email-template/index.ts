import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TEST_RECIPIENT = 'admin@quickguard.uk';

interface RenderRequest {
  template_slug: string;
  to: string | string[];
  variables?: Record<string, string>;
  from?: string;
  reply_to?: string;
  attachments?: Array<{ filename: string; content: string; content_type: string }>;
  dry_run?: boolean;
  is_test?: boolean;
  related_user_id?: string;
  related_job_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'app' } });

    const body: RenderRequest = await req.json();
    const { template_slug, to, variables = {}, from, reply_to, attachments, dry_run, is_test, related_user_id, related_job_id } = body;

    if (!template_slug || !to) {
      return new Response(JSON.stringify({ error: 'template_slug and to are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const effectiveTo = is_test ? TEST_RECIPIENT : to;
    const recipient = Array.isArray(effectiveTo) ? effectiveTo.join(', ') : effectiveTo;
    const now = new Date().toISOString();

    const { data: template } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_slug', template_slug)
      .eq('is_active', true)
      .maybeSingle();

    if (!template) {
      await supabase.from('email_send_log').insert({
        function_name: 'render-email-template',
        template: template_slug,
        recipient,
        related_user_id: related_user_id || null,
        related_job_id: related_job_id || null,
        status: 'failed',
        error_message: `Template not found or inactive: ${template_slug}`,
        sent_at: now,
        created_at: now,
      }).catch(() => {});

      return new Response(JSON.stringify({
        error: `Template '${template_slug}' not found or is inactive`,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let subject: string = template.subject || 'QuickGuard Notification';
    let bodyHtml: string = template.body_html || '';

    const fromName = 'QuickGuard Notifications';
    const fromEmail = `noreply@${Deno.env.get('RESEND_FROM_DOMAIN') || 'quickguard.uk'}`;
    const replyTo = 'support@quickguard.uk';

    subject = replaceVariables(subject, variables);
    bodyHtml = replaceVariables(bodyHtml, variables);

    if (dry_run) {
      return new Response(JSON.stringify({ subject, body_html: bodyHtml }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const senderFrom = from || `${fromName} <${fromEmail}>`;
    const senderReplyTo = reply_to || replyTo;

    const emailPayload: Record<string, unknown> = {
      from: senderFrom,
      to: Array.isArray(effectiveTo) ? effectiveTo : [effectiveTo],
      subject,
      html: bodyHtml,
    };

    if (senderReplyTo) emailPayload.reply_to = senderReplyTo;
    if (attachments) emailPayload.attachments = attachments;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!res.ok) {
        const errText = await res.text();

        await supabase.from('email_send_log').insert({
          function_name: 'render-email-template',
          template: template_slug,
          recipient,
          related_user_id: related_user_id || null,
          related_job_id: related_job_id || null,
          status: 'failed',
          error_message: errText.slice(0, 1000),
          sent_at: now,
          created_at: now,
        }).catch(() => {});

        return new Response(JSON.stringify({ error: 'Resend send failed', details: errText }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await res.json();

      await supabase.from('email_send_log').insert({
        function_name: 'render-email-template',
        template: template_slug,
        recipient,
        related_user_id: related_user_id || null,
        related_job_id: related_job_id || null,
        status: 'sent',
        sent_at: now,
        created_at: now,
      }).catch(() => {});

      return new Response(JSON.stringify({ success: true, email_id: result.id, subject }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (sendError: any) {
      await supabase.from('email_send_log').insert({
        function_name: 'render-email-template',
        template: template_slug,
        recipient,
        related_user_id: related_user_id || null,
        related_job_id: related_job_id || null,
        status: 'failed',
        error_message: (sendError?.message || 'Unknown error').slice(0, 1000),
        sent_at: now,
        created_at: now,
      }).catch(() => {});

      throw sendError;
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.split(`{{${key}}}`).join(value || '');
  }
  return result;
}
