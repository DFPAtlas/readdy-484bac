import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, account_type, user_email, user_name } = await req.json();

    if (!user_id || !account_type || !user_email) {
      return new Response(JSON.stringify({ error: 'Missing required fields: user_id, account_type, user_email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    const { data: alreadySent } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user_id)
      .eq('type', 'welcome')
      .maybeSingle();

    if (alreadySent) {
      console.log(`[send-welcome-email] Welcome already sent to ${user_id}, skipping`);
      return new Response(JSON.stringify({ sent: false, reason: 'already_sent' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const templateSlug = account_type === 'client' ? 'client_welcome' : 'guard_welcome';

    const variables: Record<string, string> = {
      user_name: user_name || 'there',
      account_type,
      dashboard_url: account_type === 'client'
        ? 'https://quickguard.uk/client/dashboard'
        : 'https://quickguard.uk/guard/dashboard',
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        template_slug: templateSlug,
        to: user_email,
        variables,
        from: Deno.env.get('FROM_EMAIL') || 'hello@quickguard.uk',
      }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      console.error(`[send-welcome-email] Render failed for ${templateSlug}: ${errText}`);

      await supabase.from('notifications').insert({
        user_id,
        user_type: account_type,
        type: 'welcome',
        title: 'Welcome to QuickGuard',
        message: `Welcome aboard${user_name ? ', ' + user_name : ''}! Complete your profile to start using QuickGuard.`,
        link: account_type === 'client' ? '/client/complete-profile-wizard' : '/guard/complete-profile-wizard',
        is_read: false,
      });

      return new Response(JSON.stringify({ sent: true, method: 'in_app_only' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('notifications').insert({
      user_id,
      user_type: account_type,
      type: 'welcome',
      title: 'Welcome to QuickGuard',
      message: `Welcome aboard${user_name ? ', ' + user_name : ''}! Complete your profile to start using QuickGuard.`,
      link: account_type === 'client' ? '/client/complete-profile-wizard' : '/guard/complete-profile-wizard',
      is_read: false,
    });

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[send-welcome-email] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
