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

    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'app' } });
    const { data: admin } = await serviceClient
      .from('admin_users')
      .select('id, email, full_name, role, is_active, created_at, last_login, permissions')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!admin) return fail(headers, 'Admin not found', 404);

    return new Response(JSON.stringify({ success: true, admin }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch {
    return fail(headers, 'Internal server error', 500);
  }
});