import { createClient } from '@supabase/supabase-js';
import { DEFAULT_RUN_ID, personas, plusAddress } from './personas.mjs';

const EXPECTED_PROJECT = 'vnywjfpkepjgclkbcmsj';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const inbox = process.env.QG_UAT_INBOX;
const password = process.env.QG_UAT_SHARED_PASSWORD;
const runId = process.env.QG_UAT_RUN_ID || DEFAULT_RUN_ID;
const dryRun = process.argv.includes('--dry-run');

if (!inbox) throw new Error('QG_UAT_INBOX is required');
if (!password || password.length < 16) throw new Error('QG_UAT_SHARED_PASSWORD must be at least 16 characters');
if (!url || !url.includes(EXPECTED_PROJECT)) throw new Error(`Refusing to seed a project other than QuickGuard ${EXPECTED_PROJECT}`);
if (!serviceRoleKey && !dryRun) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

const resolved = personas.map((persona) => ({ ...persona, email: plusAddress(inbox, runId, persona.key) }));

if (dryRun) {
  console.log(JSON.stringify({ runId, project: EXPECTED_PROJECT, personas: resolved.map(({ key, kind, email, verification }) => ({ key, kind, email, verification })) }, null, 2));
  process.exit(0);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'app' },
});

async function must(label, promise) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  throw new Error('Auth user search exceeded 2,000 users');
}

async function ensureAuthUser(persona) {
  const existing = await findUserByEmail(persona.email);
  const attributes = {
    email: persona.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: persona.fullName, user_type: persona.kind, uat_run_id: runId },
    app_metadata: { uat_run_id: runId, uat_persona: persona.key },
  };
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, attributes);
    if (error) throw error;
    return data.user;
  }
  const { data, error } = await supabase.auth.admin.createUser(attributes);
  if (error) throw error;
  return data.user;
}

function entitlement(persona, userId) {
  return {
    user_id: userId,
    plan_slug: persona.planSlug,
    plan_name: persona.planName,
    audience: persona.kind,
    features: { uat: true, run_id: runId },
    monthly_price_pence: 0,
    subscription_status: persona.key === 'client-cancelled' ? 'cancelled' : 'active',
    is_free_tier: true,
    cancel_at_period_end: false,
  };
}

const summary = [];
for (const persona of resolved) {
  const user = await ensureAuthUser(persona);
  await must(`upsert app.users ${persona.key}`, supabase.from('users').upsert({
    id: user.id,
    email: persona.email,
    full_name: persona.fullName,
    user_type: persona.kind,
    phone: '07000000000',
    city: 'Hoddesdon',
    postcode: 'EN11 8HD',
    profile_completed: true,
    verification_status: persona.kind === 'guard' ? persona.verification : 'verified',
    plan_slug: persona.planSlug,
    plan_name: persona.planName,
    subscription_status: persona.key === 'client-cancelled' ? 'cancelled' : 'active',
  }, { onConflict: 'id' }));

  await must(`upsert entitlement ${persona.key}`, supabase.from('user_entitlements_data').upsert(
    entitlement(persona, user.id), { onConflict: 'user_id' }
  ));

  if (persona.kind === 'client') {
    await must(`upsert client ${persona.key}`, supabase.from('clients').upsert({
      id: user.id,
      user_id: user.id,
      company_name: persona.companyName,
      contact_name: persona.fullName,
      first_name: 'UAT',
      last_name: persona.key,
      email: persona.email,
      phone: '07000000000',
      address_line1: '1 Test Street',
      city: 'Hoddesdon',
      postcode: 'EN11 8HD',
      industry: persona.industry,
      client_type: persona.clientType,
      verified: true,
      verification_status: 'verified',
      profile_completed: true,
      onboarding_status: 'completed',
      plan_slug: persona.planSlug,
      plan_name: persona.planName,
      subscription_status: persona.key === 'client-cancelled' ? 'cancelled' : 'active',
      is_active: true,
      is_suspended: false,
      notes: `Synthetic UAT persona ${persona.key}; run ${runId}`,
    }, { onConflict: 'user_id' }));
  } else {
    const isVerified = persona.verification === 'verified';
    const expiry = persona.siaStatus === 'expired' ? '2025-01-01' : '2028-12-31';
    await must(`upsert guard ${persona.key}`, supabase.from('guards').upsert({
      id: user.id,
      user_id: user.id,
      full_name: persona.fullName,
      email: persona.email,
      phone: '07000000000',
      bio: `Synthetic QuickGuard UAT persona ${persona.key}`,
      sia_licence_number: `UAT-${persona.key.toUpperCase()}`,
      sia_licence_type: persona.licenceType,
      licence_types: [persona.licenceType],
      sia_expiry_date: expiry,
      sia_verified: isVerified,
      sia_check_status: persona.siaStatus,
      verification_status: persona.verification,
      verified_at: isVerified ? new Date().toISOString() : null,
      years_experience: 3,
      hourly_rate: 15,
      location: 'Hoddesdon',
      city: 'Hoddesdon',
      postcode: 'EN11 8HD',
      is_active: true,
      profile_completed: true,
      dashboard_access: persona.verification !== 'suspended',
      onboarding_status: 'completed',
      plan_slug: persona.planSlug,
      plan_name: persona.planName,
      subscription_status: 'active',
      stripe_connect_status: 'not_started',
      bank_account_verified: false,
    }, { onConflict: 'user_id' }));
  }
  summary.push({ key: persona.key, kind: persona.kind, userId: user.id, email: persona.email });
}

console.log(JSON.stringify({ runId, createdOrUpdated: summary }, null, 2));

