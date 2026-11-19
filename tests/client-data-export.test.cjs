const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const schema = require('./fixtures/client-data-export-schema.json');
const C = '00000000-0000-4000-8000-000000000001', U = '00000000-0000-4000-8000-000000000002';
function load(path, mocks = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(module, module.exports, name => name in mocks ? mocks[name] : require(name), ...Object.values(globals));
  return module.exports;
}
const listing = load('lib/client-job-list.ts', { './client-job-tracker': { TRACKER_FILTER_STATUSES: { completed: ['completed', 'paid_out'] } } });
const exp = load('lib/client-data-export.ts', { './client-job-list': listing });
const all = exp.CLIENT_EXPORT_CATEGORIES.map(c => c.key);
function fixtures() {
  const jobs = Array.from({ length: 9 }, (_, i) => ({ id: 'job-' + i, client_id: C, job_title: 'Job ' + i, status: i < 4 ? 'paid_out' : 'cancelled', is_deleted: i === 8 ? null : false, assigned_count: 0, created_at: '2026-10-05T12:00:00Z' }));
  return { clients: [{ id: C, user_id: U, company_name: 'Synthetic, "Export" Ltd', address_line2: 'Suite 1', billing_address_line1: 'Billing address', notes: 'PRIVATE_INTERNAL', stripe_customer_id: 'PRIVATE_PROVIDER' }], client_contacts: [], jobs,
    job_assignments: jobs.slice(0, 8).map((job, i) => ({ id: 'assignment-' + i, job_id: job.id, guard_id: 'guard', status: i < 4 ? 'completed' : 'cancelled', payment_amount: 80 })),
    transactions: jobs.map((j, i) => ({ id: 'tx-' + i, client_id: C, job_id: j.id, status: i === 0 ? 'partially_refunded' : 'completed', amount: 80, refund_amount: i === 0 ? 20 : null, created_at: '2026-10-03T12:00:00Z', receipt_url: 'PRIVATE_LINK' })),
    subscription_payments: [0, 1].map(i => ({ id: 'subscription-payment-' + i, subscription_id: 'recorded-subscription', user_id: U, amount: 49, status: 'paid', period_start: '2026-10-01', billing_reason: 'subscription_cycle', created_at: '2026-10-04T12:00:00Z', stripe_invoice_id: 'PRIVATE_PROVIDER' })),
    support_tickets: [0, 1, 2].map(i => ({ id: 'ticket-' + i, client_id: C, ticket_reference: 'QG-' + i, status: i === 2 ? 'awaiting_client' : 'open', category: 'technical_issue', description: 'Line 1\r\nLine 2, "quoted"', is_deleted: false, admin_notes: 'PRIVATE_INTERNAL', created_at: '2026-10-05T12:00:00Z' })),
    messages: [], saved_sites: [{ id: 'site', client_id: C, site_name: 'Archived site', archived: true, deleted_at: null, created_at: '2026-10-01T00:00:00Z' }], client_documents: [],
  };
}
function database(rows = fixtures(), options = {}) {
  const calls = [], functions = [];
  const db = { calls, functions, options, rows,
    auth: { getUser: async () => ({ data: { user: { id: options.authId || U } }, error: options.authError }) },
    from(table) {
      const call = { table, filters: [], orders: [] }; calls.push(call);
      const q = { select(value) { call.fields = value; return q; }, eq(key, value) { call.filters.push([key, value]); return q; }, is(key, value) { call.filters.push([key, value]); return q; }, in(key, value) { call.filters.push([key, value]); return q; }, or(value) { call.or = value; return q; }, order(key, value) { call.orders.push([key, value.ascending]); return q; }, range(start, end) { call.range = [start, end]; return q; }, maybeSingle() { call.single = true; return q; },
        then(resolve, reject) { return Promise.resolve().then(() => {
          if (options.failure === table) throw Error('PRIVATE_READ_FAILURE');
          const columns = call.fields.split(',').map(c => c.trim());
          for (const c of [...columns, ...call.filters.map(f => f[0]), ...call.orders.map(o => o[0])]) if (!schema[table]?.includes(c)) return { data: null, error: { code: '42703', message: 'Unknown deployed column ' + c } };
          let data = (rows[table] || []).filter(row => call.filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : value === null ? row[key] == null : row[key] === value));
          if (call.or?.startsWith('is_deleted')) data = data.filter(row => row.is_deleted !== true);
          else if (call.or) data = data.filter(row => row.sender_id === U || row.receiver_id === U);
          data = [...data].sort((a, b) => { for (const [key, asc] of call.orders) { const cmp = String(a[key] || '').localeCompare(String(b[key] || '')); if (cmp) return asc ? cmp : -cmp; } return 0; });
          if (call.range) data = data.slice(call.range[0], call.range[1] + 1);
          // Extra data deliberately tests final client projections too.
          data = data.map(row => ({ ...row, ...Object.fromEntries(columns.map(c => [c, row[c] ?? null])) }));
          return { data: call.single ? data[0] || null : data, error: null };
        }).then(resolve, reject); },
      }; return q;
    }, functions: { invoke: async (name, { body }) => {
      functions.push({ name, body }); if (options.guardFailure) return { error: Error('PRIVATE_GUARD_FAILURE') };
      const ids = [...new Set((rows.job_assignments || []).filter(a => a.job_id === body.job_id).map(a => a.guard_id))];
      return { data: { profiles: options.missingProfiles ? [] : options.foreignProfile ? [{ id: 'foreign' }] : ids.map(id => ({ id, full_name: 'Inactive assigned guard', is_active: false, sia_verified: options.siaUnknown ? null : true, sia_licence_number: 'TEST-LICENCE', licence_types: ['security_guard'], rating: 0, phone: 'PRIVATE_GUARD_CONTACT', email: 'PRIVATE_GUARD_CONTACT', sia_licence_front_url: 'PRIVATE_LINK' })) }, error: null };
    } },
  };
  db.functionCalls = functions; return db;
}
const read = (db, keys = all) => exp.loadClientDataExport(db, C, U, keys);

