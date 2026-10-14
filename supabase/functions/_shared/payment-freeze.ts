import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { shouldBlockStripeOperation } from './payment-freeze-policy.mjs';

type CorsHeaders = Record<string, string>;

/**
 * Stops Stripe operations while the admin-controlled emergency payment freeze
 * is active. A settings lookup or configuration failure fails closed.
 */
export async function paymentFreezeResponse(
  method: string,
  corsHeaders: CorsHeaders = {},
): Promise<Response | null> {
  if (method.toUpperCase() === 'OPTIONS') return null;

  let settingValue: string | undefined;
  let queryFailed = false;
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Payment freeze settings are unavailable');
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      db: { schema: 'app' },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db
      .from('settings')
      .select('value')
      .eq('key', 'emergency_disable_payments')
      .maybeSingle();

    if (error) throw error;
    settingValue = data?.value;
  } catch {
    console.error('[payment-freeze] Settings lookup failed; blocking Stripe operation');
    queryFailed = true;
  }

  if (!shouldBlockStripeOperation(settingValue, queryFailed)) return null;

  return new Response(JSON.stringify({
    error: 'Payments are temporarily paused',
    code: 'payments_paused',
  }), {
    status: 503,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Retry-After': '60',
    },
  });
}
