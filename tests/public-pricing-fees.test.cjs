const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('anonymous catalogue exposes current client fees without exposing operational rules', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema app;
      grant usage on schema app to anon, authenticated;
      create table app.plans (slug text primary key, audience text, active boolean);
      create table app.plan_fee_rules (plan_slug text primary key, platform_fee_percent numeric, platform_fee_fixed_pence integer, private_note text);
      alter table app.plan_fee_rules enable row level security;
      insert into app.plans values
        ('client_free', 'client', true), ('client-starter', 'client', true),
        ('client-pro', 'client', true), ('client-enterprise', 'client', true),
        ('guard-pro', 'guard', true), ('retired-client', 'client', false);
      insert into app.plan_fee_rules values
        ('client_free', 15, 0, 'internal'), ('client-starter', 10, 0, 'internal'),
        ('client-pro', 7.5, 0, 'internal'), ('client-enterprise', 5, 0, 'internal'),
        ('guard-pro', 0, 0, 'internal'), ('retired-client', 1, 0, 'internal');
    `);
    await db.exec(readFileSync('supabase/migrations/20261117220215_public_client_pricing_fees.sql', 'utf8'));
    await db.exec('set role anon');
    const { rows } = await db.query('select * from app.get_public_client_pricing_fees()');
    assert.deepEqual(rows.map(row => row.plan_slug), ['client-enterprise', 'client-pro', 'client-starter', 'client_free']);
    assert.deepEqual(rows.map(row => Number(row.platform_fee_percent)), [5, 7.5, 10, 15]);
    assert.deepEqual(Object.keys(rows[0]), ['plan_slug', 'platform_fee_percent', 'platform_fee_fixed_pence']);
    await assert.rejects(db.query('select * from app.plan_fee_rules'), /permission denied/);
    await assert.rejects(db.query('update app.plan_fee_rules set platform_fee_percent=0'), /permission denied/);

    await db.exec("reset role; update app.plan_fee_rules set platform_fee_percent=8, platform_fee_fixed_pence=25 where plan_slug='client-pro'; update app.plans set active=false where slug='client-enterprise'; set role authenticated;");
    const changed = await db.query('select * from app.get_public_client_pricing_fees()');
    assert.equal(changed.rows.length, 3);
    assert.equal(Number(changed.rows.find(row => row.plan_slug === 'client-pro').platform_fee_percent), 8);
    assert.equal(changed.rows.find(row => row.plan_slug === 'client-pro').platform_fee_fixed_pence, 25);
  } finally {
    await db.close();
  }
});
