import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const PROD_ORIGINS = ['https://quickguard.uk', 'https://www.quickguard.uk'];
const MAX_BATCH = 50;

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

    const rawIds = Array.isArray(body.userIds) ? body.userIds : [];
    const userIds = rawIds.filter(isUuid).slice(0, MAX_BATCH);
    if (userIds.length === 0) return fail(headers, 'A userIds array of valid UUIDs is required', 400);

    const dryRun = body.confirm !== true;
    const now = new Date().toISOString();
    const results: { userId: string; status: string; actions: string[] }[] = [];

    for (const userId of userIds) {
      const actions: string[] = [];
      const { data: guard } = await serviceClient.from('guards').select('id, onboarding_status').eq('user_id', userId).maybeSingle();
      const { data: client } = await serviceClient.from('clients').select('id, onboarding_status').eq('user_id', userId).maybeSingle();
      const accountType = guard ? 'guard' : client ? 'client' : null;
      if (!accountType) {
        results.push({ userId, status: 'not_found', actions });
        continue;
      }

      const isClient = accountType === 'client';
      const { data: ent } = await serviceClient.from('user_entitlements_data').select('user_id').eq('user_id', userId).maybeSingle();
      if (!ent) {
        actions.push('entitlements');
        if (!dryRun) {
          await serviceClient.from('user_entitlements_data').insert({
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
        }
      }

      const { data: notif } = await serviceClient.from('notification_preferences').select('id').eq('user_id', userId).maybeSingle();
      if (!notif) {
        actions.push('notification_preferences');
        if (!dryRun) {
          await serviceClient.from('notification_preferences').insert({
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
        }
      }

      const { data: sub } = await serviceClient.from('subscriptions').select('id').eq('user_id', userId).maybeSingle();
      if (!sub) {
        actions.push('subscription');
        if (!dryRun) {
          await serviceClient.from('subscriptions').insert({
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
        }
      }

      const profile = guard || client;
      if (profile && (!profile.onboarding_status || profile.onboarding_status === 'pending')) {
        actions.push('onboarding_status');
        if (!dryRun) {
          const table = accountType === 'guard' ? 'guards' : 'clients';
          await serviceClient.from(table).update({ onboarding_status: 'provisioned' }).eq('user_id', userId);
        }
      }

      results.push({ userId, status: actions.length === 0 ? 'ok' : dryRun ? 'would_repair' : 'repaired', actions });
    }

    await serviceClient.from('admin_activity_log').insert({
      admin_user_id: actor.id,
      admin_username: actor.email,
      admin_name: actor.full_name,
      action_type: 'repair_account',
      action_description: `${dryRun ? 'Dry-run' : 'Executed'} repair for ${userIds.length} accounts`,
      target_type: 'user',
      target_name: `${userIds.length} accounts`,
      metadata: { dryRun, count: userIds.length, outcomes: results.map((r) => ({ userId: r.userId, status: r.status })) },
      created_at: now,
    });

    return new Response(JSON.stringify({ dryRun, results }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch {
    return fail(headers, 'Internal server error', 500);
  }
});
