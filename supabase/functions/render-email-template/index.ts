import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TEST_RECIPIENT = 'admin@quickguard.uk';
const DEFAULT_FROM = 'QuickGuard Notifications <notifications@quickguard.uk>';
const DEFAULT_REPLY_TO = 'support@quickguard.uk';

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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)));
  } catch {
    return null;
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!RESEND_API_KEY || !supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Email service is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const isServiceRole = authHeader === `Bearer ${serviceKey}`;

    if (!isServiceRole) {
      if (!authHeader || !anonKey) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        db: { schema: 'app' },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      const jwt = decodeJwtPayload(authHeader.replace('Bearer ', '').trim());
      const aal = String(jwt?.aal || '');

      if (error || !user || aal !== 'aal2') {
        return new Response(JSON.stringify({ error: 'Active admin with AAL2 required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: admin } = await userClient
        .from('admin_users')
        .select('id, is_active')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!admin?.is_active) {
        return new Response(JSON.stringify({ error: 'Active admin access required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'app' } });
    const body: RenderRequest = await req.json();
    const { template_slug, to, variables = {}, from, reply_to, attachments, dry_run, is_test, related_user_id, related_job_id } = body;

    if (!template_slug || !to) {
      return new Response(JSON.stringify({ error: 'template_slug and to are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const effectiveTo = is_test ? TEST_RECIPIENT : to;
    const recipients = Array.isArray(effectiveTo) ? effectiveTo : [effectiveTo];
    if (recipients.length === 0 || recipients.some((email) => !isValidEmail(String(email)))) {
      return new Response(JSON.stringify({ error: 'A valid recipient email is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipient = recipients.join(', ');
    const now = new Date().toISOString();

    const { data: template } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_slug', template_slug)
      .eq('is_active', true)
      .maybeSingle();

    if (!template) {
      await supabase.from('email_send_log').insert({
        function_name: 'render-email-template', template: template_slug, recipient,
        related_user_id: related_user_id || null, related_job_id: related_job_id || null,
        status: 'failed', error_message: `Template not found or inactive: ${template_slug}`,
        sent_at: now, created_at: now,
      });
      return new Response(JSON.stringify({ error: `Template '${template_slug}' not found or is inactive` }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only trusted transactional sends may create recipient-bound login links.
    // Previews, multi-recipient sends and administrator templates never receive tokens.
    const sendVariables = { ...variables };
    if (isServiceRole && !dry_run && !is_test && recipients.length === 1 && variables.dashboard_url) {
      const destination = new URL(variables.dashboard_url);
      const role = destination.pathname === '/client/dashboard' ? 'client'
        : destination.pathname === '/guard/dashboard' ? 'guard' : null;
      if (destination.origin === 'https://quickguard.uk' && role && !destination.search && !destination.hash) {
        const { data: profile } = await supabase.from(role === 'client' ? 'clients' : 'guards')
          .select('user_id').eq('email', recipients[0]).maybeSingle();
        if (profile?.user_id) {
          const { data: identity, error: identityError } = await supabase.auth.admin.getUserById(profile.user_id);
          if (identityError || identity.user?.email?.toLowerCase() !== recipients[0].toLowerCase()
              || !identity.user?.email_confirmed_at) {
            throw new Error('Dashboard link recipient identity could not be verified');
          }
          const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'magiclink', email: identity.user.email!,
          });
          if (linkError || !link.properties?.hashed_token) throw new Error('Unable to create dashboard sign-in link');
          // Fragment keeps the bearer credential out of HTTP request URLs and referrers.
          sendVariables.dashboard_url = 'https://quickguard.uk/auth/email-dashboard#' +
            new URLSearchParams({ token_hash: link.properties.hashed_token, role }).toString();
        }
      }
    }

    const subject = replaceVariables(template.subject || 'QuickGuard Notification', sendVariables);
    const bodyHtml = replaceVariables(template.body_html || '', sendVariables);
    const unresolved = [...new Set((`${subject}\n${bodyHtml}`.match(/{{\s*[^{}]+\s*}}/g) || []))];

    if (unresolved.length > 0) {
      const message = `Unresolved template variables: ${unresolved.join(', ')}`;
      await supabase.from('email_send_log').insert({
        function_name: 'render-email-template', template: template_slug, recipient,
        related_user_id: related_user_id || null, related_job_id: related_job_id || null,
        status: 'failed', error_message: message.slice(0, 1000), sent_at: now, created_at: now,
      });
      return new Response(JSON.stringify({ error: 'Template variables unresolved', details: unresolved }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (dry_run) {
      return new Response(JSON.stringify({ subject, body_html: bodyHtml }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let senderFrom = from || DEFAULT_FROM;
    if (!/@quickguard\.uk(?:>|$)/i.test(senderFrom)) senderFrom = DEFAULT_FROM;
    const senderReplyTo = reply_to && isValidEmail(reply_to) ? reply_to : DEFAULT_REPLY_TO;

    const payload: Record<string, unknown> = {
      from: senderFrom, to: recipients, subject, html: bodyHtml, reply_to: senderReplyTo,
    };
    if (attachments) payload.attachments = attachments;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        await supabase.from('email_send_log').insert({
          function_name: 'render-email-template', template: template_slug, recipient,
          related_user_id: related_user_id || null, related_job_id: related_job_id || null,
          status: 'failed', error_message: errText.slice(0, 1000), sent_at: now, created_at: now,
        });
        return new Response(JSON.stringify({ error: 'Resend send failed', details: errText }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await res.json();
      await supabase.from('email_send_log').insert({
        function_name: 'render-email-template', template: template_slug, recipient,
        related_user_id: related_user_id || null, related_job_id: related_job_id || null,
        status: 'sent', provider_message_id: result.id || null, sent_at: now, created_at: now,
      });

      return new Response(JSON.stringify({ success: true, email_id: result.id, subject }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (sendError: any) {
      await supabase.from('email_send_log').insert({
        function_name: 'render-email-template', template: template_slug, recipient,
        related_user_id: related_user_id || null, related_job_id: related_job_id || null,
        status: 'failed', error_message: (sendError?.message || 'Unknown error').slice(0, 1000),
        sent_at: now, created_at: now,
      });
      throw sendError;
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.split(`{{${key}}}`).join(value ?? '');
  }
  return result;
}
