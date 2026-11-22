import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const PROD_ORIGINS = ['https://quickguard.uk', 'https://www.quickguard.uk'];
const VALID_ROLES = ['super_admin', 'admin', 'finance_admin'];

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_PROFILE_SIZE = 5 * 1024 * 1024;
const MAX_DOC_SIZE = 10 * 1024 * 1024;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CERT_OPTIONS = ['First Aid', 'Fire Safety', 'Conflict Management', 'CCTV Licence', 'Door Supervisor', 'Close Protection', 'Event Security', 'Retail Security'];
const LICENCE_TYPES = ['Door Supervisor', 'Security Guard', 'CCTV Operator', 'Close Protection', 'Key Holding', 'Cash & Valuables'];

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  const allowed = ['guard_creation', 'guard-creation', 'create_guard', 'create-guard', 'guards', 'manage_guards', 'manage-guards', 'guard_management'];
  if (perms && typeof perms === 'object' && !Array.isArray(perms)) {
    return allowed.some((p) => (perms as Record<string, unknown>)[p] === true);
  }
  if (Array.isArray(perms)) {
    return perms.some((p: any) => typeof p === 'string' && allowed.includes(p));
  }
  return false;
}

function json(data: any, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+\-() ]/g, '').trim().slice(0, 30);
}

function normalizeSiaNumber(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 20);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isValidTime(value: string): boolean {
  if (value === '') return true;
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function clampNumber(value: unknown, min: number, max: number, decimals: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

function decodeBase64(dataUrl: unknown): { mimeType: string; bytes: Uint8Array } | null {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const clean = match[2].replace(/\s/g, '');
  if (clean.length === 0 || clean.length % 4 === 1) return null;
  try {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { mimeType: match[1].toLowerCase(), bytes };
  } catch {
    return null;
  }
}

function detectFileType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return 'application/pdf';
  return null;
}

function extensionFor(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'application/pdf') return 'pdf';
  return 'bin';
}

function randomPath(prefix: string, ext: string): string {
  const id = crypto.randomUUID();
  return `${prefix}/${id}.${ext}`;
}

