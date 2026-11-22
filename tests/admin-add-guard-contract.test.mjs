import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

const source = fs.readFileSync('app/admin/add-guard/page.tsx', 'utf8');
const compile = code => ts.transpileModule(code, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const handler = source.slice(source.indexOf('  const handleSubmit ='), source.indexOf('\n  return (', source.indexOf('  const handleSubmit =')));

function harness({ session = { access_token: 'authenticated-admin-token' }, sessionError = null, response } = {}) {
  const calls = [], errors = [], successes = [], forms = [];
  const form = { email: 'test@example.invalid', first_name: 'TEST', last_name: 'DO NOT BOOK' };
  let sequence = 0;
  const dependencies = {
    form, initialForm: {}, profileImage: { base64: 'test-image', name: 'profile.png' },
    siaFront: null, siaBack: null, siaSupporting: null, validateFileType: () => true,
    submittingRef: { current: false }, submissionRef: { current: null },
    supabase: { auth: { getSession: async () => ({ data: { session }, error: sessionError }) } },
    process: { env: { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-api-key', NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co' } },
    crypto: { randomUUID: () => `test-key-${++sequence}` },
    setError: error => errors.push(error), setSuccess: success => successes.push(success),
    setForm: next => forms.push(next), setProfileImage() {}, setSiaFront() {}, setSiaBack() {}, setSiaSupporting() {}, setLoading() {},
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      return response ? response() : { ok: true, json: async () => ({ success: true, guardId: 'new-guard', email: form.email, status: 'pending_review' }) };
    },
  };
  const submit = new Function(...Object.keys(dependencies), compile(handler + '\nreturn handleSubmit;'))(...Object.values(dependencies));
  return { calls, errors, successes, forms, form, dependencies, submit: () => submit({ preventDefault() {} }) };
}

test('Add Guard sends the signed-in admin token and a submission key, preserves documents and accepts the pending-review contract', async () => {
  const h = harness(); await h.submit();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].headers.Authorization, 'Bearer authenticated-admin-token');
  assert.equal(h.calls[0].headers.apikey, 'public-api-key');
  const body = JSON.parse(h.calls[0].body);
  assert.equal(body.idempotency_key, 'test-key-1');
  assert.equal(body.profile_image_base64, 'test-image');
  assert.equal(body.profile_image_name, 'profile.png');
  assert.equal('auto_approve' in body, false);
  assert.deepEqual(h.successes.at(-1), { email: 'test@example.invalid' });
  assert.equal(h.forms.length, 1);
});

test('Add Guard does not submit without a session and does not accept malformed or failed acknowledgements', async () => {
  for (const options of [{ session: null }, { sessionError: new Error('Unavailable') }]) {
    const h = harness(options); await h.submit(); assert.equal(h.calls.length, 0); assert.match(h.errors.at(-1), /sign in again/);
  }
  for (const result of [{}, null, { success: true }, { success: false }, { success: true, guardId: 'g', email: 'someone-else@example.invalid', status: 'pending_review' }]) {
    const h = harness({ response: () => ({ ok: true, json: async () => result }) });
    await h.submit(); assert.equal(h.forms.length, 0); assert.equal(h.successes.at(-1), null); assert.ok(h.errors.at(-1));
  }
});

test('Add Guard blocks overlapping submissions and reuses a key after uncertain failure until the submitted data changes', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const h = harness({ response: async () => { await gate; throw new Error('Network failed'); } });
  const first = h.submit(); await h.submit(); release(); await first;
  assert.equal(h.calls.length, 1);
  await h.submit();
  assert.equal(JSON.parse(h.calls[1].body).idempotency_key, 'test-key-1');
  h.form.email = 'changed@example.invalid'; await h.submit();
  assert.equal(JSON.parse(h.calls[2].body).idempotency_key, 'test-key-2');
});

test('Add Guard success shows pending review and never advertises a password or automatic SIA approval', () => {
  let slot = 0;
  const mod = { exports: {} };
  const react = { ...React, useRef: value => ({ current: value }), useState: value => [slot++ === 3 ? { email: 'test@example.invalid' } : value, () => {}] };
  new Function('module', 'exports', 'require', compile(source))(mod, mod.exports, name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs, Fragment: React.Fragment };
    if (name === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children) };
    return { default: () => null, supabase: {} };
  });
  const html = renderToStaticMarkup(React.createElement(mod.exports.default));
  assert.match(html, /Guard Created — Pending Review/);
  assert.doesNotMatch(html, /Password:|Auto-Approve|Created &amp; Approved|Copy the credentials/);
});

test('creation service retains anonymous rejection, verified identity, MFA and submission-key gates before account creation', async () => {
  const backend = fs.readFileSync('supabase/functions/create-guard-from-admin/index.ts', 'utf8');
  const token = aal => 'header.' + Buffer.from(JSON.stringify({ aal })).toString('base64url') + '.signature';
  for (const scenario of [
    { credential: 'public-key', status: 401 },
    { credential: token('aal2'), user: null, status: 401 },
    { credential: token('aal1'), user: { id: 'admin' }, status: 403 },
    { credential: token('aal2'), user: { id: 'admin' }, status: 400 },
  ]) {
    let handler;
    const db = {
      auth: { getUser: async () => ({ data: { user: scenario.user }, error: null }) },
      from: table => {
        assert.equal(table, 'admin_users');
        const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { id: 'admin', is_active: true, role: 'super_admin' }, error: null }) };
        return query;
      },
    };
    new Function('exports', 'require', 'Deno', 'fetch', compile(backend))(
      {},
      () => ({ createClient: () => db }),
      { env: { get: key => ({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-only', SUPABASE_ANON_KEY: 'public-key' })[key] }, serve: next => { handler = next; } },
      () => { throw new Error('No outbound action is allowed before these gates'); },
    );
    const response = await handler(new Request('https://test.supabase.co/functions/v1/create-guard-from-admin', {
      method: 'POST', headers: { Authorization: `Bearer ${scenario.credential}`, Origin: 'https://quickguard.uk', 'Content-Type': 'application/json' }, body: '{}',
    }));
    assert.equal(response.status, scenario.status);
  }
});
