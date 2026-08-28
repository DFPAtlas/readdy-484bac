import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

function getAal(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(base64 + pad)).aal || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;

  if (!isServiceRole) {
    const jwt = authHeader.replace('Bearer ', '').trim();

    if (!jwt || jwt === Deno.env.get('SUPABASE_ANON_KEY')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (getAal(jwt) !== 'aal2') {
      return new Response(
        JSON.stringify({ error: 'MFA required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: adminUser } = await supabaseAuth
      .from('admin_users')
      .select('id, is_active')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (!adminUser || !adminUser.is_active) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    const { guardEmail, guardName, guardFirstName, guardLastName, approved, rejectionReason, unconfirmedSections, guardId } = await req.json();

    let email = guardEmail;
    let displayName = guardName || (guardFirstName && guardLastName ? `${guardFirstName} ${guardLastName}` : 'Guard');
    let relatedUserId: string | null = guardId || null;

    if (guardId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });
      const { data: byId } = await supabase
        .from('guards')
        .select('id, user_id, email, full_name, first_name, last_name')
        .eq('id', guardId)
        .maybeSingle();

      let guardRecord = byId;
      if (!guardRecord) {
        const { data: byUserId } = await supabase
          .from('guards')
          .select('id, user_id, email, full_name, first_name, last_name')
          .eq('user_id', guardId)
          .maybeSingle();
        guardRecord = byUserId;
      }

      if (guardRecord) {
        email = guardRecord.email || email;
        displayName = guardRecord.full_name || (guardRecord.first_name && guardRecord.last_name ? `${guardRecord.first_name} ${guardRecord.last_name}` : displayName);
        relatedUserId = guardRecord.user_id || relatedUserId;
      }
    }

    if (!email || !displayName || approved === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (relatedUserId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });
      const templateLookup = approved ? 'guard_approval' : 'guard_rejection';
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: existingEmail } = await supabase
        .from('email_send_log')
        .select('id')
        .eq('template', templateLookup)
        .eq('related_user_id', relatedUserId)
        .eq('status', 'sent')
        .gte('sent_at', cutoff)
        .maybeSingle();

      if (existingEmail) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'Duplicate prevented — email already sent within 24 hours' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const templateSlug = approved ? 'guard_approval' : 'guard_rejection';
    const unconfirmedSectionsHtml = (!approved && unconfirmedSections && unconfirmedSections.length > 0)
      ? `<p style="margin:24px 0 12px;color:#4b5563;font-size:16px;font-weight:600;">Sections that could not be confirmed:</p><ul style="color:#4b5563;">${unconfirmedSections.map((s: string) => `<li>${s}</li>`).join('')}</ul>`
      : '';

    const variables: Record<string, string> = {
      guard_name: displayName,
      rejection_reason: rejectionReason || 'Unable to verify provided information',
      unconfirmed_sections_block: unconfirmedSectionsHtml,
      dashboard_url: 'https://quickguard.uk/guard/dashboard',
      support_email: 'info@quickguard.uk',
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({
        template_slug: templateSlug,
        to: email,
        variables,
        from: 'QuickGuard <info@quickguard.uk>',
        related_user_id: relatedUserId,
      }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      console.error('render-email-template error:', errText);
      return new Response(JSON.stringify({ error: 'Failed to render email' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const renderData = await renderRes.json();
    return new Response(JSON.stringify({ success: true, email_id: renderData.email_id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error sending email:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
