const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(path, mocks = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(module, module.exports, name => name in mocks ? mocks[name] : require(name), ...Object.values(globals));
  return module.exports;
}
const listing = load('lib/client-job-list.ts', { './client-job-tracker': { TRACKER_FILTER_STATUSES: {} } });
const finance = load('lib/client-finance.ts', { './client-job-list': listing, './financeAmounts': load('lib/financeAmounts.ts') });
const report = load('lib/client-support-report.ts', { './client-job-list': listing, './client-finance': finance });
const schema = { ...require('./fixtures/client-support-report-schema.json'), support_tickets: require('./fixtures/client-safety-ticket-schema.json') };
const ticket = (id, extra = {}) => ({ id, ticket_reference: 'QG-' + id, client_id: 'client', is_deleted: false, priority: 'normal', status: 'open', category: 'technical_issue', subject: 'Synthetic ticket ' + id, description: 'Test description', created_at: '2026-10-05T12:00:00Z', resolved_at: null, ...extra });
function database(rows = {}, failure) {
  const calls = [];
  return { calls, from(table) {
    const call = { table, filters: [], orders: [] }; calls.push(call);
    const q = { select(fields) { call.fields = fields; return q; }, eq(key, value) { call.filters.push([key, value]); return q; }, order(key, options) { call.orders.push([key, options.ascending]); return q; }, range(first, last) { call.range = [first, last]; return q; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        if (failure?.table === table) { if (failure.response instanceof Error) throw failure.response; return failure.response; }
        const fields = call.fields.split(',').map(field => field.trim());
        for (const key of [...fields, ...call.filters.map(f => f[0]), ...call.orders.map(o => o[0])]) if (!schema[table].includes(key)) return { data: null, error: { code: '42703', message: 'Unknown deployed column: ' + key } };
        let data = (rows[table] || []).filter(row => call.filters.every(([key, value]) => row[key] === value));
        data = [...data].sort((a, b) => { for (const [key, asc] of call.orders) { const cmp = String(a[key] || '').localeCompare(String(b[key] || '')); if (cmp) return asc ? cmp : -cmp; } return 0; });
        if (call.range) data = data.slice(call.range[0], call.range[1] + 1);
        return { data: data.map(row => Object.fromEntries(fields.map(key => [key, row[key] ?? null]))), error: null };
      }).then(resolve, reject); } };
    return q;
  } };
}
const liveLike = () => ({ support_tickets: [ticket('one', { related_job_id: 'retained-job', priority: 'high' }), ticket('two', { related_job_id: 'retained-job' }), ticket('three', { status: 'awaiting_client' })] });
const read = rows => report.loadClientSupportReport(database(rows), 'client', 'user');

test('three existing support tickets are reported even when complaints and disputes are empty', async () => {
  const records = await read(liveLike()); const summary = report.supportReportSummary(records);
  assert.equal(summary.total, 3); assert.equal(summary.tickets, 3); assert.equal(summary.open, 2); assert.equal(summary.awaitingClient, 1);
  assert.equal(summary.complaints, 0); assert.equal(summary.disputes, 0); assert.equal(summary.activeDisputes, 0);
  assert.equal(records.filter(row => row.jobId).length, 2);
});

test('deployed column validation catches a legacy ticket job_id query even on empty tables', async () => {
  const failed = await database().from('support_tickets').select('id, job_id'); assert.equal(failed.error.code, '42703');
  assert.deepEqual(await read({}), []);
});

test('all pages are client/user scoped; deleted tickets and foreign records are excluded while retained job history remains', async () => {
  const rows = { support_tickets: Array.from({ length: 205 }, (_, n) => ticket(String(n))), complaints: [{ id: 'shared', complaint_id: 'CMP-1', filed_by_id: 'user', filed_by_type: 'client', severity: 'critical', status: 'under_review', created_at: '2026-10-06' }, { id: 'foreign-c', filed_by_id: 'foreign', filed_by_type: 'client', created_at: '2026-10-06' }, { id: 'guard-c', filed_by_id: 'user', filed_by_type: 'guard', created_at: '2026-10-06' }], disputes: [{ id: 'shared', client_id: 'client', job_id: 'deleted-job', reason: 'Test dispute', details: 'details', status: 'resolved_client_partial', created_at: '2026-10-07', admin_notes: 'PRIVATE' }, { id: 'foreign-d', client_id: 'foreign' }] };
  rows.support_tickets.push(ticket('deleted', { is_deleted: true }), ticket('foreign', { client_id: 'foreign' }));
  const db = database(rows); const records = await report.loadClientSupportReport(db, 'client', 'user');
  assert.equal(records.length, 207); assert.equal(new Set(records.map(r => r.key)).size, 207);
  assert.ok(db.calls.some(c => c.table === 'support_tickets' && c.range[0] === 200));
  assert.equal(records.find(r => r.source === 'dispute').jobId, 'deleted-job');
  assert.equal(records.find(r => r.source === 'dispute').priority, 'not_recorded');
  assert.equal(JSON.stringify(records).includes('PRIVATE'), false);
  for (const call of db.calls) { assert.equal(call.fields.includes('admin_notes'), false); assert.deepEqual(call.orders.map(o => o[0]), ['created_at', 'id']); }
  assert.ok(db.calls.find(c => c.table === 'complaints').filters.some(f => f[0] === 'filed_by_id' && f[1] === 'user'));
  assert.ok(db.calls.find(c => c.table === 'disputes').filters.some(f => f[0] === 'client_id' && f[1] === 'client'));
});

