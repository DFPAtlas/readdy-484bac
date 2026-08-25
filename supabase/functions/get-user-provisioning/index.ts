import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const PROD_ORIGINS = ['https://quickguard.uk', 'https://www.quickguard.uk'];
const MAX_PAGE_SIZE = 100;

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
    .select('id, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('role', 'super_admin')
    .maybeSingle();

  if (!admin) return { error: { status: 403, message: 'Insufficient permissions' } };
  return { user, admin, serviceClient };
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return fail(headers, 'Method not allowed', 405);

  try {
    const auth = await requireSuperAdmin(req);
    if (auth.error) return fail(headers, auth.error.message, auth.error.status);
    const { serviceClient } = auth as any;

    let body: any;
    try { body = await req.json(); } catch { body = {}; }

    const page = Math.max(0, Number(body.page) || 0);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(body.pageSize) || 25));
    const search = String(body.search || '').trim().toLowerCase();
    const accountFilter = String(body.accountFilter || 'all');
    const statusFilter = String(body.statusFilter || 'all');

    const { data: authUsers, error: rpcErr } = await serviceClient.rpc('get_auth_users');
    if (rpcErr) return fail(headers, 'Failed to load users', 500);
    if (!authUsers || authUsers.length === 0) {
      return new Response(JSON.stringify({ users: [], totalCount: 0, page, pageSize }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    let emailFiltered = authUsers;
    if (search) {
      emailFiltered = authUsers.filter((u: any) => (u.email ?? '').toLowerCase().includes(search));
    }
    const filteredIds = emailFiltered.map((u: any) => u.id);
    if (filteredIds.length === 0) {
      return new Response(JSON.stringify({ users: [], totalCount: 0, page, pageSize }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const [guardsRes, clientsRes, entitlementsRes, notifRes, subsRes, adminsRes] = await Promise.all([
      serviceClient.from('guards').select('user_id, profile_completed, verification_status, subscription_status, onboarding_status, created_at').in('user_id', filteredIds),
      serviceClient.from('clients').select('user_id, profile_completed, verification_status, subscription_status, onboarding_status, created_at').in('user_id', filteredIds),
      serviceClient.from('user_entitlements_data').select('user_id').in('user_id', filteredIds),
      serviceClient.from('notification_preferences').select('user_id').in('user_id', filteredIds),
      serviceClient.from('subscriptions').select('user_id').in('user_id', filteredIds),
      serviceClient.from('admin_users').select('user_id, role').in('user_id', filteredIds),
    ]);

    const guardMap = new Map((guardsRes.data ?? []).map((g: any) => [g.user_id, g]));
    const clientMap = new Map((clientsRes.data ?? []).map((c: any) => [c.user_id, c]));
    const entSet = new Set((entitlementsRes.data ?? []).map((e: any) => e.user_id));
    const notifSet = new Set((notifRes.data ?? []).map((n: any) => n.user_id));
    const subSet = new Set((subsRes.data ?? []).map((s: any) => s.user_id));
    const adminRoleMap = new Map((adminsRes.data ?? []).map((a: any) => [a.user_id, a.role]));

    const records = emailFiltered.map((u: any) => {
      const guard = guardMap.get(u.id) as any;
      const client = clientMap.get(u.id) as any;
      const isAdmin = adminRoleMap.has(u.id);

      let accountType = '';
      let profileCompleted = false;
      let verificationStatus = 'none';
      let subscriptionStatus = 'none';
      let onboardingStatus = 'none';
      let createdAt = u.created_at;
      let role = '';

      if (guard) {
        accountType = 'guard';
        profileCompleted = guard.profile_completed ?? false;
        verificationStatus = guard.verification_status ?? 'none';
        subscriptionStatus = guard.subscription_status ?? 'none';
        onboardingStatus = guard.onboarding_status ?? 'none';
        createdAt = guard.created_at ?? u.created_at;
      } else if (client) {
        accountType = 'client';
        profileCompleted = client.profile_completed ?? false;
        verificationStatus = client.verification_status ?? 'none';
        subscriptionStatus = client.subscription_status ?? 'none';
        onboardingStatus = client.onboarding_status ?? 'none';
        createdAt = client.created_at ?? u.created_at;
      } else if (isAdmin) {
        accountType = 'admin';
        profileCompleted = true;
        verificationStatus = 'approved';
        subscriptionStatus = 'admin';
        onboardingStatus = 'admin';
      }

      if (isAdmin) role = adminRoleMap.get(u.id);
      else if (accountType === 'guard') role = 'guard';
      else if (accountType === 'client') role = 'client';

      const dashboardStatus = !accountType
        ? 'missing'
        : profileCompleted && entSet.has(u.id) && notifSet.has(u.id) && subSet.has(u.id)
        ? 'complete'
        : 'partial';

      return {
        id: u.id,
        email: u.email ?? '',
        accountType: accountType || 'unknown',
        role,
        profileCompleted,
        subscriptionStatus,
        verificationStatus,
        onboardingStatus,
        hasEntitlements: entSet.has(u.id),
        hasNotificationPrefs: notifSet.has(u.id),
        hasSubscription: subSet.has(u.id),
        createdAt,
        dashboardStatus,
      };
    });

    let result = records;
    if (accountFilter !== 'all') result = result.filter((r: any) => r.accountType === accountFilter);
    if (statusFilter === 'complete') result = result.filter((r: any) => r.dashboardStatus === 'complete');
    else if (statusFilter === 'partial') result = result.filter((r: any) => r.dashboardStatus === 'partial');
    else if (statusFilter === 'missing') result = result.filter((r: any) => r.dashboardStatus === 'missing');

    const totalCount = result.length;
    const start = page * pageSize;
    const paged = result.slice(start, start + pageSize);

    return new Response(JSON.stringify({ users: paged, totalCount, page, pageSize }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch {
    return fail(headers, 'Internal server error', 500);
  }
});