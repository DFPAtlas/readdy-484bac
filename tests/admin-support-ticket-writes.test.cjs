const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const helper = { exports: {} };
new Function('exports', compile(fs.readFileSync('lib/admin-support-ticket-writes.ts', 'utf8')))(helper.exports);
const { updateAdminSupportTicket } = helper.exports;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
const ticket = id => ({ id, subject: id, description: 'Synthetic ticket', category: 'general_support', status: 'open', admin_notes: 'Original ' + id });
const saved = (id, fields = {}) => ({ id, admin_notes: 'Saved ' + id, status: 'open', resolved_at: null, updated_at: '2026-11-18T12:00:00Z', ...fields });
function database() {
  const calls = [], pending = [];
  return { calls, pending, from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const q = { update(row) { call.updates = row; return q; }, eq(key, value) { call.filters.push([key, value]); return q; }, select(fields) { call.fields = fields; return q; }, maybeSingle() { return pending.shift() || Promise.resolve({ data: saved('A') }); } };
    return q;
  } };
}

test('admin saves require the intended nondeleted ticket row, rather than just an error-free response', async () => {
  const db = database(); const updates = { admin_notes: 'Internal note', updated_at: 'now' };
  assert.equal((await updateAdminSupportTicket(db, 'A', updates)).id, 'A');
  assert.deepEqual(db.calls[0].filters, [['id', 'A'], ['is_deleted', false]]);
  assert.deepEqual(db.calls[0].updates, updates);
  assert.match(db.calls[0].fields, /admin_notes, status, resolved_at, updated_at/);
  for (const result of [{ data: null, error: null }, { data: saved('B'), error: null }, { data: saved('A'), error: { message: 'denied' } }]) {
    db.pending.push(Promise.resolve(result));
    await assert.rejects(updateAdminSupportTicket(db, 'A', updates), /could not be confirmed/);
  }
});

function harness(db) {
  const source = fs.readFileSync('app/admin/support-tickets/page.tsx', 'utf8');
  const body = source.slice(source.indexOf('  const [tickets'), source.indexOf('\n  const formatDate'));
  const slots = [], effects = [], pendingEffects = [], reads = []; let cursor = 0, writes = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, n) => Object.is(value, b[n]));
  const hooks = {
    useState(initial) { const n = cursor++; if (!(n in slots)) slots[n] = initial; return [slots[n], value => { writes++; slots[n] = typeof value === 'function' ? value(slots[n]) : value; }]; },
    useRef(initial) { const n = cursor++; if (!(n in slots)) slots[n] = { current: initial }; return slots[n]; },
    useCallback(fn, deps) { const n = cursor++; if (!slots[n] || !same(slots[n].deps, deps)) slots[n] = { fn, deps }; return slots[n].fn; },
    useEffect(fn, deps) { const n = cursor++; if (!effects[n] || !same(effects[n].deps, deps)) pendingEffects.push(() => { effects[n]?.cleanup?.(); effects[n] = { deps, cleanup: fn() }; }); },
  };
  const env = { ...hooks, supabase: db, updateAdminSupportTicket, loadAdminSupportInbox: () => reads.shift() || Promise.resolve([ticket('A'), ticket('B')]), setTimeout: () => 1, clearTimeout() {} };
  const component = new Function(...Object.keys(env), compile(`return function() {${body}\nreturn {tickets,selected,adminNote,saving,toast,selectTicket,setAdminNote,handleSaveNote,handleChangeStatus,fetchTickets,loading,loadError};}`))(...Object.values(env));
  return { reads, get writes() { return writes; }, render() { cursor = 0; return component(); }, async effects() { pendingEffects.splice(0).forEach(fn => fn()); await flush(); }, unmount() { effects.forEach(e => e?.cleanup?.()); } };
}
async function open(r, id = 'A') { r.render(); await r.effects(); const api = r.render(); api.selectTicket(ticket(id)); return r.render(); }

test('zero-row and thrown saves retain the draft and never show success', async () => {
  for (const outcome of ['zero', 'throw']) {
    const db = database(), r = harness(db); let api = await open(r);
    api.setAdminNote('Keep this draft'); api = r.render();
    const response = deferred(); db.pending.push(response.promise); const request = api.handleSaveNote();
    if (outcome === 'zero') response.resolve({ data: null }); else response.reject(Error('Private database detail'));
    await request; api = r.render();
    assert.equal(api.adminNote, 'Keep this draft'); assert.equal(api.selected.admin_notes, 'Original A');
    assert.equal(api.toast.type, 'error'); assert.doesNotMatch(api.toast.message, /Private database detail/); assert.equal(api.saving, false);
  }
});

