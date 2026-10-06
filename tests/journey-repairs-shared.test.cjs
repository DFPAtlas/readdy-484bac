// Regression tests for the shared (TypeScript) parts of the journey repairs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');

function load(path) {
  const source = fs.readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(module, module.exports, require);
  return module.exports;
}

const shared = load('supabase/functions/_shared/shift-hours.ts');
const web = load('lib/shift-hours.ts');
const { calculatePaygFees } = (() => {
  // payg-fees imports '@/lib/booking-policy'; resolve it for the test.
  const source = fs.readFileSync('lib/payg-fees.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const policy = load('lib/booking-policy.ts');
  new Function('module', 'exports', 'require', compiled)(module, module.exports, (id) => (id === '@/lib/booking-policy' ? policy : require(id)));
  return module.exports;
})();
const { bookingAmounts } = load('supabase/functions/_shared/booking-policy.ts');

// ---------- Finding 1: multi-day pricing ----------
const twoDays = { start_date: '2026-11-02', end_date: '2026-11-03', start_time: '09:00:00', end_time: '17:00:00', number_of_days: 2 };

test('two eight-hour shifts are 16 payable hours, not the 64-hour span x days', () => {
  for (const lib of [shared, web]) {
    assert.equal(lib.shiftHours('09:00', '17:00'), 8);
    assert.equal(lib.scheduledHoursPerGuard(twoDays), 16);
    assert.equal(lib.grossGuardPence(20, twoDays), 32000); // £320, not £1,280
  }
  // The old selection formula, for the record: (final finish - first start) x days.
  const oldSpanHours = (Date.parse('2026-11-03T17:00:00Z') - Date.parse('2026-11-02T09:00:00Z')) / 3600000;
  assert.equal(oldSpanHours * 2, 64);
});

test('overnight, multi-guard and date-span fallbacks use daily shift hours x days', () => {
  for (const lib of [shared, web]) {
    assert.equal(lib.shiftHours('22:00:00', '06:00:00'), 8);
    assert.equal(lib.scheduledHoursPerGuard({ start_time: '22:00', end_time: '06:00', number_of_days: 3 }), 24);
    assert.equal(lib.scheduledHoursPerGuard({ start_time: '09:00', end_time: '17:30', start_date: '2026-11-02', end_date: '2026-11-04' }), 25.5);
    assert.equal(lib.scheduledDays(null, '2026-11-02', null), 1);
    assert.throws(() => lib.shiftHours(null, '17:00'));
    assert.throws(() => lib.grossGuardPence(0, twoDays));
  }
  // Three guards: displayed, stored and charged totals agree.
  const perGuard = shared.grossGuardPence(20, twoDays);
  const preview = calculatePaygFees({ hourlyRate: 20, hours: shared.shiftHours('09:00', '17:00'), numberOfGuards: 3, numberOfDays: 2, serviceFeePct: 10 });
  const charged = [1, 2, 3].map(() => bookingAmounts(perGuard, 10));
  assert.equal(preview.guardTotal * 100, charged.reduce((n, a) => n + a.grossGuardPence, 0));
  assert.equal(Math.round(preview.total * 100), charged.reduce((n, a) => n + a.clientTotalPence, 0));
  assert.equal(Math.round(preview.guardTotal * 100), 96000);
});

test('frontend and Edge Function hour modules are the same implementation', () => {
  const strip = (s) => s.split('\n').filter((l) => !l.startsWith('// Mirrors')).join('\n');
  assert.equal(strip(fs.readFileSync('lib/shift-hours.ts', 'utf8')), strip(fs.readFileSync('supabase/functions/_shared/shift-hours.ts', 'utf8')));
});

test('selection, fee preview and checkout all use the shared hours module', () => {
  const select = fs.readFileSync('app/client/jobs/[id]/select-guards/SelectGuardsClient.tsx', 'utf8');
  assert.match(select, /scheduledHoursPerGuard\(job\)/);
  assert.doesNotMatch(select, /hoursPerGuard \* days/);
  assert.match(fs.readFileSync('supabase/functions/create-job-payment/index.ts', 'utf8'), /booking_amount_mismatch/);
  assert.match(fs.readFileSync('supabase/functions/calculate-job-fees/index.ts', 'utf8'), /scheduledHoursPerGuard\(job\)/);
});

// ---------- Finding 2: mobile and desktop posting ----------
test('mobile and desktop post through create-job with the same plan/promotion fee loader', () => {
  const mobile = fs.readFileSync('app/client/mobile/post-job/MobilePostJob.tsx', 'utf8');
  const desktop = fs.readFileSync('app/client/post-job/page.tsx', 'utf8');
  for (const src of [mobile, desktop]) {
    assert.match(src, /submitClientJob\(/);
    assert.match(src, /loadClientBookingFee\(/);
    assert.doesNotMatch(src, /\.from\('jobs'\)\s*\.insert/);
  }
  assert.doesNotMatch(mobile, /0\.15/);
  assert.match(fs.readFileSync('lib/post-job-request.ts', 'utf8'), /functions\/v1\/create-job/);
});

test('create-job no longer double-counts usage and treats a missing repeat choice as one-off', () => {
  const src = fs.readFileSync('supabase/functions/create-job/index.ts', 'utf8');
  assert.doesNotMatch(src, /p_increment: true/);
  assert.match(src, /job_post_limit_reached/);
  assert.match(src, /is_recurring: Boolean\(formData\.repeatShift\) && formData\.repeatShift !== 'none'/);
  assert.doesNotMatch(fs.readFileSync('app/client/bulk-posting/BulkPostingClient.tsx', 'utf8'), /recordClientJobPost/);
});

// ---------- Findings 3-5: applications ----------
test('no screen inserts job applications or accepts invitations directly', () => {
  const files = ['app/guard/jobs/[id]/apply/GuardApplyClient.tsx', 'app/guard/jobs/[id]/GuardJobDetailClient.tsx', 'app/guard/saved-jobs/page.tsx', 'app/guard/mobile/MobileGuardDashboard.tsx', 'app/guard/job-invites/page.tsx'];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /from\('job_applications'\)\s*\.insert/, f);
    assert.match(src, /submitGuardApplication\(/, f);
  }
  const invites = fs.readFileSync('app/guard/job-invites/page.tsx', 'utf8');
  assert.doesNotMatch(invites, /status: newStatus/);
  assert.match(invites, /inviteId, coverMessage/);
});

test('browser usage helpers never pass an id to the usage RPC', () => {
  for (const f of ['lib/guard-application-limits.ts', 'hooks/useUsageLimits.ts']) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /check_monthly_usage/, f);
    assert.match(src, /get_my_feature_usage/, f);
  }
});

