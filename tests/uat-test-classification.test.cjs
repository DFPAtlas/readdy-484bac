const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const migration = fs.readFileSync('supabase/migrations/20261123125707_protect_guard_test_account_flag.sql','utf8');
const repair = fs.readFileSync('scripts/ops/20261123-classify-owned-uat-guard-fixtures.sql','utf8');
const targets = [...repair.matchAll(/\('([0-9a-f-]+)'::uuid,'([0-9a-f-]+)'::uuid,'([^']+)','([^']+)'\)/g)].map(m=>({id:m[1],user_id:m[2],persona:m[3],full_name:m[4]}));
async function fixture() {
 const db=new PGlite();
 await db.exec(`create schema app;create schema auth;
 create role authenticated;create role anon;create role service_role bypassrls;
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb$$;
 create function app.is_active_admin() returns boolean language sql as $$select coalesce((auth.jwt()->>'admin')::boolean,false) and auth.jwt()->>'aal'='aal2'$$;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb);
 create table app.guards(id uuid primary key,user_id uuid unique,full_name text,email text,bio text,sia_licence_number text,is_test_account boolean not null default false,verification_status text default 'pending',is_active boolean default false,updated_at timestamptz default now());
 create table app.account_closures(user_id uuid);
 create table app.admin_activity_log(id bigserial,admin_username text not null,admin_name text,action_type text not null,action_description text not null,target_type text,target_name text,entity_type text,entity_id uuid,metadata jsonb,changes jsonb);
 grant usage on schema app,auth to authenticated,anon,service_role;
 grant select,insert,update on app.guards to authenticated,service_role;
 alter table app.guards enable row level security;
 create policy own_rows on app.guards to authenticated using(user_id=(auth.jwt()->>'sub')::uuid or app.is_active_admin()) with check(user_id=(auth.jwt()->>'sub')::uuid or app.is_active_admin());`);
 for (const t of targets) {
  await db.query('insert into auth.users values($1,$2,$3,$4)',[t.user_id,t.persona+'@example.test',{uat_run_id:'launch-2026-11',uat_persona:t.persona},{}]);
  await db.query('insert into app.guards(id,user_id,full_name,email,bio,sia_licence_number) values($1,$2,$3,$4,$5,$6)',[t.id,t.user_id,t.full_name,t.persona+'@example.test',t.persona.startsWith('guard-')?'Synthetic QuickGuard UAT persona '+t.persona:null,t.persona.startsWith('guard-')?'UAT-'+t.persona.toUpperCase():null]);
 }
 return db;
}
async function role(db, value='authenticated', claims={}) {
 await db.exec('reset role');
 await db.query("select set_config('test.jwt',$1,false)",[JSON.stringify({role:value,sub:targets[0].user_id,aal:'aal1',...claims})]);
 if(value!=='postgres')await db.exec('set role '+value);
}
test('ordinary owners can currently flip the flag; migration blocks both directions, inserts and definer RPC bypass while allowing profile edits',async()=>{
 const db=await fixture();try {
  await role(db);await db.exec(`update app.guards set is_test_account=true where id='${targets[0].id}'`);
  await role(db,'postgres');await db.exec(migration);
  await db.exec(`create function app.unsafe_fixture_rpc() returns void language sql security definer as $$update app.guards set is_test_account=false where id='${targets[0].id}'$$;`);
  await role(db);
  await assert.rejects(db.exec(`update app.guards set is_test_account=false where id='${targets[0].id}'`),{code:'42501',message:'Test-account classification requires an active admin with MFA'});
  await assert.rejects(db.exec('select app.unsafe_fixture_rpc()'),{code:'42501'});
  await db.exec(`update app.guards set bio='Profile edit',is_test_account=true where id='${targets[0].id}'`);
  assert.equal((await db.query('select bio from app.guards')).rows[0].bio,'Profile edit');
  const other='00000000-0000-0000-0000-000000000001';await role(db,'authenticated',{sub:other});
  await assert.rejects(db.exec(`insert into app.guards(id,user_id,is_test_account) values('${other}','${other}',true)`),{code:'42501'});
  await db.exec(`insert into app.guards(id,user_id) values('${other}','${other}')`);
  await role(db,'postgres');await db.exec(`update app.guards set is_test_account=false where id='${targets[0].id}'`);await role(db);
  await assert.rejects(db.exec(`update app.guards set is_test_account=true where id='${targets[0].id}'`),{code:'42501'});
 }finally{await db.close();}
});
test('active MFA admins and service writes remain allowed; admin without MFA is denied; migration can replay',async()=>{
 const db=await fixture();try {
  await db.exec(migration);await db.exec(migration);
  await role(db,'authenticated',{admin:true});await assert.rejects(db.exec(`update app.guards set is_test_account=true where id='${targets[0].id}'`),{code:'42501'});
  await role(db,'authenticated',{admin:true,aal:'aal2'});await db.exec(`update app.guards set is_test_account=true`);
  await role(db,'service_role');await db.exec('update app.guards set is_test_account=false');
  await role(db,'postgres');assert.equal((await db.query('select count(*)::int n from app.guards where is_test_account')).rows[0].n,0);
 }finally{await db.close();}
});
test('reviewed fixture correction changes only six flags, records six audits and replays without duplicate audits',async()=>{
 const db=await fixture();try {
  await db.exec(migration);const before=(await db.query("select id,to_jsonb(g)-'is_test_account'-'updated_at' as protected from app.guards g order by id")).rows;
  await db.exec(repair);assert.equal((await db.query('select count(*)::int n from app.guards where is_test_account')).rows[0].n,6);
  assert.deepEqual((await db.query("select id,to_jsonb(g)-'is_test_account'-'updated_at' as protected from app.guards g order by id")).rows,before);
  await db.exec(repair);assert.equal((await db.query('select count(*)::int n from app.admin_activity_log')).rows[0].n,6);
 }finally{await db.close();}
});
test('forged user metadata, changed identity, closed account and audit failure roll back the entire classification',async()=>{
 for(const setup of [
  db=>db.query("update auth.users set raw_app_meta_data='{}',raw_user_meta_data=$1 where id=$2",[{uat_run_id:'launch-2026-11',uat_persona:targets[5].persona},targets[5].user_id]),
  db=>db.query("update app.guards set email='different@example.test' where id=$1",[targets[5].id]),
  db=>db.query('insert into app.account_closures values($1)',[targets[5].user_id]),
  db=>db.exec("alter table app.admin_activity_log add constraint reject_audit check(target_name!='UAT Door Supervisor')")
 ]) {
  const db=await fixture();try {await db.exec(migration);await setup(db);await assert.rejects(db.exec(repair));
   assert.equal((await db.query('select count(*)::int n from app.guards where is_test_account')).rows[0].n,0);
   assert.equal((await db.query('select count(*)::int n from app.admin_activity_log')).rows[0].n,0);
  }finally{await db.close();}
 }
});
test('seed classification requires protected Auth provenance and confirms a scoped write for guards and client guard shells',async()=>{
 const { assertOwnedUatUser,markUatGuardProfiles }=await import('../scripts/uat/identity.mjs');
 const persona={key:'guard-pending',kind:'guard',email:'fixture@example.test'};
 const user={id:targets[0].user_id,email:persona.email,app_metadata:{uat_run_id:'run',uat_persona:persona.key}};
 const writes=[];const db={from(table){assert.equal(table,'guards');return{update(body){writes.push(body);return{eq(key,value){assert.equal(key,'user_id');assert.equal(value,user.id);return{select:async()=>({data:[{id:'guard',is_test_account:true}],error:null})};}};}};}};
 await markUatGuardProfiles(db,user,persona,'run');assert.deepEqual(writes,[{is_test_account:true}]);
 for(const bad of [{...user,app_metadata:{}},{...user,email:'other@example.test'},{...user,app_metadata:{uat_run_id:'other',uat_persona:persona.key}},{...user,app_metadata:{},user_metadata:user.app_metadata}])assert.throws(()=>assertOwnedUatUser(bad,persona,'run'));
 const client={...persona,kind:'client'};await markUatGuardProfiles(db,user,client,'run');assert.equal(writes.length,2);
 const failed={from(){return{update(){return{eq(){return{select:async()=>({data:[],error:null})};}};}};}};
 await assert.rejects(markUatGuardProfiles(failed,user,persona,'run'),/not confirmed/);await markUatGuardProfiles(failed,user,client,'run');
});
test('the actual seed marks guard and client-shell rows and refuses to overwrite an unowned existing Auth account',async()=>{
 const ts=require('typescript');const identity=await import('../scripts/uat/identity.mjs');const personas=await import('../scripts/uat/personas.mjs');
 const code=ts.transpileModule(fs.readFileSync('scripts/uat/seed.mjs','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 async function run(unowned=false){const guards=new Map(),writes=[];let next=0,authUpdates=0;
  const db={auth:{admin:{async listUsers(){return {data:{users:unowned?[{id:'unowned',email:'fixture+qg-launch-2026-11-client-free@example.test',app_metadata:{}}]:[]},error:null};},async updateUserById(){authUpdates++;throw Error('Unexpected account overwrite');},async createUser(attributes){const user={id:'user-'+(++next),...attributes};guards.set(user.id,{id:'shell-'+next,user_id:user.id,is_test_account:false});return {data:{user},error:null};}}},from(table){return {
   upsert:async row=>{writes.push({table,row});if(table==='guards')guards.set(row.user_id,{...row});return{data:[row],error:null};},
   delete:()=>({eq:async()=>({data:[],error:null})}),
   update:body=>({eq(key,value){assert.equal(table,'guards');assert.equal(key,'user_id');const row=guards.get(value);if(row)Object.assign(row,body);return{select:async()=>({data:row?[{...row}]:[],error:null})};}}),
  };}};
  const requireMock=name=>{if(name==='@supabase/supabase-js')return{createClient:()=>db};if(name==='./personas.mjs')return personas;if(name==='./identity.mjs')return identity;throw Error('Unexpected import '+name);};
  const processMock={env:{NEXT_PUBLIC_SUPABASE_URL:'https://vnywjfpkepjgclkbcmsj.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',QG_UAT_INBOX:'fixture@example.test',QG_UAT_SHARED_PASSWORD:'fixture-password-for-unit-tests'},argv:['node','seed']};
  const running=new AsyncFunction('require','process','console','exports',code)(requireMock,processMock,{log(){}},{});
  if(unowned){await assert.rejects(running,/protected UAT provenance/);assert.equal(authUpdates,0);assert.equal(writes.length,0);}
  else{await running;assert.equal(guards.size,7);for(const row of guards.values())assert.equal(row.is_test_account,true);assert.equal(writes.filter(x=>x.table==='guards').length,4);}
 }
 await run();await run(true);
});
