import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlanChangePayload {
  user_id: string;
  old_plan_slug: string | null;
  new_plan_slug: string;
  old_plan_name: string | null;
  new_plan_name: string;
  account_type: string;
  change_source: string;
  proration_applied: boolean;
}

const PLAN_HIERARCHY: Record<string, number> = {
  'client-starter': 1,
  'client-pro': 2,
  'client-enterprise': 3,
  'guard-basic': 1,
  'guard-pro': 2,
  'guard-elite': 3,
};

function isDowngrade(oldSlug: string | null, newSlug: string): boolean {
  if (!oldSlug) return false;
  const oldRank = PLAN_HIERARCHY[oldSlug];
  const newRank = PLAN_HIERARCHY[newSlug];
  if (oldRank === undefined || newRank === undefined) return false;
  return newRank < oldRank;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';

  try {
    const payload: PlanChangePayload = await req.json();
    const { user_id, old_plan_slug, new_plan_slug, old_plan_name, new_plan_name, account_type, change_source, proration_applied } = payload;

    if (!user_id || !new_plan_slug || !new_plan_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    const { data: admins } = await supabase
      .from('admin_users')
      .select('email, full_name')
      .eq('is_active', true);

    if (!admins || admins.length === 0) {
      console.log('[send-plan-change-alert] No active admins found, skipping email');
      return new Response(JSON.stringify({ success: true, message: 'No active admins to notify', sent_to: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminEmails = admins.map((a: any) => a.email).filter(Boolean);
    if (adminEmails.length === 0) {
      console.log('[send-plan-change-alert] No admin emails found');
      return new Response(JSON.stringify({ success: true, message: 'No admin emails found', sent_to: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let userName = 'Unknown User';
    let userEmail = 'unknown';

    if (account_type === 'client') {
      const { data: client } = await supabase.from('clients').select('contact_name, company_name, email').eq('user_id', user_id).maybeSingle();
      if (client) {
        userName = client.contact_name || client.company_name || 'Unknown Client';
        userEmail = client.email || 'unknown';
      }
    } else {
      const { data: guard } = await supabase.from('guards').select('full_name, email').eq('user_id', user_id).maybeSingle();
      if (guard) {
        userName = guard.full_name || 'Unknown Guard';
        userEmail = guard.email || 'unknown';
      }
    }

    if (userName === 'Unknown User') {
      const { data: user } = await supabase.from('users').select('email, full_name').eq('id', user_id).maybeSingle();
      if (user) {
        userName = user.full_name || 'Unknown User';
        userEmail = user.email || 'unknown';
      }
    }

    const downgrade = isDowngrade(old_plan_slug, new_plan_slug);
    const direction = !old_plan_slug ? 'Activated' : (downgrade ? 'Downgrade' : 'Upgrade');
    const directionEmoji = !old_plan_slug ? '🎉' : (downgrade ? '🔻' : '🔺');
    const bannerColor = !old_plan_slug ? '#10b981' : (downgrade ? '#ef4444' : '#3b82f6');

    const downgradeWarningHtml = downgrade
      ? '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-top:24px;"><p style="color:#991b1b;margin:0;font-size:14px;font-weight:bold;">This is a downgrade — consider reaching out to retain this customer.</p></div>'
      : '';

    const accountTypeLabel = account_type === 'client' ? 'Client' : 'Security Guard';
    const prorationLabel = proration_applied ? 'Yes (prorated billing)' : 'No';
    const changeSourceLabel = change_source === 'checkout' ? 'User-initiated (checkout)' : change_source === 'webhook' ? 'Stripe event (webhook)' : change_source;
    const changeDate = new Date().toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });

    const variables: Record<string, string> = {
      user_name: userName,
      user_email: userEmail,
      account_type_label: accountTypeLabel,
      old_plan: old_plan_name || 'None',
      new_plan: new_plan_name,
      change_source: changeSourceLabel,
      proration_label: prorationLabel,
      change_date: changeDate,
      direction,
      direction_emoji: directionEmoji,
      banner_color: bannerColor,
      downgrade_warning: downgradeWarningHtml,
      admin_url: `${siteUrl}/admin/plan-change-history`,
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        template_slug: 'plan_change_alert',
        to: adminEmails,
        variables,
        from: 'QuickGuard Alerts <alerts@quickguard.uk>',
        related_user_id: user_id,
      }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      console.error('[send-plan-change-alert] Render failed:', errText);
      return new Response(JSON.stringify({ error: 'Email render failed', details: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const renderData = await renderRes.json();

    console.log(`[send-plan-change-alert] Alert sent to ${adminEmails.length} admin(s): ${direction} — ${userName} (${old_plan_name || 'none'} → ${new_plan_name})`);

    return new Response(JSON.stringify({
      success: true,
      message: `Plan change alert sent to ${adminEmails.length} admin(s)`,
      sent_to: adminEmails.length,
      email_id: renderData.email_id,
      direction,
      downgrade,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[send-plan-change-alert] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to send alert', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