function isUuidLike(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders);
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

  let authUser: { id: string } | null = null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return json({ error: 'Unauthorized' }, 401, corsHeaders);
    }
    authUser = data.user;
  } catch {
    return json({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  if (!authUser) return json({ error: 'Unauthorized' }, 401, corsHeaders);

  if (getAal(token) !== 'aal2') {
    return json({ error: 'Multi-factor authentication required' }, 403, corsHeaders);
  }

  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('id, role, permissions, is_active, email, full_name')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (adminError || !adminUser) {
    return json({ error: 'Admin access required' }, 403, corsHeaders);
  }
  if (!adminUser.is_active) {
    return json({ error: 'Admin access required' }, 403, corsHeaders);
  }
  if (!isPermittedAdmin(adminUser)) {
    return json({ error: 'Admin access required' }, 403, corsHeaders);
  }

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400, corsHeaders);
  }

  const idempotencyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key.trim() : '';
  if (!isUuidLike(idempotencyKey)) {
    return json({ error: 'Missing or invalid idempotency key' }, 400, corsHeaders);
  }

  const { data: existingReq } = await supabase
    .from('admin_guard_creation_requests')
    .select('status, result, guard_user_id, guard_id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existingReq) {
    return json(
      { ...(existingReq.result || {}), idempotent: true, guardId: existingReq.guard_user_id },
      200,
      corsHeaders
    );
  }

  const ALLOWED_FIELDS = new Set([
    'idempotency_key', 'email', 'first_name', 'last_name', 'phone', 'date_of_birth',
    'sia_licence_number', 'license_cardholder_name', 'sia_expiry_date', 'years_experience',
    'hourly_rate', 'city', 'postcode', 'bio', 'available_days', 'available_hours_from',
    'available_hours_to', 'certifications', 'licence_types',
    'profile_image_base64', 'profile_image_name',
    'sia_front_base64', 'sia_front_name',
    'sia_back_base64', 'sia_back_name',
    'sia_supporting_base64', 'sia_supporting_name',
  ]);
  const unexpectedFields = Object.keys(body).filter((k) => !ALLOWED_FIELDS.has(k));
  if (unexpectedFields.length > 0) {
    return json({ error: 'Unexpected fields in request' }, 400, corsHeaders);
  }

  const email = sanitizeText(body.email, 255).toLowerCase();
  const first_name = sanitizeText(body.first_name, 100);
  const last_name = sanitizeText(body.last_name, 100);
  const phone = normalizePhone(typeof body.phone === 'string' ? body.phone : '');
  const date_of_birth = typeof body.date_of_birth === 'string' ? body.date_of_birth.trim() : '';
  const sia_licence_number = normalizeSiaNumber(typeof body.sia_licence_number === 'string' ? body.sia_licence_number : '');
  const license_cardholder_name = sanitizeText(body.license_cardholder_name, 200);
  const sia_expiry_date = typeof body.sia_expiry_date === 'string' ? body.sia_expiry_date.trim() : '';
  const years_experience_raw = body.years_experience;
  const hourly_rate_raw = body.hourly_rate;
  const city = sanitizeText(body.city, 100);
  const postcode = sanitizeText(body.postcode, 20);
  const bio = sanitizeText(body.bio, 500);
  const available_hours_from = typeof body.available_hours_from === 'string' ? body.available_hours_from.trim() : '';
  const available_hours_to = typeof body.available_hours_to === 'string' ? body.available_hours_to.trim() : '';

  if (!email || !isValidEmail(email)) return json({ error: 'A valid email address is required' }, 400, corsHeaders);
  if (!first_name || first_name.length > 100) return json({ error: 'First name is required (max 100 characters)' }, 400, corsHeaders);
  if (!last_name || last_name.length > 100) return json({ error: 'Last name is required (max 100 characters)' }, 400, corsHeaders);
  if (sia_licence_number.length < 8 || sia_licence_number.length > 20) return json({ error: 'A valid SIA licence number is required' }, 400, corsHeaders);
  if (!isValidDate(sia_expiry_date)) return json({ error: 'A valid SIA licence expiry date is required' }, 400, corsHeaders);
  if (new Date(sia_expiry_date + 'T00:00:00Z') < new Date()) return json({ error: 'SIA licence expiry date must be in the future' }, 400, corsHeaders);
  if (date_of_birth && !isValidDate(date_of_birth)) return json({ error: 'Invalid date of birth' }, 400, corsHeaders);
  if (date_of_birth && new Date(date_of_birth + 'T00:00:00Z') > new Date()) return json({ error: 'Date of birth cannot be in the future' }, 400, corsHeaders);
  if (!isValidTime(available_hours_from)) return json({ error: 'Invalid available-from time' }, 400, corsHeaders);
  if (!isValidTime(available_hours_to)) return json({ error: 'Invalid available-to time' }, 400, corsHeaders);

  const years_experience = years_experience_raw === '' || years_experience_raw === null || years_experience_raw === undefined
    ? null
    : clampNumber(years_experience_raw, 0, 60, 0);
  if (years_experience_raw !== '' && years_experience_raw !== null && years_experience_raw !== undefined && years_experience === null) {
    return json({ error: 'Years of experience must be a whole number between 0 and 60' }, 400, corsHeaders);
  }

  const hourly_rate = hourly_rate_raw === '' || hourly_rate_raw === null || hourly_rate_raw === undefined
    ? null
    : clampNumber(hourly_rate_raw, 0, 10000, 2);
  if (hourly_rate_raw !== '' && hourly_rate_raw !== null && hourly_rate_raw !== undefined && hourly_rate === null) {
    return json({ error: 'Hourly rate must be a number between 0 and 10000' }, 400, corsHeaders);
  }

  function validateStringArray(value: unknown, allowed: string[], maxItems: number): string[] | null {
    if (value === null || value === undefined) return null;
    if (!Array.isArray(value)) return null;
    if (value.length > maxItems) return null;
    const items = value.filter((v) => typeof v === 'string' && allowed.includes(v));
    return items.length > 0 ? items : null;
  }

  const available_days = validateStringArray(body.available_days, DAYS, 7);
  const certifications = validateStringArray(body.certifications, CERT_OPTIONS, 20);
  const licence_types = validateStringArray(body.licence_types, LICENCE_TYPES, 10);

  if (Array.isArray(body.available_days) && body.available_days.length > 0 && !available_days) {
    return json({ error: 'Invalid available days' }, 400, corsHeaders);
  }

  const now = new Date().toISOString();
  const fullName = `${first_name} ${last_name}`.trim();

  const { data: existingGuardByEmail } = await supabase
    .from('guards')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  const { data: existingGuardBySia } = await supabase
    .from('guards')
    .select('id')
    .eq('sia_licence_number', sia_licence_number)
    .maybeSingle();

  if (existingGuardByEmail || existingGuardBySia) {
    return json({ error: 'A guard account with these details already exists' }, 409, corsHeaders);
  }

  const createdResources = { user: false, storagePaths: [] as { bucket: string; path: string }[], guard: false, subscription: false, entitlement: false, notificationPrefs: false };
  let userId: string | null = null;
  let guardId: string | null = null;

  async function cleanup() {
    if (createdResources.user && userId) {
      await supabase.auth.admin.deleteUser(userId).catch(() => {});
    }
    const storageClient = createClient(supabaseUrl!, supabaseServiceKey!);
    for (const obj of createdResources.storagePaths) {
      await storageClient.storage.from(obj.bucket).remove([obj.path]).catch(() => {});
    }
    if (createdResources.guard && userId) {
      await supabase.from('guards').delete().eq('user_id', userId).catch(() => {});
    }
    if (createdResources.subscription && userId) {
      await supabase.from('subscriptions').delete().eq('user_id', userId).catch(() => {});
    }
    if (createdResources.entitlement && userId) {
      await supabase.from('user_entitlements_data').delete().eq('user_id', userId).catch(() => {});
    }
    if (createdResources.notificationPrefs && userId) {
      await supabase.from('notification_preferences').delete().eq('user_id', userId).catch(() => {});
    }
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: {
        role: 'guard',
        first_name,
        last_name,
        email,
      },
    });

    if (userError) {
      if (userError.message?.toLowerCase().includes('already') || userError.message?.toLowerCase().includes('exists')) {
        return json({ error: 'A guard account with these details already exists' }, 409, corsHeaders);
      }
      throw new Error('Failed to create user');
    }

    userId = userData.user.id;
    createdResources.user = true;

    const storageClient = createClient(supabaseUrl, supabaseServiceKey);

    async function uploadDocument(base64: unknown, label: string, allowedTypes: string[], maxSize: number, bucket: string, subfolder: string): Promise<string | null> {
      if (base64 === null || base64 === undefined || base64 === '') return null;
      const decoded = decodeBase64(base64);
      if (!decoded) throw new Error(`${label} is not a valid file`);
      const detected = detectFileType(decoded.bytes);
      if (!detected || !allowedTypes.includes(detected)) throw new Error(`${label} has an unsupported file type`);
      if (decoded.bytes.length > maxSize) throw new Error(`${label} exceeds the maximum file size`);
      const ext = extensionFor(detected);
      const filePath = randomPath(`${userId}/${subfolder}`, ext);
      const { error: uploadErr } = await storageClient.storage
        .from(bucket)
        .upload(filePath, decoded.bytes, {
          contentType: detected,
          cacheControl: '3600',
          upsert: false,
        });
      if (uploadErr) throw new Error(`${label} could not be uploaded`);
      createdResources.storagePaths.push({ bucket, path: filePath });
      return filePath;
    }

    const profileImagePath = await uploadDocument(body.profile_image_base64, 'Profile image', ALLOWED_IMAGE_TYPES, MAX_PROFILE_SIZE, 'guard-profiles', 'profile');
    const siaFrontPath = await uploadDocument(body.sia_front_base64, 'SIA front', ALLOWED_DOC_TYPES, MAX_DOC_SIZE, 'sia-licences', 'sia');
    const siaBackPath = await uploadDocument(body.sia_back_base64, 'SIA back', ALLOWED_DOC_TYPES, MAX_DOC_SIZE, 'sia-licences', 'sia');
    const siaSupportingPath = await uploadDocument(body.sia_supporting_base64, 'Supporting document', ALLOWED_DOC_TYPES, MAX_DOC_SIZE, 'sia-licences', 'sia');

    const guardRecord: Record<string, any> = {
      user_id: userId,
      email,
      full_name: fullName,
      phone: phone || null,
      date_of_birth: date_of_birth || null,
      sia_licence_number,
      license_cardholder_name: license_cardholder_name || fullName,
      sia_expiry_date: sia_expiry_date || null,
      years_experience,
      hourly_rate,
      location: city || null,
      city: city || null,
      postcode: postcode || null,
      bio: bio || null,
      available_days,
      available_hours_from: available_hours_from || null,
      available_hours_to: available_hours_to || null,
      certifications,
      licence_types,
      profile_completed: true,
      subscription_status: 'incomplete',
      verification_status: 'manual_review',
      sia_verified: false,
      is_active: false,
      dashboard_access: false,
      verified_at: null,
      onboarding_status: 'provisioned',
      availability_status: 'available',
      accepts_direct_bookings: true,
      created_at: now,
      updated_at: now,
    };

    if (profileImagePath) guardRecord.profile_image_path = profileImagePath;
    if (siaFrontPath) guardRecord.sia_licence_front_path = siaFrontPath;
    if (siaBackPath) guardRecord.sia_licence_back_path = siaBackPath;
    if (siaSupportingPath) guardRecord.sia_supporting_document_path = siaSupportingPath;

    const { data: createdGuard, error: guardError } = await supabase.from('guards').insert(guardRecord).select('id').maybeSingle();
    if (guardError || !createdGuard) {
      throw new Error('Failed to create guard profile');
    }
    guardId = createdGuard.id;
    createdResources.guard = true;

    const { error: subError } = await supabase.from('subscriptions').insert({
      user_id: userId,
      status: 'active',
      plan_slug: 'guard_starter',
      plan_name: 'Free Starter',
      billing_cycle: 'monthly',
      auto_renew: false,
      payment_failure_count: 0,
      account_type: 'guard',
      created_at: now,
      updated_at: now,
    });
    if (subError) throw new Error('Failed to create subscription');
    createdResources.subscription = true;

    const { error: entError } = await supabase.from('user_entitlements_data').insert({
      user_id: userId,
      plan_slug: 'guard_starter',
      plan_name: 'Free Starter',
      audience: 'guard',
      features: ['guard.apply_job', 'guard.view_jobs', 'guard.create_profile', 'guard.advanced_alerts'],
      monthly_price_pence: 0,
      subscription_status: 'active',
      is_free_tier: true,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
    if (entError) throw new Error('Failed to create entitlements');
    createdResources.entitlement = true;

    const { error: notifError } = await supabase.from('notification_preferences').insert({
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
    if (notifError) throw new Error('Failed to create notification preferences');
    createdResources.notificationPrefs = true;

    await supabase.from('notifications').insert({
      user_id: userId,
      user_type: 'guard',
      type: 'account_created',
      title: 'Account created — pending review',
      message: 'Your guard account has been created. Our team is reviewing your details and SIA licence before you can start accepting jobs.',
      is_read: false,
      link: '/guard/dashboard',
      created_at: now,
    }).catch(() => {});

    await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        user_id: userId,
        account_type: 'guard',
        user_email: email,
        user_name: fullName,
      }),
    }).catch(() => {});

    await supabase.from('admin_activity_log').insert({
      admin_user_id: adminUser.id,
      admin_username: adminUser.email,
      admin_name: adminUser.full_name,
      action_type: 'guard_created',
      action_description: `Created guard account for ${fullName} (pending review)`,
      target_type: 'guard',
      target_name: fullName,
      metadata: {
        guard_user_id: userId,
        guard_id: guardId,
        email,
        sia_licence_number,
        idempotency_key: idempotencyKey,
        result: 'success',
      },
      created_at: now,
    }).catch(() => {});

    const result = {
      success: true,
      guardId: userId,
      guard_record_id: guardId,
      email,
      status: 'pending_review',
      message: 'Guard created. They will appear in Guard Verifications for review.',
    };

    await supabase.from('admin_guard_creation_requests').insert({
      idempotency_key: idempotencyKey,
      admin_user_id: adminUser.id,
      email,
      status: 'completed',
      guard_user_id: userId,
      guard_id: guardId,
      result,
      created_at: now,
      updated_at: now,
    }).catch(() => {});

    return json(result, 200, corsHeaders);
  } catch (err) {
    const msg = err && typeof err === 'object' && 'message' in err ? (err as Error).message : 'Unknown error';
    await cleanup();
    return json({ error: msg || 'Failed to create guard' }, 500, corsHeaders);
  }
});
