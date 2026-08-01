import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: adminUser, error: adminError } = await adminClient
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminError || !adminUser) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { client_email, client_name, guard_email, guard_name, incomplete_fields, profile_percent, profile_url, user_type } = body;

    const toEmail = client_email || guard_email || '';
    const toName = client_name || guard_name || (user_type === 'guard' ? 'Guard' : 'Client');

    if (!toEmail) {
      return new Response(JSON.stringify({ error: 'Recipient email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const missingItemsHtml = incomplete_fields && incomplete_fields.length > 0
      ? `<ul style="color:#374151;line-height:1.8;">${incomplete_fields.map((i: string) => `<li>${i}</li>`).join('')}</ul>`
      : '';

    const wizardUrl = user_type === 'guard'
      ? 'https://quickguard.uk/guard/profile'
      : (profile_url || 'https://quickguard.uk/client/profile');

    const variables: Record<string, string> = {
      guard_name: toName,
      completion_percent: `${profile_percent || 0}%`,
      missing_items: missingItemsHtml,
      admin_note: '',
      cta_label: 'Update Profile',
      cta_text: 'Complete missing fields',
      dashboard_url: wizardUrl,
      wizard_url: wizardUrl,
      year: String(new Date().getFullYear()),
    };

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    await serviceClient.functions.invoke('render-email-template', {
      body: { template_slug: 'profile_nudge', to: toEmail, variables, from: 'QuickGuard <info@quickguard.uk>' },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
