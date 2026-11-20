const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
const helper = { exports: {} };
new Function('exports', compile(fs.readFileSync('lib/support-conversation.ts', 'utf8')))(helper.exports);
const { saveSupportReply } = helper.exports;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let n = 0; n < 40; n++) await Promise.resolve(); };

function database(fault = '') {
  const calls = [], reads = [];
  return { calls, reads,
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      const q = {
        select(fields) { call.fields = fields; return q; },
        insert(row) { call.insert = row; return q; },
        update(row) { call.update = row; return q; },
        eq(key, value) { call.filters.push([key, value]); return q; }, order() { return q; },
        async single() { if (fault === 'insert-throw') throw Error('network'); return fault === 'insert' ? { error: { message: 'denied' } } : { data: { id: 'saved' } }; },
        async maybeSingle() {
          if (fault === 'status-throw') throw Error('network');
          return fault === 'status' ? { error: { message: 'denied' } } : fault === 'status-empty' ? { data: null } : { data: { id: 'ticket' } };
        },
        then(resolve, reject) { return (reads.shift() || Promise.resolve({ data: [], error: null })).then(resolve, reject); },
      }; return q;
    },
    functions: { async invoke(name, options) {
      calls.push({ bridge: name, options });
      if (fault === 'bridge-throw') throw Error('network');
      return fault === 'bridge' ? { error: { message: 'unavailable' } } : {};
    } },
    channel() { const q = { on() { return q; }, subscribe() { return q; } }; return q; }, removeChannel() {},
  };
}

test('a confirmed reply stays saved through returned/thrown/zero-row status failures, and client delivery still runs', async () => {
  for (const role of ['client', 'guard']) for (const fault of ['', 'status', 'status-throw', 'status-empty', 'bridge', 'bridge-throw']) {
    const db = database(fault); let saved = false;
    const result = await saveSupportReply(db, { ticketId: 'ticket', senderId: 'owner', senderType: role, text: ' Reply ', status: 'awaiting_' + role }, () => {
      saved = true;
      assert.equal(db.calls.length, 1, 'draft is cleared immediately after insert, before follow-up work');
    });
    assert.equal(saved, true);
    assert.equal(result.statusUpdated, !fault.startsWith('status'));
    assert.deepEqual(db.calls[0].insert, { ticket_id: 'ticket', sender_id: 'owner', sender_type: role, message_text: 'Reply', is_internal: false });
    assert.deepEqual(db.calls[1].filters, [['id', 'ticket'], ['status', 'awaiting_' + role]], 'a concurrent status change cannot be overwritten');
    assert.equal(db.calls.filter(c => c.insert).length, 1);
    assert.equal(db.calls.filter(c => c.bridge).length, role === 'client' ? 1 : 0);
    if (role === 'client') assert.deepEqual(db.calls.find(c => c.bridge).options, { body: { messageId: 'saved' } });
    const warns = fault.startsWith('status') || role === 'client' && fault.startsWith('bridge');
    assert.equal(result.warnings.length, warns ? 1 : 0);
    if (warns) assert.match(result.warnings[0], /do not need to resend/);
  }
});

test('unconfirmed inserts keep the draft and do not update the ticket or invoke delivery', async () => {
  for (const fault of ['insert', 'insert-throw']) {
    const db = database(fault); let saved = false;
    await assert.rejects(saveSupportReply(db, { ticketId: 'ticket', senderId: 'owner', senderType: 'client', text: 'Reply', status: 'open' }, () => { saved = true; }));
    assert.equal(saved, false); assert.equal(db.calls.length, 1);
  }
});

function harness(role, db, updated = () => {}) {
  const source = fs.readFileSync(`app/${role}/support/TicketDetailDrawer.tsx`, 'utf8');
  const body = source.slice(source.indexOf('  const [messages'), source.indexOf('\n  return ('));
  const slots = [], effects = [], pending = []; let cursor = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    useState(initial) { const n = cursor++; if (!(n in slots)) slots[n] = initial; return [slots[n], value => { slots[n] = typeof value === 'function' ? value(slots[n]) : value; }]; },
    useRef(initial) { const n = cursor++; if (!(n in slots)) slots[n] = { current: initial }; return slots[n]; },
    useCallback(fn, deps) { const n = cursor++; if (!slots[n] || !same(slots[n].deps, deps)) slots[n] = { fn, deps }; return slots[n].fn; },
    useEffect(fn, deps) { const n = cursor++; if (!effects[n] || !same(effects[n].deps, deps)) pending.push(() => { effects[n]?.cleanup?.(); effects[n] = { deps, cleanup: fn() }; }); },
  };
  const env = { ...hooks, supabase: db, saveSupportReply, onUpdated: updated };
  const component = new Function(...Object.keys(env), compile(`return function({ticket,clientId,guardId}) {${body}\nreturn {messages,loading,loadError,notice,warning,error,replyText,sending,setReplyText,loadMessages,handleSendReply};}`))(...Object.values(env));
  return {
    render(id = 'A', owner = 'owner') { cursor = 0; return component({ ticket: { id, status: 'open' }, clientId: owner, guardId: owner }); },
    async effects() { pending.splice(0).forEach(fn => fn()); await flush(); },
    unmount() { effects.forEach(e => e?.cleanup?.()); },
  };
}

