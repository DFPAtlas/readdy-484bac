const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/enterprise-module.cjs');

const kinds = [
  ['cancellation_notification', 'cancellation_id', 'send-cancellation-notification'],
  ['refund_notification', 'refund_request_id', 'send-refund-notification'],
];
function fixture(kind, response, completion = { data: true, error: null }) {
  const [emailType, key, endpoint] = kind;
  const calls = [], logs = [], requests = [];
  let handler, status = 'pending';
  const row = { id: 'queue-fixture', email_type: emailType, recipient_email: 'client@example.test', metadata: { [key]: 'event-fixture', job_id: 'job-fixture' } };
  const db = {
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === 'claim_email_queue') { const eligible = status === 'pending'; if (eligible) status = 'processing'; return { data: eligible ? [row] : [], error: null }; }
      if (name === 'complete_email_queue') { if (completion instanceof Error) throw completion; if (completion.data === true && !completion.error) status = 'sent'; return completion; }
      if (name === 'fail_email_queue') { status = 'pending'; return { data: 'pending', error: null }; }
      throw new Error('Unexpected RPC ' + name);
    },
    from(table) { assert.equal(table, 'email_send_log'); return { async insert(value) { logs.push(value); return { error: null }; } }; },
  };
  load('supabase/functions/process-email-queue/index.ts', {
    'https://deno.land/std@0.168.0/http/server.ts': { serve: fn => handler = fn },
    'https://esm.sh/@supabase/supabase-js@2.39.3': { createClient: () => db },
  }, {
    Deno: { env: { get: name => ({ RESEND_API_KEY: 'fixture', SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service' })[name] } },
    fetch: async (url, options) => {
      assert.equal(url, 'https://example.test/functions/v1/' + endpoint);
      requests.push(JSON.parse(options.body));
      if (response instanceof Error) throw response;
      return typeof response === 'function' ? response() : Response.json(response);
    },
  });
  return { row, calls, logs, requests, get status() { return status; }, async run(authorized = true) {
    const res = await handler(new Request('https://example.test/worker', { method: 'POST', headers: { Authorization: authorized ? 'Bearer fixture-service' : 'Bearer untrusted' } }));
    return { status: res.status, body: await res.json() };
  } };
}
const accepted = key => ({ success: true, [key]: 'event-fixture', results: [{ recipient: 'client', email_id: 'provider-client' }, { recipient: 'guard', email_id: 'provider-guard' }] });

test('cancellation/refund queue completion requires matching event and all recipient acceptance evidence', async () => {
  for (const kind of kinds) {
    const payloads = [null, {}, { success: false }, { success: true, [kind[1]]: 'other-event', results: accepted(kind[1]).results },
      { success: true, [kind[1]]: 'event-fixture', results: [] },
      { success: true, [kind[1]]: 'event-fixture', results: [{ recipient: 'client', error: 'Provider declined' }] },
      { success: true, [kind[1]]: 'event-fixture', results: [{ recipient: 'client', email_id: 'provider-client' }, { recipient: 'guard', error: 'Provider declined' }] },
      { success: true, [kind[1]]: 'event-fixture', results: [{ recipient: 'guard', email_id: 'provider-guard' }] },
      { success: true, [kind[1]]: 'event-fixture', results: [{ recipient: 'client', email_id: ' ' }] },
      { success: true, [kind[1]]: 'event-fixture', results: [{ recipient: 'client', email_id: 'provider', error: 'Uncertain' }] },
      { success: true, [kind[1]]: 'event-fixture', results: [{ recipient: 'client', email_id: 'provider' }, { recipient: 'client', email_id: 'other' }] },
    ];
    for (const payload of payloads) {
      const h = fixture(kind, payload), r = await h.run();
      assert.equal(r.body.delegated, 0); assert.equal(r.body.failed, 1);
      assert.equal(h.calls.filter(c => c.name === 'complete_email_queue').length, 0);
      assert.equal(h.calls.filter(c => c.name === 'fail_email_queue').length, 0, 'uncertain sends must not be automatically retried');
      assert.equal(h.logs.length, 1); assert.equal(h.logs[0].template, kind[0] + '_reconciliation');
      assert.match(r.body.errors[0], /operator review/i);
      assert.equal(h.status, 'processing'); await h.run(); assert.equal(h.requests.length, 1, 'next queue pass must not resend an uncertain notification');
    }
  }
});

test('delegated HTTP, JSON and network failures remain visible for reconciliation without automatic resend', async () => {
  for (const kind of kinds) {
    for (const response of [() => new Response('provider failed', { status: 502 }), () => new Response('not json'), new Error('Connection lost after possible send')]) {
      const h = fixture(kind, response), r = await h.run();
      assert.equal(r.body.delegated, 0); assert.equal(r.body.failed, 1);
      assert.deepEqual(h.calls.map(c => c.name), ['claim_email_queue']);
      assert.equal(h.logs[0].status, 'failed');
    }
  }
});

test('confirmed recipient results still require a true completion RPC acknowledgement', async () => {
  for (const kind of kinds) {
    for (const completion of [{ data: false, error: null }, { data: null, error: null }, { data: true, error: { message: 'Database unavailable' } }, new Error('Connection lost')]) {
      const h = fixture(kind, accepted(kind[1]), completion), r = await h.run();
      assert.equal(r.body.delegated, 0); assert.equal(r.body.failed, 1);
      assert.deepEqual(h.calls.map(c => c.name), ['claim_email_queue', 'complete_email_queue']);
      assert.equal(h.logs.length, 1);
    }
  }
});

test('confirmed cancellation/refund emails complete once; untrusted callers cannot claim or send', async () => {
  for (const kind of kinds) {
    for (const results of [accepted(kind[1]).results, accepted(kind[1]).results.slice(0, 1)]) {
      const h = fixture(kind, { ...accepted(kind[1]), results }), r = await h.run();
      assert.equal(r.body.delegated, 1); assert.equal(r.body.failed, 0); assert.equal(h.logs.length, 0);
      assert.deepEqual(h.calls.map(c => c.name), ['claim_email_queue', 'complete_email_queue']);
      assert.deepEqual(h.requests, [{ [kind[1]]: 'event-fixture' }]);
    }
    const h = fixture(kind, accepted(kind[1])), r = await h.run(false);
    assert.equal(r.status, 401); assert.equal(h.calls.length, 0); assert.equal(h.requests.length, 0);
  }
});


test('missing cancellation/refund event identifiers never fall through to a generic placeholder email', async () => {
  for (const kind of kinds) {
    for (const value of [undefined, null, '', 123]) {
      const h = fixture(kind, accepted(kind[1])); h.row.metadata[kind[1]] = value;
      const r = await h.run(); assert.equal(r.body.failed, 1); assert.equal(r.body.delegated, 0);
      assert.equal(h.requests.length, 0); assert.equal(h.status, 'processing');
      assert.deepEqual(h.calls.map(c => c.name), ['claim_email_queue']);
    }
  }
});
