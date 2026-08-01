import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'app' } }
    );

    const { action, email, name, intended_role, newsletter_consent } = await req.json();

    if (!action) {
      return new Response(JSON.stringify({ error: 'Action required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_dashboard') {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return new Response(JSON.stringify({ error: 'Valid email required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const normalised = email.toLowerCase().trim();

      const { data: dashboard, error: dashErr } = await supabaseAdmin.rpc(
        'get_qg_launch_account_dashboard',
        { identifier_email: normalised, identifier_user_id: null }
      );

      if (dashErr) {
        console.error('Dashboard RPC error:', dashErr);
        return new Response(JSON.stringify({ error: 'Failed to load dashboard', detail: dashErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(dashboard), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'create_referral_code') {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return new Response(JSON.stringify({ error: 'Valid email required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const normalised = email.toLowerCase().trim();
      const role = intended_role || 'unknown';

      const codePrefix = 'QG-';
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = codePrefix + (role === 'guard' ? 'G' : role === 'client' ? 'C' : 'U') + '-' + randomPart;

      const { data: existing } = await supabaseAdmin
        .from('qg_launch_profiles')
        .select('id')
        .eq('email_normalised', normalised)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from('qg_launch_profiles')
          .update({ referral_code: code, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      }

      const { data: preTokens } = await supabaseAdmin
        .from('qg_pre_account_tokens')
        .select('id')
        .eq('email_normalised', normalised)
        .maybeSingle();

      if (preTokens) {
        await supabaseAdmin
          .from('qg_pre_account_tokens')
          .update({ referral_code: code, updated_at: new Date().toISOString() })
          .eq('id', preTokens.id);
      }

      return new Response(JSON.stringify({
        referral_code: code,
        referral_link: `/qg-launch-rewards?ref=${code}`
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'toggle_newsletter_consent') {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return new Response(JSON.stringify({ error: 'Valid email required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const normalised = email.toLowerCase().trim();
      const consent = newsletter_consent === true;

      const { data: existing } = await supabaseAdmin
        .from('qg_launch_profiles')
        .select('id')
        .eq('email_normalised', normalised)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from('qg_launch_profiles')
          .update({
            newsletter_consent: consent,
            newsletter_consent_at: consent ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      }

      return new Response(JSON.stringify({
        newsletter_consent: consent,
        message: consent ? 'Newsletter consent enabled' : 'Newsletter consent disabled'
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_public_launch_stats') {
      const { data: stats, error: statsErr } = await supabaseAdmin
        .from('qg_launch_public_stats')
        .select('*')
        .eq('is_public', true);

      if (statsErr) {
        return new Response(JSON.stringify({ error: 'Failed to load stats' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ stats }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required for this action' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'record_account_view') {
      if (!email || typeof email !== 'string') {
        return new Response(JSON.stringify({ error: 'Valid email required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const normalised = email.toLowerCase().trim();

      const { data: existing } = await supabaseAdmin
        .from('qg_launch_profiles')
        .select('id')
        .eq('email_normalised', normalised)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from('qg_launch_profiles')
          .update({ last_account_viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      }

      return new Response(JSON.stringify({ recorded: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'update_profile') {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return new Response(JSON.stringify({ error: 'Valid email required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const normalised = email.toLowerCase().trim();

      const { data: existing } = await supabaseAdmin
        .from('qg_launch_profiles')
        .select('*')
        .eq('email_normalised', normalised)
        .maybeSingle();

      if (existing) {
        const updates: any = { updated_at: new Date().toISOString() };
        if (name !== undefined) updates.name = name;
        if (intended_role !== undefined) updates.intended_role = intended_role;

        if (!existing.linked_user_id && user) {
          updates.linked_user_id = user.id;
          updates.profile_status = 'linked';
        }

        await supabaseAdmin
          .from('qg_launch_profiles')
          .update(updates)
          .eq('id', existing.id);

        return new Response(JSON.stringify({ success: true, profile: { ...existing, ...updates } }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const insertData: any = {
        email,
        email_normalised: normalised,
        name: name || null,
        intended_role: intended_role || 'unknown',
        profile_status: 'temporary',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (user) {
        insertData.linked_user_id = user.id;
        insertData.profile_status = 'linked';
      }

      const { data: created, error: createErr } = await supabaseAdmin
        .from('qg_launch_profiles')
        .insert(insertData)
        .select()
        .single();

      if (createErr) {
        return new Response(JSON.stringify({ error: 'Failed to create profile', detail: createErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, profile: created }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', detail: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});