for (const role of ['guard', 'client']) {
  test(role + ' history distinguishes failure/invalid data from empty, recovers, and rejects late lifetimes', async () => {
    const db = database(), r = harness(role, db);
    db.reads.push(Promise.resolve({ data: null, error: { message: 'private database error' } }));
    r.render(); await r.effects(); let api = r.render(); assert.equal(api.loadError, true);
    await api.loadMessages(); api = r.render(); assert.equal(api.loadError, false); assert.deepEqual(api.messages, []);
    db.reads.push(Promise.resolve({ data: null, error: null })); await api.loadMessages(); api = r.render(); assert.equal(api.loadError, true);
    const late = deferred(); db.reads.push(late.promise); const load = api.loadMessages();
    r.render('B'); await r.effects(); r.render('A'); await r.effects();
    late.resolve({ data: [{ id: 'old-A' }] }); await load;
    api = r.render('A'); assert.deepEqual(api.messages, []); assert.equal(api.loadError, false);
    const closed = deferred(); db.reads.push(closed.promise); const pending = api.loadMessages(); r.unmount();
    closed.resolve({ data: [{ id: 'after-close' }] }); await pending; assert.deepEqual(r.render('A').messages, []);
  });

  test(role + ' drawer reports saved reply after status failure and prevents rapid double sends', async () => {
    const db = database('status'), r = harness(role, db); r.render(); await r.effects();
    let api = r.render(); api.setReplyText('Reply'); api = r.render();
    await Promise.all([api.handleSendReply(), api.handleSendReply()]);
    api = r.render(); assert.equal(api.replyText, ''); assert.equal(api.notice, 'Your reply was saved.');
    assert.match(api.warning, /do not need to resend/); assert.equal(api.error, ''); assert.equal(api.sending, false);
    assert.equal(db.calls.filter(c => c.insert).length, 1);
    assert.equal(db.calls.filter(c => c.bridge).length, role === 'client' ? 1 : 0);
  });

  test(role + ' drawer retains an unconfirmed draft and ignores an old send after ticket switch', async () => {
    const db = database('insert'), r = harness(role, db); r.render(); await r.effects();
    let api = r.render(); api.setReplyText('Keep this reply'); api = r.render(); await api.handleSendReply();
    api = r.render(); assert.equal(api.replyText, 'Keep this reply'); assert.match(api.error, /Reload the conversation/); assert.equal(api.notice, '');
    const saved = deferred(), originalFrom = db.from;
    db.from = table => { const q = originalFrom(table); if (table === 'ticket_messages') q.single = () => saved.promise; return q; };
    const send = api.handleSendReply(); r.render('B'); await r.effects(); api = r.render('B'); api.setReplyText('New ticket reply');
    saved.resolve({ data: { id: 'saved-old-ticket' } }); await send;
    api = r.render('B'); assert.equal(api.replyText, 'New ticket reply'); assert.equal(api.notice, '');
  });

  test(role + ' closed-ticket history failure renders an alert and retry without claiming no replies', () => {
    let index = 0;
    const hooks = { ...React, useState(initial) { const state = React.useState(initial), n = index++; return n === 2 ? [false, () => {}] : n === 5 ? [true, () => {}] : state; } };
    const mod = { exports: {} };
    new Function('require', 'exports', compile(fs.readFileSync(`app/${role}/support/TicketDetailDrawer.tsx`, 'utf8')))(name => {
      if (name === 'react') return hooks;
      if (name === '@/lib/request-deadline') return { withRequestDeadline: value => value };
      if (name === '@/lib/support-routing') return {};
      if (name === '@/lib/supabase') return { supabase: {} };
      if (name === '@/lib/support-conversation') return helper.exports;
      if (name.startsWith('./')) return { __esModule: true, default: () => null };
      return require(name);
    }, mod.exports);
    const html = renderToStaticMarkup(React.createElement(mod.exports.default, { ticket: { id: 'A', status: 'closed', created_at: '2026-11-18', updated_at: '2026-11-18' }, clientId: 'owner', guardId: 'owner' }));
    assert.match(html, /role="alert"/); assert.match(html, /Retry loading conversation/); assert.doesNotMatch(html, /No replies yet/);
  });
}
