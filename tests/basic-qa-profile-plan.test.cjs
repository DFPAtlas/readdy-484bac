const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const sql=fs.readFileSync('scripts/ops/20261122-reconcile-basic-qa-profile-plan.sql','utf8');
async function fixture(){const db=new PGlite();await db.exec(`
 create schema app;
 create table app.guards(id uuid primary key,user_id uuid,email text,is_test_account boolean,stripe_customer_id text,stripe_subscription_id text,
  subscription_status text,plan_slug text,subscription_plan text,plan_name text,updated_at timestamptz,
  verification_status text,verified_by uuid,is_active boolean,dashboard_access boolean,profile_completed boolean,onboarding_status text);
 create table app.subscriptions(id uuid primary key,user_id uuid,account_type text,plan_slug text,plan_name text,status text,currency text,plan_amount int,
  stripe_customer_id text,stripe_subscription_id text,stripe_price_id text,current_period_end timestamptz);
 create table app.user_entitlements_data(user_id uuid primary key,plan_slug text,plan_name text,subscription_status text,audience text,
  monthly_price_pence int,features jsonb,stripe_subscription_id text,current_period_end timestamptz);
 create table app.plans(slug text primary key,name text,audience text,monthly_price_pence int,features jsonb,active boolean);
 create table app.account_closures(user_id uuid);
 create table app.admin_activity_log(id uuid primary key default gen_random_uuid(),admin_username text,admin_name text,action_type text,action_description text,
  target_type text,target_name text,entity_type text,entity_id uuid,metadata jsonb,changes jsonb);
 insert into app.guards values('20826398-1bcf-4a93-9b61-493c3e156610','8ec6113d-7b78-4c69-a90c-86d0e4b69714','qgtest.guard@digital-footprint.uk',true,
  'cus_VcfannyExX18cO',null,'active',null,null,null,'2026-11-22T11:09:14Z','approved',null,true,true,true,'complete');
 insert into app.subscriptions values('58ea2b87-c8e7-484b-a97e-e8d0eccfdaae','8ec6113d-7b78-4c69-a90c-86d0e4b69714','guard','guard-basic','Guard Basic','active','gbp',1000,
  'cus_VO2jzA0T87Gutg','sub_1UNGf0IMkpwfAEDTfSohHVse','price_1TcvjKIMkpwfAEDTR040YjkP','2026-12-05T18:30:50Z');
 insert into app.plans values('guard-basic','Guard Basic','guard',1000,'["guard.apply_job","guard.view_jobs","guard.create_profile","guard.profile_boost"]',true);
 insert into app.user_entitlements_data select '8ec6113d-7b78-4c69-a90c-86d0e4b69714',slug,name,'active',audience,monthly_price_pence,features,'sub_1UNGf0IMkpwfAEDTfSohHVse','2026-12-05T18:30:50Z' from app.plans;
 insert into app.admin_activity_log(id,entity_type,entity_id,metadata) values('9bc73b25-02d5-4032-a46d-f8e614f20274','subscription','58ea2b87-c8e7-484b-a97e-e8d0eccfdaae','{"repair":"basic-sandbox-renewal-20261122","decision":"Keep sandbox fixture and reconcile renewal","profile_live_customer_preserved":true}');
 -- Approval recording is deliberately separate: label updates must never invoke it.
 create function app.reject_approval_mutation() returns trigger language plpgsql as $$begin raise exception 'Approval fields must not be written';end$$;
 create trigger approval_guard before update of verification_status,verified_by on app.guards for each row execute function app.reject_approval_mutation();
 `);return db;}
async function state(db){return (await db.query(`select jsonb_build_object('guard',(select to_jsonb(g) from app.guards g),
 'subscription',(select to_jsonb(s) from app.subscriptions s),'entitlement',(select to_jsonb(e) from app.user_entitlements_data e),
 'audits',(select jsonb_agg(to_jsonb(a) order by id) from app.admin_activity_log a)) state`)).rows[0].state;}
test('existing Basic labels reconcile once while live/sandbox identities, eligibility and full billing/entitlement records stay intact',async()=>{
 const db=await fixture();try{
  const before=await state(db);await db.exec(sql);const after=await state(db);
  assert.equal(after.guard.plan_slug,'guard-basic');assert.equal(after.guard.subscription_plan,'guard-basic');assert.equal(after.guard.plan_name,'Guard Basic');
  const protectedGuard=g=>Object.fromEntries(Object.entries(g).filter(([k])=>!['plan_slug','subscription_plan','plan_name','updated_at'].includes(k)));
  assert.deepEqual(protectedGuard(after.guard),protectedGuard(before.guard));assert.deepEqual(after.subscription,before.subscription);assert.deepEqual(after.entitlement,before.entitlement);
  assert.equal(after.audits.length,2);assert.equal(after.audits.filter(a=>a.action_type==='qa_profile_plan_labels_reconciled').length,1);
  await db.exec(sql);assert.deepEqual(await state(db),after);
 }finally{await db.close();}
});
test('untrusted fixture, changed provider/plan/status/closure or missing prior approval aborts without writes',async()=>{
 for(const change of ["update app.guards set is_test_account=false","update app.guards set stripe_customer_id='cus_other'",
  "update app.guards set plan_slug='guard-elite'","update app.user_entitlements_data set subscription_status='canceled'",
  "delete from app.admin_activity_log","insert into app.account_closures select user_id from app.guards"]){
  const db=await fixture();try{await db.exec(change);const before=await state(db);await assert.rejects(()=>db.exec(sql),/evidence changed/);assert.deepEqual(await state(db),before);}finally{await db.close();}
 }
});
test('audit failure rolls back all label changes',async()=>{
 const db=await fixture();try{await db.exec("alter table app.admin_activity_log add constraint audit_failure check(action_type is distinct from 'qa_profile_plan_labels_reconciled')");
  const before=await state(db);await assert.rejects(()=>db.exec(sql),/audit_failure/);assert.deepEqual(await state(db),before);
 }finally{await db.close();}
});
