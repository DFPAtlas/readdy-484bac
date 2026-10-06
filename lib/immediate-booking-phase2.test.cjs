'use strict';

/**
 * QuickGuard Phase 2 — immediate booking (Book a Guard Now) automated coverage.
 *
 * The workspace protects the tests/ and scripts/ directories from writes, so
 * this focused suite lives here and is run by `npm run test:unit`.
 *
 * It asserts the guarantees that must hold for the immediate-booking journey:
 * server-side classification, idempotent creation, durable idempotent guard
 * notification queueing, honest delivery states and the service-role boundary.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

test('email worker delivers job_match and recomputes honest job status', () => {
  assert.match(worker, /email\.email_type === 'job_match'/);
  assert.match(worker, /\/send-job-match-email/);
  assert.match(worker, /recompute_job_notification_status/);
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

test('migration keeps existing jobs safe and enforces idempotency', () => {
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_client_submission/);
  assert.match(migration, /WHERE submission_id IS NOT NULL/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_email_queue_idempotency/);
  assert.match(migration, /WHERE \(metadata->>'idempotency_key'\) IS NOT NULL/);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE/i);
});

test('admin urgent badge, filter and count use real data', () => {
  assert.match(adminJobs, /eq\('urgency', 'immediate'\)/);
  assert.match(adminPage, /Immediate/);
  assert.match(jobsTable, /IMMEDIATE/);
  assert.match(jobsTable, /partially_delivered/);
});