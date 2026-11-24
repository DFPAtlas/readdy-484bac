import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function aal(token: string): unknown {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload + '='.repeat((4 - payload.length % 4) % 4))).aal;
  } catch { return null; }
}
Deno.serve(async (req: Request) => {
  const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return reply({ error: 'Cleanup service is unavailable' }, 503);
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply({ error: 'Admin sign-in required' }, 401);
  const db = createClient(url, serviceKey, { db: { schema: 'app' }, auth: { persistSession: false } });
  try {
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user) return reply({ error: 'Admin sign-in required' }, 401);
    // Decode assurance only after the Auth server verifies the supplied token.
    if (aal(token) !== 'aal2') return reply({ error: 'MFA is required for manual cleanup' }, 403);
    const { data: admin, error: adminError } = await db.from('admin_users')
      .select('id, role, is_active').eq('user_id', user.id).maybeSingle();
    if (adminError) return reply({ error: 'Admin access could not be verified' }, 503);
    if (!admin?.is_active || !['super_admin', 'admin'].includes(admin.role)) {
      return reply({ error: 'An active admin or super admin is required' }, 403);
    }
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return reply({ error: 'JSON request required' }, 415);
    }
    const text = await req.text();
    if (text.length > 2048) return reply({ error: 'Request is too large' }, 413);
    let body: unknown;
    try { body = JSON.parse(text); } catch { return reply({ error: 'Invalid JSON request' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || !('action' in body) ||
        !['preview', 'execute', 'status'].includes(String(body.action))) {
      return reply({ error: 'Invalid cleanup action' }, 400);
    }
    const action = body.action;
    if (typeof action !== 'string') return reply({ error: 'Invalid cleanup action' }, 400);
    const requestId = 'requestId' in body ? body.requestId : null;
    if (action !== 'preview' && (typeof requestId !== 'string' || !uuid.test(requestId))) {
      return reply({ error: 'A valid cleanup request ID is required' }, 400);
    }
    if (action === 'execute' && (!('confirmed' in body) || body.confirmed !== true)) {
      return reply({ error: 'Review the preview and explicitly confirm permanent deletion' }, 400);
    }
    const { data, error: rpcError } = await db.rpc('admin_manual_cleanup', {
      p_actor_user_id: user.id, p_action: action, p_request_id: action === 'preview' ? null : requestId,
      p_confirmed: action === 'execute',
    }).abortSignal(AbortSignal.timeout(10000));
    if (rpcError) {
      const errors: Record<string, { status: number; error: string; code: string }> = {
        PCL01: { status: 403, error: 'Admin access is no longer available', code: 'ACCESS_DENIED' },
        PCL02: { status: 404, error: 'Cleanup request was not found for this admin', code: 'NOT_FOUND' },
        PCL03: { status: 409, error: 'Cleanup preview expired or eligible records changed. Review again.', code: 'PREVIEW_CHANGED' },
        PCL04: { status: 400, error: 'Explicit confirmation is required', code: 'CONFIRMATION_REQUIRED' },
        PCL05: { status: 409, error: 'Cleanup configuration changed and requires review', code: 'CONFIGURATION_CHANGED' },
        '55P03': { status: 409, error: 'Cleanup is busy. Check the saved request result.', code: 'BUSY' },
      };
      const known = errors[rpcError.code];
      return known ? reply({ error: known.error, code: known.code }, known.status)
        : reply({ error: 'Cleanup outcome could not be confirmed. Check the saved request result.', code: 'UNCONFIRMED' }, 503);
    }
    if (!data) return reply({ error: 'Cleanup outcome could not be confirmed', code: 'UNCONFIRMED' }, 503);
    return reply(data);
  } catch {
    return reply({ error: 'Cleanup outcome could not be confirmed. Check the saved request result.', code: 'UNCONFIRMED' }, 503);
  }
});
