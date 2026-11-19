const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
function load(path, mocks = {}) {
  const module = { exports: {} };
  new Function('module', 'exports', 'require', compile(fs.readFileSync(path, 'utf8')))(module, module.exports, name => mocks[name] ?? require(name));
  return module.exports;
}
const dates = load('lib/date-only.ts');
const safety = load('lib/client-safety.ts', { './date-only': dates });
const tracker = load('lib/client-job-tracker.ts', { './attendance-display.cjs': require('../lib/attendance-display.cjs') });
const listing = load('lib/client-job-list.ts', { './client-job-tracker': tracker });
const drafts = load('lib/client-wizard-draft.ts');
const safetyData = load('lib/client-safety-data.ts', { './client-job-list': listing, './client-safety': safety });
const now = new Date('2026-11-19T16:00:00Z');
const job = (id, status, extra = {}) => ({ id, status, client_id: 'client', is_deleted: false, job_title: id, start_date: '2026-11-20', start_time: '18:00:00', sia_licence_required: true, required_license_type: 'specific', required_licence_types: ['security_guard'], number_of_guards: 1, ...extra });

function dbFixture(rows, failTable) {
  const calls = [];
  const db = { calls, auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) }, schema(name) { assert.equal(name, 'app'); return db; },
    from(table) {
      const call = { table, filters: [], orders: [] }; calls.push(call);
      const q = {
        select(fields) { call.fields = fields; return q; }, eq(key, value) { call.filters.push(['eq', key, value]); return q; },
        in(key, value) { call.filters.push(['in', key, value]); return q; }, gt(key, value) { call.filters.push(['gt', key, value]); return q; },
        gte() { return q; }, lte() { return q; }, or() { return q; },
        order(key, opts) { call.orders.push([key, opts.ascending]); return q; }, range(first, last) { call.range = [first, last]; return q; },
        maybeSingle() { call.single = true; return q; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            if (table === failTable) return { data: null, error: { message: 'read failed' } };
            let data = (rows[table] || []).filter(row => call.filters.every(([method, key, value]) => method === 'eq' ? row[key] === value : method === 'in' ? value.includes(row[key]) : row[key] > value));
            data = [...data].sort((a, b) => { for (const [key, asc] of call.orders) { const diff = String(a[key] || '').localeCompare(String(b[key] || '')); if (diff) return asc ? diff : -diff; } return 0; });
            const count = data.length;
            if (call.range) data = data.slice(call.range[0], call.range[1] + 1);
            return { data: call.single ? data[0] || null : data, count, error: null };
          }).then(resolve, reject);
        },
      };
      return q;
    },
  };
  return db;
}

test('Draft Jobs and completed-work tabs use the same owned non-deleted scope for initial and subsequent pages', async () => {
  const source = fs.readFileSync('app/client/jobs/page.tsx', 'utf8');
  const body = source.slice(source.indexOf('  const buildJobQuery ='), source.indexOf('  const loadJobs ='));
  const rows = { jobs: [job('draft', 'draft', { is_draft: false }), ...Array.from({ length: 4 }, (_, n) => job('paid' + n, 'paid_out')), job('deleted', 'draft', { is_deleted: true }), job('foreign', 'draft', { client_id: 'foreign' })] };
  for (const [tab, expected] of [['drafts', 1], ['completed', 4], ['all', 5]]) {
    const db = dbFixture(rows);
    const env = { supabase: db, clientId: 'client', activeTab: tab, STATUS_FILTERS: listing.CLIENT_JOB_LIST_STATUSES, statusFilter: 'all', dateFrom: '', dateTo: '', searchQuery: '', sortBy: 'newest', JOBS_PER_PAGE: 2, useCallback: fn => fn };
    const query = new Function(...Object.keys(env), compile(body + '\nreturn buildJobQuery;'))(...Object.values(env));
    const first = await query(), second = await query(2);
    assert.equal(first.count, expected); assert.equal(second.count, expected);
    assert.equal(first.data.length, Math.min(expected, 2)); assert.equal(second.data.length, Math.max(0, Math.min(expected - 2, 2)));
    for (const call of db.calls) { assert.ok(call.filters.some(f => f[1] === 'client_id' && f[2] === 'client')); assert.ok(call.filters.some(f => f[1] === 'is_deleted' && f[2] === false)); assert.deepEqual(call.orders.map(x => x[0]), ['created_at', 'id']); }
  }
});

