// Database regression tests for the journey-repair migrations (PGlite).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const { CLIENT_USER, CLIENT, JOB, GUARD_USER, GUARD, OTHER_USER, OTHER_GUARD, INVITE, MIGRATIONS, setupSql, migrationSql } = require('./helpers/journey-fixture.cjs');
const migration = migrationSql;

async function setup() {
  const db = new PGlite();
  await db.exec(setupSql());
  for (const name of MIGRATIONS) await db.exec(migration(name));
  return db;
}

async function as(db, role, uid, fn) {
  await db.exec(`set role ${role}; select set_config('test.uid', '${uid || ''}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('test.uid', '', false);`); }
}
const one = async (db, sql, params) => (await db.query(sql, params)).rows[0];

// ---------- Finding 1 ----------
test('select_job_guards stores 16 scheduled hours and £320 gross, ignoring the 64-hour browser value', async () => {
  const db = await setup();
  try {
    await db.exec(`insert into app.job_applications(job_id, guard_id, status) values ('${JOB}', '${GUARD}', 'pending'), ('${JOB}', '${OTHER_GUARD}', 'pending')`);
    const sel = JSON.stringify([
      { guard_id: GUARD, agreed_hourly_rate: 1, agreed_hours: 64, gross_guard_amount: 1280 },
      { guard_id: OTHER_GUARD, agreed_hourly_rate: 1, agreed_hours: 64, gross_guard_amount: 1280 },
    ]);
    const res = await as(db, 'authenticated', CLIENT_USER, () => one(db, 'select app.select_job_guards($1, $2::jsonb) r', [JOB, sel]));
    assert.equal(res.r.agreed_hours, 16);
    const rows = (await db.query('select guard_id, agreed_hourly_rate::float rate, agreed_hours::float hours, gross_guard_amount::float gross from app.job_assignments order by gross desc')).rows;
    // Guard with own rate £20 -> £320; guard without a rate uses the job rate £18 -> £288.
    assert.deepEqual(rows.map(r => [r.rate, r.hours, r.gross]), [[20, 16, 320], [18, 16, 288]]);
    assert.equal((await one(db, "select app.job_scheduled_hours('22:00','06:00',3,null,null)::float h")).h, 24);
    assert.equal((await db.query('select * from app.booking_hours_reconciliation')).rows.length, 0);
    // A historical inflated row is listed for review, not rewritten.
    await db.exec(`update app.job_assignments set agreed_hours = 64, gross_guard_amount = 1280 where guard_id = '${GUARD}'`);
    const flagged = (await db.query('select stored_hours::float s, scheduled_hours::float h, stored_gross::float g, scheduled_gross::float sg from app.booking_hours_reconciliation')).rows;
    assert.deepEqual(flagged, [{ s: 64, h: 16, g: 1280, sg: 320 }]);
    assert.equal((await one(db, `select gross_guard_amount::float g from app.job_assignments where guard_id = '${GUARD}'`)).g, 1280);
  } finally { await db.close(); }
});

// ---------- Finding 2 ----------
const jobInsert = `insert into app.jobs(client_id, start_date, start_time, end_time, number_of_days, hourly_rate) values ('${CLIENT}', '2026-11-10', '09:00', '17:00', 1, 15)`;

test('every API insert path enforces the plan posting limit atomically', async () => {
  const db = await setup();
  try {
    // Desktop (create-job, service role) and mobile/bulk (browser role) share one limit of 2.
    await as(db, 'service_role', '', () => db.exec(jobInsert));
    await as(db, 'authenticated', CLIENT_USER, () => db.exec(jobInsert));
    await assert.rejects(as(db, 'authenticated', CLIENT_USER, () => db.exec(jobInsert)), /job_post_limit_reached/);
    await assert.rejects(as(db, 'service_role', '', () => db.exec(jobInsert)), /job_post_limit_reached/);
    assert.equal((await one(db, `select usage_count from app.user_feature_usage where user_id = '${CLIENT_USER}'`)).usage_count, 2);
    assert.equal((await one(db, `select count(*)::int n from app.jobs where client_id = '${CLIENT}'`)).n, 3); // seed + 2
  } finally { await db.close(); }
});

test('a failed insert consumes no usage, and a client cannot post for another client', async () => {
  const db = await setup();
  try {
    await db.exec('alter table app.jobs add constraint uat_force check (hourly_rate < 100)');
    await assert.rejects(as(db, 'authenticated', CLIENT_USER, () => db.exec(jobInsert.replace(', 15)', ', 500)'))), /uat_force/);
    assert.equal((await db.query(`select * from app.user_feature_usage`)).rows.length, 0);
    await assert.rejects(as(db, 'authenticated', OTHER_USER, () => db.exec(jobInsert)), /job_post_not_owner/);
    // Direct SQL maintenance inserts are not counted.
    await db.exec(jobInsert);
    assert.equal((await db.query(`select * from app.user_feature_usage`)).rows.length, 0);
  } finally { await db.close(); }
});

