const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const CLIENT = '11111111-1111-4111-8111-111111111111';
const JOB = '22222222-2222-4222-8222-222222222222';
const ASSIGNMENT = '33333333-3333-4333-8333-333333333333';
const GUARD = '44444444-4444-4444-8444-444444444444';
const REQUEST = '55555555-5555-4555-8555-555555555555';
const TRANSACTION = '66666666-6666-4666-8666-666666666666';
const SECOND_ASSIGNMENT = '77777777-7777-4777-8777-777777777777';
const SECOND_GUARD = '88888888-8888-4888-8888-888888888888';
const SECOND_REQUEST = '99999999-9999-4999-8999-999999999999';

const migration = fs.readFileSync(
  'supabase/migrations/20261006100906_restore_guard_payment_auto_release.sql',
  'utf8',
);
const coreSql = migration
  .split('-- BEGIN AUTO RELEASE CORE')[1]
  .split('-- END AUTO RELEASE CORE')[0];

async function setup({ ageHours = 73, releaseHours = 72, disputed = false } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema app;
    create table app.jobs(
      id uuid primary key, client_id uuid, status text, payment_status text,
      is_deleted boolean default false, disputed boolean default false,
      disputed_at timestamptz, disputed_reason text, updated_at timestamptz
    );
    create table app.job_assignments(
      id uuid primary key, job_id uuid, guard_id uuid, status text,
      payment_status text, completed_at timestamptz, payout_released boolean default false,
      updated_at timestamptz
    );
    create table app.job_completion_requests(
      id uuid primary key, job_id uuid, guard_id uuid, client_id uuid,
      status text, requested_at timestamptz, updated_at timestamptz
    );
    create table app.transactions(
      id uuid primary key, job_id uuid, client_id uuid, transaction_type text,
      status text, stripe_payment_intent text, refunded boolean default false,
      refund_amount numeric default 0, metadata jsonb, created_at timestamptz
    );
    create table app.disputes(id uuid primary key default gen_random_uuid(), job_id uuid, status text);
    create table app.financial_operations(job_id uuid, state text);
    create table app.payment_audit_logs(
      job_id uuid, assignment_id uuid, guard_id uuid, client_id uuid,
      from_status text, to_status text not null, changed_by uuid,
      changed_by_role text, event_type text, reference_type text,
      reference_id text, details jsonb, created_at timestamptz
    );
    insert into app.jobs(id,client_id,status,payment_status,disputed)
      values('${JOB}','${CLIENT}','awaiting_client_approval','funded',${disputed});
    insert into app.job_assignments(id,job_id,guard_id,status,payment_status,completed_at)
      values('${ASSIGNMENT}','${JOB}','${GUARD}','completed','funded',now()-interval '${ageHours} hours');
    insert into app.job_completion_requests(id,job_id,guard_id,client_id,status,requested_at)
      values('${REQUEST}','${JOB}','${GUARD}','${CLIENT}','pending',now()-interval '${ageHours} hours');
    insert into app.transactions(id,job_id,client_id,transaction_type,status,stripe_payment_intent,metadata,created_at)
      values('${TRANSACTION}','${JOB}','${CLIENT}','job_payment','completed','pi_test',
        jsonb_build_object('breakdown',jsonb_build_object('autoRelease',${releaseHours})),now()-interval '80 hours');
  `);
  await db.exec(coreSql);
  return db;
}

const decide = (db) => db.query(
  'select app.record_overdue_completion_payment_decision($1) result',
  [REQUEST],
);
const candidates = (db) => db.query(
  'select * from app.list_overdue_completion_payment_requests($1)',
  [100],
);
const claim = (db) => db.query('select app.claim_auto_payout_attempt($1) result', [REQUEST]);

test('overdue funded completion is atomically approved and made payout eligible', async () => {
  const db = await setup();
  try {
    const result = (await decide(db)).rows[0].result;
    assert.equal(result.eligible, true);
    assert.equal(result.autoReleaseHours, 72);
    assert.equal((await db.query('select status,auto_release_hours from app.job_completion_requests')).rows[0].status, 'approved');
    assert.equal((await db.query('select payment_status from app.job_assignments')).rows[0].payment_status, 'payout_pending');
    assert.equal((await db.query('select status from app.jobs')).rows[0].status, 'payout_approved');
    assert.equal((await db.query('select event_type from app.payment_audit_logs')).rows[0].event_type, 'completion_auto_approved');
  } finally {
    await db.close();
  }
});

test('frozen transaction timeout is honoured and a completion cannot release early', async () => {
  const db = await setup({ ageHours: 23, releaseHours: 24 });
  try {
    assert.equal((await candidates(db)).rows.length, 0);
    const result = (await decide(db)).rows[0].result;
    assert.equal(result.eligible, false);
    assert.equal(result.reason, 'not_due');
    assert.equal((await db.query('select status from app.job_completion_requests')).rows[0].status, 'pending');
    assert.equal((await db.query('select count(*)::int n from app.payment_audit_logs')).rows[0].n, 0);
  } finally {
    await db.close();
  }
});

test('disputes and refunded payments block automatic approval', async () => {
  const disputed = await setup({ disputed: true });
  try {
    assert.equal((await decide(disputed)).rows[0].result.reason, 'finance_hold');
  } finally {
    await disputed.close();
  }

  const refunded = await setup();
  try {
    await refunded.exec('update app.transactions set refunded=true,refund_amount=10');
    assert.equal((await decide(refunded)).rows[0].result.reason, 'payment_not_releasable');
    assert.equal((await refunded.query('select status from app.job_completion_requests')).rows[0].status, 'pending');
  } finally {
    await refunded.close();
  }
});

test('automatic approval rolls back every state change when its audit insert fails', async () => {
  const db = await setup();
  try {
    await db.exec(`
      alter table app.payment_audit_logs
      add constraint reject_auto_approval_audit
      check (event_type <> 'completion_auto_approved')
    `);
    await assert.rejects(decide(db), /reject_auto_approval_audit/);
    assert.equal((await db.query('select status from app.job_completion_requests')).rows[0].status, 'pending');
    assert.equal((await db.query('select payment_status from app.job_assignments')).rows[0].payment_status, 'funded');
    assert.equal((await db.query('select status from app.jobs')).rows[0].status, 'awaiting_client_approval');
  } finally {
    await db.close();
  }
});

test('every overdue guard on a multi-guard job can be approved in the same run', async () => {
  const db = await setup();
  try {
    await db.exec(`
      insert into app.job_assignments(id,job_id,guard_id,status,payment_status,completed_at)
        values('${SECOND_ASSIGNMENT}','${JOB}','${SECOND_GUARD}','completed','funded',now()-interval '73 hours');
      insert into app.job_completion_requests(id,job_id,guard_id,client_id,status,requested_at)
        values('${SECOND_REQUEST}','${JOB}','${SECOND_GUARD}','${CLIENT}','pending',now()-interval '73 hours');
    `);
    assert.equal((await candidates(db)).rows.length, 2);
    assert.equal((await decide(db)).rows[0].result.eligible, true);
    const second = (await db.query(
      'select app.record_overdue_completion_payment_decision($1) result',
      [SECOND_REQUEST],
    )).rows[0].result;
    assert.equal(second.eligible, true);
    assert.equal((await db.query("select count(*)::int n from app.job_completion_requests where status='approved'")).rows[0].n, 2);
    assert.equal((await db.query("select count(*)::int n from app.job_assignments where payment_status='payout_pending'")).rows[0].n, 2);
  } finally {
    await db.close();
  }
});

test('payout attempts are claimed once per retry window and completed payouts stop retrying', async () => {
  const db = await setup();
  try {
    await decide(db);
    const first = (await claim(db)).rows[0].result;
    const second = (await claim(db)).rows[0].result;
    assert.equal(first.claimed, true);
    assert.equal(second.claimed, false);
    assert.equal(second.reason, 'retry_not_due');
    await db.exec("update app.job_completion_requests set auto_payout_next_attempt_at=now(); update app.job_assignments set payment_status='paid_out',payout_released=true");
    const completed = (await claim(db)).rows[0].result;
    assert.equal(completed.reason, 'already_complete');
    assert.equal((await db.query('select auto_payout_completed_at is not null done from app.job_completion_requests')).rows[0].done, true);
  } finally {
    await db.close();
  }
});

test('browser roles cannot execute automatic payout decision functions', async () => {
  const db = await setup();
  try {
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query(
        `select has_function_privilege('${role}','app.list_overdue_completion_payment_requests(integer)','execute') allowed`,
      )).rows[0].allowed, false);
      assert.equal((await db.query(
        `select has_function_privilege('${role}','app.record_overdue_completion_payment_decision(uuid)','execute') allowed`,
      )).rows[0].allowed, false);
      assert.equal((await db.query(
        `select has_function_privilege('${role}','app.claim_auto_payout_attempt(uuid)','execute') allowed`,
      )).rows[0].allowed, false);
    }
  } finally {
    await db.close();
  }
});

test('worker uses the secured replacement path and the retired endpoint remains a tombstone', () => {
  const worker = fs.readFileSync('supabase/functions/process-overdue-guard-payouts/index.ts', 'utf8');
  const payout = fs.readFileSync('supabase/functions/create-guard-payout/index.ts', 'utf8');
  const retired = fs.readFileSync('supabase/functions/auto-release-guard-payments/index.ts', 'utf8');
  assert.match(worker, /validate_payout_worker_token/);
  assert.match(worker, /list_overdue_completion_payment_requests/);
  assert.match(worker, /record_overdue_completion_payment_decision/);
  assert.match(worker, /claim_auto_payout_attempt/);
  assert.match(worker, /automatic_completion_timeout/);
  assert.match(payout, /approvalSource === 'automatic_completion_timeout'/);
  assert.match(retired, /status: 410/);
  assert.match(migration, /qg_payout_worker_token/);
  assert.match(migration, /cron\.unschedule/);
  assert.match(migration, /cron\.schedule\(\s*'process-overdue-guard-payouts'/);
});