test('job summaries and saved wizard drafts are independently paginated, owned and failure-aware', async () => {
  const rows = { jobs: Array.from({ length: 205 }, (_, n) => job('j' + n, n % 2 ? 'draft' : 'paid_out')), job_drafts: [{ id: 'saved', client_id: 'client' }, { id: 'foreign', client_id: 'foreign' }] };
  const db = dbFixture(rows);
  assert.equal((await listing.loadClientJobSummary(db, 'client')).length, 205);
  assert.deepEqual((await listing.loadClientWizardDrafts(db, 'client')).map(row => row.id), ['saved']);
  assert.ok(db.calls.some(call => call.table === 'jobs' && call.range[0] === 200));
  for (const table of ['jobs', 'job_drafts']) await assert.rejects((table === 'jobs' ? listing.loadClientJobSummary : listing.loadClientWizardDrafts)(dbFixture(rows, table), 'client'), /could not be loaded/);
  assert.equal(listing.isScheduledDraftJob(job('x', 'cancelled', { is_draft: true, publish_at: '2027-01-01' }), now), false);
  assert.equal(listing.isScheduledDraftJob(job('x', 'draft', { is_draft: true, publish_at: '2027-01-01' }), now), true);
});

test('saved wizard draft restore checks ownership and preserves only recognised field types', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const db = dbFixture({ job_drafts: [{ id, client_id: 'client', form_data: { jobTitle: 'Synthetic', specificLicences: ['Security Guard'] } }] });
  const saved = await drafts.loadOwnedWizardDraft(db, 'client', id);
  const defaults = { jobTitle: '', startTime: '', specificLicences: [], enabled: false };
  assert.deepEqual(drafts.restoreWizardDraft(defaults, { ...saved.form_data, client_id: 'foreign', enabled: 'yes', startTime: 9 }), { ...defaults, jobTitle: 'Synthetic', specificLicences: ['Security Guard'] });
  assert.equal(defaults.jobTitle, '');
  for (const raw of [null, 'invalid', []]) assert.throws(() => drafts.restoreWizardDraft(defaults, raw), /invalid/);
  await assert.rejects(drafts.loadOwnedWizardDraft(db, 'foreign', id), /could not be loaded/);
  await assert.rejects(drafts.loadOwnedWizardDraft(db, 'client', 'invalid'), /Invalid/);
  await assert.rejects(drafts.loadOwnedWizardDraft(dbFixture({}, 'job_drafts'), 'client', id), /could not be loaded/);
});

test('finished, deleted, draft and unsupported jobs generate neither current warnings nor safety counts', () => {
  const terminal = ['cancelled', 'completed', 'payout_approved', 'paid_out', 'review_pending', 'closed', 'draft', 'unknown'].map(status => job(status, status, { risk_level: 'high', lone_worker_flag: true }));
  terminal.push(job('deleted', 'confirmed', { is_deleted: true }));
  const warnings = safety.buildSafetyWarnings(terminal, {}, now);
  assert.equal(warnings.length, 0);
  const counts = safety.safetyCounts(terminal, [{ id: 'ticket', job_id: 'cancelled', status: 'open', priority: 'urgent' }], warnings);
  for (const key of ['totalJobs', 'missingSafetyInfo', 'highRiskJobs', 'complianceWarnings', 'missingEmergencyContacts', 'jobsWithSIARequired']) assert.equal(counts[key], 0, key);
  assert.equal(counts.openTickets, 1); assert.equal(counts.urgentTickets, 1);
});

