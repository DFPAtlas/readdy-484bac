import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
const headers = { 'Access-Control-Allow-Origin': 'https://quickguard.uk', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const allowed = new Set(['first_name','last_name','phone','company_name','industry','company_size','website','address_line1','address_line2','city','postcode','billing_email','vat_number','preferred_contact_method','security_needs','hear_about_us','additional_notes']);
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, db: { schema: 'app' },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return reply(401, { error: 'Please sign in again.' });
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'app' } });
    const { data: profile, error: profileError } = await service.from('clients').select('id').eq('user_id', user.id).maybeSingle();
    if (profileError || !profile) return reply(403, { error: 'No client profile exists for this account.' });
    const input = await req.json();
    if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400, { error: 'Invalid profile data.' });
    if (Object.keys(input).some(key => !allowed.has(key))) return reply(400, { error: 'Unsupported profile field.' });
    const { data: fields, error: fieldsError } = await service.from('wizard_fields').select('field_key,field_label,is_required,field_type').eq('wizard_type','client_profile').eq('is_enabled',true);
    if (fieldsError || !fields?.length) return reply(503, { error: 'Profile configuration unavailable.' });
    const updates: Record<string, unknown> = {};
    for (const field of fields) {
      if (!allowed.has(field.field_key)) return reply(503, { error: 'Unsupported profile configuration.' });
      let value = input[field.field_key];
      if (typeof value === 'string') value = value.trim();
      if (field.is_required && (value == null || value === '' || (Array.isArray(value) && !value.length)))
        return reply(400, { error: field.field_label + ' is required.' });
      if (value !== undefined) {
        if (field.field_key === 'security_needs') {
          if (!Array.isArray(value) || value.some((item: unknown) => typeof item !== 'string' || item.length > 500))
            return reply(400, { error: 'Invalid security needs.' });
        } else if (value !== null && typeof value !== 'string') return reply(400, { error: 'Invalid ' + field.field_label + '.' });
        if (typeof value === 'string' && value.length > 2000) return reply(400, { error: field.field_label + ' is too long.' });
        if (field.field_type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          return reply(400, { error: 'Enter a valid ' + field.field_label + '.' });
        updates[field.field_key] = value === '' ? null : value;
      }
    }
    // The existing owner-scoped RPC provisions free access without altering paid plans.
    const { error: entitlementError } = await caller.rpc('ensure_my_free_entitlement');
    if (entitlementError) return reply(409, { error: 'Unable to prepare client access. Please try again.' });
    const { data: saved, error: saveError } = await service.from('clients')
      .update({ ...updates, profile_completed: true, onboarding_status: 'completed' })
      .eq('user_id', user.id).select('id').maybeSingle();
    if (saveError || !saved) return reply(409, { error: 'Unable to save your profile. Please try again.' });
    return reply(200, { success: true });
  } catch { return reply(400, { error: 'Unable to process profile data.' }); }
});
