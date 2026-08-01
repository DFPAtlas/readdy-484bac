import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    const payload: any = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: preferences } = await supabase.from('notification_preferences').select('job_matches').eq('user_id', payload.guard_id).maybeSingle();
    if (preferences && preferences.job_matches === false) {
      return new Response(JSON.stringify({ message: 'User disabled job match notifications' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isDirect = payload.is_direct_booking === true;
    const venueLabels: Record<string, string> = {
      nightclub_bar: 'Nightclub / Bar', retail_shop: 'Retail / Shop', construction_site: 'Construction Site',
      private_event: 'Private Event', festival_public_event: 'Festival / Public Event',
      warehouse_property: 'Warehouse / Property', office_building: 'Office Building', other: 'Other',
    };
    const venueLabel = venueLabels[payload.venue_category || ''] || '';
    const venueLabelBlock = venueLabel ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="background:#10b981;color:#ffffff;font-size:12px;font-weight:bold;padding:6px 14px;border-radius:9999px;display:inline-block;">${venueLabel}</td></tr></table>` : '';

    const templateSlug = isDirect ? 'job_match_direct' : 'job_match';

    const variables: Record<string, string> = {
      guard_name: payload.guard_name,
      client_name: payload.client_name,
      job_title: payload.job_title,
      location: payload.location,
      distance_miles: payload.distance_miles,
      job_date: payload.date,
      job_time: `${payload.start_time} - ${payload.end_time}`,
      hourly_rate: payload.hourly_rate,
      venue_label_block: venueLabelBlock,
      job_url: `${siteUrl}/jobs/${payload.job_id}`,
      dashboard_url: `${siteUrl}/guard/dashboard`,
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({
        template_slug: templateSlug,
        to: payload.guard_email,
        variables,
        from: 'QuickGuard <notifications@quickguard.co.uk>',
        related_user_id: payload.guard_id,
        related_job_id: payload.job_id,
      }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      throw new Error(`Template render failed: ${errText}`);
    }

    const renderData = await renderRes.json();

    await supabase.from('notifications').insert({
      user_id: payload.guard_id, user_type: 'guard',
      title: isDirect ? 'Direct Booking Alert' : 'New Job Match',
      message: `${payload.job_title} — £${payload.hourly_rate}/hr • ${payload.distance_miles} miles away${venueLabel ? ` • ${venueLabel}` : ''}`,
      type: 'info', is_read: false,
      link: `/jobs/${payload.job_id}`, created_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, email_id: renderData.email_id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});