// ---------- Findings 3-5 ----------
const apply = (db, actor, guard, invite = null, admin = false) => as(db, 'service_role', '', () =>
  one(db, 'select app.submit_job_application($1, $2, $3, $4, $5, $6) r', [actor, guard, JOB, 'Hello', invite, admin]));

test('applications enforce ownership, eligibility and limits; exhausted accounts cannot apply', async () => {
  const db = await setup();
  try {
    await assert.rejects(apply(db, OTHER_USER, GUARD), /qg_apply:forbidden/);
    await db.exec(`update app.guards set verification_status = 'pending' where id = '${GUARD}'`);
    await assert.rejects(apply(db, GUARD_USER, GUARD), /qg_apply:guard_not_verified/);
    await db.exec(`update app.guards set verification_status = 'approved', sia_expiry_date = current_date - 1 where id = '${GUARD}'`);
    await assert.rejects(apply(db, GUARD_USER, GUARD), /qg_apply:sia_expired/);
    await db.exec(`update app.guards set sia_expiry_date = current_date + 30 where id = '${GUARD}'; update app.jobs set sia_licence_required = true, required_licence_types = array['CCTV']`);
    await assert.rejects(apply(db, GUARD_USER, GUARD), /qg_apply:licence_mismatch/);
    await db.exec(`update app.jobs set sia_licence_required = false, required_licence_types = null, job_access_level = 'premium'`);
    await assert.rejects(apply(db, GUARD_USER, GUARD), /qg_apply:tier_locked:premium/);
    await db.exec(`update app.jobs set job_access_level = null`);
    assert.equal((await db.query('select * from app.user_feature_usage')).rows.length, 0, 'rejections consume nothing');

    // Eligible (limit 1): succeeds and consumes exactly one.
    const ok = await apply(db, GUARD_USER, GUARD);
    assert.ok(ok.r.applicationId);
    assert.equal((await one(db, `select usage_count from app.user_feature_usage where user_id = '${GUARD_USER}'`)).usage_count, 1);
    // Duplicate: rejected, nothing consumed.
    await assert.rejects(apply(db, GUARD_USER, GUARD), /qg_apply:already_applied/);
    // Exhausted account on a second job.
    await db.exec(`insert into app.jobs(id, client_id, start_date, start_time, end_time, number_of_days, hourly_rate) values ('99999999-9999-4999-8999-999999999999', '${CLIENT}', '2026-11-11', '09:00', '17:00', 1, 15)`);
    await assert.rejects(as(db, 'service_role', '', () => one(db, 'select app.submit_job_application($1, $2, $3) r', [GUARD_USER, GUARD, '99999999-9999-4999-8999-999999999999'])), /qg_apply:limit_reached/);
    assert.equal((await one(db, `select usage_count from app.user_feature_usage where user_id = '${GUARD_USER}'`)).usage_count, 1);
    // guards.id vs guards.user_id: passing the profile id as the actor is rejected.
    await assert.rejects(apply(db, OTHER_GUARD, OTHER_GUARD), /qg_apply:forbidden/);
    assert.ok((await apply(db, OTHER_USER, OTHER_GUARD)).r.applicationId, 'unlimited plan applies via its auth user id');
  } finally { await db.close(); }
});

test('invitation acceptance is atomic, retryable after failure and idempotent', async () => {
  const db = await setup();
  try {
    await db.exec(`insert into app.job_invites values ('${INVITE}', '${JOB}', '${GUARD}', '${CLIENT}', 'pending', null)`);
    // Browser roles cannot mark an invite accepted without an application.
    await assert.rejects(as(db, 'authenticated', GUARD_USER, () => db.exec(`update app.job_invites set status = 'accepted' where id = '${INVITE}'`)), /invite_acceptance_requires_application/);
    // A failed application leaves the invite pending.
    await db.exec(`update app.guards set is_active = false where id = '${GUARD}'`);
    await assert.rejects(apply(db, GUARD_USER, GUARD, INVITE), /qg_apply:guard_inactive/);
    assert.equal((await one(db, `select status from app.job_invites`)).status, 'pending');
    // Retry succeeds; acceptance and application commit together.
    await db.exec(`update app.guards set is_active = true where id = '${GUARD}'`);
    const first = await apply(db, GUARD_USER, GUARD, INVITE);
    assert.equal(first.r.replayed, false);
    assert.equal((await one(db, `select status from app.job_invites`)).status, 'accepted');
    // Repeated acceptance: same application, no second usage unit.
    const again = await apply(db, GUARD_USER, GUARD, INVITE);
    assert.equal(again.r.replayed, true);
    assert.equal(again.r.applicationId, first.r.applicationId);
    assert.equal((await one(db, 'select count(*)::int n from app.job_applications')).n, 1);
    assert.equal((await one(db, `select usage_count from app.user_feature_usage where user_id = '${GUARD_USER}'`)).usage_count, 1);
    // Declining directly is still allowed for other invites.
    await db.exec(`insert into app.job_invites values (gen_random_uuid(), '${JOB}', '${OTHER_GUARD}', '${CLIENT}', 'pending', null)`);
    await as(db, 'authenticated', OTHER_USER, () => db.exec(`update app.job_invites set status = 'declined' where guard_id = '${OTHER_GUARD}'`));
  } finally { await db.close(); }
});

