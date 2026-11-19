const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { databaseFixture } = require('./helpers/client-read-fixture.cjs');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
function load(path, mocks = {}) {
  const module = { exports: {} };
  new Function('module', 'exports', 'require', compile(fs.readFileSync(path, 'utf8')))(module, module.exports, name => mocks[name] ?? require(name));
  return module.exports;
}
const guidance = load('lib/customer-guidance.ts');
const actions = load('lib/client-job-actions.ts', { './customer-guidance': guidance });
const { loadClientReviews } = load('lib/client-reviews.ts', { './client-job-actions': actions });
const job = (id, status, extra = {}) => ({ id, client_id: 'client', status, is_deleted: false, job_title: id, start_date: '2026-11-20', ...extra });
const assignment = (id, jobId, extra = {}) => ({ id, job_id: jobId, guard_id: 'guard', status: 'completed', payment_status: 'paid_out', ...extra });

function fixture({ failTable, profileError = false, missingProfile = false } = {}) {
  const jobs = ['paid_out', 'review_pending', 'closed', 'completed', 'cancelled'].map(status => job(status, status));
  jobs.push(job('deleted', 'paid_out', { is_deleted: true }), job('foreign', 'paid_out', { client_id: 'another-client' }));
  const rows = { jobs, job_assignments: jobs.map(row => assignment('a-' + row.id, row.id)), reviews: [
    { id: 'review-closed', client_id: 'client', job_id: 'closed', guard_id: 'guard', rating: 4, created_at: '2026-11-19' },
    { id: 'review-foreign', client_id: 'another-client', job_id: 'paid_out', guard_id: 'guard', rating: 1 },
  ] };
  rows.job_assignments.push(assignment('unpaid', 'paid_out', { guard_id: 'unpaid-guard', payment_status: 'funded' }),
    assignment('unfinished', 'paid_out', { guard_id: 'unfinished-guard', status: 'confirmed' }), assignment('duplicate', 'paid_out'));
  const db = databaseFixture(rows, { failTable });
  const profileCalls = [];
  db.functions = { async invoke(name, { body }) {
    profileCalls.push({ name, body });
    return { error: profileError ? { message: 'offline' } : null, data: { profiles: missingProfile ? [] : [
      { id: 'guard', full_name: 'Synthetic Guard', is_active: false, profile_image_url: '/guard.png', email: 'private', bank_account_number: 'private', sia_licence_number: 'private' },
    ] } };
  } };
  return { db, rows, profileCalls };
}

test('cancellation fails closed and review eligibility requires settled completed assignments', () => {
  for (const status of guidance.CLIENT_CANCELLABLE_STATUSES) assert.equal(actions.canClientCancelJob({ status }), true);
  for (const status of ['completed', 'payout_approved', 'paid_out', 'review_pending', 'closed', 'cancelled', 'disputed', 'awaiting_client_approval', 'future_status', undefined]) {
    assert.equal(actions.canClientCancelJob({ status }), false, status);
  }
  assert.equal(actions.canClientCancelJob({ status: 'confirmed', is_deleted: true }), false);
  for (const status of ['paid_out', 'review_pending']) {
    assert.equal(actions.canClientReviewAssignment({ status }, assignment('a', 'j')), true);
    for (const extra of [{ status: 'confirmed' }, { status: 'cancelled' }, { payment_status: 'funded' }, { payment_status: 'payout_processing' }]) {
      assert.equal(actions.canClientReviewAssignment({ status }, assignment('a', 'j', extra)), false);
    }
  }
  for (const status of ['completed', 'payout_approved', 'closed', 'cancelled', 'unknown']) assert.equal(actions.canClientReviewAssignment({ status }, assignment('a', 'j')), false);
});