// ---------- Finding 6: shift confirmation ----------
const { confirmGuardShift, ShiftConfirmationError } = load('supabase/functions/_shared/shift-confirmation.ts');
function fakeDb({ assignment, job, updateResult }) {
  const calls = [];
  return { calls, from(table) {
    const q = { filters: [], payload: null,
      select() { return this; }, eq(k, v) { this.filters.push([k, v]); return this; }, is(k, v) { this.filters.push([k, v]); return this; },
      update(p) { this.payload = p; calls.push(['update', table, p]); return this; },
      async maybeSingle() { return table === 'job_assignments' ? assignment : job; },
      then(resolve) { resolve(updateResult); } };
    return q;
  } };
}
const funded = { data: { id: 'a1', job_id: 'j1', guard_id: 'g1', status: 'confirmed', payment_status: 'funded', guard_confirmed_at: null }, error: null };
const activeJob = { data: { id: 'j1', status: 'confirmed', payment_status: 'funded', is_deleted: false }, error: null };

test('shift confirmation writes guard_confirmed_at and reports success only after one row persists', async () => {
  const db = fakeDb({ assignment: funded, job: activeJob, updateResult: { data: [{ id: 'a1', guard_confirmed_at: '2026-10-05T20:00:00Z' }], error: null } });
  const result = await confirmGuardShift(db, { guardId: 'g1', assignmentId: 'a1', jobId: 'j1', now: '2026-10-05T20:00:00Z' });
  assert.equal(result.success, true);
  assert.equal(result.guard_confirmed_at, '2026-10-05T20:00:00Z');
  assert.deepEqual(Object.keys(db.calls[0][2]).sort(), ['guard_confirmed_at', 'updated_at']);
});

