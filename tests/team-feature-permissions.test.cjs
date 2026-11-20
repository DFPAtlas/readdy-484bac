const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const MEMBER = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const POST = 'client.post_job', ANALYTICS = 'client.analytics_dashboard', API = 'client.api_access', TEAM = 'client.team_access';
function harness(options = {}) {
  const calls = [];
  const db = { user: MEMBER, token: 'session-one', allowed: [ANALYTICS],
    auth: { async getSession() { return { data: { session: db.user ? { user: { id: db.user }, access_token: db.token } : null }, error: null }; } },
    schema(name) { assert.equal(name,'app'); return db; },
    async rpc(name) { calls.push({ rpc: name }); assert.equal(name,'get_my_team_features'); return options.rpc ? options.rpc(db) : { data: db.allowed, error: null }; },
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      assert.notEqual(table,'team_member_configs','browser must not read an owner or team row to derive rights');
      const q = { select() { return q; }, eq(k,v) { call.filters.push([k,v]); return q; }, maybeSingle() { return q; },
        then(a,b) {
          let data = null;
          if (table === 'user_entitlements_data') {
            assert.deepEqual(call.filters,[['user_id',MEMBER]],'no owner entitlement lookup');
            data = { user_id: MEMBER, is_active: true, features: options.own ?? [POST] };
          }
          return Promise.resolve({ data, error: null }).then(a,b);
        },
      }; return q;
    },
  };
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('lib/entitlements.ts','utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('module','exports','require',code)(m,m.exports,n => { assert.equal(n,'./supabase'); return { supabase: db }; });
  return { api: m.exports, db, calls };
}

test('single-feature and all-feature readers agree on selected delegation plus own rights',async()=>{
  const h=harness();const flags=await h.api.getAllClientFeatures(MEMBER);
  assert.equal(flags[POST],true);assert.equal(flags[ANALYTICS],true);assert.equal(flags[API],false);
  for(const key of h.api.CLIENT_FEATURE_KEYS) assert.equal(await h.api.hasFeature(MEMBER,key),flags[key],key);
  assert.ok(h.calls.some(c=>c.rpc==='get_my_team_features'));
});
test('a revoked team feature is removed immediately despite the own entitlement cache',async()=>{
  const h=harness();assert.equal(await h.api.hasFeature(MEMBER,ANALYTICS),true);
  h.db.allowed=[];
  assert.equal(await h.api.hasFeature(MEMBER,ANALYTICS),false);
  assert.equal((await h.api.getAllClientFeatures(MEMBER))[ANALYTICS],false);
  assert.equal((await h.api.getAllClientFeatures(MEMBER))[POST],true);
});
test('RPC errors, throws and malformed responses fail closed for team rights and preserve own rights',async()=>{
  for(const rpc of [async()=>({data:null,error:{message:'offline'}}),async()=>{throw Error('offline')},async()=>({data:{features:[API]},error:null}),async()=>({data:'["client.api_access"]',error:null})]) {
    const h=harness({rpc});const flags=await h.api.getAllClientFeatures(MEMBER);
    assert.equal(flags[API],false);assert.equal(flags[POST],true);assert.equal(await h.api.hasFeature(MEMBER,API),false);
  }
});
test('unknown, non-client and malformed returned keys cannot grant extra rights',async()=>{
  const h=harness({own:[]});h.db.allowed=[ANALYTICS,ANALYTICS,'guard.apply_job','client.unknown',null,4];
  const flags=await h.api.getAllClientFeatures(MEMBER);
  assert.deepEqual(Object.keys(flags).filter(k=>flags[k]),[ANALYTICS]);
  assert.equal(await h.api.hasFeature(MEMBER,'guard.apply_job'),false);
});
test('anonymous, foreign-user and foreign supplied-entitlement contexts do not gain rights',async()=>{
  for(const user of [null,OTHER]) {
    const h=harness();h.db.user=user;
    assert.equal(await h.api.hasFeature(MEMBER,POST),false);
    assert.ok(Object.values(await h.api.getAllClientFeatures(MEMBER)).every(v=>v===false));
    assert.ok(!h.calls.some(c=>c.rpc));
  }
  const h=harness({own:[]});h.db.allowed=[];
  const flags=await h.api.getAllClientFeaturesFromEntitlement(MEMBER,{user_id:OTHER,is_active:true,features:[API]});
  assert.equal(flags[API],false);
});
test('account or token changes during team reads retire all late feature results',async()=>{
  for(const change of [db=>{db.user=OTHER;db.token='other-session'},db=>{db.token='refreshed-session'}]) {
    const h=harness({rpc:async db=>{change(db);return {data:[ANALYTICS],error:null}}});
    assert.ok(Object.values(await h.api.getAllClientFeatures(MEMBER)).every(v=>!v));
    const single=harness({rpc:async db=>{change(db);return {data:[ANALYTICS],error:null}}});
    assert.equal(await single.api.hasFeature(MEMBER,ANALYTICS),false);
  }
});
test('guard own features remain available without invoking client delegation',async()=>{
  const h=harness({own:['guard.apply_job']});
  assert.equal(await h.api.hasFeature(MEMBER,'guard.apply_job'),true);
  assert.ok(!h.calls.some(c=>c.rpc));
});

test('normal token refresh preserves the session while a new sign-in retires old results',async()=>{
  const token=(session,version)=>'header.'+Buffer.from(JSON.stringify({session_id:session,version})).toString('base64url')+'.signature';
  for(const sameSession of [true,false]) {
    const h=harness({rpc:async db=>{
      db.token=token(sameSession?MEMBER:OTHER,2);return {data:[ANALYTICS],error:null};
    }});
    h.db.token=token(MEMBER,1);
    const flags=await h.api.getAllClientFeatures(MEMBER);
    assert.equal(flags[ANALYTICS],sameSession);assert.equal(flags[POST],sameSession);
  }
});

