import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export interface RenderedTemplate {
  subject: string;
  body_html: string;
  text_body: string;
  from_name: string;
  from_email: string;
  reply_to: string;
}

export async function renderTemplate(
  templateSlug: string,
  variables: Record<string, string> = {}
): Promise<RenderedTemplate> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { db: { schema: 'app' } });

  const { data: template } = await supabase
    .from('email_templates')
    .select('*')
    .eq('template_slug', templateSlug)
    .eq('is_active', true)
    .maybeSingle();

  const defaults = getFallbackTemplate(templateSlug);

  if (!template) {
    return applyVariables(defaults, variables);
  }

  const subject = template.subject || defaults.subject;
  const bodyHtml = template.body_html || defaults.body_html;
  const textBody = stripHtml(bodyHtml);

  return applyVariables(
    {
      subject,
      body_html: bodyHtml,
      text_body: textBody,
      from_name: defaults.from_name,
      from_email: defaults.from_email,
      reply_to: defaults.reply_to,
    },
    variables
  );
}

function applyVariables(template: RenderedTemplate, variables: Record<string, string>): RenderedTemplate {
  let result = { ...template };
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result.subject = result.subject.split(placeholder).join(value || '');
    result.body_html = result.body_html.split(placeholder).join(value || '');
    result.text_body = result.text_body.split(placeholder).join(value || '');
  }
  return result;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getFallbackTemplate(slug: string): RenderedTemplate {
  return {
    subject: 'QuickGuard Notification',
    body_html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:40px 20px;">
  <table width="100%"><tr><td align="center">
    <table width="600" style="background:#fff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#111827;padding:32px;text-align:center;">
        <h1 style="color:#fff;margin:0;">QuickGuard</h1>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="color:#374151;font-size:16px;">{{message}}</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://quickguard.uk" style="background:#14B8A6;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Visit QuickGuard</a>
        </div>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:20px;text-align:center;font-size:12px;color:#9ca3af;">QuickGuard &copy; ${new Date().getFullYear()}</td></tr>
    </table>
  </td></tr></table>
</body></html>`,
    text_body: 'QuickGuard Notification\n\n{{message}}\n\nVisit: https://quickguard.uk',
    from_name: 'QuickGuard',
    from_email: 'info@quickguard.uk',
    reply_to: 'support@quickguard.uk',
  };
}