test('failed or zero-row confirmation writes, wrong owner and unfunded shifts never report success', async () => {
  const cases = [
    [{ assignment: funded, job: activeJob, updateResult: { data: null, error: { message: 'boom' } } }, 'write_failed'],
    [{ assignment: funded, job: activeJob, updateResult: { data: [], error: null } }, 'conflict'],
    [{ assignment: { data: null, error: null }, job: activeJob, updateResult: { data: [], error: null } }, 'not_found'],
    [{ assignment: { data: { ...funded.data, payment_status: 'pending' }, error: null }, job: activeJob }, 'not_funded'],
    [{ assignment: { data: { ...funded.data, status: 'awaiting_payment' }, error: null }, job: activeJob }, 'not_booked'],
    [{ assignment: funded, job: { data: { ...activeJob.data, status: 'cancelled' }, error: null } }, 'job_inactive'],
  ];
  for (const [state, code] of cases) {
    await assert.rejects(confirmGuardShift(fakeDb(state), { guardId: 'g1', assignmentId: 'a1', jobId: 'j1' }),
      (err) => err instanceof ShiftConfirmationError && err.code === code);
  }
  const dash = fs.readFileSync('app/guard/dashboard/GuardDashboardClient.tsx', 'utf8');
  assert.match(dash, /action: 'confirm_shift'/);
  assert.match(dash, /!data\.guard_confirmed_at\) throw/);
});

// ---------- Finding 7: booking disputes ----------
test('booking dispute screen uses dispute-job and only shows success after it is recorded', () => {
  const src = fs.readFileSync('app/client/jobs/[id]/confirmation/BookingConfirmationClient.tsx', 'utf8');
  const handler = src.slice(src.indexOf('const handleDispute'), src.indexOf('const formatDate'));
  assert.match(handler, /functions\/v1\/dispute-job/);
  assert.doesNotMatch(handler, /from\('jobs'\)/);
  assert.ok(handler.indexOf('throw new Error') < handler.indexOf('setJob('), 'failure is handled before local state changes');
});

// ---------- Finding 8: subscription profile sync ----------
const sub = load('supabase/functions/_shared/subscription-profile.ts');

test('guard plan changes never write subscription_tier; clients keep it', () => {
  const guard = sub.subscriptionProfileUpdate('guard', { status: 'active', planSlug: 'guard-pro', planName: 'Guard Pro', now: 'x' });
  assert.equal('subscription_tier' in guard, false);
  assert.deepEqual(guard, { updated_at: 'x', subscription_status: 'active', subscription_plan: 'guard-pro', plan_slug: 'guard-pro', plan_name: 'Guard Pro' });
  const client = sub.subscriptionProfileUpdate('client', { status: 'active', planSlug: 'client-pro', now: 'x' });
  assert.equal(client.subscription_tier, 'client-pro');
  for (const key of Object.keys(sub.subscriptionProfileUpdate('guard', { status: 'a', planSlug: 'p', planName: 'n', customerId: 'c', subscriptionId: 's', currentPeriodEnd: 'e', activateProfile: true }))) {
    assert.ok(sub.PROFILE_SUBSCRIPTION_COLUMNS.guard.includes(key), key);
  }
});

test('Edge Functions no longer put subscription_tier into guard updates', () => {
  const webhook = fs.readFileSync('supabase/functions/enhanced-stripe-webhook/index.ts', 'utf8');
  assert.doesNotMatch(webhook, /subscription_tier:/);
  assert.doesNotMatch(webhook, /profileUpdate\.subscription_tier/);
  assert.doesNotMatch(fs.readFileSync('supabase/functions/create-subscription-checkout/index.ts', 'utf8'), /subscription_tier:/);
  assert.match(fs.readFileSync('supabase/functions/check-stripe-session/index.ts', 'utf8'), /delete profileUpdate\.subscription_tier/);
});

