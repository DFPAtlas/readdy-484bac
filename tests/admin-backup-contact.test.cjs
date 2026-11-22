const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('./helpers/enterprise-module.cjs');
const { hooksHarness, nodes, content } = require('./helpers/guard-ui-fixture.cjs');
const { assessBackup } = load('supabase/functions/_shared/backup-health.ts');
const now = Date.parse('2026-11-21T12:00:00Z');
const current = { status: 'healthy', last_backup_at: '2026-11-20T12:00:00Z', last_restore_test_at: '2026-11-18T12:00:00Z', retention_days: 7 };

test('recorded backup health expires at the retention boundary and rejects missing/invalid evidence', () => {
  assert.equal(assessBackup(current, now).status, 'healthy');
  assert.equal(assessBackup({ ...current, last_backup_at: '2026-11-14T12:00:00Z' }, now).status, 'healthy');
  assert.equal(assessBackup({ ...current, last_backup_at: '2026-11-14T11:59:59Z' }, now).label, 'Stale Record');
  for (const patch of [{ last_backup_at: null }, { last_backup_at: 'invalid' }, { last_backup_at: '2026-11-22' }, { retention_days: null }, { retention_days: 0 }, { last_restore_test_at: null }, { last_restore_test_at: 'invalid' }, { status: 'warning' }]) {
    assert.equal(assessBackup({ ...current, ...patch }, now).status, 'warning');
  }
  assert.equal(assessBackup({ ...current, status: 'critical' }, now).status, 'critical');
});

test('backup panel and overall score reject stale healthy flags; loading and errors never claim missing setup', () => {
  const backup = { ...current, backup_type: 'Database Backup', last_backup_at: '2026-06-30', notes: null };
  const props = { backupComplianceData: { backups: [backup], compliance: [] }, fetchState: 'idle', onRetry() {} };
  const panel = load('app/admin/security/BackupCompliancePanel.tsx', { '@/lib/supabase': { supabase: {} } }).default;
  assert.match(content(panel(props)), /Stale Record/);
  assert.match(content(panel(props)), /independent verification/);
  assert.doesNotMatch(content(panel({ ...props, fetchState: 'loading' })), /not configured|Stale Record/);
  const failed = panel({ ...props, fetchState: 'error' });
  assert(nodes(failed).some(n => n.props?.role === 'alert'));
  assert(nodes(failed).some(n => n.type === 'button' && n.props.onClick === props.onRetry));
  const score = load('app/admin/security/OverallHealthScore.tsx').default({ ...props, stats: {} });
  const cards = nodes(score).filter(n => n.props?.children && content(n).startsWith('Backups'));
  assert(cards.some(n => content(n).includes('0%')));
});

function endpoint(file, db) {
  let handler;
  load(file, { 'https://esm.sh/@supabase/supabase-js@2.39.3': { createClient: () => db } }, {
    Deno: { serve: fn => { handler = fn; }, env: { get: () => 'configured' } },
  });
  return (body, aal = 'aal2') => handler(new Request('https://example.test/function', {
    method: 'POST', headers: { Authorization: 'Bearer h.' + Buffer.from(JSON.stringify({ aal })).toString('base64url') + '.s', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
}

function siaFixture({ authenticated = true, active = true, failTable = null, authError = null } = {}) {
  const authReads = [];
  const db = { auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'admin' } : null } }), admin: {
    getUserById: async id => { authReads.push(id); return { data: { user: id === 'missing-account' ? null : { email: 'fallback+guard@example.test' } }, error: id === 'missing-account' ? { status: 404 } : authError }; },
  } }, from(table) {
    let head = false;
    const q = { select(fields, options) { head = !!options?.head; return q; }, maybeSingle: async () => ({ data: { id: 'admin', is_active: active } }) };
    for (const name of ['eq', 'not', 'in', 'gte', 'lte', 'order', 'range']) q[name] = () => q;
    q.then = (resolve, reject) => Promise.resolve({ count: head ? 0 : 3, error: failTable === table ? { message: 'private detail' } : null,
      data: head ? null : table === 'guards' ? ['profile', 'fallback', 'missing-account'].map(id => ({ id: 'guard-' + id, user_id: id, verification_status: 'approved' }))
      : table === 'users' ? [{ id: 'profile', email: 'profile@example.test' }] : [],
    }).then(resolve, reject);
    return q;
  } };
  return { call: endpoint('supabase/functions/admin-sia-verifications/index.ts', db), authReads };
}

