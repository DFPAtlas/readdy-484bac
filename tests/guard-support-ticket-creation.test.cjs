const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const migration = fs.readFileSync('supabase/migrations/20261114105009_enable_guard_support_ticket_creation.sql', 'utf8');
const ownerProtection = fs.readFileSync('supabase/migrations/20261114103643_protect_support_ticket_owner_updates.sql', 'utf8');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('guard creation migration preserves owner isolation, client complaints, closure blocks and protected updates', async () => {
  const db = new PGlite();
  try {
    // Minimal fixture with the production policy predicates inspected on 18 November.
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA app;
      GRANT USAGE ON SCHEMA auth, app TO anon, authenticated, service_role;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION app.is_active_admin() RETURNS boolean LANGUAGE sql STABLE AS
        $$ SELECT coalesce(current_setting('test.admin', true) = 'true', false) $$;
      CREATE TABLE app.guards(id uuid PRIMARY KEY, user_id uuid NOT NULL);
      CREATE TABLE app.clients(id uuid PRIMARY KEY, user_id uuid NOT NULL);
      CREATE TABLE app.account_closures(user_id uuid PRIMARY KEY);
      CREATE TABLE app.support_tickets(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES app.clients(id),
        guard_id uuid REFERENCES app.guards(id), subject text NOT NULL, status text DEFAULT 'open',
        admin_notes text, updated_at timestamptz DEFAULT now()
      );
      GRANT SELECT ON app.guards, app.clients, app.account_closures TO anon, authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON app.support_tickets TO anon, authenticated, service_role;
      ALTER TABLE app.guards ENABLE ROW LEVEL SECURITY;
      ALTER TABLE app.clients ENABLE ROW LEVEL SECURITY;
      CREATE POLICY guards_select_own ON app.guards FOR SELECT TO authenticated USING(user_id = auth.uid());
      CREATE POLICY clients_select_own ON app.clients FOR SELECT TO authenticated USING(user_id = auth.uid());
      ALTER TABLE app.support_tickets ENABLE ROW LEVEL SECURITY;
      CREATE POLICY client_tickets_insert ON app.support_tickets FOR INSERT TO authenticated
        WITH CHECK(EXISTS(SELECT 1 FROM app.clients WHERE clients.user_id = auth.uid() AND clients.id = support_tickets.client_id));
      CREATE POLICY client_tickets_select ON app.support_tickets FOR SELECT TO authenticated
        USING(EXISTS(SELECT 1 FROM app.clients WHERE clients.user_id = auth.uid() AND clients.id = support_tickets.client_id));
      CREATE POLICY guard_tickets_insert ON app.support_tickets FOR INSERT
        WITH CHECK(guard_id IN(SELECT g.id FROM app.guards g WHERE g.user_id = auth.uid()));
      CREATE POLICY guard_tickets_select ON app.support_tickets FOR SELECT
        USING(EXISTS(SELECT 1 FROM app.guards g WHERE g.user_id = auth.uid() AND g.id = support_tickets.guard_id));
      CREATE POLICY guard_tickets_update ON app.support_tickets FOR UPDATE
        USING(EXISTS(SELECT 1 FROM app.guards g WHERE g.user_id = auth.uid() AND g.id = support_tickets.guard_id));
      CREATE POLICY support_tickets_admin_all ON app.support_tickets TO authenticated
        USING(app.is_active_admin()) WITH CHECK(app.is_active_admin());
      CREATE POLICY qg_closed_account_block ON app.support_tickets AS RESTRICTIVE TO authenticated
        USING(NOT EXISTS(SELECT 1 FROM app.account_closures WHERE user_id = auth.uid()))
        WITH CHECK(NOT EXISTS(SELECT 1 FROM app.account_closures WHERE user_id = auth.uid()));
      INSERT INTO app.guards VALUES('${id(11)}','${id(1)}'),('${id(12)}','${id(2)}');
      INSERT INTO app.clients VALUES('${id(13)}','${id(3)}'),('${id(14)}','${id(4)}');
    `);
    const actor = async (user, role = 'authenticated') => {
      await db.exec(`RESET ROLE; SET test.admin = 'false'; SELECT set_config('request.jwt.claim.sub', '${user ? id(user) : ''}', false); SET ROLE ${role};`);
    };
    const insert = (guard, client = null) => db.query('INSERT INTO app.support_tickets(guard_id,client_id,subject) VALUES($1,$2,$3) RETURNING id', [guard ? id(guard) : null, client ? id(client) : null, 'Synthetic regression ticket']);
    await actor(1);
    await assert.rejects(insert(11), err => err.code === '23502', 'reproduces the live missing-client blocker');
    await db.exec('RESET ROLE; BEGIN'); await db.exec(migration); await db.exec(ownerProtection); await db.exec('COMMIT');
    await actor(1);
    const ticket = (await insert(11)).rows[0].id;
    assert.equal((await db.query('SELECT count(*)::int AS count FROM app.support_tickets')).rows[0].count, 1);
    for (const values of [[12, null], [11, 14], [null, null]]) {
      await assert.rejects(insert(...values), err => err.code === '42501');
    }
    await assert.rejects(db.query('UPDATE app.support_tickets SET guard_id=$1 WHERE id=$2', [id(12), ticket]), /only change the ticket status/);
    await assert.rejects(db.query("UPDATE app.support_tickets SET admin_notes='forged' WHERE id=$1", [ticket]), /only change the ticket status/);
    assert.equal((await db.query("UPDATE app.support_tickets SET status='under_review' WHERE id=$1 RETURNING status", [ticket])).rows[0].status, 'under_review');
    for (const user of [2, 4]) {
      await actor(user);
      assert.equal((await db.query('SELECT count(*)::int AS count FROM app.support_tickets')).rows[0].count, 0);
      assert.equal((await db.query("UPDATE app.support_tickets SET status='closed' WHERE id=$1 RETURNING id", [ticket])).rows.length, 0);
    }
    await actor(null, 'anon');
    await assert.rejects(insert(11), err => err.code === '42501');
    await actor(3);
    await insert(11, 13); // Existing client complaint with an associated guard stays valid.
    await assert.rejects(insert(12, 14), err => err.code === '42501');
    await db.exec(`RESET ROLE; INSERT INTO app.account_closures VALUES('${id(1)}');`);
    await actor(1);
    await assert.rejects(insert(11), err => err.code === '42501');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM app.support_tickets')).rows[0].count, 0);
    await db.exec('RESET ROLE; SET test.admin = \'true\'; SET ROLE authenticated;');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM app.support_tickets')).rows[0].count, 0, 'closed-account restriction remains authoritative even for an admin flag');
    await actor(5); await db.exec("RESET ROLE; SET test.admin = 'true'; SET ROLE authenticated;");
    assert.equal((await db.query('SELECT count(*)::int AS count FROM app.support_tickets')).rows[0].count, 2);
    assert.equal((await db.query("UPDATE app.support_tickets SET status='resolved',admin_notes='reviewed' WHERE id=$1 RETURNING id", [ticket])).rows.length, 1);
    await actor(null, 'service_role');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM app.support_tickets')).rows[0].count, 2);
    await db.exec('RESET ROLE; BEGIN'); await db.exec(migration); await db.exec('COMMIT');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM app.support_tickets')).rows[0].count, 2, 'reapplication preserves tickets');
  } finally { await db.close(); }
});

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
const adminSource = fs.readFileSync('app/admin/support-tickets/page.tsx', 'utf8');
const tickets = [
  { id: id(21), client_id: null, guard_id: id(11), subject: 'Guard enquiry', description: 'Synthetic', category: 'general_support', status: 'open', priority: 'normal', created_at: '2026-11-18T09:00:00Z' },
  { id: id(22), client_id: id(13), guard_id: id(11), subject: 'Client complaint', description: 'Synthetic', category: 'general_support', status: 'open', priority: 'normal', created_at: '2026-11-18T09:00:00Z' },
];

test('admin enrichment identifies guard requesters without relabelling client complaints', async () => {
  const calls = [];
  const values = { support_tickets: tickets, clients: [{ id: id(13), contact_name: 'Client contact', email: 'client@example.test' }], guards: [{ id: id(11), full_name: 'Guard contact', email: 'guard@example.test' }] };
  const supabase = { from(table) { const q = { select(fields) { calls.push({ table, fields }); return q; }, eq() { return q; }, order() { return q; }, in() { return q; }, then(resolve, reject) { return Promise.resolve({ data: values[table] || [], error: null }).then(resolve, reject); } }; return q; } };
  const helpers = { exports: require('./helpers/enterprise-module.cjs').load('lib/support-inbox-reads.ts') };
  const rows = await helpers.exports.loadAdminSupportInbox(supabase);
  assert.equal(rows[0].requester_name, 'Guard contact'); assert.equal(rows[0].requester_email, 'guard@example.test');
  assert.equal(rows[1].requester_name, 'Client contact'); assert.equal(rows[1].requester_email, 'client@example.test');
  assert.ok(calls.find(c => c.table === 'guards').fields.includes('email'));
  for (const selected of rows) {
    let hook = 0;
    const hooks = { ...React, useState(initial) { const state = React.useState(initial); const values = [rows, rows, false, false, selected]; return hook < values.length ? [values[hook++], () => {}] : (hook++, state); } };
    const mod = { exports: {} };
    new Function('require', 'exports', compile(adminSource))(name => {
      if (name === 'react') return hooks;
      if (name === '@/lib/admin-support-ticket-writes') return {};
      if (name === '@/lib/supabase') return { supabase: {} };
      if (name === '@/lib/support-inbox-reads') return helpers.exports;
      if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      return require(name);
    }, mod.exports);
    const html = renderToStaticMarkup(React.createElement(mod.exports.default));
    assert.ok(html.includes(selected.requester_name));
    assert.ok(html.split(selected.requester_email).length >= 3, 'requester email is visible in both list and detail');
  }
});