test('late saves update the original list row without replacing a different or closed editor', async () => {
  for (const destination of ['B', null]) {
    const db = database(), r = harness(db); let api = await open(r);
    api.setAdminNote('Note for A'); api = r.render(); const response = deferred(); db.pending.push(response.promise);
    const request = api.handleSaveNote(); api.selectTicket(destination ? ticket(destination) : null);
    api = r.render(); api.setAdminNote('Different editor draft');
    response.resolve({ data: saved('A') }); await request; api = r.render();
    assert.equal(api.selected?.id ?? null, destination); assert.equal(api.adminNote, 'Different editor draft'); assert.equal(api.toast, null);
    assert.equal(api.tickets.find(t => t.id === 'A').admin_notes, 'Saved A');
  }
});

test('closing and reopening the same ticket creates a new editor lifetime', async () => {
  const db = database(), r = harness(db); let api = await open(r);
  const staleHandler = api.handleSaveNote, response = deferred(); db.pending.push(response.promise);
  const request = api.handleSaveNote(); api.selectTicket(null); api = r.render(); api.selectTicket({ ...ticket('A'), admin_notes: 'Reopened snapshot' }); api = r.render();
  response.resolve({ data: saved('A') }); await request; api = r.render();
  assert.equal(api.selected.admin_notes, 'Reopened snapshot'); assert.equal(api.adminNote, 'Reopened snapshot'); assert.equal(api.toast, null);
  const count = db.calls.length; await staleHandler(); assert.equal(db.calls.length, count, 'a stale same-ID handler cannot start a new mutation');
});

test('note and status changes share a synchronous lock and preserve text edited during a save', async () => {
  const db = database(), r = harness(db); let api = await open(r);
  api.setAdminNote('Submitted note'); api = r.render(); const response = deferred(); db.pending.push(response.promise);
  const request = api.handleSaveNote(); await api.handleSaveNote(); await api.handleChangeStatus('A', 'closed');
  assert.equal(db.calls.length, 1); api.setAdminNote('Newer unsaved text');
  response.resolve({ data: saved('A', { admin_notes: 'Submitted note' }) }); await request; api = r.render();
  assert.equal(api.adminNote, 'Newer unsaved text'); assert.equal(api.selected.admin_notes, 'Submitted note'); assert.equal(api.toast.type, 'success');
});

test('confirmed status fields come from the server and an older inbox read cannot overwrite the save', async () => {
  const db = database(), r = harness(db); let api = await open(r);
  const oldRead = deferred(); r.reads.push(oldRead.promise); const refresh = api.fetchTickets();
  db.pending.push(Promise.resolve({ data: saved('A', { status: 'resolved', resolved_at: 'server-time' }) }));
  await api.handleChangeStatus('A', 'resolved'); api = r.render();
  assert.equal(api.selected.status, 'resolved'); assert.equal(api.selected.resolved_at, 'server-time'); assert.equal(api.loading, false);
  oldRead.resolve([ticket('A'), ticket('B')]); await refresh; api = r.render();
  assert.equal(api.tickets[0].status, 'resolved'); assert.equal(api.tickets[0].resolved_at, 'server-time');
});

test('unmounted save callbacks write no state and load failures invalidate the open editor', async () => {
  const db = database(), r = harness(db); let api = await open(r);
  const response = deferred(); db.pending.push(response.promise); const request = api.handleSaveNote(); r.unmount(); const count = r.writes;
  response.resolve({ data: saved('A') }); await request; assert.equal(r.writes, count);

  const db2 = database(), r2 = harness(db2); api = await open(r2); const fail = deferred(); r2.reads.push(fail.promise);
  const refresh = api.fetchTickets(); fail.reject(Error('load unavailable')); await refresh; api = r2.render();
  assert.equal(api.selected, null); assert.equal(api.loadError, true); await api.handleChangeStatus('A', 'closed'); assert.equal(db2.calls.length, 0);
});