test('SIA contacts use profile email then page-scoped auth fallback after admin/MFA checks', async () => {
  const f = siaFixture(); const response = await f.call({ action: 'list' });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.map(row => row.email), ['profile@example.test', 'fallback+guard@example.test', '']);
  assert.deepEqual(f.authReads.sort(), ['fallback', 'missing-account']);
  for (const options of [{ authenticated: false }, { active: false }]) {
    const denied = siaFixture(options); assert((await denied.call({ action: 'list' })).status >= 400); assert.equal(denied.authReads.length, 0);
  }
  const weak = siaFixture(); assert.equal((await weak.call({ action: 'list' }, 'aal1')).status, 403); assert.equal(weak.authReads.length, 0);
});

test('SIA profile/auth read failures are reported instead of silently inventing missing contacts', async () => {
  for (const options of [{ failTable: 'users' }, { authError: { status: 503 } }]) {
    const f = siaFixture(options); const response = await f.call({ action: 'list' });
    assert.equal(response.status, 500); assert.doesNotMatch(JSON.stringify(await response.json()), /private detail/);
  }
});

test('SIA contact UI supplies a recipient or a disabled missing-email state', async () => {
  const entries = [' guard+qa@example.test ', '', '  '].map((email, i) => ({ guardId: String(i), userId: String(i), email, fullName: 'QA', verificationStatus: 'verified' }));
  const channel = { on() { return channel; }, subscribe() { return channel; } };
  const h = hooksHarness('app/admin/sia-verifications/SIAVerificationsClient.tsx', {
    '@/lib/supabase': { supabase: { functions: { invoke: async () => ({ data: { data: entries, totalCount: 3 } }) }, channel: () => channel, removeChannel() {} } },
    '@/lib/admin-logger': { logAdminAction() {} }, './DocumentThumbnail': { default() {} }, './ProfileAvatar': { default() {} }, '@/components/Pagination': { default() {} },
  }, { setTimeout: () => 1, clearTimeout() {} });
  h.render(); await h.effects(); const tree = h.render();
  const links = nodes(tree).filter(n => n.type === 'a' && n.props.href?.startsWith('mailto:'));
  assert.deepEqual(links.map(n => n.props.href), ['mailto:guard%2Bqa%40example.test']);
  assert.equal(nodes(tree).filter(n => n.type === 'button' && n.props.disabled && content(n) === 'Email unavailable').length, 2);
  h.unmount();
});

test('backup endpoint derives stale status and surfaces tracking-query failures', async () => {
  for (const failure of [null, 'security_backup_status', 'compliance_status']) {
    const db = { schema() { return db; }, auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) }, from(table) {
      const q = { select: () => q, eq: () => q, order: () => q, maybeSingle: async () => ({ data: { id: 'admin', role: 'super_admin' } }),
        then: (resolve, reject) => Promise.resolve({ error: table === failure ? { message: 'private detail' } : null, data: table === 'security_backup_status' ? [{ ...current, last_backup_at: '2026-06-30' }] : [] }).then(resolve, reject) };
      return q;
    } };
    const call = endpoint('supabase/functions/security-dashboard/index.ts', db);
    const response = await call({ action: 'backup_compliance_status' });
    assert.equal(response.status, failure ? 503 : 200);
    const body = await response.json();
    if (!failure) { assert.equal(body.backups[0].status, 'critical'); assert.equal(body.backups[0].recorded_status, 'healthy'); }
    assert.doesNotMatch(JSON.stringify(body), /private detail/);
  }
});

test('finance schedule JSON repair preserves scheduling and credentials, and is idempotent', async () => {
  const { PGlite } = require('@electric-sql/pglite'); const db = new PGlite();
  try {
    await db.exec(`create schema cron;
      create table cron.job(jobid bigint primary key,jobname text,command text,schedule text,active boolean);
      create function cron.alter_job(job_id bigint,command text) returns void language sql as $$update cron.job set command=alter_job.command where jobid=job_id$$;`);
    const original = "select net.http_post(url:='unchanged-url',body:=''::jsonb,headers:='{\"Authorization\":\"SECRET-FIXTURE\"}'::jsonb)";
    await db.query('insert into cron.job values(1,$1,$2,$3,true),(2,$4,$2,$3,false)', ['monthly-finance-snapshot', original, '0 2 1 * *', 'unrelated']);
    const name = fs.readdirSync('supabase/migrations').find(n => n.endsWith('_repair_monthly_finance_cron_json_body.sql'));
    const sql = fs.readFileSync('supabase/migrations/' + name, 'utf8');
    await db.exec(sql); await db.exec(sql);
    const rows = (await db.query('select * from cron.job order by jobid')).rows;
    assert.equal(rows[0].command, original.replace("body:=''::jsonb", "body:='{}'::jsonb"));
    assert.equal(rows[0].schedule, '0 2 1 * *'); assert.equal(rows[0].active, true);
    assert.equal(rows[1].command, original); assert.equal(rows[1].active, false);
  } finally { await db.close(); }
});
