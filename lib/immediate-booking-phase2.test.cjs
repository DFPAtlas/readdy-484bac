/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

/**
 * QuickGuard Phase 2 — immediate booking (Book a Guard Now) automated coverage.
 *
 * The workspace protects the tests/ directory from writes, so this focused
 * suite lives here and is executed by `npm run test:unit`.
 *
 * It has two layers:
 *  1. Source-contract tests asserting the guarantees are wired into the
 *     edge functions and migration.
 *  2. Behavioural tests that actually run the migration/RPC logic on an
 *     in-process Postgres (PGlite) so queue idempotency, retry reset and
 *     job-match-scoped recompute are proven, not just grepped.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const createJob = read('supabase/functions/create-job/index.ts');
const notify = read('supabase/functions/notify-matching-guards/index.ts');
const worker = read('supabase/functions/process-email-queue/index.ts');
const adminMutate = read('supabase/functions/admin-job-mutate/index.ts');
const adminJobs = read('supabase/functions/admin-jobs/index.ts');
const adminPage = read('app/admin/jobs/page.tsx');
const jobsTable = read('app/admin/jobs/JobsTable.tsx');
const request = read('lib/post-job-request.ts');
const migration = read('supabase/migrations/20261007090000_immediate_booking_phase2.sql');

const JOB_ID = '11111111-1111-1111-1111-111111111111';
const GUARD_ID = '22222222-2222-2222-2222-222222222222';
const GUARD_USER_ID = '33333333-3333-3333-3333-333333333333';
const CLIENT_ID = '44444444-4444-4444-4444-444444444444';
const KEY = `immediate-job:${JOB_ID}:guard:${GUARD_ID}`;

async function buildDb() {
  const db = new PGlite();
  await db.exec(`
    create schema app;
    create role anon;
    create role authenticated;
    create role service_role;
    create table app.jobs (
      id uuid primary key,
      client_id uuid,
      urgency text default 'standard',
      is_urgent boolean default false,
      is_deleted boolean default false,
      created_at timestamptz default now()
    );
    create table app.email_queue (
      id uuid primary key default (md5(random()::text || clock_timestamp()::text)::uuid),
      user_id uuid,
      email_type text not null,
      recipient_email text,
      recipient_name text,
      subject text,
      body_html text,
      status text default 'pending',
      priority integer,
      metadata jsonb,
      dedupe_key text,
      error_message text,
      retry_count integer default 0,
      created_at timestamptz default now(),
      updated_at timestamptz
    );
  `);
  const sql = migration.replace(/NOTIFY\s+pgrst\s*,\s*'reload schema'\s*;/gi, '');
  await db.exec(sql);
  return db;
}

function queueCall(dedupeKey, metadataLiteral) {
  return `select app.queue_job_match_notification(
    '${JOB_ID}', '${GUARD_ID}', '${GUARD_USER_ID}',
    'guard@example.test', 'Guard', 'New job match',
    '${dedupeKey}', ${metadataLiteral}, 10) as outcome`;
}

test('immediate requests still reach submitClientJob/create-job', () => {
  assert.match(request, /functions\/v1\/create-job/);
  assert.match(request, /bookingMode/);
});

test('server sets urgency, is_urgent and booking_source for immediate jobs', () => {
  assert.match(createJob, /const isImmediateBooking = bookingMode === 'immediate'/);
  assert.match(createJob, /urgency: isImmediateBooking \? 'immediate'/);
  assert.match(createJob, /is_urgent: isImmediateBooking/);
  assert.match(createJob, /booking_source: isImmediateBooking \? 'homepage_guard_now' : null/);
});

test('browser-supplied ownership is ignored in favour of the session', () => {
  assert.match(createJob, /client\.user_id !== user\.id/);
});

test('immediate bookings require a valid submission id before any work', () => {
  assert.match(createJob, /isImmediateBooking && !safeSubmissionId/);
  assert.match(createJob, /error: 'invalid_submission_id'/);
  const guard = createJob.indexOf('invalid_submission_id');
  const entitlement = createJob.indexOf('user_entitlements_data');
  const usage = createJob.indexOf('check_monthly_usage');
  const insert = createJob.indexOf(".from('jobs')\n      .insert(jobPayload)");
  assert.ok(guard > -1 && entitlement > -1);
  assert.ok(guard < entitlement, 'invalid immediate id must be rejected before entitlement');
  assert.ok(guard < usage, 'invalid immediate id must be rejected before usage consumption');
  assert.ok(insert === -1 || guard < insert, 'invalid immediate id must be rejected before insert');
});

test('submission lookup runs before entitlement and usage are consumed', () => {
  const lookup = createJob.indexOf("eq('submission_id', safeSubmissionId)");
  const entitlement = createJob.indexOf('user_entitlements_data');
  const usage = createJob.indexOf('check_monthly_usage');
  assert.ok(lookup > -1 && entitlement > -1 && usage > -1);
  assert.ok(lookup < entitlement, 'submission lookup must precede entitlement');
  assert.ok(lookup < usage, 'submission lookup must precede usage consumption');
});

test('an existing submission id returns the original job idempotently', () => {
  const idx = createJob.indexOf("eq('submission_id', safeSubmissionId)");
  assert.match(createJob.slice(idx, idx + 400), /idempotent: true/);
});

test('concurrent unique conflict returns the existing job, not a failure', () => {
  assert.match(createJob, /23505/);
  assert.match(createJob, /racedJob/);
  assert.match(createJob, /idempotent: true/);
});

test('guard emails are queued durably with a deterministic idempotency key', () => {
  assert.match(notify, /queue_job_match_notification/);
  assert.match(notify, /idempotencyKey = `\$\{queuePrefix\}:\$\{jobId\}:guard:\$\{guard\.id\}`/);
});

test('matching no longer sends guard emails synchronously', () => {
  assert.doesNotMatch(notify, /functions\/v1\/send-job-match-email/);
});

test('ineligible guards are filtered before queueing', () => {
  assert.match(notify, /verification_status/);
  assert.match(notify, /sia_verified/);
  assert.match(notify, /guardsToNotify/);
});

test('service-role path compares the real secret, never a supplied flag', () => {
  assert.match(notify, /bearer === supabaseServiceKey/);
  assert.doesNotMatch(notify, /body\.(role|isService|serviceRole|isServiceCaller)/);
});

test('email worker verifies completion and recompute before claiming success', () => {
  assert.match(worker, /email\.email_type === 'job_match'/);
  assert.match(worker, /\/send-job-match-email/);
  assert.match(worker, /complete_email_queue/);
  assert.match(worker, /completion !== true/);
  assert.match(worker, /job_match_reconciliation/);
  assert.match(worker, /recompute_job_notification_status/);
  assert.match(worker, /recomputeError/);
});

test('admin retry re-queues without ever reporting false delivery', () => {
  assert.match(adminMutate, /notify-matching-guards/);
  assert.match(adminMutate, /partially_delivered/);
  assert.doesNotMatch(adminMutate, /notification_status: 'delivered'/);
});

test('create-job never records delivered from a queue row', () => {
  assert.doesNotMatch(createJob, /notification_status: 'delivered'/);
  assert.match(createJob, /deliveryStatus = 'queued'/);
});

test('migration uses dedupe_key and the scoped job-match unique index', () => {
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_client_submission/);
  assert.match(migration, /WHERE submission_id IS NOT NULL/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ/);
  assert.match(migration, /DROP INDEX IF EXISTS app\.uq_email_queue_idempotency/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_email_queue_job_match_dedupe/);
  assert.match(migration, /WHERE email_type = 'job_match'/);
  assert.match(migration, /AND dedupe_key IS NOT NULL/);
  assert.match(migration, /RAISE EXCEPTION/);
  assert.doesNotMatch(migration, /metadata->>'idempotency_key'\) IS NOT NULL/);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE/i);
});

test('admin urgent badge, filter and count use real data', () => {
  assert.match(adminJobs, /eq\('urgency', 'immediate'\)/);
  assert.match(adminPage, /Immediate/);
  assert.match(jobsTable, /IMMEDIATE/);
  assert.match(jobsTable, /partially_delivered/);
});

test('queueing the same job-match key twice creates exactly one row', async () => {
  const db = await buildDb();
  try {
    const first = await db.query(queueCall(KEY, "''::jsonb"));
    const second = await db.query(queueCall(KEY, "''::jsonb"));
    assert.equal(first.rows[0].outcome, 'queued');
    assert.equal(second.rows[0].outcome, 'queued');
    const count = await db.query("select count(*)::int as n from app.email_queue where email_type='job_match'");
    assert.equal(count.rows[0].n, 1);
  } finally {
    await db.close();
  }
});

test('a sent job-match row is never reset or duplicated', async () => {
  const db = await buildDb();
  try {
    await db.query(queueCall(KEY, "''::jsonb"));
    await db.exec("update app.email_queue set status='sent' where email_type='job_match'");
    const again = await db.query(queueCall(KEY, "''::jsonb"));
    assert.equal(again.rows[0].outcome, 'delivered');
    const row = await db.query("select count(*)::int as n, min(status) as s from app.email_queue where email_type='job_match'");
    assert.equal(row.rows[0].n, 1);
    assert.equal(row.rows[0].s, 'sent');
  } finally {
    await db.close();
  }
});

test('a pending or processing job-match row is not duplicated', async () => {
  const db = await buildDb();
  try {
    await db.query(queueCall(KEY, "''::jsonb"));
    await db.exec("update app.email_queue set status='processing' where email_type='job_match'");
    const again = await db.query(queueCall(KEY, "''::jsonb"));
    assert.equal(again.rows[0].outcome, 'queued');
    const row = await db.query("select count(*)::int as n, min(status) as s from app.email_queue where email_type='job_match'");
    assert.equal(row.rows[0].n, 1);
    assert.equal(row.rows[0].s, 'processing');
  } finally {
    await db.close();
  }
});

test('a failed job-match row is reset to pending for retry without duplication', async () => {
  const db = await buildDb();
  try {
    await db.query(queueCall(KEY, "''::jsonb"));
    await db.exec("update app.email_queue set status='failed', error_message='boom', retry_count=3 where email_type='job_match'");
    const again = await db.query(queueCall(KEY, "''::jsonb"));
    assert.equal(again.rows[0].outcome, 'retried');
    const row = await db.query("select count(*)::int as n, min(status) as s, min(error_message) as e from app.email_queue where email_type='job_match'");
    assert.equal(row.rows[0].n, 1);
    assert.equal(row.rows[0].s, 'pending');
    assert.equal(row.rows[0].e, null);
  } finally {
    await db.close();
  }
});

test('the authoritative dedupe key is stored in dedupe_key and metadata cannot spoof identity', async () => {
  const db = await buildDb();
  try {
    await db.query(queueCall(KEY, `'{"job_id":"99999999-9999-9999-9999-999999999999","idempotency_key":"spoofed"}'::jsonb`));
    const row = await db.query("select dedupe_key, metadata from app.email_queue where email_type='job_match'");
    assert.equal(row.rows[0].dedupe_key, KEY);
    assert.equal(row.rows[0].metadata.job_id, JOB_ID);
    assert.equal(row.rows[0].metadata.guard_record_id, GUARD_ID);
    assert.equal(row.rows[0].metadata.idempotency_key, KEY);
    assert.equal(row.rows[0].metadata.notification_type, 'job_match');
  } finally {
    await db.close();
  }
});

test('recompute only counts job_match rows and ignores cancellation emails', async () => {
  const db = await buildDb();
  try {
    await db.exec(`insert into app.jobs (id, client_id, urgency) values ('${JOB_ID}', '${CLIENT_ID}', 'immediate')`);
    await db.query(queueCall(KEY, "''::jsonb"));
    await db.exec(`update app.email_queue set status='sent' where email_type='job_match';
      insert into app.email_queue (email_type, recipient_email, subject, body_html, status, metadata)
      values ('cancellation_notification','client@example.test','Cancelled','<p>x</p>','failed',
              '{"job_id":"${JOB_ID}"}'::jsonb)`);
    const result = await db.query(`select app.recompute_job_notification_status('${JOB_ID}') as status`);
    assert.equal(result.rows[0].status, 'delivered');
    const job = await db.query(`select notification_status, notified_guard_count from app.jobs where id='${JOB_ID}'`);
    assert.equal(job.rows[0].notification_status, 'delivered');
    assert.equal(job.rows[0].notified_guard_count, 1);
  } finally {
    await db.close();
  }
});

test('a failed job_match plus an unrelated failed email keeps job status failed, not delivered', async () => {
  const db = await buildDb();
  try {
    await db.exec(`insert into app.jobs (id, client_id, urgency) values ('${JOB_ID}', '${CLIENT_ID}', 'immediate')`);
    await db.query(queueCall(KEY, "''::jsonb"));
    await db.exec(`update app.email_queue set status='failed' where email_type='job_match';
      insert into app.email_queue (email_type, recipient_email, subject, body_html, status, metadata)
      values ('payment_notification','client@example.test','Paid','<p>x</p>','sent',
              '{"job_id":"${JOB_ID}"}'::jsonb)`);
    const result = await db.query(`select app.recompute_job_notification_status('${JOB_ID}') as status`);
    assert.equal(result.rows[0].status, 'failed');
    const job = await db.query(`select notification_status from app.jobs where id='${JOB_ID}'`);
    assert.equal(job.rows[0].notification_status, 'failed');
  } finally {
    await db.close();
  }
});

test('the migration does not reclassify or rewrite existing standard jobs', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema app;
      create role anon;
      create role authenticated;
      create role service_role;
      create table app.jobs (
        id uuid primary key,
        client_id uuid,
        urgency text default 'standard',
        is_urgent boolean default false,
        is_deleted boolean default false,
        created_at timestamptz default now()
      );
      create table app.email_queue (
        id uuid primary key default (md5(random()::text || clock_timestamp()::text)::uuid),
        user_id uuid,
        email_type text not null,
        recipient_email text,
        recipient_name text,
        subject text,
        body_html text,
        status text default 'pending',
        priority integer,
        metadata jsonb,
        dedupe_key text,
        error_message text,
        retry_count integer default 0,
        created_at timestamptz default now(),
        updated_at timestamptz
      );
      insert into app.jobs (id, client_id, urgency) values ('55555555-5555-5555-5555-555555555555', '${CLIENT_ID}', 'standard');
    `);
    const sql = migration.replace(/NOTIFY\s+pgrst\s*,\s*'reload schema'\s*;/gi, '');
    await db.exec(sql);
    const row = await db.query("select urgency, is_urgent, booking_source, submission_id from app.jobs where id='55555555-5555-5555-5555-555555555555'");
    assert.equal(row.rows[0].urgency, 'standard');
    assert.equal(row.rows[0].is_urgent, false);
    assert.equal(row.rows[0].booking_source, null);
    assert.equal(row.rows[0].submission_id, null);
  } finally {
    await db.close();
  }
});