test('source/status/priority/date filters share exact rows and counters, with inclusive UK date boundaries', async () => {
  const rows = await read({ support_tickets: [ticket('before', { created_at: '2026-06-30T22:59:59Z' }), ticket('start', { created_at: '2026-06-30T23:00:00Z', status: 'awaiting_client', priority: 'high' }), ticket('end', { created_at: '2026-07-01T22:59:59Z', status: 'awaiting_client', priority: 'high' }), ticket('after', { created_at: '2026-07-01T23:00:00Z' })] });
  const selected = report.filterSupportReport(rows, { from: '2026-07-01', to: '2026-07-01', source: 'ticket', status: 'awaiting_client', priority: 'high' });
  assert.deepEqual(selected.map(r => r.id), ['end', 'start']); assert.equal(report.supportReportSummary(selected).awaitingClient, 2);
  assert.equal(report.filterSupportReport(rows, { from: '2026-07-02', to: '2026-07-01' }).length, 0);
  assert.equal(report.filterSupportReport(rows, { source: 'complaint' }).length, 0);
  assert.equal(report.filterSupportReport(await read(liveLike()), { from: '2026-10-20', to: '2026-11-19' }).length, 0);
});

test('resolved dispute outcomes stay distinct from open/closed records and urgent means active urgent or critical only', async () => {
  const records = await read({ support_tickets: [ticket('urgent', { priority: 'urgent' }), ticket('closed', { priority: 'urgent', status: 'closed' })], complaints: [{ id: 'c', filed_by_id: 'user', filed_by_type: 'client', severity: 'critical', status: 'under_review', created_at: '2026-10-05' }], disputes: ['resolved_guard', 'resolved_client_refund', 'resolved_client_partial', 'resolved_cancelled'].map((status, n) => ({ id: String(n), client_id: 'client', status, created_at: '2026-10-05' })) });
  const summary = report.supportReportSummary(records);
  assert.equal(summary.urgent, 2); assert.equal(summary.closed, 1); assert.equal(summary.resolved, 4); assert.equal(summary.activeDisputes, 0);
  assert.equal(report.filterSupportReport(records, { status: 'resolved' }).length, 4);
  assert.ok(report.filterSupportReport(records, { status: 'resolved' }).every(r => r.status.startsWith('resolved_')));
});

test('source failures and malformed records reject instead of manufacturing an empty successful report', async () => {
  for (const table of ['support_tickets', 'complaints', 'disputes']) for (const response of [{ data: null, error: { message: 'read failed' } }, { data: null, error: null }, Error('offline')]) await assert.rejects(report.loadClientSupportReport(database({}, { table, response }), 'client', 'user'));
  for (const extra of [{ id: null }, { status: null }, { description: {} }, { created_at: null }, { created_at: 'invalid' }, { resolved_at: 'invalid' }]) await assert.rejects(read({ support_tickets: [ticket('bad', extra)] }));
});

test('the actual report page loads support records, surfaces a source error and recovers on Retry', async () => {
  const source = fs.readFileSync('app/client/reports/page.tsx', 'utf8');
  const start = source.indexOf('  const loadData = useCallback'); const body = source.slice(start, source.indexOf('\n  useEffect(', start));
  const setters = [...new Set([...body.matchAll(/\b(set[A-Z]\w*)\(/g)].map(match => match[1]))];
  const failure = { table: 'complaints', response: { data: null, error: { message: 'unavailable' } } };
  const data = database(liveLike(), failure), writes = [];
  const db = { auth: { getUser: async () => ({ data: { user: { id: 'user' } }, error: null }) }, from(table) {
    if (['support_tickets', 'complaints', 'disputes'].includes(table)) return data.from(table);
    const q = { select: () => q, eq: () => q, in: () => q, order: () => q, maybeSingle: async () => ({ data: { id: 'client', company_name: 'Synthetic' }, error: null }), then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject) }; return q;
  } };
  const env = { useCallback: fn => fn, reportRequest: { current: 0 }, reportMounted: { current: true }, supabase: db,
    loadClientFinanceRecords: async () => ({ transactions: [], subscriptionPayments: [] }), loadClientSupportReport: report.loadClientSupportReport,
    ...Object.fromEntries(setters.map(name => [name, value => writes.push({ name, value })])),
  };
  const code = ts.transpileModule(body + '\nreturn loadData;', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const refresh = new Function(...Object.keys(env), code)(...Object.values(env));
  await refresh(); assert.match(writes.find(w => w.name === 'setLoadError' && w.value)?.value, /could not be loaded/);
  assert.equal(writes.some(w => w.name === 'setReportData'), false);
  failure.table = 'none'; await refresh(); const result = writes.find(w => w.name === 'setReportData').value;
  assert.equal(result.supportRecords.length, 3); assert.equal(writes.filter(w => w.name === 'setLoadError').at(-1).value, null);
});

test('report source errors render Retry without zero support counters or an empty-success report', () => {
  const source = fs.readFileSync('app/client/reports/page.tsx', 'utf8'); let slot = 0;
  const names = [...source.matchAll(/const \[([^\]]*)\] = useState/g)].map(match => match[1].split(',')[0].trim());
  const childMocks = Object.fromEntries([...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]).filter(name => name.startsWith('./') || name.startsWith('../') || name.startsWith('@/components/')).map(name => [name, { __esModule: true, default: () => null }]));
  const Page = load('app/client/reports/page.tsx', { ...childMocks, react: { ...React, useState(initial) { const name = names[slot++]; return [name === 'loadError' ? 'Read failed' : initial, () => {}]; } },
    'next/link': { __esModule: true, default: props => React.createElement('a', props, props.children) }, '@/lib/supabase': { supabase: {} }, '@/hooks/useClientGuard': { useClientGuard: () => ({ loading: false, allowed: true }) }, '@/hooks/useRouteGuard': { useRouteGuard: () => ({ checking: false, blocked: false }) }, '@/lib/client-job-completion': load('lib/client-job-completion.ts'), '@/lib/client-finance': finance, '@/lib/client-support-report': report,
  }).default;
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.match(html, /Failed to load reports/); assert.match(html, /Retry/); assert.doesNotMatch(html, /No support records|Open Support Tickets|0 records/);
});

