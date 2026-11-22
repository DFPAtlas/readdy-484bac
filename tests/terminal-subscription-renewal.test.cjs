const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const migrationName=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_terminal_subscription_renewal_flag.sql'));
const migration=fs.readFileSync('supabase/migrations/'+migrationName,'utf8');
const repair=fs.readFileSync('scripts/ops/20261122-reconcile-cancelled-starter-renewal.sql','utf8');
const ID='7a010528-5acb-431f-ae27-50def502fe79',USER='f795cc3a-baf8-4654-8d7e-46c5160faec6';
async function fixture(){const db=new PGlite();await db.exec(`
 create schema app;create role anon;create role authenticated;create role service_role;
 create table app.subscriptions(id uuid primary key,user_id uuid,status text,auto_renew boolean default true,updated_at timestamptz,
 account_type text,plan_slug text,plan_amount int,currency text,stripe_subscription_id text,stripe_customer_id text,stripe_price_id text,cancelled_at timestamptz);
 create table app.clients(id uuid primary key,user_id uuid,subscription_status text,stripe_subscription_id text,stripe_customer_id text,is_active boolean);
 create table app.user_entitlements_data(user_id uuid primary key,subscription_status text,is_active boolean,features jsonb);
 create table app.account_closures(user_id uuid);
 create table app.admin_activity_log(id uuid default gen_random_uuid(),admin_username text,admin_name text,action_type text,action_description text,
 target_type text,target_name text,entity_type text,entity_id uuid,metadata jsonb,changes jsonb);
 insert into app.subscriptions values('${ID}','${USER}','cancelled',true,'2026-10-04T18:26:25Z','client','client-starter',4900,'gbp','sub_1UMtnGIMkpwfAEDTPjI4GqFt','cus_VNf6NZ3ZsI72dN','price_1TcvjNIMkpwfAEDTZ6QYTKZ3','2026-10-04T18:26:25.868Z');
 insert into app.clients values('d8de02e0-6c9f-407c-9cca-cb2f5e3f9362','${USER}','cancelled','sub_1UMtnGIMkpwfAEDTPjI4GqFt','cus_VNf6NZ3ZsI72dN',true);
 insert into app.user_entitlements_data values('${USER}','cancelled',false,'["retained"]');
 create function app.sync_status() returns trigger language plpgsql as $$begin update app.user_entitlements_data set subscription_status=new.status,is_active=new.status='active' where user_id=new.user_id;return new;end$$;
 create trigger sync_entitlements after update of status on app.subscriptions for each row execute function app.sync_status();
 `);await db.exec(migration);return db;}
async function state(db){return (await db.query(`select jsonb_build_object('subscriptions',(select jsonb_agg(to_jsonb(s) order by id) from app.subscriptions s),
 'clients',(select jsonb_agg(to_jsonb(c)) from app.clients c),'entitlements',(select jsonb_agg(to_jsonb(e)) from app.user_entitlements_data e),
 'audits',(select jsonb_agg(to_jsonb(a)) from app.admin_activity_log a)) state`)).rows[0].state;}
test('terminal inserts and status transitions override default, true and null renewal flags without blocking status/entitlement sync',async()=>{
 const db=await fixture();try{
  for(const status of ['canceled','cancelled','incomplete_expired']){
   for(const flag of [true,false,null]){
    const id=(await db.query('insert into app.subscriptions(id,status,auto_renew) values(gen_random_uuid(),$1,$2) returning id,auto_renew',[status,flag])).rows[0];assert.equal(id.auto_renew,false);
   }
   await db.query('update app.subscriptions set status=$1,auto_renew=true where id=$2',[status,ID]);
   const s=await state(db);assert.equal(s.subscriptions.find(x=>x.id===ID).auto_renew,false);
   assert.equal(s.entitlements[0].subscription_status,status);assert.equal(s.entitlements[0].is_active,false);
  }
  const row=(await db.query("insert into app.subscriptions(id,status) values(gen_random_uuid(),'cancelled') returning auto_renew")).rows[0];assert.equal(row.auto_renew,false);
 }finally{await db.close();}
});
test('nonterminal subscriptions keep existing renewal flags and status; trigger execution needs no new browser privileges',async()=>{
 const db=await fixture();try{
  for(const status of ['active','trialing','past_due','unpaid','incomplete','paused'])for(const flag of [true,false,null]){
   const row=(await db.query('insert into app.subscriptions(id,status,auto_renew) values(gen_random_uuid(),$1,$2) returning status,auto_renew',[status,flag])).rows[0];
   assert.deepEqual(row,{status,auto_renew:flag});
  }
  const privileges=(await db.query("select has_function_privilege('authenticated','app.normalize_terminal_subscription_renewal()','execute') browser,has_function_privilege('service_role','app.normalize_terminal_subscription_renewal()','execute') service")).rows[0];
  assert.deepEqual(privileges,{browser:false,service:true});
  await db.exec('grant usage on schema app to service_role;grant select,insert,update on app.subscriptions to service_role;grant select,update on app.user_entitlements_data to service_role;set role service_role');
  const inserted=(await db.query("insert into app.subscriptions(id,status) values(gen_random_uuid(),'cancelled') returning auto_renew")).rows[0];assert.equal(inserted.auto_renew,false);
  await db.query('update app.subscriptions set auto_renew=true where id=$1',[ID]);
  assert.equal((await db.query('select auto_renew from app.subscriptions where id=$1',[ID])).rows[0].auto_renew,false);
 }finally{await db.close();}
});
test('confirmed fixture flag repair preserves full profile, entitlement and other subscription fields; repeat does not duplicate audit',async()=>{
 const db=await fixture();try{
  const before=await state(db);assert.equal(before.subscriptions[0].auto_renew,true);await db.exec(repair);const after=await state(db);
  assert.equal(after.subscriptions[0].auto_renew,false);assert.deepEqual(after.clients,before.clients);assert.deepEqual(after.entitlements,before.entitlements);
  const strip=s=>Object.fromEntries(Object.entries(s).filter(([k])=>!['auto_renew','updated_at'].includes(k)));
  assert.deepEqual(strip(after.subscriptions[0]),strip(before.subscriptions[0]));assert.equal(after.audits.length,1);
  await db.exec(repair);assert.deepEqual(await state(db),after);
 }finally{await db.close();}
});
test('changed identity, status, provider binding or entitlement aborts without writes',async()=>{
 for(const change of ["update app.subscriptions set stripe_customer_id='cus_other'","update app.subscriptions set status='active'","update app.user_entitlements_data set is_active=true"]){
  const db=await fixture();try{await db.exec(change);const before=await state(db);await assert.rejects(()=>db.exec(repair),/evidence changed/);assert.deepEqual(await state(db),before);}finally{await db.close();}
 }
});
test('late audit error rolls back the renewal correction',async()=>{
 const db=await fixture();try{
  await db.exec('alter table app.admin_activity_log add constraint reject_repair_audit check(false)');
  const before=await state(db);await assert.rejects(()=>db.exec(repair),/reject_repair_audit/);assert.deepEqual(await state(db),before);
 }finally{await db.close();}
});