test('all eight deployed-schema categories load and preserve the existing account counts and verified inactive guard', async () => {
  const db = database(); const data = await read(db);
  assert.deepEqual(Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length])), { profile: 1, jobs: 9, guards: 8, payments: 11, tickets: 3, messages: 0, sites: 1, documents: 0 });
  assert.equal(data.guards[0].guard_name, 'Inactive assigned guard'); assert.equal(data.guards[0].sia_verified, true); assert.equal(data.guards[0].guard_account_active, false); assert.equal(data.guards[0].rating, 0);
  assert.equal(data.jobs.find(j => j.id === 'job-0').assigned_count, 1); assert.equal(data.jobs.find(j => j.id === 'job-0').recorded_assigned_count, 0);
  assert.equal(data.profile[0].billing_address_line1, 'Billing address'); assert.deepEqual(data.profile[0].site_contacts, []);
  assert.equal(data.payments.filter(p => p.type === 'subscription').length, 2); assert.equal(data.payments.find(p => p.type === 'subscription').period_start, '2026-10-01');
  assert.doesNotMatch(JSON.stringify(data), /PRIVATE_|stripe_customer_id|admin_notes|file_url|receipt_url|sia_licence_front_url/);
  assert.equal(db.calls.some(c => c.table === 'guards'), false);
});

test('legacy nonexistent columns fail schema validation even on empty tables, while repaired queries succeed', async () => {
  const db = database(); assert.equal((await db.from('saved_sites').select('id, site_type')).error.code, '42703');
  assert.equal((await db.from('subscription_payments').select('id, stripe_subscription_id')).error.code, '42703');
  assert.equal((await read(database(), ['payments'])).payments.length, 11);
});

test('category preview scope is independent of selection and unrelated failures', async () => {
  const db = database(fixtures(), { failure: 'subscription_payments' }); const data = await read(db, ['jobs']);
  assert.deepEqual(Object.keys(data), ['jobs']); assert.equal(data.jobs.length, 9); assert.equal(db.calls.some(c => c.table === 'subscription_payments'), false); assert.equal(db.functionCalls.length, 0);
  const preview = JSON.parse(exp.clientExportPreview('jobs', data.jobs)); assert.equal(preview.record_count, 9); assert.equal(preview.sample.length, 5); assert.equal(preview.more_records, 4);
});