test('starting-soon uses the recorded UK time, including same-day shifts and daylight-saving boundaries', () => {
  assert.equal(safety.isSafetyStartingSoon(job('same-day', 'confirmed', { start_date: '2026-11-19', start_time: '18:00' }), now), true);
  assert.equal(safety.isSafetyStartingSoon(job('past', 'confirmed', { start_date: '2026-11-19', start_time: '09:00' }), now), false);
  assert.equal(safety.safetyShiftStart({ start_date: '2026-07-01', start_time: '18:00' }), Date.parse('2026-07-01T17:00:00Z'));
  assert.equal(safety.safetyShiftStart({ start_date: '2026-11-19', start_time: '18:00' }), Date.parse('2026-11-19T18:00:00Z'));
  assert.equal(safety.safetyShiftStart({ start_date: '2026-03-29', start_time: '01:30' }), null);
  for (const value of [{ start_date: '2026-02-30', start_time: '18:00' }, { start_date: '2026-11-20' }, { start_date: '2026-11-20', start_time: '25:00' }]) assert.equal(safety.safetyShiftStart(value), null);
});

test('licence arrays replace generic specific labels and all guard licence types are checked', () => {
  const current = job('j', 'confirmed');
  const assignments = { j: [{ id: 'a', guard_id: 'g', status: 'confirmed', guards: { id: 'g', full_name: 'Synthetic', sia_verified: true, licence_types: ['Door Supervisor', 'Security Guard'], sia_expiry_date: '2027-12-01' } }] };
  const warnings = safety.buildSafetyWarnings([current], assignments, now);
  assert.ok(warnings.some(w => w.id === 'j-sia' && w.message.includes('Security Guard')));
  assert.ok(warnings.every(w => !w.message.includes('"specific"')));
  assert.equal(warnings.some(w => w.id.includes('licence-mismatch')), false);
  current.required_licence_types = ['CCTV Operator'];
  assert.ok(safety.buildSafetyWarnings([current], assignments, now).some(w => w.id.includes('licence-mismatch')));
  const missing = safety.buildSafetyWarnings([job('missing', 'confirmed', { required_licence_types: [], safety_check: { required_sia_selected: true } })], {}, now);
  assert.ok(missing.some(w => w.id === 'missing-sia' && /Select the required/.test(w.message)));
  assignments.j[0].status = 'cancelled';
  assert.equal(safety.buildSafetyWarnings([current], assignments, now).some(w => w.id.includes('guard-g')), false);
});

test('checklist completeness counts eight booleans, and summary warning count matches the displayed list', () => {
  const checklist = Object.fromEntries(safety.SAFETY_CHECK_FIELDS.map(key => [key, true]));
  const current = job('j', 'confirmed', { safety_check: { ...checklist, id: 'id', created_at: 'metadata', client_id: 'client' }, emergency_contact_name: 'Test', site_access_instructions: 'Gate A' });
  let warnings = safety.buildSafetyWarnings([current], {}, now);
  assert.equal(safety.safetyCounts([current], [], warnings).missingSafetyInfo, 0);
  current.safety_check.risk_notes_added = false;
  warnings = safety.buildSafetyWarnings([current], {}, now);
  const counts = safety.safetyCounts([current], [], warnings);
  assert.equal(counts.missingSafetyInfo, 1); assert.equal(counts.complianceWarnings, warnings.length);
});

test('safety data errors are not empty successes; retained incidents and active assigned profiles stay scoped', async () => {
  const rows = { clients: [{ id: 'client', user_id: 'user' }], jobs: [job('active', 'confirmed'), job('cancelled', 'cancelled')], job_safety_checks: [], support_tickets: [{ id: 'incident', client_id: 'client', is_deleted: false, job_id: 'cancelled' }], job_assignments: [{ id: 'a', job_id: 'active', guard_id: 'g', status: 'confirmed' }, { id: 'old', job_id: 'cancelled', guard_id: 'g', status: 'confirmed' }] };
  const db = dbFixture(rows); const profileCalls = [];
  db.functions = { invoke: async (name, args) => { profileCalls.push([name, args]); return { data: { profiles: [{ id: 'g', full_name: 'Synthetic', sia_verified: true, licence_types: ['Security Guard'], phone: 'private', sia_licence_number: 'private' }] } }; } };
  const data = await safetyData.loadClientSafetyData(db);
  assert.equal(data.jobs.length, 2); assert.equal(data.incidents.length, 1);
  const assignments = await safetyData.loadSafetyAssignments(db, data.jobs);
  assert.deepEqual(Object.keys(assignments), ['active']); assert.equal(profileCalls.length, 1);
  assert.equal(assignments.active[0].guards.phone, undefined); assert.equal(assignments.active[0].guards.sia_licence_number, null);
  for (const table of ['clients', 'jobs', 'job_safety_checks', 'support_tickets']) await assert.rejects(safetyData.loadClientSafetyData(dbFixture(rows, table)), /could not be loaded/);
  db.functions.invoke = async () => ({ data: null, error: { message: 'offline' } });
  await assert.rejects(safetyData.loadSafetyAssignments(db, data.jobs), /could not be loaded/);
});

