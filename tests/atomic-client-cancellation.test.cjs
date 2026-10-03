const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const JOB='11111111-1111-4111-8111-111111111111', CLIENT='22222222-2222-4222-8222-222222222222', USER='33333333-3333-4333-8333-333333333333';
async function setup(){const db=new PGlite();await db.exec(`
create role anon; create role authenticated; create schema app; create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table app.clients(id uuid,user_id uuid);
create table app.jobs(id uuid primary key,client_id uuid,status text,payment_status text,updated_at timestamptz);
create table app.job_cancellations(id uuid primary key default gen_random_uuid(),job_id uuid,client_id uuid,cancelled_by text,reason text,notes text,preferred_resolution text,contact_preference text,status text,cancelled_at timestamptz,created_at timestamptz default now(),updated_at timestamptz);
create table app.transactions(id uuid default gen_random_uuid(),job_id uuid,transaction_type text,status text,amount numeric,refund_amount numeric,refunded boolean,created_at timestamptz default now());
create table app.refund_requests(id uuid default gen_random_uuid(),job_id uuid,client_id uuid,cancellation_id uuid,transaction_id uuid,requested_amount numeric check(requested_amount>0),reason text,type text,status text,notes text,created_at timestamptz default now());
create table app.financial_operations(job_id uuid,state text);
create table app.job_assignments(job_id uuid,status text,payment_status text,payout_released boolean,stripe_transfer_id text,updated_at timestamptz);
create table app.guard_payouts(job_id uuid,status text,stripe_transfer_id text);
insert into app.clients values('${CLIENT}','${USER}');
insert into app.jobs values('${JOB}','${CLIENT}','confirmed','funded',null);
insert into app.transactions(job_id,transaction_type,status,amount,refunded) values('${JOB}','job_payment','completed',92,false);
insert into app.job_assignments(job_id,status,payment_status,payout_released) values('${JOB}','confirmed','funded',false);
select set_config('test.uid','${USER}',false);`);await db.exec(fs.readFileSync('supabase/migrations/20261003170540_atomic_client_cancellation.sql','utf8'));return db;}
const cancel=db=>db.query("select public.cancel_client_job($1,'Other','Sandbox only','full_refund','email') result",[JOB]);
test('cancellation and pending refund commit together and retry creates no duplicates',async()=>{const db=await setup();try{let first=(await cancel(db)).rows[0].result;let retry=(await cancel(db)).rows[0].result;assert.equal(first.refundStatus,'pending');assert.equal(first.requestedAmount,92);assert.equal(retry.refundRequestId,first.refundRequestId);assert.equal((await db.query('select count(*)::int n from app.job_cancellations')).rows[0].n,1);assert.equal((await db.query('select status from app.jobs')).rows[0].status,'cancelled');assert.equal((await db.query('select status from app.job_assignments')).rows[0].status,'cancelled');assert.equal((await db.query('select refunded from app.transactions')).rows[0].refunded,false);}finally{await db.close();}});
test('legacy half-completed cancellation is reused and only remaining payment is requested',async()=>{const db=await setup();try{await db.exec(`insert into app.job_cancellations(job_id,client_id,cancelled_by,reason,preferred_resolution,status) values('${JOB}','${CLIENT}','client','Other','full_refund','cancelled');update app.transactions set refund_amount=20;`);assert.equal((await cancel(db)).rows[0].result.requestedAmount,72);assert.equal((await db.query('select count(*)::int n from app.job_cancellations')).rows[0].n,1);}finally{await db.close();}});
test('refund failure rolls back cancellation and job writes',async()=>{const db=await setup();try{await db.exec('alter table app.refund_requests add constraint force_failure check(requested_amount<1)');await assert.rejects(cancel(db),/force_failure/);assert.equal((await db.query('select count(*)::int n from app.job_cancellations')).rows[0].n,0);assert.equal((await db.query('select status from app.jobs')).rows[0].status,'confirmed');}finally{await db.close();}});
test('ownership, anonymous access, terminal jobs and started payouts are rejected',async()=>{const db=await setup();try{await db.exec("select set_config('test.uid','44444444-4444-4444-8444-444444444444',false)");await assert.rejects(cancel(db),/own this job/);await db.exec("select set_config('test.uid','',false)");await assert.rejects(cancel(db),/Authentication/);await db.exec(`select set_config('test.uid','${USER}',false);update app.jobs set status='completed'`);await assert.rejects(cancel(db),/cannot be cancelled/);await db.exec("update app.jobs set status='confirmed';update app.job_assignments set payout_released=true");await assert.rejects(cancel(db),/payout already started/);assert.equal((await db.query("select has_function_privilege('anon','public.cancel_client_job(uuid,text,text,text,text)','execute') allowed")).rows[0].allowed,false);}finally{await db.close();}});
