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
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;

  if (!isServiceRole) {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      db: { schema: 'app' },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: adminCheck } = await userClient
      .from('admin_users')
      .select('id, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminCheck || !adminCheck.is_active) {
      return new Response(
        JSON.stringify({ error: 'Active admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    const { client_email, client_name, guard_name, job_title, job_id, proposed_rate, cover_message, guard_id } = await req.json();

    const coverMessageBlock = cover_message
      ? `<div style="background:#f9fafb;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #e5e7eb;"><p style="color:#6b7280;font-size:14px;white-space:pre-wrap;">${cover_message}</p></div>`
      : '';

    const variables: Record<string, string> = {
      client_name: client_name || 'Client',
      guard_name: guard_name || '',
      job_title: job_title || '',
      proposed_rate: String(proposed_rate || ''),
      cover_message_block: coverMessageBlock,
      dashboard_url: `${siteUrl}/client/dashboard`,
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({
        template_slug: 'job_application',
        to: client_email,
        variables,
        from: 'QuickGuard <notifications@quickguard.co.uk>',
        related_user_id: guard_id || null,
        related_job_id: job_id || null,
      }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      throw new Error(`Template render failed: ${errText}`);
    }

    const renderData = await renderRes.json();
    return new Response(JSON.stringify({ success: true, email_id: renderData.email_id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});