import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const PROD_ORIGINS = ['https://quickguard.uk', 'https://www.quickguard.uk'];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (origin === 'https://readdy.ai' || origin.endsWith('.readdy.ai')) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin! : PROD_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function fail(headers: Record<string, string>, message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

async function provisionSupportRecords(supabase: any, userId: string, accountType: string) {
  const now = new Date().toISOString();
  const isClient = accountType === 'client';
  const results: { step: string; status: string }[] = [];

  const { data: ent } = await supabase.from('user_entitlements_data').select('user_id').eq('user_id', userId).maybeSingle();
  if (!ent) {
    const { error } = await supabase.from('user_entitlements_data').insert({
      user_id: userId,
      plan_slug: isClient ? 'client_free' : 'guard_starter',
      plan_name: 'Free Starter',
      audience: accountType,
      features: isClient ? JSON.stringify(['client.post_job', 'client.view_guard_profiles', 'client.escrow_payments']) : JSON.stringify(['guard.apply_job', 'guard.view_jobs', 'guard.create_profile', 'guard.advanced_alerts']),
      monthly_price_pence: 0,
      subscription_status: 'active',
      created_at: now,
      updated_at: now,
    });
    results.push({ step: 'entitlements', status: error ? 'error' : 'created' });
  } else {
    results.push({ step: 'entitlements', status: 'exists' });
  }

  const { data: notif } = await supabase.from('notification_preferences').select('id').eq('user_id', userId).maybeSingle();
  if (!notif) {
    const { error } = await supabase.from('notification_preferences').insert({
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
    results.push({ step: 'notification_preferences', status: error ? 'error' : 'created' });
  } else {
    results.push({ step: 'notification_preferences', status: 'exists' });
  }

  const { data: sub } = await supabase.from('subscriptions').select('id').eq('user_id', userId).maybeSingle();
  if (!sub) {
    const { error } = await supabase.from('subscriptions').insert({
      user_id: userId,
      status: 'active',
      plan_slug: isClient ? 'client_free' : 'guard_starter',
      plan_name: 'Free Starter',
      billing_cycle: 'monthly',
      auto_renew: false,
      payment_failure_count: 0,
      account_type: accountType,
      created_at: now,
      updated_at: now,
    });
    results.push({ step: 'subscription', status: error ? 'error' : 'created' });
  } else {
    results.push({ step: 'subscription', status: 'exists' });
  }

  return results;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return fail(headers, 'Method not allowed', 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return fail(headers, 'Missing authentication token', 401);

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return fail(headers, 'Invalid or expired token', 401);

    const verifiedUserId = user.id;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'app' } });

    const { data: guard } = await supabase.from('guards').select('id').eq('user_id', verifiedUserId).maybeSingle();
    const { data: client } = await supabase.from('clients').select('id').eq('user_id', verifiedUserId).maybeSingle();
    const accountType = guard ? 'guard' : client ? 'client' : null;
    if (!accountType) return fail(headers, 'No client or guard profile found for this account', 400);

    const results = await provisionSupportRecords(supabase, verifiedUserId, accountType);

    await supabase.from('audit_log').insert({
      table_name: 'provision',
      record_id: verifiedUserId,
      action: 'provision_user_account_self',
      user_id: verifiedUserId,
      new_values: { accountType, steps: results },
      created_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, accountType, results }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch {
    return fail(headers, 'Internal server error', 500);
  }
});
