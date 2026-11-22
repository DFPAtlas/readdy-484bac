const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const closeSql = fs.readFileSync('scripts/ops/20261122-retire-uat-adverts.sql', 'utf8');
const reviewSql = fs.readFileSync('scripts/ops/20261122-record-sandbox-reversal-review.sql', 'utf8');
const ids = [...closeSql.matchAll(/'([0-9a-f-]{36})'/g)].slice(0,5).map(m=>m[1]);
async function fixture() {
  const db = new PGlite();
  await db.exec(`create schema app;
    create table app.jobs(id uuid primary key,job_title text,end_date date,is_deleted boolean,status text,updated_at timestamptz,payment_status text);
    create table app.job_assignments(job_id uuid);
    create table app.job_applications(job_id uuid,status text);
    create table app.admin_activity_log(admin_username text,admin_name text,action_type text,action_description text,target_type text,target_name text,metadata jsonb,changes jsonb);
    create table app.guard_payouts(id uuid primary key,job_id uuid,assignment_id uuid,guard_id uuid,status text,amount numeric,net_amount numeric,stripe_transfer_id text,stripe_transfer_status text);
    create table app.payment_audit_logs(job_id uuid,assignment_id uuid,guard_id uuid,from_status text,to_status text,changed_by_role text,reason text,event_type text,reference_type text,reference_id text,metadata jsonb);`);
  for (const id of ids) await db.query("insert into app.jobs values($1,'[UAT launch-2026-11] Pub Door Supervisor fixture','2026-10-21',false,'open',now(),'unfunded')", [id]);
  await db.query("insert into app.job_applications values($1,'pending')", [ids[0]]);
  await db.exec("insert into app.guard_payouts(id,status,amount,net_amount,stripe_transfer_id,stripe_transfer_status) values('a4cb0be5-6fa1-4b68-b8f5-e0e0c513ac4e','failed',80,80,'tr_3UMuNlIMkpwfAEDT1zhM9H4Z','reversed')");
  return db;
}
test('UAT cleanup is audited and idempotent while preserving applications and payment state', async () => {
  const db = await fixture(); try {
    await db.exec(closeSql); await db.exec(closeSql);
    assert.equal((await db.query("select count(*)::int n from app.jobs where status='closed' and payment_status='unfunded'")).rows[0].n, 5);
    assert.equal((await db.query('select count(*)::int n from app.admin_activity_log')).rows[0].n, 5);
    assert.equal((await db.query("select count(*)::int n from app.job_applications where status='pending'")).rows[0].n, 1);
  } finally { await db.close(); }
});
test('changed title or assignment evidence aborts the whole cleanup without partial closures', async () => {
  for (const changed of ['title','assignment']) {
    const db = await fixture(); try {
      if (changed === 'title') await db.query("update app.jobs set job_title='Current customer job' where id=$1", [ids[0]]);
      else await db.query('insert into app.job_assignments values($1)', [ids[0]]);
      await assert.rejects(db.exec(closeSql), /cleanup aborted/);
      assert.equal((await db.query("select count(*)::int n from app.jobs where status='open'")).rows[0].n, 5);
      assert.equal((await db.query('select count(*)::int n from app.admin_activity_log')).rows[0].n, 0);
    } finally { await db.close(); }
  }
});
test('sandbox reversal review records provider evidence once without changing financial state', async () => {
  const db = await fixture(); try {
    await db.exec(reviewSql); await db.exec(reviewSql);
    const rows = (await db.query('select * from app.payment_audit_logs')).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].metadata.livemode, false);
    assert.equal(rows[0].metadata.amount_reversed_minor, 8000);
    assert.equal((await db.query('select status from app.guard_payouts')).rows[0].status, 'failed');
    await db.exec('update app.guard_payouts set amount=81');
    await assert.rejects(db.exec(reviewSql), /review aborted/);
    assert.equal((await db.query('select count(*)::int n from app.payment_audit_logs')).rows[0].n, 1);
  } finally { await db.close(); }
});
test('backup evidence records the limited core-data drill without claiming complete disaster recovery', async () => {
  const db=await fixture();try {
    await db.exec(`create table app.security_backup_status(id integer,backup_type text,status text,last_backup_at timestamptz,retention_days integer,last_restore_test_at timestamptz,updated_at timestamptz,notes text);
      insert into app.security_backup_status values(1,'Database Backup','healthy','2026-10-01',30,null,now(),'Old unchecked claim');`);
    const sql=fs.readFileSync('scripts/ops/20261122-record-backup-evidence.sql','utf8');
    await db.exec(sql);await db.exec(sql);
    const row=(await db.query('select * from app.security_backup_status')).rows[0];
    assert.equal(row.status,'warning');assert.equal(row.retention_days,7);assert.match(row.notes,/does not verify a full provider-backup restore/);
    const audit=(await db.query("select * from app.admin_activity_log where action_type='backup_evidence_verified'")).rows;
    assert.equal(audit.length,1);assert.equal(audit[0].metadata.restored_rows,135);assert.equal(audit[0].changes.previous_record.retention_days,30);
  }finally{await db.close();}
});
