const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const { renderToStaticMarkup } = require('react-dom/server');
const schema = require('./fixtures/client-data-export-schema.json');
const migrationNames = fs.readdirSync('supabase/migrations').filter(name => name.endsWith('_add_client_company_description.sql'));
assert.equal(migrationNames.length, 1);
const migration = fs.readFileSync('supabase/migrations/' + migrationNames[0], 'utf8');
const protection = fs.readFileSync('supabase/migrations/20261003203000_trusted_job_counter.sql', 'utf8').split('\ndo $$ begin')[0];
const C = '11111111-1111-4111-8111-111111111111', U = '22222222-2222-4222-8222-222222222222', F = '33333333-3333-4333-8333-333333333333', V = '44444444-4444-4444-8444-444444444444';
function load(path, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('module', 'exports', 'require', code)(module, module.exports, name => name in mocks ? mocks[name] : require(name));
  return module.exports;
}
const website = load('lib/client-profile-website.ts');
const quoted = key => '"' + key.replaceAll('"', '""') + '"';
async function fixture() {
  const db = new PGlite();
  const types = { id: 'uuid primary key', user_id: 'uuid', verified: 'boolean', is_active: 'boolean', profile_completed: 'boolean', total_spent: 'numeric', total_jobs_posted: 'int', active_jobs: 'int', billing_cycle_day: 'int', verified_at: 'timestamptz' };
  const columns = schema.clients.filter(c => c !== 'description').map(c => quoted(c) + ' ' + (types[c] || 'text')).join(',');
  await db.exec(`create role authenticated; create role anon; create schema app; create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.role() returns text language sql as $$select current_user::text$$;
    create function public.is_active_admin() returns boolean language sql as $$select false$$;
    grant usage on schema app,auth to authenticated,anon;
    create table app.clients(${columns}); create table app.account_closures(user_id uuid primary key);
    grant select,update on app.clients to authenticated,anon; grant select on app.account_closures to authenticated;
    alter table app.clients enable row level security;
    create policy clients_select_own on app.clients for select to authenticated using(user_id=auth.uid());
    create policy clients_update_own on app.clients for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    create policy qg_closed_account_block on app.clients as restrictive for all to authenticated using(not exists(select 1 from app.account_closures where user_id=auth.uid())) with check(not exists(select 1 from app.account_closures where user_id=auth.uid()));
    insert into app.clients(id,user_id,company_name,first_name,last_name,email,phone,website,verified,total_spent,stripe_customer_id)
      values('${C}','${U}','Synthetic Company','Test','Client','test@example.invalid','test','',false,123,'cus_preserved'),('${F}','${V}','Foreign Company','Other','Client','other@example.invalid','test','',false,456,'cus_foreign');`);
  await db.exec(protection);
  await db.exec('create trigger protect before update on app.clients for each row execute function app.protect_client_server_fields()');
  return db;
}
async function owner(db) { await db.exec(`reset role; select set_config('test.uid','${U}',false); set role authenticated;`); }
async function apply(db) { await db.exec('reset role'); await db.exec(migration); await owner(db); }
async function profile(db) { return (await db.query('select * from app.clients where id=$1', [C])).rows[0]; }
function find(node, predicate) { if (!node || typeof node !== 'object') return; if (predicate(node)) return node; for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; } }
function harness(db, initialProfile) {
  const slots = [], calls = [], updates = [], errors = []; let cursor = 0, failure = null;
  const react = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; } };
  const adapter = { from(table) { assert.equal(table, 'clients'); const call = {}; calls.push(call); const q = {
    update(payload) { call.payload = JSON.parse(JSON.stringify(payload)); return q; }, eq(key, value) { call.filter = [key, value]; return q; }, select(value) { assert.equal(value, 'id'); return q; },
    async maybeSingle() {
      if (failure instanceof Error) throw failure;
      if (failure) return failure;
      const entries = Object.entries(call.payload);
      try {
        const saved = await db.query('update app.clients set ' + entries.map(([key], i) => quoted(key) + '=$' + (i + 1)).join(',') + ' where ' + quoted(call.filter[0]) + '=$' + (entries.length + 1) + ' returning id', [...entries.map(([, value]) => value), call.filter[1]]);
        return { data: saved.rows[0] || null, error: null };
      } catch (error) { call.databaseError = error.code; return { data: null, error }; }
    },
  }; return q; } };
  const Component = load('app/client/profile/CompanyProfileSection.tsx', { react, '@/lib/supabase': { supabase: adapter }, '@/lib/client-profile-website': website }).default;
  const render = () => { cursor = 0; return Component({ profile: initialProfile, onUpdate: value => updates.push(value), onError: value => errors.push(value) }); };
  return { calls, updates, errors, render, setFailure(value) { failure = value; },
    change(value) { find(render(), n => n.type === 'textarea' && n.props.name === 'description').props.onChange({ target: { name: 'description', value } }); },
    submit() { return render().props.onSubmit({ preventDefault() {} }); },
  };
}

