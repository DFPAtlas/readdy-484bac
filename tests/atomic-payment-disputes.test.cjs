const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const USER='11111111-1111-4111-8111-111111111111', CLIENT='22222222-2222-4222-8222-222222222222', JOB='33333333-3333-4333-8333-333333333333', ASSIGN='44444444-4444-4444-8444-444444444444';
async function setup(){const db=new PGlite();await db.exec(`
create role anon;create role authenticated;create role service_role;create schema app;
create table app.clients(id uuid,user_id uuid);
create table app.jobs(id uuid primary key,client_id uuid,status text,payment_status text,is_deleted boolean,disputed boolean,disputed_at timestamptz,disputed_reason text,updated_at timestamptz);
create table app.job_assignments(id uuid primary key,job_id uuid,guard_id uuid);
create table app.disputes(id uuid primary key default gen_random_uuid(),job_id uuid,client_id uuid,guard_id uuid,assignment_id uuid,raised_by text,reason text,details text,status text,created_at timestamptz default now());
create table app.financial_operations(job_id uuid,state text);
create table app.payment_audit_logs(job_id uuid,assignment_id uuid,guard_id uuid,client_id uuid,from_status text,to_status text not null,changed_by uuid,changed_by_role text,event_type text,reference_type text,reference_id text,details jsonb);
create table app.subscription_payments(id uuid default gen_random_uuid(),stripe_invoice_id text);
insert into app.clients values('${CLIENT}','${USER}');
insert into app.jobs values('${JOB}','${CLIENT}','confirmed','funded',false,false,null,null,null);
insert into app.job_assignments values('${ASSIGN}','${JOB}',null);
`);await db.exec(fs.readFileSync('supabase/migrations/20261004182919_atomic_payment_disputes.sql','utf8'));return db;}
const raise=(db,user=USER,assignment=ASSIGN)=>db.query('select app.raise_client_payment_dispute($1,$2,$3,$4,null) result',[user,JOB,assignment,'Sandbox dispute']);
test('dispute, independent finance hold and audit commit together; replay adds nothing',async()=>{const db=await setup();try{const first=(await raise(db)).rows[0].result;const second=(await raise(db)).rows[0].result;assert.equal(second.disputeId,first.disputeId);assert.equal(second.replayed,true);assert.equal((await db.query('select count(*)::int n from app.disputes')).rows[0].n,1);const job=(await db.query('select * from app.jobs')).rows[0];assert.equal(job.disputed,true);assert.equal(job.payment_status,'funded');assert.equal(job.status,'confirmed');assert.equal((await db.query('select count(*)::int n from app.payment_audit_logs')).rows[0].n,1);}finally{await db.close();}});
test('audit failure rolls back dispute and hold',async()=>{const db=await setup();try{await db.exec("alter table app.payment_audit_logs add constraint force_failure check(to_status <> 'disputed')");await assert.rejects(raise(db),/force_failure/);assert.equal((await db.query('select count(*)::int n from app.disputes')).rows[0].n,0);assert.equal((await db.query('select disputed from app.jobs')).rows[0].disputed,false);}finally{await db.close();}});
test('cross-client and cross-job assignment, unfunded job and processing payout are rejected',async()=>{const db=await setup();try{await assert.rejects(raise(db,'55555555-5555-4555-8555-555555555555'),/Client profile/);await db.exec("update app.job_assignments set job_id='66666666-6666-4666-8666-666666666666'");await assert.rejects(raise(db),/Assignment/);await db.exec(`update app.job_assignments set job_id='${JOB}';update app.jobs set payment_status='pending'`);await assert.rejects(raise(db),/not eligible/);await db.exec(`update app.jobs set payment_status='funded';insert into app.financial_operations values('${JOB}','processing')`);await assert.rejects(raise(db),/processing/);assert.equal((await db.query('select count(*)::int n from app.disputes')).rows[0].n,0);}finally{await db.close();}});
test('browser roles cannot execute privileged dispute RPC; invoice duplication is rejected',async()=>{const db=await setup();try{for(const role of ['anon','authenticated'])assert.equal((await db.query(`select has_function_privilege('${role}','app.raise_client_payment_dispute(uuid,uuid,uuid,text,text)','execute') allowed`)).rows[0].allowed,false);await db.exec("insert into app.subscription_payments(stripe_invoice_id) values('in_test')");await assert.rejects(db.exec("insert into app.subscription_payments(stripe_invoice_id) values('in_test')"),/subscription_payments_invoice_unique/);}finally{await db.close();}});