test('owner checks reject foreign/session-changed requests before exporting anything', async () => {
  await assert.rejects(read(database(fixtures(), { authId: 'other-user' })), /session changed/);
  const rows = fixtures(); rows.clients[0].user_id = 'other-user'; const db = database(rows); await assert.rejects(read(db), /company records/); assert.deepEqual(db.calls.map(c => c.table), ['clients']);
  await assert.rejects(exp.loadClientDataExport(database(), 'foreign-client', U, ['jobs']), /company records/);
});

test('deleted and foreign jobs/assignments/tickets/sites are excluded; retained payments, archived sites and participant messages remain', async () => {
  const rows = fixtures(); rows.jobs.push({ ...rows.jobs[0], id: 'deleted', is_deleted: true }, { ...rows.jobs[0], id: 'foreign', client_id: 'other' });
  rows.job_assignments.push({ id: 'private-assignment', job_id: 'foreign', guard_id: 'private-guard' }, { id: 'deleted-assignment', job_id: 'deleted', guard_id: 'private-guard' });
  rows.transactions.push({ id: 'retained-payment', client_id: C, job_id: 'deleted' }, { id: 'foreign-payment', client_id: 'other' });
  rows.support_tickets.push({ id: 'deleted-ticket', client_id: C, is_deleted: true }, { id: 'foreign-ticket', client_id: 'other' });
  rows.saved_sites.push({ id: 'deleted-site', client_id: C, deleted_at: '2026-11-01' }, { id: 'foreign-site', client_id: 'other' });
  rows.messages = [{ id: 'incoming', sender_id: 'guard-user', receiver_id: U, message_text: 'Received' }, { id: 'outgoing', sender_id: U, receiver_id: 'guard-user', message_text: 'Sent' }, { id: 'private-message', sender_id: 'someone', receiver_id: 'else' }];
  const data = await read(database(rows)); assert.equal(data.jobs.length, 9); assert.equal(data.guards.length, 8); assert.equal(data.tickets.length, 3); assert.equal(data.sites.length, 1);
  assert.equal(data.payments.some(p => p.id === 'retained-payment'), true); assert.equal(data.messages.length, 2); assert.equal(data.messages[0].sender_id !== undefined, true); assert.doesNotMatch(JSON.stringify(data), /foreign-|private-assignment|deleted-assignment|private-message/);
});

test('all paginated sources and assignment ID batches are read completely with stable ordering', async () => {
  const rows = fixtures(); rows.jobs = Array.from({ length: 205 }, (_, i) => ({ ...rows.jobs[0], id: 'job-' + String(i).padStart(4, '0') }));
  rows.job_assignments = rows.jobs.map((job, i) => ({ id: 'a-' + i, job_id: job.id, guard_id: 'guard', status: 'completed' }));
  rows.client_documents = Array.from({ length: 405 }, (_, i) => ({ id: 'document-' + String(i).padStart(4, '0'), client_id: C, file_name: 'Metadata only' }));
  const db = database(rows); const data = await read(db, ['jobs', 'guards', 'documents']); assert.equal(data.jobs.length, 205); assert.equal(data.guards.length, 205); assert.equal(data.documents.length, 405);
  assert.equal(db.calls.filter(c => c.table === 'jobs').length, 2); assert.equal(db.calls.filter(c => c.table === 'client_documents').length, 3);
  assert.ok(db.calls.filter(c => c.table === 'job_assignments').every(c => c.filters.find(f => f[0] === 'job_id')[1].length <= 100));
});

test('unavailable profile or verification is null with an explicit availability, never fabricated false or zero', async () => {
  const data = await read(database(fixtures(), { missingProfiles: true }), ['guards']); assert.equal(data.guards[0].profile_availability, 'unavailable'); assert.equal(data.guards[0].sia_verified, null); assert.equal(data.guards[0].rating, null); assert.equal(data.guards[0].guard_name, null);
  const unknown = await read(database(fixtures(), { siaUnknown: true }), ['guards']); assert.equal(unknown.guards[0].profile_availability, 'available'); assert.equal(unknown.guards[0].sia_verified, null);
  await assert.rejects(read(database(fixtures(), { foreignProfile: true }), ['guards']), /could not be verified/);
});