test('review queue uses actual eligible pairs, keeps closed-job history and safely identifies inactive guards', async () => {
  const { db, rows, profileCalls } = fixture();
  let result = await loadClientReviews(db, 'client');
  assert.deepEqual(result.pendingReviews.map(row => row.job_id).sort(), ['paid_out', 'review_pending']);
  assert.equal(result.reviews.length, 1); assert.equal(result.reviews[0].jobs.job_title, 'closed');
  assert.match(result.pendingReviews[0].guard_name, /Synthetic Guard \(inactive account\)/);
  for (const row of result.pendingReviews) for (const key of ['email', 'bank_account_number', 'sia_licence_number']) assert.equal(row[key], undefined);
  assert.deepEqual(Object.keys(result.reviews[0].guards).sort(), ['full_name', 'profile_photo_url']);
  assert.ok(profileCalls.every(call => call.name === 'get-client-assigned-guards' && ['paid_out', 'review_pending', 'closed'].includes(call.body.job_id)));
  assert.ok(db.calls.every(call => !['guards', 'guard_public_profiles'].includes(call.table)));
  // After successful submission closes the job, the review remains in history.
  rows.reviews.push({ id: 'new-review', client_id: 'client', job_id: 'paid_out', guard_id: 'guard', rating: 5 });
  rows.jobs.find(row => row.id === 'paid_out').status = 'closed';
  result = await loadClientReviews(db, 'client');
  assert.equal(result.reviews.length, 2); assert.deepEqual(result.pendingReviews.map(row => row.job_id), ['review_pending']);
});

test('review database/profile failures reject instead of becoming All Caught Up; missing profiles are explicit', async () => {
  for (const failTable of ['jobs', 'reviews', 'job_assignments']) {
    const { db } = fixture({ failTable }); await assert.rejects(loadClientReviews(db, 'client'), /could not be loaded/);
  }
  const failing = fixture({ profileError: true }); await assert.rejects(loadClientReviews(failing.db, 'client'), /profiles could not be loaded/);
  const missing = await loadClientReviews(fixture({ missingProfile: true }).db, 'client');
  assert.ok(missing.pendingReviews.every(row => row.guard_name === 'Guard profile unavailable'));
});

test('review reads page beyond server limits and scope every assignment/profile request to owned jobs', async () => {
  const { db, rows, profileCalls } = fixture();
  rows.jobs = Array.from({ length: 205 }, (_, n) => job('job-' + String(n).padStart(3, '0'), 'paid_out'));
  rows.job_assignments = rows.jobs.map(row => assignment('a-' + row.id, row.id)); rows.reviews = [];
  const result = await loadClientReviews(db, 'client');
  assert.equal(result.pendingReviews.length, 205); assert.equal(profileCalls.length, 205);
  assert.ok(db.calls.some(call => call.table === 'jobs' && call.offset === 200));
  assert.ok(db.calls.some(call => call.table === 'job_assignments' && call.offset === 200));
  for (const call of db.calls.filter(call => call.table === 'jobs')) {
    assert.equal(call.filters.every(filter => filter(job('foreign', 'paid_out', { client_id: 'another-client' }))), false);
    assert.equal(call.filters.every(filter => filter(job('deleted', 'paid_out', { is_deleted: true }))), false);
  }
});

test('bulk cancellation uses the atomic RPC, skips terminal work and reports partial failures', async () => {
  const calls = [];
  const db = { async rpc(name, args) {
    calls.push([name, args]);
    if (args.p_job_id === 'blocked') return { error: { message: 'Payout already started' } };
    if (args.p_job_id === 'offline') throw new Error('offline');
    if (args.p_job_id === 'malformed') return { data: { success: true } };
    return { data: { success: true, cancellationId: 'cancel-' + args.p_job_id } };
  } };
  const result = await actions.cancelClientJobs(db, [job('eligible', 'confirmed'), job('blocked', 'in_progress'), job('offline', 'open'), job('malformed', 'draft'), job('paid', 'paid_out'), job('closed', 'closed')]);
  assert.deepEqual(result, { cancelled: 1, failed: 3, skipped: 2 });
  assert.equal(calls.length, 4); assert.ok(calls.every(([name, args]) => name === 'cancel_client_job' && args.p_resolution === 'full_refund' && args.p_reason));
});

