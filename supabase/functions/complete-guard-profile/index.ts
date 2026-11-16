import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const productionOrigin = 'https://quickguard.uk';

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = /^https:\/\/(www\.)?quickguard\.uk$/.test(origin)
    || /^https:\/\/([\w-]+\.)*readdy\.ai$/.test(origin)
    || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin ? origin : productionOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' });

  try {
    const token = req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return reply(401, { error: 'Please sign in again.' });

    const url = Deno.env.get('SUPABASE_URL')!;
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      db: { schema: 'app' },
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser(token);
    if (authError || !user || user.is_anonymous) return reply(401, { error: 'Please sign in again.' });

    const input = await req.json().catch(() => null);
    if (!input || typeof input.updatedAt !== 'string' || Object.keys(input).length !== 1) {
      return reply(400, { error: 'Invalid profile submission.' });
    }

    const { data: guard, error: guardError } = await caller.from('guards')
      .select('id,profile_completed,updated_at,full_name,phone,sia_licence_number,license_cardholder_name,sia_expiry_date,years_experience,hourly_rate,certifications,available_days,available_hours_from,available_hours_to,bio,sia_licence_front_url,sia_licence_back_url,driving_licence_front_url,driving_licence_back_url,proof_of_address_url')
      .eq('user_id', user.id).maybeSingle();
    if (guardError || !guard) return reply(403, { error: 'Unable to access your guard profile.' });
    if (guard.profile_completed === true) return reply(200, { success: true });

    const retryMessage = 'Your profile changed while it was being submitted. Please try again.';
    if (guard.updated_at !== input.updatedAt) return reply(409, { error: retryMessage });
    if (!guard.full_name?.trim() || !guard.sia_licence_number?.trim() || !guard.sia_expiry_date) {
      return reply(400, { error: 'Enter your name, SIA licence number and expiry date.' });
    }

    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      db: { schema: 'app' },
      auth: { persistSession: false },
    });
    const { data: fields, error: fieldsError } = await service.from('wizard_fields')
      .select('field_key,field_label,is_required')
      .eq('wizard_type', 'guard_profile').eq('is_enabled', true);
    if (fieldsError || !fields?.length) return reply(503, { error: 'Profile configuration unavailable.' });
    const [firstName, ...lastName] = guard.full_name.trim().split(/\s+/);
    const fieldValues = new Map<string, unknown>([
      ['first_name', firstName], ['last_name', lastName.join(' ')],
      ['phone', guard.phone], ['sia_licence_number', guard.sia_licence_number],
      ['license_cardholder_name', guard.license_cardholder_name], ['sia_expiry_date', guard.sia_expiry_date],
      ['years_experience', guard.years_experience], ['hourly_rate', guard.hourly_rate],
      ['certifications', guard.certifications], ['available_days', guard.available_days],
      ['available_hours_from', guard.available_hours_from], ['available_hours_to', guard.available_hours_to],
      ['bio', guard.bio],
    ]);
    for (const field of fields) {
      if (!field.is_required) continue;
      if (!fieldValues.has(field.field_key)) return reply(503, { error: 'Unsupported profile configuration.' });
      const value = fieldValues.get(field.field_key);
      if (value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length)) {
        return reply(400, { error: `${field.field_label} is required.` });
      }
    }

    const documents = [
      { bucket: 'sia-licences', path: guard.sia_licence_front_url, prefix: 'front-' },
      { bucket: 'sia-licences', path: guard.sia_licence_back_url, prefix: 'back-' },
      { bucket: 'guard-documents', path: guard.driving_licence_front_url, prefix: 'front-' },
      { bucket: 'guard-documents', path: guard.driving_licence_back_url, prefix: 'back-' },
      { bucket: 'guard-documents', path: guard.proof_of_address_url, prefix: 'poa-' },
    ];
    const documentChecks = await Promise.all(documents.map(async ({ bucket, path, prefix }) => {
      const [folder, filename, extra] = (path || '').split('/');
      if (folder !== user.id || !filename?.startsWith(prefix) || extra !== undefined) return false;
      const { data, error } = await service.storage.from(bucket).list(folder, { search: filename });
      if (error) throw error;
      return data.some(object => object.name === filename && object.id);
    }));
    if (!documentChecks.every(Boolean)) {
      return reply(400, { error: 'Upload both sides of your SIA and driving licences and your proof of address.' });
    }

    const { data: entitlement, error: entitlementError } = await caller.rpc('ensure_my_free_entitlement');
    if (entitlementError || !entitlement?.length) {
      return reply(409, { error: 'Unable to prepare guard access. Please try again.' });
    }

    const update = service.from('guards')
      .update({ profile_completed: true, onboarding_status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', guard.id).eq('user_id', user.id).eq('updated_at', guard.updated_at);
    const { data: completed, error: saveError } = await (
      guard.profile_completed === null ? update.is('profile_completed', null) : update.eq('profile_completed', false)
    ).select('id').maybeSingle();
    if (saveError) throw saveError;
    if (!completed) return reply(409, { error: retryMessage });
    return reply(200, { success: true });
  } catch (error) {
    console.error('[complete-guard-profile] Completion failed', error instanceof Error ? error.name : 'backend error');
    return reply(500, { error: 'Unable to complete your profile. Please try again.' });
  }
});
