const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { installTeamProfileCompatibility } = require('./helpers/team-profile-compat.cjs');
const { PGlite } = require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222', C='33333333-3333-4333-8333-333333333333', D='44444444-4444-4444-8444-444444444444';
const CA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', CB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', CC='cccccccc-cccc-4ccc-8ccc-cccccccccccc', CD='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const API='client.api_access', TEAM='client.team_access', POST='client.post_job';
const email = id => ({[A]:'owner@example.test',[B]:'member@example.test',[C]:'foreign@example.test',[D]:'second@example.test'})[id];
const company = id => ({[A]:CA,[B]:CB,[C]:CC,[D]:CD})[id];
test('team management SQL authorizes, confirms and replays only owned changes',async t=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create schema app;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
      create table app.guards(id uuid primary key,user_id uuid,is_active boolean);
      create table app.admin_users(user_id uuid primary key,is_active boolean);
      create table app.users(id uuid primary key,email text,full_name text,user_type text);
      create table app.clients(id uuid primary key,user_id uuid,company_name text,subscription_tier text,is_active boolean,is_suspended boolean);
      create table app.user_entitlements_data(user_id uuid primary key,features jsonb,is_active boolean,audience text);
      create table app.account_closures(user_id uuid primary key);
      create table public.team_member_configs(id uuid primary key default gen_random_uuid(),admin_user_id uuid not null,member_user_id uuid not null,enabled_features jsonb not null default '[]',created_at timestamptz not null default now(),unique(admin_user_id,member_user_id));
      alter table public.team_member_configs enable row level security;
      create policy team_read on public.team_member_configs for select to authenticated using(admin_user_id=auth.uid() or member_user_id=auth.uid());
      create policy team_write on public.team_member_configs for all to authenticated using(admin_user_id=auth.uid()) with check(admin_user_id=auth.uid());
      create view app.team_member_configs with(security_invoker=true) as select * from public.team_member_configs;
      alter table app.users enable row level security;create policy own_user on app.users for select to authenticated using(id=auth.uid());
      alter table app.user_entitlements_data enable row level security;create policy own_ent on app.user_entitlements_data for select to authenticated using(user_id=auth.uid());
      grant usage on schema app,auth to anon,authenticated,service_role;
      grant all on public.team_member_configs,app.team_member_configs to authenticated;
      grant update(enabled_features),insert(admin_user_id,member_user_id) on public.team_member_configs,app.team_member_configs to authenticated;
      grant select on app.users,app.user_entitlements_data to authenticated;`);
    for(const suffix of ['_team_feature_permissions.sql','_client_team_management.sql']) {
      const file=fs.readdirSync('supabase/migrations').find(f=>f.endsWith(suffix));
      await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
    }
    await installTeamProfileCompatibility(db, { management: true });
    async function root(sql,values=[]) { await db.exec('reset role;');return db.query(sql,values); }
    async function ddl(sql) { await db.exec('reset role;'+sql); }
    async function seed() {
      await root('truncate app.guards,app.admin_users,app.client_team_operations,app.client_team_state,public.team_member_configs,app.account_closures,app.user_entitlements_data,app.clients,app.users,auth.users');
      for(const [i,id] of [A,B,C,D].entries()) {
        await root('insert into auth.users values($1,$2,now(),null,null)',[id,email(id)]);
        await root('insert into app.users values($1,$2,$3,$4)',[id,'editable-'+email(id),'Synthetic '+i,'client']);
        await root('insert into app.clients values($1,$2,$3,$4,true,false)',[company(id),id,'Company '+i,'Enterprise']);
        await root('insert into app.user_entitlements_data values($1,$2,true,$3)',[id,JSON.stringify(id===A||id===C?[TEAM,API,POST]:[POST]),'client']);
      }
    }
    async function call(action,extra={},who=A) {
      await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${who}',false);`);
      return (await db.query('select app.manage_my_client_team($1::jsonb) as data',[JSON.stringify({action,request_id:randomUUID(),expected_user_id:who,expected_client_id:company(who),...extra})])).rows[0].data;
    }
    const rev=async(who=A)=>(await root('select coalesce((select revision from app.client_team_state where owner_user_id=$1),0)::int as r',[who])).rows[0].r;
    const rows=async()=>(await root('select * from public.team_member_configs order by id')).rows;
    async function operation(action,member=B,extra={},who=A) { return {operation_id:randomUUID(),config_id:randomUUID(),member_user_id:member,expected_revision:await rev(who),...(action==='add'?{email:email(member)}:{}),...extra}; }
    async function add(member=B,who=A) {const op=await operation('add',member,{},who);return {op,result:await call('add',op,who)};}
    async function effective(who) {await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${who}',false);`);return(await db.query('select app.get_my_team_features() as f')).rows[0].f;}

    await t.test('profile-only owner and member can list, search, add, delegate, replay and remove without legacy mirrors',async()=>{
      await seed();await root('delete from app.users where id in ($1,$2)',[A,B]);
      assert.deepEqual((await call('list')).members,[]);
      assert.equal((await call('search',{email:email(B)})).candidates[0].member_user_id,B);
      const {op,result}=await add();
      assert.equal((await call('list')).members[0].member_available,true);
      assert.equal((await call('add',op)).replayed,true);
      await call('update',await operation('update',B,{config_id:result.config_id,expected_features:[],enabled_features:[API]}));
      assert.deepEqual(await effective(B),[API]);
      await call('remove',await operation('remove',B,{config_id:result.config_id}));
      assert.deepEqual(await effective(B),[]);assert.deepEqual(await rows(),[]);
      assert.equal((await root('select count(*)::int n from app.users where id in ($1,$2)',[A,B])).rows[0].n,0);
    });
    await t.test('profile-only identities with ambiguous, conflicting or invalid server records fail closed',async()=>{
      for(const who of [A,B]) {
        for(const sql of [
          `insert into app.guards values(gen_random_uuid(),'${who}',true)`,
          `insert into app.admin_users values('${who}',true)`,
          `insert into app.clients values(gen_random_uuid(),'${who}','Duplicate','Enterprise',false,false)`,
          `update auth.users set email_confirmed_at=null where id='${who}'`,
          `update auth.users set banned_until=now()+interval '1 day' where id='${who}'`,
          `update auth.users set deleted_at=now() where id='${who}'`,
          `update app.clients set is_active=false where user_id='${who}'`,
          `update app.clients set is_suspended=true where user_id='${who}'`,
          `insert into app.account_closures values('${who}')`,
          `insert into app.users values('${who}','conflict@example.test','Conflict','guard')`,
        ]) {
          await seed();await root('delete from app.users where id in ($1,$2)',[A,B]);await root(sql);
          if(who===A) await assert.rejects(()=>call('list'),/active owned/);
          else {assert.deepEqual((await call('search',{email:email(B)})).candidates,[]);await assert.rejects(()=>add(),/Member account/);}
          assert.deepEqual(await rows(),[]);
        }
      }
    });
    await t.test('owned list uses verified Auth email and never exposes foreign members or private owner rows',async()=>{
      await seed();const one=await add();await add(D,C);
      const data=await call('list');assert.equal(data.members.length,1);assert.equal(data.members[0].member_user_id,B);assert.equal(data.members[0].email,email(B));assert.equal(data.team_revision,1);
      assert.equal((await db.query(`select * from app.users where id='${B}'`)).rows.length,0);
      assert.deepEqual(await effective(B),[]);
      await assert.rejects(async()=>call('list',{},B),/active owned Team Access/);
      const other=await call('list',{},C);assert.equal(other.members[0].member_user_id,D);
      assert.equal(one.result.committed,true);
    });
    await t.test('search requires exact verified email and excludes self, existing teams and ineligible accounts',async()=>{
      await seed();assert.equal((await call('search',{email:' MEMBER@EXAMPLE.TEST '})).candidates[0].member_user_id,B);
      assert.deepEqual((await call('search',{email:'%@example.test'})).candidates,[]);
      await assert.rejects(async()=>call('search',{email:'mem'}),/full email/);
      assert.deepEqual((await call('search',{email:email(A)})).candidates,[]);
      assert.deepEqual((await call('search',{email:'editable-'+email(B)})).candidates,[]);
      await add();assert.deepEqual((await call('search',{email:email(B)})).candidates,[]);
      await root('update auth.users set email_confirmed_at=null where id=$1',[D]);assert.deepEqual((await call('search',{email:email(D)})).candidates,[]);
    });
    await t.test('add starts with no delegated features and stores an atomic private receipt without raw email',async()=>{
      await seed();const {op,result}=await add();assert.equal(result.outcome,'added');assert.equal(result.operation_revision,1);
      assert.deepEqual((await rows())[0].enabled_features,[]);
      const receipt=(await root('select * from app.client_team_operations')).rows[0];assert.equal(receipt.id,op.operation_id);assert.ok(!JSON.stringify(receipt).includes(email(B)));
      const replay=await call('add',op);assert.equal(replay.replayed,true);assert.equal(await rev(),1);assert.equal((await rows()).length,1);
      const duplicate=await operation('add',B);const confirmed=await call('add',duplicate);assert.equal(confirmed.outcome,'already_present');assert.equal(confirmed.config_id,result.config_id);assert.equal((await rows()).length,1);
    });
    await t.test('global owner uniqueness and scope checks reject foreign or changed targets without writes',async()=>{
      await seed();const {op}=await add();
      await assert.rejects(async()=>call('add',await operation('add',B,{},C),C),/not available/);
      await assert.rejects(async()=>call('add',{...op,expected_client_id:CC}),/Company context/);
      await assert.rejects(async()=>call('remove',{...op,expected_revision:0},C),/different request/);
      await assert.rejects(async()=>call('remove',{...op,operation_id:randomUUID(),expected_revision:0},C),/context changed/);
      assert.equal((await rows())[0].admin_user_id,A);
      await assert.rejects(()=>root('insert into public.team_member_configs values($1,$2,$3,$4,now())',[randomUUID(),C,B,'[]']),/unique/);
    });
    await t.test('feature selection is plan bounded and the previous effective-feature reader observes changes',async()=>{
      await seed();const {result}=await add();const update=await operation('update',B,{config_id:result.config_id,expected_features:[],enabled_features:[API]});
      await call('update',update);assert.deepEqual(await effective(B),[API]);
      await assert.rejects(async()=>call('update',await operation('update',B,{config_id:result.config_id,expected_features:[API],enabled_features:[API,'client.unknown']})),/current plan/);
      await assert.rejects(async()=>call('update',await operation('update',B,{config_id:result.config_id,expected_features:[],enabled_features:[POST]})),/changed elsewhere/);
      await root('update public.team_member_configs set enabled_features=$1 where id=$2',['["client.legacy"]',result.config_id]);
      await call('update',await operation('update',B,{config_id:result.config_id,expected_features:['client.legacy'],enabled_features:[]}));
      await assert.rejects(async()=>call('update',await operation('update',B,{config_id:result.config_id,expected_features:[],enabled_features:['client.legacy']})),/current plan/);
    });
    await t.test('revision checks and durable replay prevent late duplicate and first-arriving old requests from reversing newer changes',async()=>{
      await seed();const {result}=await add();
      const on=await operation('update',B,{config_id:result.config_id,expected_features:[],enabled_features:[API]});
      const delayed={...on,operation_id:randomUUID()};
      await call('update',on);
      await call('update',await operation('update',B,{config_id:result.config_id,expected_features:[API],enabled_features:[]}));
      assert.equal((await call('update',on)).replayed,true);assert.equal(await rev(),3);assert.deepEqual((await rows())[0].enabled_features,[]);
      await assert.rejects(async()=>call('update',delayed),/changed elsewhere/);assert.deepEqual((await rows())[0].enabled_features,[]);
      await assert.rejects(async()=>call('update',{...on,enabled_features:[POST]}),/different request/);
    });
    await t.test('removal and replay never remove a later re-added membership',async()=>{
      await seed();const {op:originalAdd,result}=await add();
      const remove=await operation('remove',B,{config_id:result.config_id});await call('remove',remove);assert.deepEqual(await rows(),[]);
      const second=await add();assert.notEqual(second.result.config_id,result.config_id);
      assert.equal((await call('remove',remove)).replayed,true);assert.equal((await rows())[0].id,second.result.config_id);
      assert.equal((await call('add',originalAdd)).replayed,true);assert.equal((await rows()).length,1);
      await assert.rejects(async()=>call('remove',await operation('remove',B,{config_id:result.config_id})),/changed/);
      await call('remove',await operation('remove',B,{config_id:second.result.config_id}));
      assert.equal((await call('remove',await operation('remove',B,{config_id:second.result.config_id}))).outcome,'already_absent');
    });
    await t.test('receipt failures and zero-row trigger writes roll back membership and revision atomically',async()=>{
      await seed();await ddl(`create function public.reject_receipt() returns trigger language plpgsql as $$begin raise exception 'receipt failed';end$$;create trigger reject_receipt before insert on app.client_team_operations for each row execute function public.reject_receipt();`);
      await assert.rejects(()=>add(),/receipt failed/);assert.deepEqual(await rows(),[]);assert.equal(await rev(),0);
      await root('drop trigger reject_receipt on app.client_team_operations');
      await ddl(`create function public.skip_team_insert() returns trigger language plpgsql as $$begin return null;end$$;create trigger skip_team before insert on public.team_member_configs for each row execute function public.skip_team_insert();`);
      await assert.rejects(()=>add(),/could not be confirmed/);assert.deepEqual(await rows(),[]);assert.equal(await rev(),0);
      await root('drop trigger skip_team on public.team_member_configs');
    });
    await t.test('closed, suspended, banned, unconfirmed and wrong-role identities cannot receive or manage grants',async()=>{
      for(const sql of [`update auth.users set banned_until=now()+interval '1 day' where id='${B}'`,`update auth.users set email_confirmed_at=null where id='${B}'`,`update auth.users set deleted_at=now() where id='${B}'`,`update app.clients set is_active=false where user_id='${B}'`,`update app.clients set is_suspended=true where user_id='${B}'`,`update app.users set user_type='guard' where id='${B}'`,`insert into app.account_closures values('${B}')`]) {
        await seed();await root(sql);await assert.rejects(()=>add(),/Member account/);assert.deepEqual(await rows(),[]);
      }
      for(const sql of [`insert into app.account_closures values('${A}')`,`update app.clients set is_suspended=true where user_id='${A}'`,`update app.user_entitlements_data set features='[]' where user_id='${A}'`]) {
        await seed();await root(sql);await assert.rejects(async()=>call('list'),/active owned/);
      }
      await seed();const {result}=await add();await root('update app.clients set is_active=false where user_id=$1',[B]);
      await call('remove',await operation('remove',B,{config_id:result.config_id}));assert.deepEqual(await rows(),[]);
    });
    await t.test('pagination returns every owned member and refuses a mixed-revision continuation',async()=>{
      await seed();
      for(let i=1;i<=405;i++) {
        const id=i.toString(16).padStart(8,'0')+'-0000-4000-8000-000000000000';
        await root('insert into public.team_member_configs(id,admin_user_id,member_user_id) values($1,$2,$1)',[id,A]);
      }
      const first=await call('list');assert.equal(first.members.length,200);assert.equal(first.has_more,true);assert.equal(first.members[0].member_available,false);
      const second=await call('list',{after_id:first.next_after_id,expected_revision:0});const third=await call('list',{after_id:second.next_after_id,expected_revision:0});
      assert.equal(second.members.length,200);assert.equal(third.members.length,5);assert.equal(third.next_after_id,null);
      await add();await assert.rejects(async()=>call('list',{after_id:first.next_after_id,expected_revision:0}),/changed while loading/);
    });
    await t.test('browser direct table/column writes and private receipt reads are revoked; anonymous RPC execution is denied',async()=>{
      await seed();
      await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${A}',false);`);
      for(const table of ['public.team_member_configs','app.team_member_configs']) {
        await assert.rejects(()=>db.query(`insert into ${table}(admin_user_id,member_user_id) values('${A}','${B}')`),/permission denied/);
        await assert.rejects(()=>db.query(`update ${table} set enabled_features='[]'`),/permission denied/);
        await assert.rejects(()=>db.query(`delete from ${table}`),/permission denied/);
      }
      for(const table of ['app.client_team_operations','app.client_team_state']) await assert.rejects(()=>db.query('select * from '+table),/permission denied/);
      await db.exec('reset role;set role anon;');await assert.rejects(()=>db.query(`select app.manage_my_client_team('{}')`),/permission denied/);
      const f=(await root(`select prosecdef,proconfig from pg_proc where oid='app.manage_my_client_team(jsonb)'::regprocedure`)).rows[0];assert.equal(f.prosecdef,true);assert.ok(f.proconfig.includes('search_path=""'));
    });
    await t.test('restrictive policies keep direct mutations blocked even after an accidental table regrant',async()=>{
      await seed();const {result}=await add();await root('grant insert,update,delete on public.team_member_configs,app.team_member_configs to authenticated');
      await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${A}',false);`);
      await assert.rejects(()=>db.query(`insert into public.team_member_configs(admin_user_id,member_user_id) values('${A}','${D}')`),/row-level security/);
      assert.equal((await db.query(`update app.team_member_configs set enabled_features='["${API}"]' returning id`)).rows.length,0);
      assert.equal((await db.query('delete from public.team_member_configs returning id')).rows.length,0);
      assert.equal((await rows())[0].id,result.config_id);assert.deepEqual((await rows())[0].enabled_features,[]);
    });
  } finally {await db.close();}
});