function component(mocks = {}, globals = {}) {
  return load('app/client/reports/SupportReport.tsx', { '@/lib/client-support-report': report, 'next/link': { __esModule: true, default: props => React.createElement('a', props, props.children) }, ...mocks }, globals).default;
}
test('cards and tables render typed sources, ticket references, recorded priority/status and safe job links', async () => {
  const records = await read(liveLike());
  for (const table of [false, true]) {
    let slot = 0;
    const Component = component({ react: { ...React, useState(initial) { const n = slot++; return [n === 3 && table ? 'table' : initial, () => {}]; } } });
    const html = renderToStaticMarkup(React.createElement(Component, { records, reportRange: { from: '', to: '' }, onToast() {} }));
    for (const expected of ['Support ticket', 'QG-one', 'QG-two', 'QG-three', 'Awaiting client reply', 'high', '/client/jobs/detail?id=retained-job', 'No linked job']) assert.ok(html.includes(expected), expected);
    assert.doesNotMatch(html, /No support records match/);
  }
});

test('actual CSV download contains only the visible filter result, with complete source/reference/job fields and safe quoted text', async () => {
  const records = await read({ support_tickets: [ticket('open'), ticket('awaiting', { status: 'awaiting_client', description: '=SUM(1,2)\n"quoted", text', related_job_id: 'retained-job', resolution_notes: 'line one\nline two' })] });
  let slot = 0, captured, anchor, clicks = 0; const toast = [];
  const Component = component({ react: { ...React, useMemo: fn => fn(), useState(initial) { const n = slot++; return [n === 1 ? 'awaiting_client' : initial, () => {}]; } } }, {
    URL: { createObjectURL(blob) { captured = blob; return 'blob:synthetic'; }, revokeObjectURL(url) { assert.equal(url, 'blob:synthetic'); } },
    document: { createElement(tag) { assert.equal(tag, 'a'); anchor = { click() { clicks++; } }; return anchor; }, body: { appendChild() {}, removeChild() {} } },
  });
  const tree = Component({ records, reportRange: { from: '', to: '' }, onToast: message => toast.push(message) });
  const find = node => { if (!node || typeof node !== 'object') return; if (node.props?.['aria-label'] === 'Export support records CSV') return node; for (const child of [node.props?.children].flat(Infinity)) { const found = find(child); if (found) return found; } };
  find(tree).props.onClick(); const csv = await captured.text();
  assert.equal(clicks, 1); assert.match(anchor.download, /^quickguard-support-/); assert.equal(toast[0], '1 support record exported to CSV');
  assert.ok(csv.includes('"Source","Record ID","Reference","Related Job ID"'));
  assert.ok(csv.includes('"Support ticket","awaiting","QG-awaiting","retained-job"'));
  assert.ok(csv.includes('"\'=SUM(1,2)\n""quoted"", text"')); assert.ok(csv.includes('"line one\nline two"'));
  assert.equal(csv.includes('"QG-open"'), false);
  const parsed = []; let row = [], cell = '', quoted = false;
  const text = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && char === ',') { row.push(cell); cell = ''; }
    else if (!quoted && char === '\n') { row.push(cell); parsed.push(row); row = []; cell = ''; }
    else if (quoted || char !== '\r') cell += char;
  }
  row.push(cell); parsed.push(row);
  assert.equal(quoted, false); assert.equal(parsed.length, 2); assert.ok(parsed.every(r => r.length === 12));
  assert.equal(parsed[1][8], '\'=SUM(1,2)\n"quoted", text'); assert.equal(parsed[1][11], 'line one\nline two');
});
