const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const USER='11111111-1111-4111-8111-111111111111';
const PROFILE='22222222-2222-4222-8222-222222222222';
const OTHER='33333333-3333-4333-8333-333333333333';
const migration=fs.readFileSync('supabase/migrations/20261122212426_close_free_subscriptions_on_account_closure.sql','utf8');
async function fixture({fixed=true,guard=false}={}) {
 const db=new PGlite();
 await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;create role authenticator;
 create schema app;create schema auth;create schema storage;
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;
 grant usage on schema app,auth to service_role,authenticated,anon;
 create table app.admin_users(user_id uuid,role text,is_active boolean);
 create table app.guards(id uuid,user_id uuid,is_active boolean,dashboard_access boolean,stripe_customer_id text,stripe_subscription_id text);
 create table app.clients(id uuid,user_id uuid,is_active boolean,stripe_customer_id text,stripe_subscription_id text);
 create table app.users(id uuid,user_type text,stripe_customer_id text,stripe_subscription_id text);
 create table app.plans(slug text primary key,audience text,monthly_price_pence int,name text,features jsonb,active boolean default true);
 create table app.subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid,account_type text,plan_slug text,status text,
  auto_renew boolean default false,cancel_at_period_end boolean default false,cancelled_at timestamptz,cancellation_reason text,updated_at timestamptz default now(),
  plan_amount numeric,amount_paid numeric,stripe_subscription_id text,stripe_customer_id text,stripe_price_id text,
  stripe_invoice_id text,stripe_session_id text,payment_method_id text,current_period_start timestamptz,
  current_period_end timestamptz,next_payment_date timestamptz,last_payment_date timestamptz);
 create table app.subscription_payments(id uuid default gen_random_uuid(),subscription_id uuid);
 create table app.user_entitlements_data(user_id uuid primary key,subscription_status text,is_active boolean generated always as (subscription_status='active') stored,
  plan_slug text,plan_name text,audience text,features jsonb,monthly_price_pence int,current_period_end timestamptz,
  cancel_at_period_end boolean,stripe_subscription_id text,updated_at timestamptz default now());
 create table app.jobs(client_id uuid,status text);create table app.job_assignments(guard_id uuid,status text);
 create table app.disputes(guard_id uuid,client_id uuid,status text);
 create table app.guard_bank_payouts(guard_id uuid,status text);create table app.guard_payouts(guard_id uuid,status text);
 create table storage.objects(owner_id text);alter table storage.objects enable row level security;
 insert into app.plans(slug,audience,monthly_price_pence,name,features) values('client_free','client',0,'Free Starter','["post_job"]'),('guard_starter','guard',0,'Starter','["view_job"]'),('client-starter','client',4900,'Client Starter','["paid_feature"]');
 insert into app.users values('${USER}','${guard?'guard':'client'}',null,null);
 insert into app.${guard?'guards':'clients'}(id,user_id,is_active${guard?',dashboard_access':''}) values('${PROFILE}','${USER}',true${guard?',true':''});
 insert into app.subscriptions(user_id,account_type,plan_slug,status) values('${USER}','${guard?'guard':'client'}','${guard?'guard_starter':'client_free'}','active');
 insert into app.subscriptions(user_id,account_type,plan_slug,status) values('${OTHER}','client','client_free','active');
 insert into app.user_entitlements_data(user_id,subscription_status,plan_slug,features) values('${USER}','active','retained-plan','["retained_feature"]');
 set request.jwt.claims='{"role":"service_role"}';
 `);
 await db.exec(fs.readFileSync('supabase/migrations/20261013051710_account_closure_retention.sql','utf8').split('-- BEGIN RETENTION SCHEDULER')[0]);
 await db.exec(fs.readFileSync('supabase/migrations/20261113211036_fix_account_closure_generated_entitlement_status.sql','utf8'));
 if(fixed) await applyRepair(db);
 return db;
}
async function applyRepair(db){
 await db.exec(migration);
 await db.exec(`create trigger trg_sync_entitlements after insert or update of status,plan_slug,current_period_end on app.subscriptions for each row execute function app.sync_subscription_to_entitlements()`);
}
async function close(db){return (await db.query('select app.begin_account_closure($1,$1) closure',[USER])).rows[0].closure;}
async function state(db){return (await db.query(`select jsonb_build_object(
 'subscriptions',(select jsonb_agg(to_jsonb(s) order by user_id,id) from app.subscriptions s),
 'closures',(select jsonb_agg(to_jsonb(c) order by id) from app.account_closures c),
 'clients',(select jsonb_agg(to_jsonb(c)) from app.clients c),'guards',(select jsonb_agg(to_jsonb(g)) from app.guards g),
 'entitlements',(select jsonb_agg(to_jsonb(e)) from app.user_entitlements_data e),
 'events',(select jsonb_agg(to_jsonb(e) order by id) from app.account_retention_events e),
 'payments',(select jsonb_agg(to_jsonb(p)) from app.subscription_payments p)) state`)).rows[0].state;}
test('reproduces historical closed-account active free row; repaired retry reconciles once without changing closure dates',async()=>{
 const db=await fixture({fixed:false});try{
  const closure=await close(db);assert.equal((await state(db)).subscriptions.find(s=>s.user_id===USER).status,'active');
  await applyRepair(db);const before=await state(db);await close(db);const after=await state(db);
  const subscription=after.subscriptions.find(s=>s.user_id===USER);
  assert.equal(subscription.status,'canceled');assert.equal(subscription.auto_renew,false);assert.ok(subscription.cancelled_at);
  assert.deepEqual(after.closures,before.closures);assert.equal(after.closures[0].closed_at,closure.closed_at);
  assert.deepEqual(after.clients,before.clients);assert.deepEqual(after.entitlements,before.entitlements);
  assert.deepEqual(after.subscriptions.find(s=>s.user_id===OTHER),before.subscriptions.find(s=>s.user_id===OTHER));
  assert.equal(after.events.filter(e=>e.event_type==='free_subscription_closed').length,1);
  await close(db);assert.deepEqual(await state(db),after);
 }finally{await db.close();}
});
test('new client and guard closure closes only its local free subscription and retains inactive entitlement',async()=>{
 for(const guard of [false,true]){const db=await fixture({guard});try{
  const closure=await close(db);const after=await state(db);
  assert.equal(after.subscriptions.find(s=>s.user_id===USER).status,'canceled');
  assert.equal(after.entitlements[0].is_active,false);assert.equal(after.closures[0].id,closure.id);
  assert.equal(after.events.filter(e=>e.event_type==='closure_started').length,1);
  assert.equal(after.events.filter(e=>e.event_type==='free_subscription_closed').length,1);
  assert.equal(after[guard?'guards':'clients'][0].is_active,false);
 }finally{await db.close();}}
});
test('paid access, provider references, service periods and payment history are never rewritten as free cancellation',async()=>{
 const changes=[
  "plan_slug='client-starter'","plan_amount=4900","amount_paid=10","stripe_customer_id='cus_existing'",
  "stripe_price_id='price_existing'","stripe_invoice_id='in_existing'","stripe_session_id='cs_existing'",
  "payment_method_id='pm_existing'","current_period_end=now()+interval '1 month'","next_payment_date=now()"
 ];
 for(const change of changes){const db=await fixture();try{
  await db.exec(`update app.subscriptions set ${change} where user_id='${USER}'`);
  const before=(await state(db)).subscriptions;await close(db);
  assert.deepEqual((await state(db)).subscriptions,before,change);
 }finally{await db.close();}}
 const db=await fixture();try{
  await db.exec(`insert into app.subscription_payments(subscription_id) select id from app.subscriptions where user_id='${USER}'`);
  const before=await state(db);await close(db);const after=await state(db);
  assert.deepEqual(after.subscriptions,before.subscriptions);assert.deepEqual(after.payments,before.payments);
 }finally{await db.close();}
});
test('existing paid terminal history and provider-linked profile closure keep their previous behavior',async()=>{
 const db=await fixture();try{
  await db.exec(`update app.subscriptions set status='canceled',stripe_subscription_id='sub_ended' where user_id='${USER}';update app.clients set stripe_customer_id='cus_existing' where user_id='${USER}'`);
  const before=(await state(db)).subscriptions;await close(db);assert.deepEqual((await state(db)).subscriptions,before);
 }finally{await db.close();}
});
test('existing paid/booking safeguards and browser authorization remain enforced',async()=>{
 for(const change of [
  `update app.subscriptions set stripe_subscription_id='sub_active' where user_id='${USER}'`,
  `insert into app.jobs values('${PROFILE}','confirmed')`
 ]){const db=await fixture();try{await db.exec(change);const before=await state(db);await assert.rejects(()=>close(db));assert.deepEqual(await state(db),before);}finally{await db.close();}}
 const db=await fixture();try{
  const closure=await close(db);await db.exec('set role authenticated');
  await assert.rejects(()=>db.query('select app.reconcile_closed_free_subscriptions($1)',[closure.id]),/permission denied/);
  await assert.rejects(()=>close(db),/permission denied/);
 }finally{await db.close();}
});
test('audit failure rolls back closure, local cancellation and entitlement updates together',async()=>{
 const db=await fixture();try{
  await db.exec("alter table app.account_retention_events add constraint audit_failure check(event_type <> 'free_subscription_closed')");
  const before=await state(db);await assert.rejects(()=>close(db),/audit_failure/);assert.deepEqual(await state(db),before);
 }finally{await db.close();}
});
test('closed-account subscription refresh preserves retained entitlement evidence even without an app user',async()=>{
 const db=await fixture();try{
  await close(db);await db.exec(`delete from app.users where id='${USER}'`);
  const before=(await state(db)).entitlements;
  await db.exec(`update app.subscriptions set status='active' where user_id='${USER}'`);
  assert.deepEqual((await state(db)).entitlements,before);
  assert.equal(before[0].is_active,false);assert.equal(before[0].plan_slug,'retained-plan');
  assert.deepEqual(before[0].features,['retained_feature']);
 }finally{await db.close();}
});
test('open-account entitlement synchronization retains its normal catalogue behavior',async()=>{
 const db=await fixture();try{
  await db.exec(`update app.subscriptions set plan_slug='client-starter' where user_id='${USER}'`);
  const e=(await state(db)).entitlements[0];assert.equal(e.plan_slug,'client-starter');assert.equal(e.is_active,true);
  assert.deepEqual(e.features,['paid_feature']);assert.equal(e.monthly_price_pence,4900);
 }finally{await db.close();}
});