test('browser roles cannot read or consume another account\'s usage', async () => {
  const db = await setup();
  try {
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await one(db, `select has_function_privilege('${role}', 'app.check_monthly_usage(uuid,text,boolean)', 'execute') ok`)).ok, false);
      assert.equal((await one(db, `select has_function_privilege('${role}', 'app.submit_job_application(uuid,uuid,uuid,text,uuid,boolean)', 'execute') ok`)).ok, false);
    }
    const mine = await as(db, 'authenticated', GUARD_USER, () => one(db, "select app.get_my_feature_usage('guard_application') r"));
    assert.equal(mine.r.plan_slug, 'guard_starter');
    await assert.rejects(as(db, 'authenticated', '', () => one(db, "select app.get_my_feature_usage('guard_application') r")), /not_authenticated/);
  } finally { await db.close(); }
});

// ---------- Finding 9 ----------
const promo = (db, guard) => as(db, 'service_role', '', () => one(db, 'select app.assign_guard_promo_tier($1) r', [guard]));

test('promo allocation fails closed, checks eligibility, and never overwrites existing benefits', async () => {
  const db = await setup();
  try {
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await one(db, `select has_function_privilege('${role}', 'app.assign_guard_promo_tier(uuid)', 'execute') ok`)).ok, false);
    }
    await assert.rejects(promo(db, GUARD), /qg_promo:config_missing/);
    assert.equal((await one(db, `select signup_number from app.guards where id = '${GUARD}'`)).signup_number, null, 'no write without config');
    await db.exec(`insert into app.promo_config values (1, now(), 1, 3, 5, 30, 5, false)`);
    await db.exec(`update app.guards set verification_status = 'pending' where id = '${OTHER_GUARD}'`);
    await assert.rejects(promo(db, OTHER_GUARD), /qg_promo:guard_not_eligible/);
    await assert.rejects(promo(db, '00000000-0000-4000-8000-000000000000'), /qg_promo:guard_not_found/);

    const first = await promo(db, GUARD);
    assert.deepEqual([first.r.signupNumber, first.r.tier, first.r.foundingBadge, Number(first.r.lifetimeFee)], [1, 'founding', true, 5]);
    // Pausing promotions or repeating the call never strips founding benefits.
    await db.exec(`update app.promo_config set is_paused = true`);
    const repeat = await promo(db, GUARD);
    assert.equal(repeat.r.alreadyAssigned, true);
    const kept = await one(db, `select promo_tier, founding_badge, lifetime_fee_percentage::float fee, signup_number from app.guards where id = '${GUARD}'`);
    assert.deepEqual(kept, { promo_tier: 'founding', founding_badge: true, fee: 5, signup_number: 1 });
    // Paused: next eligible guard gets the next number on the standard tier.
    await db.exec(`update app.guards set verification_status = 'approved' where id = '${OTHER_GUARD}'`);
    const paused = await promo(db, OTHER_GUARD);
    assert.deepEqual([paused.r.signupNumber, paused.r.tier], [2, 'standard']);
  } finally { await db.close(); }
});

test('promo signup numbers cannot be duplicated', async () => {
  const db = await setup();
  try {
    await db.exec(`insert into app.promo_config values (1, now(), 10, 20, 30, 30, 5, false)`);
    const a = await promo(db, GUARD);
    const b = await promo(db, OTHER_GUARD);
    assert.notEqual(a.r.signupNumber, b.r.signupNumber);
    // Even a writer bypassing the function cannot create a duplicate number.
    await assert.rejects(db.exec(`update app.guards set signup_number = ${a.r.signupNumber} where id = '${OTHER_GUARD}'`), /guards_signup_number_unique/);
    // The function body serialises allocation with a transaction-scoped advisory lock.
    assert.match(migration('20261005230300_secure_guard_promo_allocation.sql'), /pg_advisory_xact_lock\(hashtextextended\('guard_promo_allocation'/);
  } finally { await db.close(); }
});

test('invite and saved-job updates no longer fail on the missing updated_at column', async () => {
  const db = new PGlite();
  try {
    await db.exec(setupSql());
    await db.exec(`insert into app.job_invites values ('${INVITE}', '${JOB}', '${GUARD}', '${CLIENT}', 'pending', null)`);
    await assert.rejects(db.exec(`update app.job_invites set status = 'declined'`), /has no field "updated_at"/);
    for (const name of MIGRATIONS) await db.exec(migration(name));
    await db.exec(`update app.job_invites set status = 'declined'`);
    await db.exec(`insert into app.saved_jobs(job_id, guard_id) values ('${JOB}', '${GUARD}'); update app.saved_jobs set guard_id = guard_id`);
    assert.equal((await one(db, 'select status from app.job_invites')).status, 'declined');
  } finally { await db.close(); }
});
