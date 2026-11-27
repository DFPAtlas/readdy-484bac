const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./helpers/enterprise-module.cjs');
const { hooksHarness, nodes, content } = require('./helpers/guard-ui-fixture.cjs');
const { loadClientReportJobs } = load('lib/client-report-jobs.ts');
const fs = require('node:fs');
const ts = require('typescript');

const job = (id = 'j1', extra = {}) => ({ id, client_id: 'client', is_deleted: false, job_title: 'Synthetic shift', start_date: '2026-11-05', created_at: '2026-11-01', ...extra });
const assignment = (id, extra = {}) => ({ id, job_id: 'j1', guard_id: 'g1', status: 'completed', assigned_at: '2026-11-01T12:00:00Z', completed_at: '2026-11-06T12:00:00Z', ...extra });
function fixture({ jobs = [job()], assignments = Array.from({ length: 8 }, (_, i) => assignment('a' + i)), profiles = [{ id: 'g1', full_name: 'Synthetic Daniel', is_active: false, sia_verified: false, bank_account: 'PRIVATE', email: 'PRIVATE' }] } = {}) {
  const rows = { jobs, job_assignments: assignments }, calls = [];
  const f = { rows, calls, profiles, fail: null, profileResponse: null, from(table) {
    assert.notEqual(table, 'guards', 'Reports must use owner-checked profile reads');
    const call = { table, filters: [], orders: [] }; calls.push(call);
    const q = {
      select(fields) { call.fields = fields; return q; },
      eq(key, value) { call.filters.push([key, value]); return q; },
      in(key, values) { call.filters.push([key, { values }]); return q; },
      order(key) { call.orders.push(key); return q; }, range(first, last) { call.range = [first, last]; return q; },
      then(resolve, reject) {
        if (f.fail === table) return Promise.resolve({ data: null, error: { message: 'unavailable' } }).then(resolve, reject);
        let selected = (rows[table] || []).filter(row => call.filters.every(([key, value]) =>
          value && typeof value === 'object' ? value.values.includes(row[key]) : row[key] === value));
        selected = [...selected].sort((a, b) => a.id.localeCompare(b.id));
        if (call.range) selected = selected.slice(call.range[0], call.range[1] + 1);
        return Promise.resolve({ data: selected, error: null }).then(resolve, reject);
      },
    }; return q;
  }, functions: { async invoke(name, options) {
    assert.equal(name, 'get-client-assigned-guards'); assert.deepEqual(Object.keys(options.body), ['job_id']);
    calls.push({ name, body: options.body });
    if (f.fail === 'profiles') return { data: null, error: { message: 'endpoint failed' } };
    if (f.profileResponse) return f.profileResponse;
    const ids = new Set(assignments.filter(row => row.job_id === options.body.job_id).map(row => row.guard_id));
    return { data: { profiles: f.profiles.filter(p => ids.has(p.id)) }, error: null };
  } } };
  return f;
}

test('eight shifts resolve their historical guard through the protected path without private fields', async () => {
  const db = fixture(); const result = await loadClientReportJobs(db, 'client');
  assert.equal(result.assignments.length, 8); assert.equal(result.guards.length, 1);
  assert.ok(result.assignments.every(a => a.guards.full_name === 'Synthetic Daniel'));
  assert.equal(result.guards[0].is_active, false); assert.equal(result.guards[0].sia_verified, false);
  assert.equal(result.jobs[0].job_assignments.length, 8);
  assert.equal(db.calls.filter(c => c.name).length, 1);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.ok(db.calls.every(c => !c.fields?.includes('guards(')));
  const f = ui(result.assignments);
  assert.match(content(f.render()), /8 shifts.*1 unique guards/);
  f.h.unmount();
});

