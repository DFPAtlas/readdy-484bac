const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const JOB='11111111-1111-4111-8111-111111111111', PAYMENT='22222222-2222-4222-8222-222222222222';
async function setup() {
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema app; create schema auth;
 create function auth.uid() returns uuid language sql as 'select null::uuid';
 create table app.admin_users(user_id uuid,is_active boolean,role text);
 create table app.jobs(id uuid primary key,client_id uuid,status text,payment_status text,disputed boolean,disputed_at timestamptz,disputed_reason text,updated_at timestamptz);
 create table app.transactions(id uuid primary key,job_id uuid,client_id uuid,amount numeric,status text,refund_amount numeric,refunded boolean,stripe_refund_id text,refunded_at timestamptz,updated_at timestamptz);
 create table app.job_assignments(id uuid default gen_random_uuid(),job_id uuid,status text,payment_status text,payout_released boolean default false,stripe_transfer_id text,updated_at timestamptz);
 create table app.guard_payouts(job_id uuid,status text,stripe_transfer_id text);
 create table app.disputes(id uuid primary key,job_id uuid,status text,resolution text,admin_notes text,refund_amount numeric,stripe_refund_id text,resolved_at timestamptz,updated_at timestamptz);
 create table app.payment_audit_logs(job_id uuid,client_id uuid,from_status text,to_status text not null,changed_by uuid,changed_by_role text,reason text,event_type text,reference_type text,reference_id text,metadata jsonb);
 create function app.guard_state() returns trigger language plpgsql as $$begin if new.status in ('confirmed','completed') and new.payment_status not in ('funded','payout_pending','payout_processing','paid_out','paid','client_released') then raise exception 'Invalid funded state'; end if; return new; end$$;
 create trigger guard_job before update on app.jobs for each row execute function app.guard_state();
 create trigger guard_assignment before update on app.job_assignments for each row execute function app.guard_state();
 insert into app.jobs values('${JOB}',null,'confirmed','funded',false,null,null,null);
 insert into app.transactions(id,job_id,amount,status,refund_amount,refunded) values('${PAYMENT}','${JOB}',92,'completed',0,false);
 insert into app.job_assignments(job_id,status,payment_status) values('${JOB}','confirmed','funded');`);
 await db.exec(fs.readFileSync('supabase/migrations/20261003114129_admin_financial_operation_safety.sql','utf8'));
 return db;
}
async function claim(db,key,kind='refund') {return (await db.query('select app.claim_financial_operation($1,$2,$3,null) op',[JOB,key,kind])).rows[0].op;}
async function record(db,op,cumulative,amount,succeeded=true,dispute=null) {return db.query(`select app.record_financial_refund($1,$2,$3,'re_test',$4,$5,$6,'super_admin','resolved_client_refund','test')`,[op.id,PAYMENT,dispute,cumulative,amount,succeeded]);}
test('active or uncertain operation prevents a competing payout and duplicate refund',async()=>{
 const db=await setup();try {const op=await claim(db,'first');await assert.rejects(claim(db,'payout','payout'),/Another financial/);await assert.rejects(claim(db,'first'),/already processing/);await db.query("update app.financial_operations set state='reconciliation_required' where id=$1",[op.id]);await assert.rejects(claim(db,'other'),/Another financial/);} finally {await db.close();}
});
test('partial then remaining full refund reconciles transaction, job, assignments, audit and replay',async()=>{
 const db=await setup();try {const partial=await claim(db,'partial');await record(db,partial,20,20);assert.equal((await db.query('select status from app.transactions')).rows[0].status,'partially_refunded');assert.equal((await db.query('select payment_status from app.jobs')).rows[0].payment_status,'funded');assert.equal((await claim(db,'partial')).replayed,true);const full=await claim(db,'full');await record(db,full,92,72);assert.equal((await db.query('select status from app.jobs')).rows[0].status,'cancelled');assert.equal((await db.query('select payment_status from app.job_assignments')).rows[0].payment_status,'refunded');assert.equal((await db.query('select count(*)::int n from app.payment_audit_logs')).rows[0].n,2);} finally {await db.close();}
});
test('audit failure rolls back all refund records and leaves operation reserved',async()=>{
 const db=await setup();try {const op=await claim(db,'fail');await db.exec("alter table app.payment_audit_logs add constraint reject_test check (reason <> 'test')");await assert.rejects(record(db,op,92,92),/reject_test/);assert.equal((await db.query('select status from app.transactions')).rows[0].status,'completed');assert.equal((await db.query('select status from app.jobs')).rows[0].status,'confirmed');assert.equal((await db.query('select state from app.financial_operations')).rows[0].state,'processing');} finally {await db.close();}
});
test('pending refund keeps booking valid and holds operation for reconciliation',async()=>{
 const db=await setup();try {const op=await claim(db,'pending');await record(db,op,92,92,false);assert.equal((await db.query('select state from app.financial_operations')).rows[0].state,'reconciliation_required');assert.equal((await db.query('select refund_amount from app.transactions')).rows[0].refund_amount,'0');assert.equal((await db.query('select disputed from app.jobs')).rows[0].disputed,true);} finally {await db.close();}
});
test('payout already started blocks recording refund, and over-refunds are rejected',async()=>{
 const db=await setup();try {const op=await claim(db,'refund');await assert.rejects(record(db,op,93,93),/Invalid payment/);await db.exec(`insert into app.guard_payouts(job_id,status) values('${JOB}','processing')`);await assert.rejects(record(db,op,92,92),/Payout has started/);} finally {await db.close();}
});
test('financial RPCs are not executable by browser roles',async()=>{
 const db=await setup();try {const r=await db.query("select has_function_privilege('authenticated','app.claim_financial_operation(uuid,text,text,uuid)','execute') a, has_function_privilege('anon','app.record_financial_refund(uuid,uuid,uuid,text,numeric,numeric,boolean,text,text,text)','execute') b");assert.deepEqual(r.rows[0],{a:false,b:false});} finally {await db.close();}
});

async function setupRequest(){const db=await setup();await db.exec(`create table app.refund_requests(id uuid primary key,job_id uuid,transaction_id uuid,status text,requested_amount numeric,approved_amount numeric,stripe_refund_id text,processed_at timestamptz,updated_at timestamptz);insert into app.refund_requests(id,job_id,transaction_id,status,requested_amount) values('${PAYMENT}','${JOB}','${PAYMENT}','pending',92);`);await db.exec(fs.readFileSync('supabase/migrations/20261003173431_admin_cancellation_refund_queue.sql','utf8'));return db;}
const recordRequest=(db,op,succeeded=true)=>db.query("select app.record_requested_refund($1,$2,$1,null,'re_request',92,92,$3,'finance_admin','resolved_client_refund','test')",[PAYMENT,op.id,succeeded]);
test('refund request and financial ledger complete together, with browser execution denied',async()=>{const db=await setupRequest();try{const op=await claim(db,'request');await recordRequest(db,op);assert.equal((await db.query('select status from app.refund_requests')).rows[0].status,'completed');assert.equal((await db.query('select status from app.transactions')).rows[0].status,'refunded');assert.equal((await db.query("select has_function_privilege('authenticated','app.record_requested_refund(uuid,uuid,uuid,uuid,text,numeric,numeric,boolean,text,text,text)','execute') allowed")).rows[0].allowed,false);}finally{await db.close();}});
test('queue write failure rolls back ledger and operation completion',async()=>{const db=await setupRequest();try{const op=await claim(db,'request');await db.exec("alter table app.refund_requests add constraint fail_queue check(status<>'completed')");await assert.rejects(recordRequest(db,op),/fail_queue/);assert.equal((await db.query('select status from app.transactions')).rows[0].status,'completed');assert.equal((await db.query('select state from app.financial_operations')).rows[0].state,'processing');}finally{await db.close();}});
test('pending Stripe refund is processing with no completed refund amount',async()=>{const db=await setupRequest();try{const op=await claim(db,'request');await recordRequest(db,op,false);assert.equal((await db.query('select status from app.refund_requests')).rows[0].status,'processing');assert.equal((await db.query('select refund_amount from app.transactions')).rows[0].refund_amount,'0');assert.equal((await db.query('select state from app.financial_operations')).rows[0].state,'reconciliation_required');}finally{await db.close();}});
