const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { load } = require('./helpers/enterprise-module.cjs');

test('maintenance SQL reads private-schema records with invoker rights, pages logs, and conceals cron commands', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema app; create schema cron;
      create role anon; create role authenticated; create role service_role;
      create table cron.job(jobid bigint primary key, jobname text, schedule text, active boolean, command text);
      create table cron.job_run_details(runid bigint, jobid bigint, status text, start_time timestamptz, end_time timestamptz, return_message text);
      create table public.cleanup_log(id uuid,table_name text,rows_removed int,retention_days int,started_at timestamptz,finished_at timestamptz,status text,error_message text);
      grant usage on schema app to service_role;
      grant select on cron.job, cron.job_run_details, public.cleanup_log to service_role;
      grant usage on schema app to anon, authenticated;
      insert into cron.job values(1,'worker','* * * * *',true,'SECRET COMMAND'),(2,'never','0 * * * *',false,'SECRET');
      insert into cron.job_run_details values(1,1,'succeeded',now()-interval '8 days',now(), 'OLD'),(2,1,'failed',now(),now(),'SECRET ERROR');
      insert into public.cleanup_log values
        ('11111111-1111-4111-8111-111111111111','notifications',3,180,now(),now(),'completed',null),
        ('22222222-2222-4222-8222-222222222222','email_queue',0,90,now()-interval '1 day',now(),'failed','query failed');`);
    await db.exec(fs.readFileSync('supabase/migrations/20261121222643_admin_maintenance_snapshot.sql','utf8'));
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select app.get_admin_maintenance_snapshot()'), /permission denied/);
      await db.exec('reset role');
    }
    assert.equal((await db.query("select prosecdef from pg_proc where proname='get_admin_maintenance_snapshot'")).rows[0].prosecdef, false);
    await db.exec('set role service_role');
    await assert.rejects(db.query('select app.get_admin_maintenance_snapshot()'), /permission denied for schema cron/);
    await db.exec('reset role');
    const usageMigration = fs.readdirSync('supabase/migrations').find(name => name.endsWith('_restore_service_cron_schema_usage.sql'));
    await db.exec(fs.readFileSync('supabase/migrations/' + usageMigration, 'utf8'));
    await db.exec('set role service_role');
    const data = (await db.query('select app.get_admin_maintenance_snapshot(1,1) as data')).rows[0].data;
    assert.equal(data.cron_jobs.length, 2);
    assert.equal(data.cron_jobs[0].run_count_7d, 1);
    assert.equal(data.cron_jobs[0].last_run.status, 'failed');
    assert.equal(data.cron_jobs[1].last_run, null);
    assert.equal(data.cleanup.total_count, 2);
    assert.equal(data.cleanup.logs.length, 1);
    assert.equal(data.cleanup.logs[0].table_name, 'email_queue');
    assert.equal(data.cleanup.last_run.table, 'notifications');
    assert.equal(data.cleanup.last_failure.table, 'email_queue');
    assert.doesNotMatch(JSON.stringify(data), /SECRET/);
  } finally { await db.close(); }
});

function handlerFixture({ authenticated = true, aal = 'aal2', active = true, role = 'super_admin', failure = false } = {}) {
  let handler; const calls = [];
  const maintenance = { cron_jobs: [{ jobid: 1 }], cleanup: { status: 'healthy', logs: [], total_count: 420 } };
  const db = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'admin-user' } : null } }) },
    from(table) {
      assert.equal(table, 'admin_users', 'maintenance-only reads must not probe other services');
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: 'admin', is_active: active, role } }) }; return q;
    },
    rpc: async (name, args) => { calls.push({ name, args }); return { data: failure ? null : maintenance, error: failure ? { message: 'private schema failure' } : null }; },
  };
  load('supabase/functions/admin-system-status/index.ts', {
    'https://esm.sh/@supabase/supabase-js@2.39.3': { createClient: (url, key, options) => { assert.equal(options.db.schema, 'app'); return db; } },
  }, { Deno: { serve: fn => { handler = fn; }, env: { get: () => 'configured' } }, fetch: () => { throw new Error('Unexpected external probe'); } });
  const token = 'header.' + Buffer.from(JSON.stringify({ aal })).toString('base64url') + '.signature';
  return { calls, maintenance, request: (query = '') => handler(new Request('https://example.test/status?section=maintenance' + query, { headers: { Authorization: 'Bearer ' + token } })) };
}

test('maintenance endpoint keeps admin, active-account and MFA checks before its service-only read', async () => {
  for (const options of [{ authenticated: false }, { aal: 'aal1' }, { active: false }, { role: 'guard' }]) {
    const h = handlerFixture(options); assert((await h.request()).status >= 400); assert.equal(h.calls.length, 0);
  }
  const h = handlerFixture(); const response = await h.request('&cleanup_offset=15&cleanup_limit=15');
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), h.maintenance);
  assert.deepEqual(h.calls, [{ name: 'get_admin_maintenance_snapshot', args: { p_offset: 15, p_limit: 15 } }]);
});

test('maintenance endpoint rejects invalid pagination and never turns a failed read into empty records', async () => {
  for (const query of ['&cleanup_offset=-1', '&cleanup_limit=101', '&cleanup_limit=1.5', '&cleanup_offset=NaN']) {
    const h = handlerFixture(); assert.equal((await h.request(query)).status, 400); assert.equal(h.calls.length, 0);
  }
  const h = handlerFixture({ failure: true }); const response = await h.request();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Unable to load maintenance records' });
});
