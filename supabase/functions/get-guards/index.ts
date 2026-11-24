import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const PROD_ORIGINS = ['https://quickguard.uk', 'https://www.quickguard.uk'];

const VALID_ROLES = ['super_admin', 'admin', 'finance_admin'];

const ALLOWED_STATUSES = ['all', 'pending', 'approved', 'rejected', 'suspended', 'manual_review', 'verified'];

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

const GUARD_FIELDS = [
  'id', 'user_id', 'full_name', 'email', 'phone', 'date_of_birth',
  'sia_licence_number', 'license_cardholder_name', 'sia_expiry_date',
  'sia_licence_front_url', 'sia_licence_back_url', 'sia_licence_uploaded_at',
  'driving_licence_front_url', 'driving_licence_back_url', 'driving_licence_uploaded_at',
  'proof_of_address_url', 'proof_of_address_uploaded_at',
  'years_experience', 'hourly_rate', 'certifications', 'available_days',
  'available_hours_from', 'available_hours_to', 'bio', 'profile_image_url',
  'profile_completed', 'created_at', 'updated_at', 'rejection_reason',
  'rejected_at', 'verified_at', 'verification_status', 'sia_check_status',
  'sia_checked_at', 'sia_scraped_name', 'sia_scraped_status',
  'sia_confidence_score', 'sia_mismatch_reason', 'sia_raw_result_json',
  'sia_verification_details', 'location', 'postcode', 'city',
  'willing_to_travel', 'has_transport', 'max_distance_miles', 'licence_types',
  'sia_licence_type', 'sia_scraped_licence_type', 'sia_scraped_expiry_date',
  'sia_verified', 'sia_verified_at', 'stripe_connect_status',
  'stripe_connect_restricted_reason', 'stripe_connect_onboarded_at',
  'stripe_connect_verified_at', 'subscription_plan', 'subscription_status',
  'plan_name', 'plan_slug', 'total_jobs_completed', 'total_earnings',
  'rating', 'total_reviews', 'is_active', 'dashboard_access', 'verified_by',
  'promo_tier', 'signup_number', 'nudge_sent_at', 'onboarding_status',
  'founding_badge',
].join(',');

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (origin === 'https://readdy.ai' || origin.endsWith('.readdy.ai')) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

function buildCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin! : PROD_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function getAal(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(base64 + pad)).aal || null;
  } catch {
    return null;
  }
}

function isPermittedAdmin(admin: any): boolean {
  if (!admin) return false;
  if (typeof admin.role === 'string' && VALID_ROLES.includes(admin.role)) return true;
  const perms = admin.permissions;
  if (perms && typeof perms === 'object' && !Array.isArray(perms)) {
    if (
      perms.guard_verification === true ||
      perms['guard-verification'] === true ||
      perms.guards === true ||
      perms.verify_guards === true
    ) {
      return true;
    }
  }
  if (Array.isArray(perms)) {
    const allowed = ['guard_verification', 'guard-verification', 'guards', 'verify_guards'];
    return perms.some((p: any) => typeof p === 'string' && allowed.includes(p));
  }
  return false;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function json(data: any, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'Method not allowed. Use GET or POST.' }, 405, corsHeaders);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ error: 'Server configuration error' }, 500, corsHeaders);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const token = authHeader.slice(7).trim();
  if (!token || token === Deno.env.get('SUPABASE_ANON_KEY')) {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  let user: { id: string } | null = null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return json({ error: 'Unauthorized' }, 401, corsHeaders);
    }
    user = data.user;
  } catch {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  if (getAal(token) !== 'aal2') {
    return json({ error: 'MFA required' }, 403, corsHeaders);
  }

  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('id, role, is_active, permissions')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminError || !adminUser) {
    return json({ error: 'Admin access required' }, 403, corsHeaders);
  }

  if (!adminUser.is_active) {
    return json({ error: 'Account not active' }, 403, corsHeaders);
  }

  if (!isPermittedAdmin(adminUser)) {
    return json({ error: 'Admin access required' }, 403, corsHeaders);
  }

  try {
    let status = 'pending';
    let incompleteOnly = false;
    let page = 1;
    let pageSize = DEFAULT_PAGE_SIZE;

    if (req.method === 'POST') {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        body = {};
      }
      if (typeof body.status === 'string') status = body.status;
      if (body.incompleteOnly === true) incompleteOnly = true;
      page = clampInt(body.page, 1, 1000000, 1);
      pageSize = clampInt(body.pageSize, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
    } else {
      const url = new URL(req.url);
      const qs = url.searchParams.get('status');
      if (qs && typeof qs === 'string') status = qs;
      if (url.searchParams.get('incomplete') === 'true') incompleteOnly = true;
      page = clampInt(url.searchParams.get('page'), 1, 1000000, 1);
      pageSize = clampInt(url.searchParams.get('pageSize'), 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return json({ error: 'Invalid status filter' }, 400, corsHeaders);
    }

    let query = supabase.from('guards').select(GUARD_FIELDS, { count: 'exact' });

    if (status === 'pending') {
      query = query.in('verification_status', ['pending', 'manual_review', 'pending_sia_check']);
    } else if (status === 'approved') {
      query = query.in('verification_status', ['approved', 'verified']);
    } else if (status === 'suspended') {
      query = query.eq('verification_status', 'suspended');
    } else if (status === 'rejected') {
      query = query.eq('verification_status', 'rejected');
    } else if (status === 'manual_review') {
      query = query.eq('verification_status', 'manual_review');
    } else if (status === 'verified') {
      query = query.eq('verification_status', 'verified');
    }

    if (incompleteOnly) {
      query = query.eq('profile_completed', false);
    }

    // Break timestamp ties so adjacent API pages cannot reshuffle equal-date guards.
    query = query.order('created_at', { ascending: false }).order('id', { ascending: false });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: guards, error: queryError, count } = await query;

    if (queryError) {
      return json({ error: queryError.message }, 500, corsHeaders);
    }

    return json(
      {
        success: true,
        totalCount: count ?? (guards ? guards.length : 0),
        page,
        pageSize,
        count: guards ? guards.length : 0,
        data: guards || [],
      },
      200,
      corsHeaders
    );
  } catch (err) {
    const msg = err && typeof err === 'object' && 'message' in err ? (err as Error).message : String(err);
    return json({ error: msg || 'Unknown error' }, 500, corsHeaders);
  }
});
