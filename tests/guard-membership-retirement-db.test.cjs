const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
const sql=fs.readFileSync('supabase/migrations/20261125182810_retire_paid_guard_memberships.sql','utf8');
test('retire guard catalogue idempotently without changing billing, client pricing, legacy promises, tokens or history',async()=>{
 const db=new PGlite();try{
  await db.exec(`create schema app;create table app.plans(slug text primary key,name text,audience text,features jsonb,monthly_price_pence integer,active boolean,description text,job_limit_per_month integer,updated_at timestamptz default now(),stripe_price_id text);
  create table app.subscriptions(id integer,plan_slug text,status text,stripe_subscription_id text,cancel_at_period_end boolean);create table app.user_entitlements_data(user_id integer,plan_slug text,features jsonb);create table app.tokens(user_id integer,balance integer);
  insert into app.plans values('guard_starter','Old Free','guard','["guard.apply_job"]',0,true,'Old',2,now(),null),('guard-basic','Paid historical','guard','["guard.profile_boost"]',1000,true,'Historical description',10,now(),'price_existing'),('guard_professional','Legacy','guard','[]',2000,true,'Old',null,now(),'price_legacy'),('client-pro','Client Pro','client','["client.job_templates"]',9900,true,'Current',30,now(),'price_client');
  insert into app.subscriptions values(1,'guard-basic','active','sub_existing',false);insert into app.user_entitlements_data values(1,'guard-basic','["guard.profile_boost"]');insert into app.tokens values(1,500);`);
  const snapshot=async()=>({subs:(await db.query('select * from app.subscriptions')).rows,ent:(await db.query('select * from app.user_entitlements_data')).rows,tokens:(await db.query('select * from app.tokens')).rows,client:(await db.query("select * from app.plans where audience='client'")).rows});
  const before=await snapshot();await db.exec(sql);await db.exec(sql);assert.deepEqual(await snapshot(),before);
  const free=(await db.query("select * from app.plans where slug='guard_starter'")).rows[0];assert.equal(free.job_limit_per_month,null);assert.equal(free.monthly_price_pence,0);assert.equal(free.active,true);
  const paid=(await db.query("select * from app.plans where slug='guard-basic'")).rows[0];assert.equal(paid.active,false);assert.equal(paid.name,'Paid historical');assert.equal(paid.stripe_price_id,'price_existing');assert.equal(paid.job_limit_per_month,10);assert.deepEqual(paid.features,['guard.profile_boost']);
  assert.equal((await db.query("select count(*)::int n from app.plans where audience='guard' and monthly_price_pence>0 and active")).rows[0].n,0);
 }finally{await db.close();}
});
