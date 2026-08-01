import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'app' }
    });

    const now = new Date().toISOString();
    const repairs: string[] = [];

    const { data: allUsers } = await supabase.auth.admin.listUsers();
    if (!allUsers?.users) {
      return new Response(JSON.stringify({ success: true, repairs, message: 'No users found' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const user of allUsers.users) {
      const { data: existingGuards } = await supabase.from('guards').select('id').eq('user_id', user.id);
      const { data: existingClients } = await supabase.from('clients').select('id').eq('user_id', user.id);
      const { data: admins } = await supabase.from('admin_users').select('id').eq('user_id', user.id);

      if (admins && admins.length > 0) continue;

      const isGuard = existingGuards && existingGuards.length > 0;
      const isClient = existingClients && existingClients.length > 0;
      const accountType = isGuard ? 'guard' : isClient ? 'client' : null;

      if (!accountType) continue;

      const isClientType = accountType === 'client';

      const { data: ent } = await supabase.from('user_entitlements_data').select('user_id').eq('user_id', user.id).maybeSingle();
      if (!ent) {
        const { error: entErr } = await supabase.from('user_entitlements_data').insert({
          user_id: user.id,
          plan_slug: isClientType ? 'client_free' : 'guard_starter',
          plan_name: isClientType ? 'Free Starter' : 'Guard Starter',
          audience: accountType,
          features: isClientType
            ? JSON.stringify(['client.post_job', 'client.view_guard_profiles', 'client.escrow_payments'])
            : '[]',
          monthly_price_pence: 0,
          subscription_status: 'incomplete',
          is_active: false,
          is_free_tier: true,
          created_at: now,
          updated_at: now,
        });
        if (!entErr) repairs.push(`Created entitlements for ${user.email}`);
        else repairs.push(`Failed entitlements for ${user.email}: ${entErr.message}`);
      }

      const { data: notif } = await supabase.from('notification_preferences').select('id').eq('user_id', user.id).maybeSingle();
      if (!notif) {
        const { error: notifErr } = await supabase.from('notification_preferences').insert({
          user_id: user.id,
          job_matches: true,
          application_updates: true,
          payment_notifications: true,
          messages: true,
          sia_reminders: true,
          email_frequency: 'daily',
          new_applicants: true,
          guard_confirmations: true,
          job_reminders: true,
          support_tickets: true,
          payment_updates: true,
          in_app_alerts: true,
          sms_notifications: false,
          created_at: now,
          updated_at: now,
        });
        if (!notifErr) repairs.push(`Created notification prefs for ${user.email}`);
        else repairs.push(`Failed notification prefs for ${user.email}: ${notifErr.message}`);
      }

      const { data: sub } = await supabase.from('subscriptions').select('id').eq('user_id', user.id).maybeSingle();
      if (!sub) {
        const { error: subErr } = await supabase.from('subscriptions').insert({
          user_id: user.id,
          status: 'incomplete',
          plan_slug: isClientType ? 'client_free' : 'guard_starter',
          plan_name: isClientType ? 'Free Starter' : 'Guard Starter',
          billing_cycle: 'monthly',
          auto_renew: false,
          payment_failure_count: 0,
          account_type: accountType,
          created_at: now,
          updated_at: now,
        });
        if (!subErr) repairs.push(`Created subscription for ${user.email}`);
        else repairs.push(`Failed subscription for ${user.email}: ${subErr.message}`);
      }

      if (isGuard) {
        const { data: g } = await supabase.from('guards').select('onboarding_status').eq('user_id', user.id).maybeSingle();
        if (g && (!g.onboarding_status || g.onboarding_status === 'pending')) {
          await supabase.from('guards').update({ onboarding_status: 'provisioned' }).eq('user_id', user.id);
          repairs.push(`Fixed onboarding for guard ${user.email}`);
        }
      }
      if (isClient) {
        const { data: c } = await supabase.from('clients').select('onboarding_status').eq('user_id', user.id).maybeSingle();
        if (c && (!c.onboarding_status || c.onboarding_status === 'pending')) {
          await supabase.from('clients').update({ onboarding_status: 'provisioned' }).eq('user_id', user.id);
          repairs.push(`Fixed onboarding for client ${user.email}`);
        }
      }

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'repair_account',
        details: JSON.stringify({ repairs }),
        created_at: now,
      });
    }

    return new Response(JSON.stringify({ success: true, repairs }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('repair-account error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
