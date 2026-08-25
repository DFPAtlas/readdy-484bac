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

    const email = String(body.email || '').trim().toLowerCase();
    const newPassword = String(body.newPassword || '');
    if (!email || !newPassword) return fail(headers, 'Email and new password are required', 400);
    if (newPassword.length < 8) return fail(headers, 'Password must be at least 8 characters', 400);

    const { data: target } = await serviceClient
      .from('admin_users')
      .select('id, user_id, email')
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle();
    if (!target) return fail(headers, 'Admin not found', 404);

    if (target.user_id) {
      const { error: authErr } = await serviceClient.auth.admin.updateUserById(target.user_id, { password: newPassword });
      if (authErr) {
        if (/new password should be different/i.test(authErr.message || '')) {
          return fail(headers, 'New password must be different from the current password', 400);
        }
        return fail(headers, 'Failed to update password', 500);
      }
    }

    await serviceClient.from('admin_activity_log').insert({
      admin_user_id: actor.id,
      admin_username: actor.email,
      admin_name: actor.full_name,
      action_type: 'admin_password_reset',
      action_description: `Reset password for ${email}`,
      target_type: 'admin_user',
      target_name: email,
      metadata: { target_user_id: target.user_id },
      created_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch {
    return fail(headers, 'Internal server error', 500);
  }
});