const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/enterprise-module.cjs');
const SDK = 'https://esm.sh/@supabase/supabase-js@2.39.3';
const SERVE = 'https://deno.land/std@0.168.0/http/server.ts';
const ENV = { SUPABASE_URL: 'https://sandbox.example.test', SUPABASE_SERVICE_ROLE_KEY: 'service-fixture', SUPABASE_ANON_KEY: 'public-fixture', RESEND_API_KEY: 'provider-fixture' };
const body = { clientEmail: 'synthetic@example.invalid', clientName: 'Fixture', jobTitle: 'Test', jobId: 'job', venue: 'Test', startDate: '2099-12-01', startTime: '09:00', numberOfGuards: '2', hourlyRate: '15.5' };
function sender(options = {}) {
  let handler;
  const requests = [], reads = [];
  const db = { from(table) { reads.push(table); return { select() { return this; }, eq() { return this; }, async maybeSingle() {
    if (table === 'jobs') return { data: options.job === undefined ? { status: 'open', is_draft: false, publish_at: null } : options.job, error: options.jobError || null };
    return { data: options.mode === undefined ? null : { value: options.mode }, error: options.settingError || null };
  } }; } };
  load('supabase/functions/send-job-posted-email/index.ts', { [SERVE]: { serve(fn) { handler = fn; } }, [SDK]: { createClient: () => db } }, {
    Deno: { env: { get: key => ({ ...ENV, ...options.env })[key] } }, console: { error() {} },
    fetch: async (url, init) => { requests.push({ url, body: JSON.parse(init.body) }); if (options.networkError) throw Error('private provider detail'); return new Response(options.raw ?? JSON.stringify(options.result ?? { success: true, email_id: 'accepted' }), { status: options.status || 200 }); },
  });
  return { requests, reads, async run(input = body, token = 'service-fixture') { const response = await handler(new Request('https://sandbox.example.test/sender', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(input) })); return { status: response.status, body: await response.json() }; } };
}
test('job confirmation accepts HTML form numeric strings and formats the rate', async () => {
  const h = sender(); const r = await h.run(); assert.equal(r.status, 200); assert.equal(r.body.delivered, true); assert.equal(r.body.message_id, 'accepted');
  assert.equal(h.requests[0].body.variables.hourly_rate, '15.50'); assert.equal(h.requests[0].body.variables.number_of_guards, '2'); assert.equal(h.requests[0].body.dry_run, false);
  assert.equal(h.requests[0].body.template_slug, 'job_posted');
});
test('saved scheduled drafts receive scheduled wording and a London publication time despite forged caller state', async () => {
  for (const [date, time] of [['2099-12-01T12:00:00Z', '12:00 GMT'], ['2099-07-01T12:00:00Z', '13:00 BST']]) {
    const h = sender({ job: { status: 'draft', is_draft: true, publish_at: date } });
    const r = await h.run({ ...body, status: 'open', is_draft: false, publishAt: 'invalid' });
    assert.equal(r.status, 200); assert.equal(r.body.delivered, true);
    assert.equal(h.requests[0].body.template_slug, 'job_scheduled');
    assert.ok(h.requests[0].body.variables.publish_at.endsWith(time), h.requests[0].body.variables.publish_at);
  }
  const published = sender({ job: { status: 'open', is_draft: false, publish_at: '2000-01-01T12:00:00Z' } });
  assert.equal((await published.run({ ...body, status: 'draft', is_draft: true })).status, 200);
  assert.equal(published.requests[0].body.template_slug, 'job_posted');
});
test('missing, unreadable, inconsistent or inactive job state cannot produce a publication email', async () => {
  for (const options of [{ job: null }, { jobError: Error('private database error') },
    { job: { status: 'cancelled', is_draft: false } }, { job: { status: 'closed', is_draft: false } },
    { job: { status: 'open', is_draft: true } }, { job: { status: 'draft', is_draft: false } },
    { job: { status: 'draft', is_draft: true, publish_at: null } },
    { job: { status: 'draft', is_draft: true, publish_at: 'invalid' } }]) {
    const h = sender(options); const r = await h.run();
    assert.ok([409, 503].includes(r.status)); assert.equal(h.requests.length, 0);
    assert.doesNotMatch(JSON.stringify(r.body), /private/);
  }
});
test('confirmation rejects invalid numeric input before configuration reads or template calls', async () => {
  for (const changes of [{ hourlyRate: '' }, { hourlyRate: '15oops' }, { hourlyRate: null }, { hourlyRate: [] }, { hourlyRate: true }, { hourlyRate: -1 }, { hourlyRate: 1001 }, { numberOfGuards: '2.5' }, { numberOfGuards: 0 }, { numberOfGuards: 101 }]) {
    const h = sender(); assert.equal((await h.run({ ...body, ...changes })).status, 400); assert.equal(h.requests.length, 0); assert.equal(h.reads.length, 0);
  }
});
test('browser and anonymous callers cannot read delivery configuration or invoke templates', async () => {
  for (const token of [null, 'ordinary-user']) { const h = sender(); assert.equal((await h.run(body, token)).status, 403); assert.equal(h.reads.length, 0); assert.equal(h.requests.length, 0); }
});
test('paused, invalid and unreadable delivery settings fail closed without email calls', async () => {
  for (const options of [{ mode: 'paused' }, { mode: 'typo' }, { mode: null }, { settingError: Error('private database detail') }]) {
    const h = sender(options); const r = await h.run(); assert.equal(r.status, 503); assert.equal(r.body.success, false); assert.equal(h.requests.length, 0); assert.doesNotMatch(JSON.stringify(r.body), /private/);
  }
});
test('private dry run forwards preview only and never claims delivery', async () => {
  const h = sender({ mode: 'dry_run', env: { RESEND_API_KEY: undefined }, result: { subject: 'Preview', body_html: '<p>Preview</p>' } });
  const r = await h.run(); assert.deepEqual(r.body, { success: true, delivered: false, dry_run: true }); assert.equal(h.requests.length, 1); assert.equal(h.requests[0].body.dry_run, true); assert.equal(h.requests[0].body.is_test, undefined); assert.equal(r.body.message_id, undefined);
  const missingPreview = sender({ mode: 'dry_run' }); assert.equal((await missingPreview.run()).status, 500);
});
test('confirmation requires successful provider acceptance and hides provider details', async () => {
  for (const options of [{ status: 500 }, { result: { success: false, email_id: 'no' } }, { result: { success: true } }, { result: { success: true, email_id: ' ' } }, { raw: 'invalid json' }, { networkError: true }, { env: { RESEND_API_KEY: undefined } }]) {
    const h = sender(options); const r = await h.run(); assert.equal(r.status, 500); assert.notEqual(r.body.success, true); assert.doesNotMatch(JSON.stringify(r.body), /private|provider-fixture/);
  }
});
function posting(options = {}) {
  let handler; const requests = [], inserts = [];
  const db = { auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) }, rpc: async () => ({ data: { allowed: true }, error: null }), from(table) {
    let mutation = null;
    const q = { select() { return q; }, eq() { return q; }, update() { mutation = 'update'; return q; }, insert(data) { mutation = 'insert'; inserts.push({ table, data }); return q; }, maybeSingle() { return q; }, then(resolve, reject) {
      const data = table === 'clients' ? { id: 'client', user_id: 'owner' } : table === 'user_entitlements_data' ? { plan_slug: 'client_free', is_active: true } : table === 'jobs' && mutation === 'insert' ? { id: 'job' } : null;
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    } }; return q;
  } };
  load('supabase/functions/create-job/index.ts', { [SERVE]: { serve(fn) { handler = fn; } }, 'https://esm.sh/@supabase/supabase-js@2': { createClient: () => db } }, {
    Deno: { env: { get: key => ENV[key] } },
    fetch: async (url, init) => { requests.push({ url, body: JSON.parse(init.body) }); if (url.endsWith('/send-job-posted-email')) { if (options.networkError) throw Error('unavailable'); return new Response(options.raw ?? JSON.stringify(options.result ?? { success: true, delivered: true, message_id: 'accepted' }), { status: options.status || 200 }); } return new Response(JSON.stringify({ queued: 0 }), { status: 200 }); },
  });
  return { requests, inserts, async run() { const r = await handler(new Request('https://sandbox.example.test/create-job', { method: 'POST', headers: { Authorization: 'Bearer user-fixture' }, body: JSON.stringify({ clientId: 'client', submissionId: 'qgb_fixture123456', formData: { ...body, jobTitle: 'Synthetic test', jobDescription: 'Synthetic acceptance test only', securityType: 'Security Guard', addressLine1: '1 Test Road', city: 'London', postcode: 'SW1A 1AA', numberOfDays: '1', endTime: '17:00', contactName: 'Fixture', contactEmail: body.clientEmail } }) })); return { status: r.status, body: await r.json() }; } };
}
test('real create-job handler sends normalized numbers and keeps a successfully posted job when email fails', async () => {
  for (const options of [{}, { status: 500 }, { result: { success: false } }, { result: { success: true, delivered: false, dry_run: true } }, { result: { success: true } }, { result: { success: true, message_id: '' } }, { raw: 'bad json' }, { networkError: true }]) {
    const h = posting(options); const r = await h.run(); assert.equal(r.status, 200); assert.equal(r.body.success, true); assert.equal(r.body.jobId, 'job');
    assert.equal(r.body.warnings.includes('email_failed'), Object.keys(options).length > 0);
    const email = h.requests.find(r => r.url.endsWith('/send-job-posted-email')); assert.equal(email.body.hourlyRate, 15.5); assert.equal(email.body.numberOfGuards, 2);
    assert.equal(h.inserts.filter(r => r.table === 'jobs').length, 1); assert.equal(h.requests.filter(r => r.url.endsWith('/notify-matching-guards')).length, 1);
  }
});
