const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('cancellation and refund triggers populate required queue fields and tolerate absent recipient', async () => {
 const db = new PGlite();
 try {
 await db.exec(`create schema app; create role anon; create role authenticated;
 create table app.users(id uuid primary key,email text);
 create table app.clients(id uuid primary key,user_id uuid);
 create table app.jobs(id uuid primary key,client_id uuid);
 create table app.email_queue(user_id uuid,email_type text not null,recipient_email text not null,subject text not null,body_html text not null,status text,metadata jsonb,created_at timestamptz,updated_at timestamptz);
 create table app.job_cancellations(id uuid primary key,job_id uuid);
 create table app.refund_requests(id uuid primary key,job_id uuid);
 insert into app.users values ('00000000-0000-0000-0000-000000000001','client@example.test');
 insert into app.clients values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
 insert into app.jobs values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002');`);
 await db.exec(readFileSync('supabase/migrations/20261003143000_cancellation_queue_required_fields.sql','utf8'));
 await db.exec(`create trigger cancellation after insert on app.job_cancellations for each row execute function app.queue_cancellation_email();
 create trigger refund after insert on app.refund_requests for each row execute function app.queue_refund_email();
 insert into app.job_cancellations values ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003');
 insert into app.refund_requests values ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000003');`);
 const {rows}=await db.query('select * from app.email_queue order by email_type');
 assert.equal(rows.length,2);
 for (const row of rows) {assert.equal(row.recipient_email,'client@example.test');assert.ok(row.subject);assert.ok(row.body_html);assert.equal(row.status,'pending');}
 assert.equal(rows[0].metadata.cancellation_id,'00000000-0000-0000-0000-000000000004');
 assert.equal(rows[1].metadata.refund_request_id,'00000000-0000-0000-0000-000000000005');
 await db.exec(`update app.users set email=null;
 insert into app.job_cancellations values ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000003');`);
 assert.equal((await db.query('select count(*)::int as n from app.job_cancellations')).rows[0].n,2);
 assert.equal((await db.query('select count(*)::int as n from app.email_queue')).rows[0].n,2);
 } finally {await db.close();}
});