test('jobs and assignments paginate and foreign/deleted jobs are excluded from profile reads', async () => {
  const jobs = Array.from({ length: 205 }, (_, i) => job('j' + String(i).padStart(3, '0')));
  jobs.push(job('foreign', { client_id: 'other' }), job('deleted', { is_deleted: true }));
  const assignments = Array.from({ length: 405 }, (_, i) => assignment('a' + String(i).padStart(3, '0'), { job_id: 'j000' }));
  assignments.push(assignment('a-end', { job_id: 'j204' }), assignment('a-foreign', { job_id: 'foreign' }));
  const db = fixture({ jobs, assignments }); const result = await loadClientReportJobs(db, 'client');
  assert.equal(result.jobs.length, 205); assert.equal(result.assignments.length, 406);
  assert.ok(db.calls.some(c => c.table === 'jobs' && c.range[0] === 200));
  assert.ok(db.calls.some(c => c.table === 'job_assignments' && c.range[0] === 400));
  assert.deepEqual(db.calls.filter(c => c.name).map(c => c.body.job_id).sort(), ['j000', 'j204']);
});

test('missing historical profiles remain identifiable and never become compliant or erase shifts', async () => {
  const result = await loadClientReportJobs(fixture({ profiles: [] }), 'client');
  assert.equal(result.assignments.length, 8); assert.equal(result.guards.length, 1);
  assert.equal(result.guards[0].id, 'g1'); assert.equal(result.guards[0].full_name, 'Guard name unavailable');
  assert.equal(result.guards[0].profile_available, false); assert.equal(result.guards[0].sia_verified, null);
});

test('read failures and malformed or unassigned profiles fail instead of fabricating an empty report', async () => {
  for (const fail of ['jobs', 'job_assignments', 'profiles']) {
    const db = fixture(); db.fail = fail; await assert.rejects(loadClientReportJobs(db, 'client'));
  }
  for (const profiles of [null, [{ id: 'unassigned', full_name: 'Other Guard' }], [{ id: 'g1', full_name: {} }], [{ id: 'g1' }, { id: 'g1' }]]) {
    const db = fixture(); db.profileResponse = { data: { profiles } }; await assert.rejects(loadClientReportJobs(db, 'client'));
  }
  const empty = fixture({ jobs: [], assignments: [] });
  assert.deepEqual(await loadClientReportJobs(empty, 'client'), { jobs: [], assignments: [], guards: [] });
  assert.equal(empty.calls.length, 1);
});

const Link = { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
function ui(assignments, globals = {}) {
  const h = hooksHarness('app/client/reports/AttendanceReport.tsx', {
    'next/link': Link, './ReportPdfButton': { __esModule: true, default: () => null },
  }, globals);
  const props = { assignments, jobs: [job(), job('j2', { start_date: '2026-11-06' })], reportRange: { from: '', to: '' }, onToast() {} };
  return { h, props, render: () => h.render(props) };
}

test('identity-based filters and visible counts distinguish guards sharing a name and follow date/status filters', () => {
  const rows = [assignment('a1', { guards: { id: 'g1', full_name: 'Same Name' } }), assignment('a2', { job_id: 'j2', guard_id: 'g2', status: 'confirmed', guards: { id: 'g2', full_name: 'Same Name' } })];
  const f = ui(rows); let tree = f.render();
  assert.match(content(tree), /2 shifts.*2 unique guards/);
  nodes(tree).find(n => n.props?.['aria-label'] === 'Filter attendance by guard').props.onChange({ target: { value: 'g2' } });
  tree = f.render(); assert.match(content(tree), /1 shifts.*1 unique guards/);
  nodes(tree).find(n => n.props?.['aria-label'] === 'Filter attendance by guard').props.onChange({ target: { value: '' } });
  f.props.reportRange = { from: '2026-11-05', to: '2026-11-05' }; tree = f.render();
  assert.match(content(tree), /1 shifts.*1 unique guards/);
  nodes(tree).find(n => n.props?.['aria-label'] === 'Filter attendance by status').props.onChange({ target: { value: 'confirmed' } });
  assert.match(content(f.render()), /0 shifts.*0 unique guards/); f.h.unmount();
});

test('cards, tables and PDF use recorded check-in/out instead of assignment/completion timestamps', () => {
  const rows = [assignment('a1', { guards: { id: 'g1', full_name: 'Synthetic Daniel' }, check_in_time: '2026-11-05T18:00:00Z', check_out_time: '2026-11-05T22:00:00Z', payment_amount: 0 })];
  const f = ui(rows); let tree = f.render();
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Synthetic Daniel/); assert.match(html, /05\/11\/2026, 18:00:00/); assert.match(html, /05\/11\/2026, 22:00:00/);
  assert.doesNotMatch(html, /01\/11\/2026|06\/11\/2026/);
  nodes(tree).find(n => n.props?.['aria-label'] === 'Show attendance table').props.onClick();
  tree = f.render();
  const table = renderToStaticMarkup(tree);
  assert.match(table, /<table/); assert.match(table, /Synthetic Daniel/);
  assert.match(table, /05\/11\/2026, 18:00:00/); assert.match(table, /05\/11\/2026, 22:00:00/);
  const pdf = nodes(tree).find(n => typeof n.props?.report === 'function').props.report();
  assert.equal(pdf.rows[0][0], 'Synthetic Daniel'); assert.equal(pdf.rows[0][5], '05/11/2026, 18:00:00');
  assert.equal(pdf.rows[0][9], 0);
  const missing = ui([assignment('missing', { guards: { id: 'g1', full_name: 'Guard name unavailable' } })]);
  const missingTree = missing.render(); assert.match(content(missingTree), /No check-in recorded/);
  assert.match(content(missingTree), /No check-out recorded/);
  assert.equal(nodes(missingTree).find(n => typeof n.props?.report === 'function').props.report().rows[0][5], 'N/A');
  f.h.unmount(); missing.h.unmount();
});