test('actual component reproduces missing-column failure before migration, then saves, reopens and clears multiline company descriptions', async () => {
  const db = await fixture(); try {
    await owner(db); const h = harness(db, await profile(db)); const text = 'Café 😀 security\n"Quoted" company description'; h.change(text);
    await h.submit(); assert.equal(h.calls[0].databaseError, '42703'); assert.equal(h.updates.length, 0); assert.equal(h.errors.length, 1);
    await apply(db); await h.submit(); assert.equal(h.updates.length, 1); assert.equal((await profile(db)).description, text); assert.equal(h.updates[0].description, text); assert.equal((await profile(db)).website, '');
    const reopened = harness(db, await profile(db)); const textarea = find(reopened.render(), n => n.type === 'textarea' && n.props.name === 'description'); assert.equal(textarea.props.value, text); assert.equal(textarea.props.required, undefined);
    assert.match(renderToStaticMarkup(reopened.render()), /Company Description \(optional\)/);
    await reopened.submit(); assert.equal((await profile(db)).description, text);
    reopened.change(''); await reopened.submit(); assert.equal((await profile(db)).description, '');
    const blank = harness(db, await profile(db)); assert.equal(find(blank.render(), n => n.type === 'textarea').props.value, '');
  } finally { await db.close(); }
});

test('migration is nullable, idempotent and preserves existing rows, RLS policies and protected billing state', async () => {
  const db = await fixture(); try {
    const policies = (await db.query("select policyname,qual,with_check from pg_policies where schemaname='app' and tablename='clients' order by policyname")).rows;
    await db.exec(migration); await db.exec(migration);
    const columns = (await db.query("select data_type,is_nullable,column_default from information_schema.columns where table_schema='app' and table_name='clients' and column_name='description'")).rows;
    assert.deepEqual(columns, [{ data_type: 'text', is_nullable: 'YES', column_default: null }]);
    assert.equal((await db.query('select count(*)::int n from app.clients where description is not null')).rows[0].n, 0);
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='app.clients'::regclass")).rows[0].relrowsecurity, true);
    assert.deepEqual((await db.query("select policyname,qual,with_check from pg_policies where schemaname='app' and tablename='clients' order by policyname")).rows, policies);
    await owner(db); const row = await profile(db); assert.equal(row.stripe_customer_id, 'cus_preserved'); assert.equal(row.total_spent, '123'); assert.equal(row.verified, false);
    await assert.rejects(db.query('update app.clients set verified=true'), /protected client fields/);
    await assert.rejects(db.query("update app.clients set stripe_customer_id='cus_changed'"), /protected client fields/);
  } finally { await db.close(); }
});

test('foreign, closed and anonymous accounts cannot read or update the description through existing policies', async () => {
  const db = await fixture(); try {
    await apply(db); const foreign = harness(db, { ...(await profile(db)), id: F }); foreign.change('Forbidden'); await foreign.submit(); assert.equal(foreign.updates.length, 0); assert.equal(foreign.errors.length, 1);
    assert.equal((await db.query('select description from app.clients where id=$1', [F])).rows.length, 0);
    await db.exec(`reset role; insert into app.account_closures values('${U}'); set role authenticated`);
    const closed = await db.query('update app.clients set description=$1 where id=$2 returning id', ['Forbidden', C]); assert.equal(closed.rows.length, 0); assert.equal((await db.query('select description from app.clients')).rows.length, 0);
    await db.exec('reset role; set role anon'); assert.equal((await db.query('select description from app.clients')).rows.length, 0); assert.equal((await db.query("update app.clients set description='Forbidden' returning id")).rows.length, 0);
    await db.exec('reset role'); assert.equal((await db.query('select count(*)::int n from app.clients where description is not null')).rows[0].n, 0);
  } finally { await db.close(); }
});

test('description write errors, zero rows and thrown failures keep Retry available and never report success', async () => {
  const db = await fixture(); try {
    await apply(db);
    for (const failure of [{ data: null, error: Error('blocked') }, { data: null, error: null }, Error('offline')]) {
      const h = harness(db, await profile(db)); h.change('Retry description'); h.setFailure(failure); await h.submit(); assert.equal(h.updates.length, 0); assert.equal(h.errors.length, 1);
      assert.equal(find(h.render(), n => n.type === 'button' && n.props.type === 'submit').props.disabled, false);
      h.setFailure(null); await h.submit(); assert.equal(h.updates.length, 1); assert.equal((await profile(db)).description, 'Retry description');
    }
  } finally { await db.close(); }
});