test('every selected category error or guard lookup failure rejects the full load instead of returning a partial export', async () => {
  for (const failure of Object.keys(schema)) await assert.rejects(read(database(fixtures(), { failure })));
  await assert.rejects(read(database(fixtures(), { guardFailure: true })), /Assigned guard details/);
});

function csvRows(text) {
  const rows = []; let row = [], field = '', quoted = false; text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(field); field = ''; } else if (c === '\n' && !quoted) { row.push(field); rows.push(row); row = []; field = ''; } else if (!(c === '\r' && !quoted)) field += c; }
  assert.equal(quoted, false); return rows;
}

test('rectangular CSV and JSON retain all selected/empty categories, subscription-only fields, arrays, null/false, quotes and formula protection', async () => {
  const rows = fixtures(); rows.client_contacts = [{ id: 'contact', client_id: C, name: '=HYPERLINK("bad")', email: 'own-contact@example.test' }]; rows.jobs[0].job_title = '\t=HYPERLINK("bad")';
  const data = await read(database(rows)); const csv = exp.clientExportCSV(data); assert.equal(csv.charCodeAt(0), 0xfeff);
  const parsed = csvRows(csv); const header = parsed.shift(); assert.ok(parsed.every(row => row.length === header.length));
  const mapped = parsed.map(row => Object.fromEntries(header.map((key, i) => [key, row[i]])));
  assert.equal(mapped.filter(r => r.export_row_type === 'record').length, 33); assert.deepEqual(mapped.filter(r => r.export_row_type === 'empty_category').map(r => r.export_category), ['messages', 'documents']);
  assert.equal(mapped.find(r => r.type === 'subscription').period_start, '2026-10-01'); assert.equal(mapped.find(r => r.export_category === 'tickets').category, 'technical_issue');
  assert.equal(mapped.find(r => r.id === 'job-0').job_title[0], "'"); assert.equal(mapped.find(r => r.export_category === 'guards').sia_verified, 'true'); assert.equal(mapped.find(r => r.export_category === 'guards').guard_account_active, 'false');
  assert.deepEqual(JSON.parse(mapped.find(r => r.export_category === 'guards').licence_types), ['security_guard']); assert.match(mapped.find(r => r.export_category === 'tickets').description, /Line 1\r\nLine 2, "quoted"/);
  const json = JSON.parse(JSON.stringify(exp.buildClientExport(data, C, U, 'Synthetic'))); assert.deepEqual(json.export_metadata.categories, all); assert.equal(json.export_metadata.record_counts.documents, 0); assert.equal(json.profile[0].site_contacts.length, 1);
  assert.doesNotMatch(csv + JSON.stringify(json), /PRIVATE_|admin_notes|file_url|stripe_invoice_id/);
});

function find(node, predicate) { if (!node || typeof node !== 'object') return null; if (predicate(node)) return node; for (const child of [node.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; } return null; }
function modalHarness(options = {}) {
  let stateIndex = 0, refIndex = 0, cleanup, closes = 0; const states = [], refs = [], blobs = [], downloads = [], messages = [];
  const db = options.db || database();
  const react = { useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; }, useRef(initial) { return refs[refIndex++] ||= { current: initial }; }, useCallback(fn) { return fn; }, useEffect(fn) { if (!cleanup) cleanup = fn(); } };
  const print = { printed: 0, closed: 0, node: null, document: { createElement: () => ({}), body: { replaceChildren(node) { print.node = node; } } }, print() { print.printed++; }, close() { print.closed++; } };
  const api = options.loader ? { ...exp, loadClientDataExport: options.loader } : exp;
  const Component = load('app/client/profile/ExportDataModal.tsx', { react, '@/lib/supabase': { supabase: db }, '@/lib/client-data-export': api }, {
    URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:fixture'; }, revokeObjectURL() {} }, setTimeout: fn => fn(),
    document: { createElement: () => ({ click() { downloads.push(this.download); }, remove() {} }), body: { appendChild() {} } }, window: { open: () => options.blockPrint ? null : print },
  }).default;
  const render = () => { stateIndex = 0; refIndex = 0; return Component({ clientId: C, userId: U, companyName: '</pre><script>unsafe()</script>', onClose() { closes++; }, onMessage: (...args) => messages.push(args) }); };
  const click = async label => { const node = find(render(), n => n.type === 'button' && (n.props['aria-label'] === label || n.props.children === label)); assert.ok(node, label); await node.props.onClick(); };
  return { db, render, click, blobs, downloads, messages, print, closes: () => closes, close: () => cleanup() };
}

