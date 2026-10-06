import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { authorizePromoCaller } from '../_shared/promo-auth.ts';

// Promotional tier allocation for a newly approved guard.
// Callable ONLY by the backend (service-role bearer, e.g. admin-verify-guard) or an
// active QuickGuard administrator. Anonymous callers, guards and clients are
// rejected before any privileged client is created. Allocation itself is atomic,
// idempotent and eligibility-checked in app.assign_guard_promo_tier.

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const ERRORS: Record<string, [number, string]> = {
  invalid_request: [400, 'guardId is required'],
  guard_not_found: [404, 'Guard not found'],
  guard_not_eligible: [409, 'Guard is not approved and active'],
  config_missing: [503, 'Promotion configuration is missing; no tier was assigned'],
  write_conflict: [409, 'Guard promotion changed concurrently; retry'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) return json({ error: 'Server configuration error' }, 500);

  const auth = await authorizePromoCaller(req.headers.get('Authorization'), supabaseServiceKey, async (token: string) => {
    // Only reached for non-service tokens: verify the user and their admin role.
    const verifier = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' }, auth: { persistSession: false } });
    const { data: userData, error: userError } = await verifier.auth.getUser(token);
    if (userError || !userData?.user) return false;
    const { data: admin, error: adminError } = await verifier.from('admin_users')
      .select('id, role, is_active').eq('user_id', userData.user.id).eq('is_active', true).maybeSingle();
    return !adminError && !!admin && ['super_admin', 'admin'].includes(admin.role);
  });
  if (!auth.ok) return json({ error: auth.error || 'Unauthorized' }, auth.status || 401);

  let guardId: unknown;
  try { ({ guardId } = await req.json()); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  if (typeof guardId !== 'string' || !/^[0-9a-f-]{36}$/i.test(guardId)) return json({ error: 'guardId is required' }, 400);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });
  // Caller-supplied dates are ignored; the database uses its own records.
  const { data: result, error } = await supabase.rpc('assign_guard_promo_tier', { p_guard_id: guardId });
  if (error || !result?.success) {
    const code = /qg_promo:([a-z_]+)/.exec(error?.message || '')?.[1];
    const [status, message] = (code && ERRORS[code]) || [500, 'Unable to assign promotion tier'];
    if (!code) console.error('[assign-guard-promo-tier] Allocation failed:', error?.code, error?.message);
    return json({ error: message, code: code || 'allocation_failed' }, status);
  }

  if (result.newlyAssigned) {
    try {
      const { data: guardData } = await supabase.from('guards').select('full_name, email').eq('id', guardId).maybeSingle();
      if (guardData?.email) {
        await fetch(`${supabaseUrl}/functions/v1/send-guard-promo-welcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
          body: JSON.stringify({
            guardId, guardName: guardData.full_name, guardEmail: guardData.email,
            tier: result.tier, signupNumber: result.signupNumber, promoEndsAt: result.promoEndsAt, lifetimeFee: result.lifetimeFee,
          }),
        });
      }
    } catch (emailErr) {
      console.error('Promo welcome email failed:', emailErr);
    }
  }

  return json(result, 200);
});