test('safety errors render Retry without reassuring zero counters or an all-clear message', () => {
  const Page = load('app/client/trust-safety/TrustSafetyClient.tsx', {
    '@/hooks/useRouteGuard': { useRouteGuard: () => ({ checking: false, blocked: false }) },
    '@/lib/supabase': { supabase: {} }, '@/lib/client-safety': safety, '@/lib/client-safety-data': safetyData,
    './useSafetyData': { useSafetyData: () => ({ client: null, jobs: [], incidents: [], loading: false, error: 'Safety records could not be loaded.', retry() {} }), useUpdateSafetyCheck: () => () => {}, useUpdateJobSafety: () => () => {} },
    'next/link': { __esModule: true, default: props => React.createElement('a', props, props.children) },
    '@/components/PortalSidebar': { __esModule: true, default: () => null },
    ...Object.fromEntries(['SafetyStatsBar', 'JobSafetyChecklist', 'SiteInstructionsPanel', 'EmergencyContactsPanel', 'IncidentHistory', 'ComplianceWarnings'].map(name => ['./' + name, { __esModule: true, default: () => null }])),
  }).default;
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.match(html, /role="alert"/); assert.match(html, /Retry safety records/); assert.doesNotMatch(html, /All Clear|No current warnings|Compliance Warnings/);
});

const flush = async () => { for (let n = 0; n < 25; n++) await Promise.resolve(); };
test('retired saved-draft loads cannot replace a newer form or clear its loading state', async () => {
  const source = fs.readFileSync('app/client/post-job/page.tsx', 'utf8');
  const start = source.indexOf('  useEffect(() => {\n    let retired = false;\n    if (!requestedDraftId)');
  const end = source.indexOf('\n  const deleteDraft', start);
  const updates = [], loaded = []; let effect, resolve;
  const env = { useEffect: fn => { effect = fn; }, requestedDraftId: 'draft', allowed: true, authLoading: false, checking: false, blocked: false, clientId: 'client',
    appliedWizardDraftRef: { current: null }, draftRetry: 0, supabase: {},
    setDraftRestoreError: value => updates.push(['error', value]), setDraftRestoreLoading: value => updates.push(['loading', value]),
    loadOwnedWizardDraft: () => new Promise(r => { resolve = r; }), loadDraft: value => { loaded.push(value); return true; } };
  new Function(...Object.keys(env), compile(source.slice(start, end)))(...Object.values(env));
  const cleanup = effect(); const count = updates.length; cleanup(); resolve({ id: 'retired' }); await flush();
  assert.equal(loaded.length, 0); assert.equal(updates.length, count); assert.equal(env.appliedWizardDraftRef.current, null);
});

test('safety hook retires closed-screen results and disabled routes perform no reads', async () => {
  let effect, resolve, reads = 0; const writes = [];
  const Hook = load('app/client/trust-safety/useSafetyData.ts', {
    react: { useState: value => [value, next => writes.push(next)], useRef: current => ({ current }), useCallback: fn => fn, useEffect: fn => { effect = fn; } },
    '@/lib/supabase': { supabase: {} }, '@/lib/client-safety-data': { loadClientSafetyData: () => { reads++; return new Promise(r => { resolve = r; }); } },
  }).useSafetyData;
  Hook(true); const cleanup = effect(); const count = writes.length; cleanup(); resolve({ client: { id: 'old' }, jobs: [{ id: 'stale' }], incidents: [] }); await flush();
  assert.equal(writes.length, count); assert.equal(reads, 1);
  Hook(false); effect(); await flush(); assert.equal(reads, 1);
});