test('actual modal previews unselected jobs/guards without changing selection, uses correct singular/plural and retries a failed preview', async () => {
  const db = database(); const h = modalHarness({ db }); await h.click('Preview Job History'); const html = renderToStaticMarkup(h.render()); assert.match(html, /&quot;record_count&quot;: 9/); assert.match(html, /Export 1 category/); assert.doesNotMatch(html, /categoryy|categoryies/);
  db.options.guardFailure = true; await h.click('Preview Selected Guards'); assert.match(renderToStaticMarkup(h.render()), /Retry preview/); db.options.guardFailure = false; await h.click('Retry preview'); assert.match(renderToStaticMarkup(h.render()), /Inactive assigned guard/);
  await h.click('Select Job History'); assert.match(renderToStaticMarkup(h.render()), /Export 2 categories/); h.close();
});

test('actual CSV/JSON download Blob bytes contain all eight category counts; failures keep the modal open and Retry succeeds', async () => {
  for (const format of ['CSV', 'JSON']) {
    const db = database(); const h = modalHarness({ db }); await h.click('Select All'); await h.click(format); db.options.failure = 'subscription_payments'; await h.click('Export 8 categories'); assert.equal(h.blobs.length, 0); assert.equal(h.closes(), 0); assert.match(renderToStaticMarkup(h.render()), /Retry export/);
    db.options.failure = null; await h.click('Retry export'); assert.equal(h.blobs.length, 1); assert.equal(h.closes(), 1);
    const bytes = await h.blobs[0].text(); if (format === 'JSON') assert.equal(JSON.parse(bytes).export_metadata.record_counts.payments, 11); else assert.equal(csvRows(bytes).length, 36);
    assert.doesNotMatch(bytes, /PRIVATE_|file_url|admin_notes/); h.close();
  }
});

test('print treats customer-controlled content as text and a blocked popup never announces success', async () => {
  const h = modalHarness(); await h.click('Print View'); await h.click('Export 1 category'); assert.equal(h.print.printed, 1); assert.match(h.print.node.textContent, /<\/pre><script>unsafe\(\)<\/script>/); assert.equal(h.closes(), 1); h.close();
  const blocked = modalHarness({ blockPrint: true }); await blocked.click('Print View'); await blocked.click('Export 1 category'); assert.equal(blocked.closes(), 0); assert.equal(blocked.messages.some(m => m[0] === 'success'), false); assert.match(renderToStaticMarkup(blocked.render()), /Allow pop-ups/); blocked.close();
});

test('superseded previews and closing while loading cannot show stale results or trigger a later download', async () => {
  const pending = []; const h = modalHarness({ loader: (...args) => new Promise(resolve => pending.push({ args, resolve })) });
  const first = h.click('Preview Job History'), second = h.click('Preview Selected Guards'); pending[1].resolve({ guards: [{ id: 'newer' }] }); await second; pending[0].resolve({ jobs: [{ id: 'stale' }] }); await first;
  assert.match(renderToStaticMarkup(h.render()), /newer/); assert.doesNotMatch(renderToStaticMarkup(h.render()), /stale/);
  const exporting = h.click('Export 1 category'); h.close(); pending[2].resolve({ profile: [] }); await exporting; assert.equal(h.blobs.length, 0); assert.equal(h.closes(), 0);
});