test('actual CSV export follows the guard filter, recorded attendance and safe escaping', async () => {
  let blob, clicked = 0;
  const f = ui([assignment('a1', { guards: { id: 'g1', full_name: '=Synthetic Guard' }, check_in_time: '2026-11-05T18:00:00Z' }), assignment('a2', { guard_id: 'g2', guards: { id: 'g2', full_name: 'Other Guard' } })], {
    URL: { createObjectURL(value) { blob = value; return 'blob:synthetic'; }, revokeObjectURL() {} },
    document: { createElement: () => ({ click() { clicked++; } }), body: { appendChild() {}, removeChild() {} } },
  });
  let tree = f.render(); nodes(tree).find(n => n.props?.['aria-label'] === 'Filter attendance by guard').props.onChange({ target: { value: 'g1' } });
  tree = f.render(); nodes(tree).find(n => n.type === 'button' && content(n).trim() === 'CSV').props.onClick();
  const csv = await blob.text(); assert.equal(clicked, 1); assert.match(csv, /'=Synthetic Guard/);
  assert.match(csv, /05\/11\/2026, 18:00:00/); assert.doesNotMatch(csv, /Other Guard|01\/11\/2026|06\/11\/2026/); f.h.unmount();
});

test('the report page rejects an account switch before publishing loaded report data', async () => {
  const source = fs.readFileSync('app/client/reports/page.tsx', 'utf8');
  const start = source.indexOf('  const loadData = useCallback');
  const body = source.slice(start, source.indexOf('\n  useEffect(', start));
  const setters = [...new Set([...body.matchAll(/\b(set[A-Z]\w*)\(/g)].map(match => match[1]))];
  let authReads = 0; const writes = [];
  const env = {
    useCallback: fn => fn, reportRequest: { current: 0 }, reportMounted: { current: true },
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: ++authReads === 1 ? 'first-owner' : 'other-owner' } }, error: null }) },
      from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: 'client', company_name: 'Synthetic Client' }, error: null }) }; return q; },
    },
    loadClientReportJobs: async () => ({ jobs: [job()], assignments: [assignment('a')], guards: [] }),
    loadClientFinanceRecords: async () => ({ transactions: [], subscriptionPayments: [] }),
    loadClientSupportReport: async () => [],
    ...Object.fromEntries(setters.map(name => [name, value => writes.push({ name, value })])),
  };
  const code = ts.transpileModule(body + '\nreturn loadData;', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  await new Function(...Object.keys(env), code)(...Object.values(env))();
  assert.ok(writes.some(w => w.name === 'setLoadError' && /account changed/.test(w.value)));
  assert.equal(writes.some(w => w.name === 'setReportData'), false);
});
