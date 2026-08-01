import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ProvisionResult {
  step: string;
  status: 'created' | 'exists' | 'error' | 'skipped';
  error?: string;
}

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

    const { userId, accountType } = await req.json();

    if (!userId || !accountType) {
      return new Response(JSON.stringify({ error: 'userId and accountType are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: ProvisionResult[] = [];
    const now = new Date().toISOString();

    if (accountType === 'guard') {
      const { data: existingGuard } = await supabase.from('guards').select('id').eq('user_id', userId).maybeSingle();
      if (existingGuard) {
        results.push({ step: 'profile', status: 'exists' });
        await supabase.from('guards').update({ updated_at: now }).eq('user_id', userId);
      } else {
        const { error: insertErr } = await supabase.from('guards').insert({
          user_id: userId,
          email: '',
          full_name: '',
          profile_completed: false,
          subscription_status: 'incomplete',
          verification_status: 'manual_review',
          sia_verified: false,
          is_active: false,
          onboarding_status: 'provisioned',
          created_at: now,
          updated_at: now,
        });
        results.push({ step: 'profile', status: insertErr ? 'error' : 'created', error: insertErr?.message });
      }
    } else if (accountType === 'client') {
      const { data: existingClient } = await supabase.from('clients').select('id').eq('user_id', userId).maybeSingle();
      if (existingClient) {
        results.push({ step: 'profile', status: 'exists' });
        await supabase.from('clients').update({ updated_at: now }).eq('user_id', userId);
      } else {
        const { error: insertErr } = await supabase.from('clients').insert({
          user_id: userId,
          email: '',
          contact_name: '',
          profile_completed: false,
          subscription_status: 'incomplete',
          verification_status: 'pending',
          is_active: true,
          onboarding_status: 'provisioned',
          created_at: now,
          updated_at: now,
        });
        results.push({ step: 'profile', status: insertErr ? 'error' : 'created', error: insertErr?.message });
      }
    } else {
      results.push({ step: 'profile', status: 'skipped' });
    }

    const isClient = accountType === 'client';

    const { data: existingEntitlement } = await supabase.from('user_entitlements_data').select('user_id').eq('user_id', userId).maybeSingle();
    if (existingEntitlement) {
      results.push({ step: 'entitlements', status: 'exists' });
      await supabase.from('user_entitlements_data').update({ updated_at: now }).eq('user_id', userId);
    } else {
      const { error: entErr } = await supabase.from('user_entitlements_data').insert({
        user_id: userId,
        plan_slug: isClient ? 'client_free' : 'free',
        plan_name: isClient ? 'Free Starter' : 'Free Tier',
        audience: accountType,
        features: isClient
          ? JSON.stringify(['client.post_job', 'client.view_guard_profiles', 'client.escrow_payments'])
          : '[]',
        monthly_price_pence: 0,
        subscription_status: 'incomplete',
        is_active: false,
        is_free_tier: true,
        created_at: now,
        updated_at: now,
      });
      results.push({ step: 'entitlements', status: entErr ? 'error' : 'created', error: entErr?.message });
    }

    const { data: existingNotifPrefs } = await supabase.from('notification_preferences').select('id').eq('user_id', userId).maybeSingle();
    if (existingNotifPrefs) {
      results.push({ step: 'notification_preferences', status: 'exists' });
      await supabase.from('notification_preferences').update({ updated_at: now }).eq('user_id', userId);
    } else {
      const { error: notifErr } = await supabase.from('notification_preferences').insert({
        user_id: userId,
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
      results.push({ step: 'notification_preferences', status: notifErr ? 'error' : 'created', error: notifErr?.message });
    }

    const { data: existingSub } = await supabase.from('subscriptions').select('id').eq('user_id', userId).maybeSingle();
    if (existingSub) {
      results.push({ step: 'subscription', status: 'exists' });
      await supabase.from('subscriptions').update({ updated_at: now }).eq('user_id', userId);
    } else {
      const { error: subErr } = await supabase.from('subscriptions').insert({
        user_id: userId,
        status: 'incomplete',
        plan_slug: isClient ? 'client_free' : 'free',
        plan_name: isClient ? 'Free Starter' : 'Free Tier',
        billing_cycle: 'monthly',
        auto_renew: false,
        payment_failure_count: 0,
        account_type: accountType,
        created_at: now,
        updated_at: now,
      });
      results.push({ step: 'subscription', status: subErr ? 'error' : 'created', error: subErr?.message });
    }

    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'provision_user_account',
      details: JSON.stringify({ accountType, results }),
      created_at: now,
    });

    const hasErrors = results.some(r => r.status === 'error');

    return new Response(JSON.stringify({
      success: !hasErrors,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('provision-user-account error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});