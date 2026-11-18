const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const migration = fs.readFileSync('supabase/migrations/20261118000420_reconcile_guard_promotion_configuration.sql', 'utf8');

test('restore missing configuration once and publish aggregate recognition availability only', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema app; grant usage on schema app to anon, authenticated;
      create table public.promo_config (
        id integer, launch_date timestamptz, tier1_cap integer, tier2_cap integer, tier3_cap integer,
        tier3_window_days integer, tier1_lifetime_fee numeric, standard_fee numeric, is_paused boolean,
        created_at timestamptz, updated_at timestamptz, client_tier1_cap integer, client_tier2_cap integer,
        client_tier3_cap integer, client_tier3_window_days integer, client_tier1_lifetime_discount numeric,
        client_tier3_free_jobs integer, client_standard_service_fee numeric
      );
      create table app.promo_config (like public.promo_config including all);
      create table app.guards(signup_number integer, email text);
      insert into app.guards values (1,'private@example.test'),(2,'private2@example.test');
      insert into public.promo_config values (1,'2026-05-08',100,500,2000,90,5,10,false,now(),now(),50,250,1000,90,.5,3,15);
    `);
    await db.exec('begin');
    await db.exec(migration);
    await db.exec('commit');
    const config = (await db.query('select * from app.promo_config')).rows[0];
    assert.equal(config.tier1_cap, 100);
    assert.equal(new Date(config.launch_date).toISOString(), '2026-05-08T00:00:00.000Z');
    await db.exec('set role anon');
    const summary = (await db.query('select app.get_guard_promotion_summary() summary')).rows[0].summary;
    assert.equal(summary.configured, true);
    assert.equal(summary.tier1Remaining, 98);
    assert.equal(summary.tier2Remaining, 400);
    assert.equal(summary.tier3Active, false, 'the old window is not silently reopened');
    assert.equal(JSON.stringify(summary).includes('private'), false);
    assert.equal('tier1_lifetime_fee' in summary, false);
    await assert.rejects(db.query('select * from app.guards'), /permission denied/);
    await assert.rejects(db.query('update app.promo_config set is_paused=false'), /permission denied/);
    await db.exec('reset role; update app.promo_config set tier1_cap=120,is_paused=true;');
    await db.exec('begin');
    await db.exec(migration);
    await db.exec('commit');
    assert.equal((await db.query('select tier1_cap from app.promo_config')).rows[0].tier1_cap, 120, 'existing admin edits survive reapplication');
    await db.exec('set role authenticated');
    assert.equal((await db.query('select app.get_guard_promotion_summary() summary')).rows[0].summary.isPaused, true);
    await db.exec('reset role; delete from app.promo_config; set role anon');
    assert.deepEqual((await db.query('select app.get_guard_promotion_summary() summary')).rows[0].summary, { configured: false });
  } finally { await db.close(); }
});
