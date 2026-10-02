import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-qg-email-worker-token',
};

async function isWorkerAuthorized(supabaseUrl: string, serviceKey: string, req: Request): Promise<boolean> {
  if (req.headers.get('Authorization') === `Bearer ${serviceKey}`) return true;
  const token = req.headers.get('x-qg-email-worker-token') || '';
  if (!token) return false;
  const service = createClient(supabaseUrl, serviceKey, { db: { schema: 'app' } });
  const { data, error } = await service.rpc('validate_email_worker_token', { p_token: token });
  return !error && data === true;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!(await isWorkerAuthorized(supabaseUrl, serviceKey, req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized email worker' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'app' } });
  const now = new Date();
  const defaultCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('user_id, last_digest_sent_at')
      .eq('email_frequency', 'daily')
      .limit(500);

    if (prefsError) throw prefsError;

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const pref of prefs || []) {
      if (!pref.user_id) { skipped++; continue; }

      const { data: user } = await supabase
        .from('users')
        .select('id, email, full_name, user_type')
        .eq('id', pref.user_id)
        .maybeSingle();

      if (!user?.email) { skipped++; continue; }

      const since = pref.last_digest_sent_at || defaultCutoff;
      const { data: notifications, error: notifError } = await supabase
        .from('notifications')
        .select('title, message, created_at')
        .eq('user_id', pref.user_id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(25);

      if (notifError) {
        errors.push(`${user.email}: ${notifError.message}`);
        continue;
      }
      if (!notifications?.length) { skipped++; continue; }

      const digestContent = notifications.map((item) =>
        `<div style="padding:12px 0;border-bottom:1px solid #e5e7eb"><strong>${escapeHtml(item.title)}</strong><br><span>${escapeHtml(item.message)}</span></div>`
      ).join('');

      const variables = {
        guard_name: user.full_name || 'QuickGuard user',
        digest_date: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        digest_content: digestContent,
        dashboard_url: user.user_type === 'client'
          ? 'https://quickguard.uk/client/dashboard'
          : 'https://quickguard.uk/guard/dashboard',
        year: String(now.getFullYear()),
      };

      const sendRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({
          template_slug: 'daily_digest',
          to: user.email,
          variables,
          from: 'QuickGuard <digest@quickguard.uk>',
          related_user_id: user.id,
        }),
      });

      if (!sendRes.ok) {
        errors.push(`${user.email}: ${await sendRes.text()}`);
        continue;
      }

      const { error: updateError } = await supabase
        .from('notification_preferences')
        .update({ last_digest_sent_at: now.toISOString(), updated_at: now.toISOString() })
        .eq('user_id', user.id);

      if (updateError) {
        errors.push(`${user.email}: sent but digest timestamp update failed: ${updateError.message}`);
      }
      sent++;
    }

    return new Response(JSON.stringify({ success: true, frequency: 'daily', sent, skipped, errors }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
