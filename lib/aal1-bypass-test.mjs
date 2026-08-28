import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://vnywjfpkepjgclkbcmsj.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_sQ_UMgDtGLjb0cDtg6Cslg_8ij5ycRT';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

function logSection(title) {
  console.log('\n' + '='.repeat(72));
  console.log('  ' + title);
  console.log('='.repeat(72));
}

function summarize(label, status, bodyText) {
  let snippet = bodyText;
  try {
    const j = JSON.parse(bodyText);
    snippet = JSON.stringify(j).slice(0, 200);
  } catch {
    snippet = (bodyText || '').slice(0, 200);
  }
  console.log(`\n[${label}]`);
  console.log(`  HTTP ${status}`);
  console.log(`  body: ${snippet}`);
  return { label, status, snippet };
}

async function rawFetch(path, { method = 'GET', token, headers = {}, body } = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error(
      'Missing credentials. Set ADMIN_EMAIL and ADMIN_PASSWORD env vars:\n' +
        '  ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=*** node lib/aal1-bypass-test.mjs'
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  logSection('1. Sign in (password only) — expect aal1 session');
  const { data: signIn, error: signInErr } =
    await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

  if (signInErr || !signIn.session) {
    console.error('Sign in failed:', signInErr?.message || 'no session');
    process.exit(1);
  }

  const token = signIn.session.access_token;
  const userId = signIn.session.user.id;

  const { data: aal, error: aalErr } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentLevel = aal?.currentLevel ?? 'unknown';
  const nextLevel = aal?.nextLevel ?? 'unknown';

  console.log(`  user_id:      ${userId}`);
  console.log(`  email:        ${signIn.session.user.email}`);
  console.log(`  current aal:  ${currentLevel}`);
  console.log(`  next aal:     ${nextLevel}`);

  if (currentLevel === 'aal2') {
    console.log(
      '\n  ⚠️  Session is already aal2 — this admin is NOT MFA-enrolled, so the\n' +
        '  bypass test is not meaningful. Enroll MFA first, then rerun.'
    );
  } else {
    console.log(
      '\n  ✅  Session is aal1. The following requests use ONLY this aal1 token.'
    );
  }

  const results = [];

  logSection('2. Table SELECTs (RLS) — aal1 token');

  const selects = [
    { label: 'admin_users (self/admin read)', path: '/rest/v1/admin_users?select=id,email,role&limit=5' },
    { label: 'settings', path: '/rest/v1/settings?select=key,value&limit=20' },
    { label: 'guards', path: '/rest/v1/guards?select=id,first_name,verification_status&limit=5' },
    { label: 'jobs', path: '/rest/v1/jobs?select=id,title&limit=5' },
    { label: 'clients', path: '/rest/v1/clients?select=id&limit=5' },
    { label: 'users', path: '/rest/v1/users?select=id,email&limit=5' },
    { label: 'admin_activity_log', path: '/rest/v1/admin_activity_log?select=*&limit=5' },
    { label: 'subscriptions', path: '/rest/v1/subscriptions?select=id&limit=5' },
  ];

  for (const s of selects) {
    const { status, text } = await rawFetch(s.path, { token });
    results.push(summarize(s.label, status, text));
  }

  logSection('3. RPC calls (SECURITY DEFINER helpers)');

  const rpcs = [
    { label: 'is_active_admin()', path: '/rest/v1/rpc/is_active_admin', method: 'POST' },
    { label: 'is_admin_safe()', path: '/rest/v1/rpc/is_admin_safe', method: 'POST' },
  ];
  for (const r of rpcs) {
    const { status, text } = await rawFetch(r.path, { method: r.method, token });
    results.push(summarize(r.label, status, text));
  }

  {
    const label = `is_admin('${userId}')`;
    const { status, text } = await rawFetch('/rest/v1/rpc/is_admin', {
      method: 'POST',
      token,
      body: { user_uuid: userId },
    });
    results.push(summarize(label, status, text));
  }

  logSection('4. Storage (list buckets + objects)');

  {
    const { status, text } = await rawFetch('/storage/v1/bucket', { token });
    results.push(summarize('list buckets', status, text));

    let buckets = [];
    try {
      buckets = JSON.parse(text);
    } catch {}
    for (const b of (Array.isArray(buckets) ? buckets : []).slice(0, 3)) {
      const { status: st, text: tx } = await rawFetch(
        `/storage/v1/object/list/${b.name}?limit=3`,
        { token }
      );
      results.push(summarize(`list objects in bucket "${b.name}"`, st, tx));
    }
  }

  logSection('5. Edge Functions (aal2-enforced)');

  const fns = [
    { label: 'admin-guards', path: '/functions/v1/admin-guards', body: {} },
    { label: 'admin-jobs', path: '/functions/v1/admin-jobs', body: {} },
    { label: 'admin-system-status', path: '/functions/v1/admin-system-status', body: {} },
    { label: 'get-storage-usage', path: '/functions/v1/get-storage-usage', body: {} },
  ];

  for (const f of fns) {
    const { status, text } = await rawFetch(f.path, {
      method: 'POST',
      token,
      body: f.body,
    });
    results.push(summarize(f.label, status, text));
  }

  logSection('SUMMARY (observed, not reasoned)');
  for (const r of results) {
    const flag =
      r.status === 200 && (r.snippet.startsWith('[]') || r.snippet === 'false')
        ? '  → filtered/denied (200 empty or false)'
        : r.status >= 400
        ? '  → rejected'
        : '  → ALLOWED';
    console.log(`  ${r.label.padEnd(40)} HTTP ${r.status}${flag}`);
  }

  console.log(
    '\nNote: PostgREST RLS denies SELECT by returning HTTP 200 with an empty [].\n' +
      '      A non-empty body means the aal1 token actually READ that resource.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});