test('database enforces caller-only intersections and private owner entitlements',async(t)=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema app;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table app.users(id uuid primary key,user_type text);
      create table app.clients(id uuid primary key,user_id uuid,is_active boolean);
      create table app.account_closures(user_id uuid primary key);
      create table app.user_entitlements_data(user_id uuid primary key,is_active boolean,audience text,features jsonb);
      create table public.team_member_configs(id uuid primary key,admin_user_id uuid,member_user_id uuid,enabled_features jsonb,created_at timestamptz,unique(admin_user_id,member_user_id));
      alter table public.team_member_configs enable row level security;
      create policy team_read on public.team_member_configs for select to authenticated using(admin_user_id=auth.uid() or member_user_id=auth.uid());
      create view app.team_member_configs with(security_invoker=true) as select * from public.team_member_configs;
      alter table app.user_entitlements_data enable row level security;
      create policy own_ent on app.user_entitlements_data for select to authenticated using(user_id=auth.uid());
      grant usage on schema app,auth to anon,authenticated,service_role;
      grant select on public.team_member_configs,app.team_member_configs,app.user_entitlements_data to authenticated;
      insert into app.users values('${MEMBER}','client'),('${OWNER}','client'),('${OTHER}','client');
      insert into app.clients values('${MEMBER}','${MEMBER}',true),('${OWNER}','${OWNER}',true),('${OTHER}','${OTHER}',true);
      insert into app.user_entitlements_data values('${OWNER}',true,'client','["${TEAM}","${ANALYTICS}","${API}"]');
      insert into public.team_member_configs values('${MEMBER}','${OWNER}','${MEMBER}','["${ANALYTICS}","${POST}","client.unknown","guard.apply_job",5,"${ANALYTICS}"]',now()),
        ('44444444-4444-4444-8444-444444444444','${OTHER}','${OWNER}','[]',now());`);
    const path=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_team_feature_permissions.sql'));
    await db.exec(fs.readFileSync('supabase/migrations/'+path,'utf8'));
    async function asMember(user=MEMBER) {
      await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`);
      return (await db.query('select app.get_my_team_features() as features')).rows[0].features;
    }
    async function change(sql) { await db.exec('reset role;'+sql); }
    await t.test('only the explicit intersection is returned; private owner rows remain unreadable',async()=>{
      assert.deepEqual(await asMember(),[ANALYTICS]);
      assert.equal((await db.query(`select * from app.user_entitlements_data where user_id='${OWNER}'`)).rows.length,0);
      assert.equal((await db.query(`select * from app.team_member_configs where admin_user_id='${OTHER}'`)).rows.length,0);
      assert.deepEqual(await asMember(OTHER),[]);
      assert.deepEqual(await asMember(''),[]);
    });
    await t.test('revocation, malformed selections and owner plan loss remove delegation',async()=>{
      for(const features of ['[]','null','{}','"legacy string"']) {
        await change(`update public.team_member_configs set enabled_features='${features}';`);
        assert.deepEqual(await asMember(),[]);
      }
      await change(`update public.team_member_configs set enabled_features='["${ANALYTICS}"]';update app.user_entitlements_data set features='["${ANALYTICS}"]';`);
      assert.deepEqual(await asMember(),[]);
      await change(`update app.user_entitlements_data set features='["${TEAM}","${ANALYTICS}"]',is_active=false;`);
      assert.deepEqual(await asMember(),[]);
      await change(`update app.user_entitlements_data set is_active=true,audience='guard';`);
      assert.deepEqual(await asMember(),[]);
      await change(`update app.user_entitlements_data set audience='client';`);
    });
    await t.test('inactive or closed member/owner and wrong audience are denied',async()=>{
      for(const user of [MEMBER,OWNER]) {
        await change(`update app.clients set is_active=false where user_id='${user}';`);assert.deepEqual(await asMember(),[]);
        await change(`update app.clients set is_active=true where user_id='${user}';insert into app.account_closures values('${user}');`);assert.deepEqual(await asMember(),[]);
        await change(`delete from app.account_closures;update app.users set user_type='guard' where id='${user}';`);assert.deepEqual(await asMember(),[]);
        await change(`update app.users set user_type='client' where id='${user}';`);
      }
    });
    await t.test('ambiguous memberships, self-membership and nested owners fail closed',async()=>{
      await change(`insert into public.team_member_configs values('${OTHER}','${OTHER}','${MEMBER}','["${ANALYTICS}"]',now());`);assert.deepEqual(await asMember(),[]);
      await change(`delete from public.team_member_configs where id='${OTHER}';update public.team_member_configs set admin_user_id='${MEMBER}';`);assert.deepEqual(await asMember(),[]);
      await change(`update public.team_member_configs set admin_user_id='${OTHER}';`);assert.deepEqual(await asMember(),[]);
      await change(`update public.team_member_configs set admin_user_id='${OWNER}';`);
    });
    await t.test('anonymous execution is revoked and function cannot accept another member ID',async()=>{
      await db.exec('reset role; set role anon;');
      await assert.rejects(()=>db.query('select app.get_my_team_features()'),/permission denied/);
      await db.exec('reset role;');
      const row=(await db.query(`select pronargs,prosecdef,provolatile,proconfig from pg_proc where oid='app.get_my_team_features()'::regprocedure`)).rows[0];
      assert.equal(row.pronargs,0);assert.equal(row.prosecdef,true);assert.equal(row.provolatile,'s');
      assert.ok(row.proconfig.some(v=>v.startsWith('search_path=')));
    });
  } finally { await db.close(); }
});
