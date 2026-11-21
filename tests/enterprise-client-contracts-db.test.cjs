const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const C = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222', G = '33333333-3333-4333-8333-333333333333', G2 = '44444444-4444-4444-8444-444444444444';
const CID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const features = '["client.custom_contracts","client.priority_support"]';
test('versioned contracts enforce ownership, immutable publication, explicit acceptance and safe priority provenance', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema app;create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
      create table app.users(id uuid primary key,user_type text);
      create table app.admin_users(user_id uuid,is_active boolean);
      create table app.clients(id uuid primary key,user_id uuid,company_name text,is_active boolean,is_suspended boolean);
      create table app.guards(id uuid primary key,user_id uuid,is_active boolean);
      create table app.account_closures(user_id uuid primary key);
      create table app.user_entitlements_data(user_id uuid primary key,is_active boolean,audience text,features jsonb);
      create table app.jobs(id uuid primary key,client_id uuid,status text,is_draft boolean default false,is_deleted boolean default false);
      create table app.job_applications(job_id uuid,guard_id uuid);
      create table app.job_assignments(id uuid primary key,job_id uuid,guard_id uuid,status text);
      create table app.job_invites(job_id uuid,guard_id uuid);
      create table app.support_tickets(id uuid primary key,client_id uuid,priority text,status text);
      grant usage on schema app,auth to anon,authenticated,service_role;
      insert into auth.users values('${C}',now(),null,null),('${OTHER}',now(),null,null),('${G}',now(),null,null),('${G2}',now(),null,null);
      insert into app.clients values('${CID}','${C}','QA',true,false),('${OID}','${OTHER}','Other',true,false);
      insert into app.guards values('${G}','${G}',true),('${G2}','${G2}',true);
      insert into app.user_entitlements_data values('${C}',true,'client','${features}'),('${OTHER}',true,'client','[]');`);
    const role = fs.readFileSync('supabase/migrations/20261120183707_quickguard_profile_role_compatibility.sql','utf8');
    await db.exec(role.slice(0,role.indexOf('create or replace function app.get_my_message_partners')));
    const file = fs.readdirSync('supabase/migrations').find(name => name.endsWith('_enterprise_client_contracts_and_priority.sql'));
    await db.exec(fs.readFileSync('supabase/migrations/' + file,'utf8'));
    const root = async (sql, args=[]) => { await db.exec('reset role');return db.query(sql,args); };
    const as = async user => db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`);
    async function rpc(user,name,args=[]) { await as(user);return (await db.query(`select app.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result; }
    const settings = () => rpc(C,'get_my_contract_settings');
    const save = (id,title,terms,expected=null,user=C) => rpc(user,'save_my_contract_template',[id,title,terms,expected]);
    const job = async (client=CID,status='open') => { const id=randomUUID();await root('insert into app.jobs(id,client_id,status,is_draft) values($1,$2,$3,$4)',[id,client,status,status==='draft']);return id; };
    let v1, v2, j1, j2;
    await t.test('profile-only client can create an immutable default and retry without duplicating it', async () => {
      assert.equal((await settings()).allowed,true);v1=randomUUID();
      const result=await save(v1,'First contract','Terms, with "quotes"\nand a second line.');assert.equal(result.default_template_id,v1);assert.equal(result.templates.length,1);
      const retry=await save(v1,'First contract','Terms, with "quotes"\nand a second line.');assert.equal(retry.replayed,true);assert.equal(retry.templates.length,1);
      await assert.rejects(()=>save(v1,'Changed','Different'),/retry differs/);
      await assert.rejects(()=>save(randomUUID(),'Other','Foreign',null,OTHER),/permission denied|privilege/i);
    });
    await t.test('all posting paths attach a snapshot, drafts attach only on publication, and old jobs do not change', async () => {
      j1=await job();j2=await job(CID,'draft');assert.equal((await root('select count(*)::int n from app.job_contracts where job_id=$1',[j2])).rows[0].n,0);
      await root("update app.jobs set status='open',is_draft=false where id=$1",[j2]);
      v2=randomUUID();await save(v2,'Second contract','Second immutable terms',v1);
      const j3=await job();const rows=(await root('select * from app.job_contracts order by title')).rows;
      assert.equal(rows.length,3);assert.equal(rows.find(row=>row.job_id===j1).template_id,v1);assert.equal(rows.find(row=>row.job_id===j2).template_id,v1);assert.equal(rows.find(row=>row.job_id===j3).template_id,v2);
      const replay=await save(v1,'First contract','Terms, with "quotes"\nand a second line.');assert.equal(replay.default_template_id,v2);
      await assert.rejects(()=>rpc(C,'set_my_default_contract',[v1,null]),/changed/);
      const foreign=await job(OID);assert.equal((await rpc(OTHER,'get_job_contract',[foreign])).contract,null);
    });
    await t.test('guard must explicitly accept the exact attached hash before any assignment path succeeds', async () => {
      const detail=await rpc(G,'get_job_contract',[j1]);assert.equal(detail.can_accept,true);assert.equal(detail.contract.accepted_at,null);
      await assert.rejects(()=>root("insert into app.job_assignments values($1,$2,$3,'selected')",[randomUUID(),j1,G]),/must review and accept/);
      await assert.rejects(()=>rpc(G,'accept_job_contract',[j1,'0'.repeat(64)]),/Contract changed/);
      await assert.rejects(()=>rpc(C,'accept_job_contract',[j1,detail.contract.content_sha256]),/permission denied|privilege/i);
      const accepted=await rpc(G,'accept_job_contract',[j1,detail.contract.content_sha256]);assert.ok(accepted.contract.accepted_at);
      const replay=await rpc(G,'accept_job_contract',[j1,detail.contract.content_sha256]);assert.equal(replay.contract.accepted_at,accepted.contract.accepted_at);
      await root("insert into app.job_assignments values($1,$2,$3,'selected')",[randomUUID(),j1,G]);
      await assert.rejects(()=>root("insert into app.job_assignments values($1,$2,$3,'confirmed')",[randomUUID(),j1,G2]),/must review and accept/);
      assert.equal((await root('select count(*)::int n from app.job_contract_acceptances')).rows[0].n,1);
    });
    await t.test('unrelated clients, hidden jobs, closed identities and anonymous callers cannot read or accept terms', async () => {
      await assert.rejects(()=>rpc(OTHER,'get_job_contract',[j1]),/permission denied|privilege/i);
      await root("update app.jobs set status='confirmed' where id=$1",[j2]);
      await assert.rejects(()=>rpc(G2,'get_job_contract',[j2]),/permission denied|privilege/i);
      await root('insert into app.account_closures values($1)',[G]);await assert.rejects(()=>rpc(G,'get_job_contract',[j1]),/permission denied|privilege/i);await root('delete from app.account_closures');
      await root('update app.jobs set is_deleted=true where id=$1',[j1]);await assert.rejects(()=>rpc(G,'get_job_contract',[j1]),/permission denied|privilege/i);await root('update app.jobs set is_deleted=false where id=$1',[j1]);
      await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select app.get_my_contract_settings()'),/permission denied/);
    });
    await t.test('contract versions and acceptances cannot be edited, and browser table access stays private', async () => {
      for(const table of ['client_contract_templates','job_contracts','job_contract_acceptances']) await assert.rejects(()=>root('update app.'+table+' set content_sha256=$1',['0'.repeat(64)]),/immutable/);
      await as(C);
      for(const table of ['client_contract_templates','client_contract_defaults','job_contracts','job_contract_acceptances']) {
        await assert.rejects(()=>db.query('select * from app.'+table),/permission denied/);
        await assert.rejects(()=>db.query('delete from app.'+table),/permission denied/);
      }
      await assert.rejects(()=>db.query("select app.qg_client_has_owned_feature($1,'client.custom_contracts')",[C]),/permission denied/);
      const acl=(await root("select proname,proconfig from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='app' and proname='accept_job_contract'")).rows[0];assert.ok(acl.proconfig.includes('search_path=""'));
    });
    await t.test('plan loss blocks new contract configuration but preserves previously agreed job terms', async () => {
      await root('update app.user_entitlements_data set is_active=false where user_id=$1',[C]);assert.equal((await settings()).allowed,false);
      await assert.rejects(()=>save(randomUUID(),'Denied','Terms',v2),/permission denied|privilege/i);
      assert.ok((await rpc(G,'get_job_contract',[j1])).contract.accepted_at);
      await root('update app.user_entitlements_data set is_active=true where user_id=$1',[C]);
      await rpc(C,'set_my_default_contract',[null,v2]);const future=await job();assert.equal((await rpc(C,'get_job_contract',[future])).contract,null);
    });
    await t.test('silent default and acceptance writes roll back instead of reporting false success', async () => {
      const before=(await settings()).templates.length;
      await db.exec(`reset role;create function app.skip_contract_write() returns trigger language plpgsql as $$begin return null;end$$;create trigger skip_contract_default before insert or update on app.client_contract_defaults for each row execute function app.skip_contract_write();`);
      await assert.rejects(()=>save(randomUUID(),'Not committed','Skipped terms'),/could not be confirmed/);
      assert.equal((await settings()).templates.length,before);
      await root('drop trigger skip_contract_default on app.client_contract_defaults');
      await rpc(C,'set_my_default_contract',[v1,null]);const id=await job();const detail=await rpc(G2,'get_job_contract',[id]);
      await root('create trigger skip_contract_acceptance before insert on app.job_contract_acceptances for each row execute function app.skip_contract_write()');
      await assert.rejects(()=>rpc(G2,'accept_job_contract',[id,detail.contract.content_sha256]),/could not be confirmed/);
      await assert.rejects(()=>root("insert into app.job_assignments values($1,$2,$3,'selected')",[randomUUID(),id,G2]),/must review and accept/);
      await root('drop trigger skip_contract_acceptance on app.job_contract_acceptances');
    });
    await t.test('priority service tier is derived server-side, cannot be forged or rewritten and keeps severity separate', async () => {
      const premium=randomUUID(),normal=randomUUID();
      await root("insert into app.support_tickets(id,client_id,priority,status,support_tier) values($1,$2,'normal','open','standard')",[premium,CID]);
      await root("insert into app.support_tickets(id,client_id,priority,status,support_tier) values($1,$2,'urgent','open','priority')",[normal,OID]);
      let rows=(await root('select * from app.support_tickets')).rows;assert.equal(rows.find(row=>row.id===premium).support_tier,'priority');assert.equal(rows.find(row=>row.id===normal).support_tier,'standard');assert.equal(rows.find(row=>row.id===normal).priority,'urgent');
      await root("update app.support_tickets set support_tier='standard' where id=$1",[premium]);rows=(await root('select * from app.support_tickets where id=$1',[premium])).rows;assert.equal(rows[0].support_tier,'priority');
    });
  } finally { await db.close(); }
});
