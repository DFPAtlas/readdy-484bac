import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const userId = '10000000-0000-4000-8000-000000000001';
const existingUser = '20000000-0000-4000-8000-000000000002';
const key = '30000000-0000-4000-8000-000000000003';
const token = 'header.' + Buffer.from(JSON.stringify({ aal: 'aal2' })).toString('base64url') + '.signature';
const body = { idempotency_key: key, email: 'test@example.invalid', first_name: 'TEST', last_name: 'DO NOT BOOK', sia_licence_number: 'SYNTHETICTEST', sia_expiry_date: '2099-12-31' };
const queryResult = execute => ({ then: (resolve, reject) => Promise.resolve().then(execute).then(resolve, reject) });

async function harness(t, failTable = null) {
  const pg = new PGlite(); t.after(() => pg.close());
  await pg.exec(`create schema auth; create schema app;
    create table auth.users(id uuid primary key, email text unique, raw_user_meta_data jsonb);
    create table app.users(id uuid primary key,email text unique,full_name text,user_type text);
    create table app.notification_preferences(user_id uuid primary key references app.users(id) on delete cascade,job_matches boolean default false);
    create table app.subscriptions(user_id uuid primary key references auth.users(id));
    create table app.user_entitlements_data(user_id uuid primary key references auth.users(id) on delete cascade, features jsonb, plan_slug text,
      monthly_price_pence integer default 0, subscription_status text default 'active',
      is_active boolean generated always as (subscription_status in ('active','trialing')) stored,
      is_free_tier boolean generated always as (monthly_price_pence=0) stored);
    create function app.sync_subscription_to_entitlements() returns trigger language plpgsql as $$ begin
      insert into app.user_entitlements_data(user_id,features,plan_slug) values(new.user_id,'["canonical-plan-feature"]','guard_starter')
      on conflict(user_id) do update set features=excluded.features,plan_slug=excluded.plan_slug; return new; end $$;
    create trigger trg_sync_entitlements after insert on app.subscriptions for each row execute function app.sync_subscription_to_entitlements();
    create function app.user_defaults() returns trigger language plpgsql as $$ begin
      insert into app.user_entitlements_data(user_id,features,plan_slug) values(new.id,'["signup-plan-feature"]','guard_starter') on conflict(user_id) do nothing;
      insert into app.notification_preferences(user_id) values(new.id) on conflict(user_id) do nothing; return new; end $$;
    create trigger user_defaults after insert on app.users for each row execute function app.user_defaults();
    create table app.guards(id uuid primary key default gen_random_uuid(), user_id uuid unique references auth.users(id) on delete cascade,
      email text, full_name text, sia_licence_number text, is_active boolean default true, verification_status text default 'pending',
      profile_completed boolean default false, sia_verified boolean default false, dashboard_access boolean default false, payload jsonb);
    create function public.handle_new_user() returns trigger language plpgsql as $$ begin
      insert into app.guards(user_id,email,full_name) values(new.id,new.email,concat_ws(' ',new.raw_user_meta_data->>'first_name',new.raw_user_meta_data->>'last_name'))
      on conflict(user_id) do nothing; return new; end $$;
    create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
    insert into auth.users values('${existingUser}','existing@example.invalid','{}');
    update app.guards set is_active=true, verification_status='approved', sia_verified=true where user_id='${existingUser}';`);
  const before = (await pg.query('select * from app.guards where user_id=$1', [existingUser])).rows[0];
  const rows = new Map(), emails = [], deletedUsers = [];
  let handler, creations = 0, shellId;
  const db = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'admin-id' } }, error: null }),
      admin: {
        createUser: async attributes => {
          creations++; assert.equal(attributes.email_confirm, false);
          await pg.query('insert into auth.users values($1,$2,$3)', [userId, attributes.email, JSON.stringify(attributes.user_metadata)]);
          shellId = (await pg.query('select id from app.guards where user_id=$1', [userId])).rows[0].id;
          return { data: { user: { id: userId } }, error: null };
        },
        deleteUser: async id => { deletedUsers.push(id); try { await pg.query('delete from auth.users where id=$1', [id]); return { error: null }; } catch(error) { return { error: { message:error.message } }; } },
      },
    },
    storage: { from: () => ({ remove: async () => ({ error: null }) }) },
    from: table => {
      if (table === 'admin_users') {
        const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: 'admin', email: 'admin@example.invalid', is_active: true, role: 'super_admin' }, error: null }) }; return q;
      }
      if (table === 'guards') {
        const filters = []; let operation, record, conflict;
        async function execute() {
          try {
            if (operation === 'insert' || operation === 'upsert') {
              const columns = ['user_id','email','full_name','sia_licence_number','is_active','verification_status','profile_completed','sia_verified','dashboard_access'];
              const values = columns.map(c => record[c]); values.push(JSON.stringify(record));
              const clause = operation === 'upsert' ? ' on conflict(user_id) do update set ' + columns.slice(1).concat('payload').map(c => `${c}=excluded.${c}`).join(',') : '';
              if (operation === 'upsert') assert.equal(conflict.onConflict, 'user_id');
              const result = await pg.query(`insert into app.guards(${columns.join(',')},payload) values(${values.map((_, i) => '$'+(i+1)).join(',')})${clause} returning id`, values);
              return { data: result.rows[0], error: null };
            }
            const where = filters.map(([column], i) => { assert.ok(['user_id','email','sia_licence_number'].includes(column)); return `${column}=$${i+1}`; }).join(' and ');
            const result = await pg.query(`${operation === 'delete' ? 'delete from' : 'select * from'} app.guards where ${where}`, filters.map(([, value]) => value));
            return { data: result.rows[0] || null, error: null };
          } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
        }
        const q = { select: () => q, eq: (column, value) => { filters.push([column, value]); return q; },
          insert: value => { operation = 'insert'; record = value; return q; },
          upsert: (value, options) => { operation = 'upsert'; record = value; conflict = options; return q; },
          delete: () => { operation = 'delete'; return q; }, maybeSingle: execute, then: (resolve, reject) => execute().then(resolve, reject) };
        return q;
      }
      const q = {
        select: () => q, eq: () => q,
        maybeSingle: async () => ({ data: table === 'admin_guard_creation_requests' ? rows.get(table) || null : null, error: null }),
        insert: row => queryResult(async () => {
          if (table === failTable) return { error: { message: 'Injected downstream failure' } };
          if (table === 'subscriptions') {
            await pg.query('insert into app.subscriptions values($1)',[row.user_id]);
            rows.set('user_entitlements_data',(await pg.query('select * from app.user_entitlements_data where user_id=$1',[row.user_id])).rows[0]);
          }
          if (table === 'user_entitlements_data') {
            try { await pg.query('insert into app.user_entitlements_data(user_id,features,plan_slug) values($1,$2,$3)',[row.user_id,JSON.stringify(row.features),row.plan_slug]); }
            catch(error) { return { error:{message:error.message} }; }
          }
          if (table === 'notification_preferences') {
            try { await pg.query('insert into app.notification_preferences(user_id) values($1)',[row.user_id]); }
            catch(error) { return {error:{message:error.message}}; }
          }
          rows.set(table, row); return { error: null };
        }),
        upsert: (row, options) => queryResult(async () => {
          if(table===failTable) return {error:{message:'Injected downstream failure'}};
          if(table === 'users') {
            assert.deepEqual(options,{onConflict:'id',ignoreDuplicates:true});
            await pg.query('insert into app.users values($1,$2,$3,$4) on conflict(id) do nothing',[row.id,row.email,row.full_name,row.user_type]); rows.set(table,row); return {error:null};
          }
          if(table === 'notification_preferences') {
            assert.deepEqual(options,{onConflict:'user_id',ignoreDuplicates:true});
            await pg.query('insert into app.notification_preferences(user_id,job_matches) values($1,$2) on conflict(user_id) do nothing',[row.user_id,row.job_matches]);
            rows.set(table,(await pg.query('select * from app.notification_preferences where user_id=$1',[row.user_id])).rows[0]); return {error:null};
          }
          assert.equal(table,'user_entitlements_data'); assert.deepEqual(options,{onConflict:'user_id',ignoreDuplicates:true});
          const columns=['user_id','features','plan_slug']; const values=[row.user_id,JSON.stringify(row.features),row.plan_slug];
          for(const generated of ['is_active','is_free_tier']) if(Object.hasOwn(row,generated)) { columns.push(generated); values.push(row[generated]); }
          await pg.query(`insert into app.user_entitlements_data(${columns.join(',')}) values(${values.map((_,i)=>'$'+(i+1)).join(',')}) on conflict(user_id) do nothing`,values);
          rows.set(table,(await pg.query('select * from app.user_entitlements_data where user_id=$1',[row.user_id])).rows[0]); return {error:null};
        }),
        delete: () => ({ eq: () => queryResult(async () => { if(['subscriptions','user_entitlements_data','notification_preferences','users'].includes(table)) await pg.query('delete from app.'+table+' where '+(table==='users'?'id':'user_id')+'=$1',[userId]); rows.delete(table); return { error: null }; }) }),
      }; return q;
    },
  };
  const compiled = ts.transpileModule(fs.readFileSync('supabase/functions/create-guard-from-admin/index.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('exports','require','Deno','fetch',compiled)({}, () => ({ createClient: () => db }), {
    env: { get: name => ({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-only', SUPABASE_ANON_KEY: 'public-key' })[name] }, serve: next => { handler = next; },
  }, async (url, options) => { emails.push({ url, body: JSON.parse(options.body) }); return new Response('{}'); });
  return { pg, rows, emails, deletedUsers, before, get creations() { return creations; }, get shellId() { return shellId; },
    call: () => handler(new Request('https://test.supabase.co/functions/v1/create-guard-from-admin', { method:'POST', headers: { Authorization: 'Bearer '+token, Origin:'https://quickguard.uk', 'Content-Type':'application/json' }, body:JSON.stringify(body) })) };
}

test('admin creation completes the Auth-trigger shell once, preserving its ID and keeping verification/access pending', async t => {
  const h = await harness(t); const response = await h.call(); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.success, true); assert.equal(result.status, 'pending_review');
  const saved = (await h.pg.query('select * from app.guards where user_id=$1',[userId])).rows;
  assert.equal(saved.length, 1); assert.equal(saved[0].id, h.shellId); assert.equal(result.guard_record_id, h.shellId);
  assert.equal(saved[0].is_active, false); assert.equal(saved[0].dashboard_access, false); assert.equal(saved[0].sia_verified, false); assert.equal(saved[0].verification_status, 'manual_review');
  assert.deepEqual(h.rows.get('user_entitlements_data').features,['canonical-plan-feature']);
  assert.equal(h.rows.get('user_entitlements_data').is_active,true); assert.equal(h.rows.get('user_entitlements_data').is_free_tier,true);
  assert.equal(h.rows.get('notification_preferences').job_matches,false);
  assert.deepEqual((await h.pg.query('select * from app.guards where user_id=$1',[existingUser])).rows[0], h.before);
  assert.equal(h.emails.length, 1); assert.equal(h.creations, 1);
  const retried = await h.call(); assert.equal(retried.status, 200); assert.equal((await retried.json()).idempotent, true);
  assert.equal(h.creations, 1); assert.equal(h.emails.length, 1);
});

test('downstream provisioning failure rolls back only the newly created Auth user and guard shell', async t => {
  const h = await harness(t, 'notification_preferences'); const response = await h.call(); assert.equal(response.status, 500);
  assert.equal((await response.json()).error, 'Failed to create notification preferences');
  assert.deepEqual(h.deletedUsers, [userId]); assert.equal(h.emails.length, 0);
  assert.equal((await h.pg.query('select * from app.guards where user_id=$1',[userId])).rows.length, 0);
  assert.equal((await h.pg.query('select * from auth.users where id=$1',[userId])).rows.length, 0);
  assert.deepEqual((await h.pg.query('select * from app.guards where user_id=$1',[existingUser])).rows[0], h.before);
  assert.equal(h.rows.has('subscriptions'), false); assert.equal(h.rows.has('user_entitlements_data'), false);
  assert.equal((await h.pg.query('select * from app.users where id=$1',[userId])).rows.length,0);
  assert.equal((await h.pg.query('select * from app.notification_preferences where user_id=$1',[userId])).rows.length,0);
});

test('optional notification errors do not undo a fully provisioned guard or break the saved idempotent result', async t => {
  const h = await harness(t, 'notifications'); const response = await h.call(); assert.equal(response.status, 200);
  assert.equal((await response.json()).success,true); assert.equal(h.deletedUsers.length,0);
  assert.equal(h.rows.get('admin_guard_creation_requests').status,'completed');
});