test('failed or zero-row writes are genuine failures', async () => {
  await assert.rejects(sub.requireWrite(Promise.resolve({ error: { message: 'PGRST204' } }), 'guard sync'), /guard sync failed: PGRST204/);
  await assert.rejects(sub.requireWrite(Promise.resolve({ error: null, data: [] }), 'guard sync', { minRows: 1 }), /affected 0 row/);
  assert.ok(await sub.requireWrite(Promise.resolve({ error: null, data: [{ id: 1 }] }), 'guard sync', { minRows: 1 }));
});

test('monthly and annual Stripe prices both resolve to their plan', async () => {
  const plans = [{ slug: 'guard-pro', name: 'Guard Pro', stripe_price_id: 'price_month', stripe_annual_price_id: 'price_year' }];
  const db = { from() { const q = { filter: '', select() { return q; }, or(f) { q.filter = f; return q; },
    limit() { const id = /stripe_price_id\.eq\.(\w+)/.exec(q.filter)[1]; return Promise.resolve({ data: plans.filter(p => p.stripe_price_id === id || p.stripe_annual_price_id === id), error: null }); } }; return q; } };
  assert.equal((await sub.planForPrice(db, 'price_month')).billingCycle, 'monthly');
  assert.equal((await sub.planForPrice(db, 'price_year')).billingCycle, 'annual');
  assert.equal(await sub.planForPrice(db, 'price_other'), null);
  await assert.rejects(sub.planForPrice(db, 'price_x,stripe_price_id.neq.y'), /Invalid Stripe price id/);
});

// ---------- Finding 9: promo-tier authorisation ----------
const { authorizePromoCaller } = load('supabase/functions/_shared/promo-auth.ts');

test('unauthorised promo calls are rejected before any privileged work', async () => {
  let verifierCalls = 0;
  const notAdmin = async () => { verifierCalls++; return false; };
  assert.deepEqual(await authorizePromoCaller(null, 'service-key', notAdmin), { ok: false, status: 401, error: 'Authentication required' });
  assert.equal((await authorizePromoCaller('Bearer anon-key', 'service-key', notAdmin)).status, 403);
  assert.equal((await authorizePromoCaller('Bearer guard-jwt', 'service-key', notAdmin)).status, 403);
  assert.equal((await authorizePromoCaller('Bearer guard-jwt', 'service-key', async () => { throw new Error('x'); })).status, 403);
  assert.deepEqual(await authorizePromoCaller('Bearer service-key', 'service-key', notAdmin), { ok: true, caller: 'service' });
  assert.deepEqual(await authorizePromoCaller('Bearer admin-jwt', 'service-key', async () => true), { ok: true, caller: 'admin' });
  assert.equal(verifierCalls, 2);
  const fn = fs.readFileSync('supabase/functions/assign-guard-promo-tier/index.ts', 'utf8');
  assert.ok(fn.indexOf('authorizePromoCaller(') < fn.indexOf("rpc('assign_guard_promo_tier'"), 'auth runs before the privileged RPC');
  assert.doesNotMatch(fn, /from\('guards'\)\s*\n?\s*\.update/);
});

// ---------- Finding 10: support routing ----------
test('ordinary, complaint, refund-review and replacement tickets all use the Command Centre bridge', () => {
  for (const f of ['app/client/support/CreateTicketModal.tsx', 'app/client/jobs/[id]/ComplaintModal.tsx', 'app/client/jobs/RefundRequestModal.tsx', 'app/client/jobs/[id]/ReplacementRequestModal.tsx']) {
    assert.match(fs.readFileSync(f, 'utf8'), /routeTicketToCommandCentre\(/, f);
  }
  const bridge = fs.readFileSync('supabase/functions/dfp-support-ticket-bridge/index.ts', 'utf8');
  assert.match(bridge, /'x-idempotency-key': `quickguard-ticket:\$\{ticketId\}`/);
  assert.match(bridge, /retryUnsynced/);
  assert.match(bridge, /alreadySynced: true/);
});
