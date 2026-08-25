import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const PROD_ORIGINS = ['https://quickguard.uk', 'https://www.quickguard.uk'];
const APPROVED_TYPES = ['client', 'guard'];

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

async function requireSuperAdmin(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: { status: 401, message: 'Missing authentication token' } };

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return { error: { status: 401, message: 'Invalid or expired token' } };

  const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'app' } });
  const { data: admin } = await serviceClient
    .from('admin_users')
    .select('id, role, is_active, full_name, email')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('role', 'super_admin')
    .maybeSingle();

  if (!admin) return { error: { status: 403, message: 'Insufficient permissions' } };
  return { user, admin, serviceClient };
}

function fail(headers: Record<string, string>, message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

function isUuid(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return fail(headers, 'Method not allowed', 405);

  try {
    const auth = await requireSuperAdmin(req);
    if (auth.error) return fail(headers, auth.error.message, auth.error.status);
    const { admin: actor, serviceClient } = auth as any;

    let body: any;
    try { body = await req.json(); } catch { return fail(headers, 'Invalid request body', 400); }

    const userId = String(body.userId || '');
    const accountType = String(body.accountType || '');
    if (!isUuid(userId)) return fail(headers, 'Invalid userId', 400);
    if (!APPROVED_TYPES.includes(accountType)) return fail(headers, 'Invalid accountType', 400);

    const now = new Date().toISOString();
    const results: { step: string; status: string }[] = [];

    if (accountType === 'guard') {
      const { data: g } = await serviceClient.from('guards').select('id').eq('user_id', userId).maybeSingle();
      if (g) {
        results.push({ step: 'profile', status: 'exists' });
        await serviceClient.from('guards').update({ updated_at: now }).eq('user_id', userId);
      } else {
        const { error } = await serviceClient.from('guards').insert({
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
        results.push({ step: 'profile', status: error ? 'error' : 'created' });
      }
    } else {
      const { data: c } = await serviceClient.from('clients').select('id').eq('user_id', userId).maybeSingle();
      if (c) {
        results.push({ step: 'profile', status: 'exists' });
        await serviceClient.from('clients').update({ updated_at: now }).eq('user_id', userId);
      } else {
        const { error } = await serviceClient.from('clients').insert({
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
        results.push({ step: 'profile', status: error ? 'error' : 'created' });
      }
    }

    const isClient = accountType === 'client';
    const { data: ent } = await serviceClient.from('user_entitlements_data').select('user_id').eq('user_id', userId).maybeSingle();
    if (!ent) {
      const { error } = await serviceClient.from('user_entitlements_data').insert({
        user_id: userId,
        plan_slug: isClient ? 'client_free' : 'free',
        plan_name: isClient ? 'Free Starter' : 'Free Tier',
        audience: accountType,
        features: isClient ? JSON.stringify(['client.post_job', 'client.view_guard_profiles', 'client.escrow_payments']) : '[]',
        monthly_price_pence: 0,
        subscription_status: 'incomplete',
        is_active: false,
        is_free_tier: true,
        created_at: now,
        updated_at: now,
      });
      results.push({ step: 'entitlements', status: error ? 'error' : 'created' });
    } else {
      results.push({ step: 'entitlements', status: 'exists' });
    }

    const { data: notif } = await serviceClient.from('notification_preferences').select('id').eq('user_id', userId).maybeSingle();
    if (!notif) {
      const { error } = await serviceClient.from('notification_preferences').insert({
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

    const { data: sub } = await serviceClient.from('subscriptions').select('id').eq('user_id', userId).maybeSingle();
    if (!sub) {
      const { error } = await serviceClient.from('subscriptions').insert({
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
      results.push({ step: 'subscription', status: error ? 'error' : 'created' });
    } else {
      results.push({ step: 'subscription', status: 'exists' });
    }

    await serviceClient.from('admin_activity_log').insert({
      admin_user_id: actor.id,
      admin_username: actor.email,
      admin_name: actor.full_name,
      action_type: 'admin_provision_user',
      action_description: `Provisioned ${accountType} account`,
      target_type: accountType,
      target_name: userId,
      metadata: { target_user_id: userId, accountType, results },
      created_at: now,
    });

    const hasErrors = results.some((r) => r.status === 'error');
    return new Response(JSON.stringify({ success: !hasErrors, results }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch {
    return fail(headers, 'Internal server error', 500);
  }
});