test('terminal cancellation modals provide support and never offer refund resolutions', () => {
  const Modal = load('app/client/jobs/CancelJobModal.tsx', { '@/lib/client-job-actions': actions, '@/lib/supabase': { supabase: {} }, 'next/navigation': { useRouter: () => ({ push() {} }) } }).default;
  for (const status of ['completed', 'paid_out', 'payout_approved', 'review_pending', 'closed', 'cancelled', 'disputed', 'unknown']) {
    const html = renderToStaticMarkup(React.createElement(Modal, { job: job('job', status), onClose() {}, onSuccess() {} }));
    assert.match(html, /Cannot Cancel Job/); assert.match(html, /Contact Support/);
    assert.doesNotMatch(html, /Full Refund|Partial Refund|Cancellation Reason|currently active/);
  }
  const eligible = renderToStaticMarkup(React.createElement(Modal, { job: job('job', 'confirmed'), onClose() {}, onSuccess() {} }));
  assert.match(eligible, /Cancellation Reason/);
});

test('review read errors render Retry instead of zero counters and All Caught Up', () => {
  let index = 0;
  const hooks = { ...React, useState(initial) {
    const current = index++; const original = React.useState(initial);
    return current === 0 ? [false, () => {}] : current === 1 ? ['Review records could not be loaded.', () => {}] : original;
  } };
  const Page = load('app/client/reviews/page.tsx', {
    react: hooks, 'next/navigation': { useRouter: () => ({ push() {} }) },
    'next/link': { __esModule: true, default: props => React.createElement('a', props, props.children) },
    '@/lib/supabase': { supabase: {} }, '@/lib/client-reviews': { loadClientReviews },
    '@/hooks/useClientGuard': { useClientGuard: () => ({ loading: false, allowed: true, userId: 'user' }) },
    '@/components/QuickGuardImage': { __esModule: true, default: () => null },
    '@/components/PortalSidebar': { __esModule: true, default: () => null },
    '@/components/reviews/ReviewStatusBadge': { __esModule: true, default: () => null, ReviewStars: () => null },
    '@/components/reviews/RateGuardModal': { __esModule: true, default: () => null },
    '@/lib/date-only': { formatDateOnly: value => value },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.match(html, /role="alert"/); assert.match(html, /Retry reviews/);
  assert.doesNotMatch(html, /All Caught Up|Pending \(0\)|Reviews Given|Average Rating/);
});

test('the existing review service rejects ownership, lifecycle, assignment and duplicate violations', async () => {
  const JOB = '11111111-1111-4111-8111-111111111111', GUARD = '22222222-2222-4222-8222-222222222222';
  async function run({ status = 'paid_out', assignmentStatus = 'completed', paymentStatus = 'paid_out', owner = 'client', token = 'test-token' } = {}) {
    const rows = { clients: [{ id: 'client', user_id: 'user-client' }], jobs: [{ id: JOB, client_id: owner, status }], job_assignments: [{ id: 'assignment', job_id: JOB, guard_id: GUARD, status: assignmentStatus, payment_status: paymentStatus }], reviews: [{ id: 'existing', assignment_id: 'assignment' }] };
    const db = databaseFixture(rows); let handler;
    const compiled = compile(fs.readFileSync('supabase/functions/create-review/index.ts', 'utf8'));
    new Function('require', 'Deno', 'exports', compiled)(() => ({ serve: fn => { handler = fn; }, createClient: () => db }), { env: { get: () => 'test' } }, {});
    return handler(new Request('https://example.invalid', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: JOB, guardId: GUARD, rating: 5 }) }));
  }
  assert.equal((await run({ token: 'invalid' })).status, 401);
  assert.equal((await run({ owner: 'another-client' })).status, 403);
  for (const status of ['completed', 'payout_approved', 'cancelled', 'closed']) assert.equal((await run({ status })).status, 400);
  assert.equal((await run({ assignmentStatus: 'confirmed' })).status, 400);
  assert.equal((await run({ paymentStatus: 'funded' })).status, 400);
  for (const status of ['paid_out', 'review_pending']) assert.equal((await run({ status })).status, 409);
});
