const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
function load(path, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('module', 'exports', 'require', code)(module, module.exports, name => name in mocks ? mocks[name] : require(name));
  return module.exports;
}
const website = load('lib/client-profile-website.ts');
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
}
function harness(initialWebsite, initialFailure = null) {
  const profile = { id: 'owned-client', company_name: 'Synthetic company', website: initialWebsite, email: 'synthetic@example.invalid', first_name: 'Test', last_name: 'User', phone: 'test', billing_email: '' };
  const slots = [], calls = [], updates = [], errors = []; let cursor = 0, failure = initialFailure;
  const react = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; } };
  const db = { from(table) { assert.equal(table, 'clients'); const call = {}; calls.push(call); const q = {
    update(payload) { call.payload = payload; return q; }, eq(key, value) { call.filter = [key, value]; return q; }, select(columns) { call.columns = columns; return q; },
    async maybeSingle() { if (failure instanceof Error) throw failure; if (failure) return failure; return { data: { id: profile.id }, error: null }; },
  }; return q; } };
  const Component = load('app/client/profile/CompanyProfileSection.tsx', { react, '@/lib/supabase': { supabase: db }, '@/lib/client-profile-website': website }).default;
  const render = () => { cursor = 0; return Component({ profile, onUpdate: value => updates.push(value), onError: value => errors.push(value) }); };
  return { profile, calls, updates, errors, setFailure(value) { failure = value; }, render,
    change(value) { find(render(), node => node.type === 'input' && node.props.name === 'website').props.onChange({ target: { name: 'website', value } }); },
    async submit() { let prevented = false; await render().props.onSubmit({ preventDefault() { prevented = true; } }); assert.equal(prevented, true); },
  };
}

test('absent and legacy placeholder websites remain blank optional fields through unchanged save and reopen', async () => {
  for (const value of [null, undefined, '', '  ', 'https://', ' HTTP:// ']) {
    const h = harness(value); const tree = h.render(); const input = find(tree, node => node.type === 'input' && node.props.name === 'website');
    assert.equal(input.props.value, ''); assert.equal(input.props.type, 'url'); assert.equal(input.props.required, undefined);
    const html = renderToStaticMarkup(tree); assert.match(html, /Website \(optional\)/); assert.match(html, /id="company-website-help"/);
    await h.submit(); assert.equal(h.calls[0].payload.website, ''); assert.deepEqual(h.calls[0].filter, ['id', 'owned-client']); assert.equal(h.calls[0].columns, 'id');
    assert.equal(h.updates.length, 1); assert.equal(h.updates[0].website, ''); assert.deepEqual(h.errors, []);
    const reopened = harness(h.updates[0].website); assert.equal(find(reopened.render(), node => node.type === 'input' && node.props.name === 'website').props.value, '');
  }
});

test('complete submitted web URLs are normalised consistently; incomplete or unsupported values cause no writes', async () => {
  for (const [value, expected] of [['https://EXAMPLE.com/path?q=1#part', 'https://example.com/path?q=1#part'], [' http://example.com ', 'http://example.com/'], ['HTTPS://EXAMPLE.com', 'https://example.com/']]) {
    const h = harness(''); h.change(value); await h.submit();
    assert.equal(h.calls[0].payload.website, expected); assert.equal(h.updates[0].website, expected); assert.deepEqual(h.errors, []);
    assert.equal(h.calls[0].payload.company_name, h.profile.company_name); assert.equal('email' in h.calls[0].payload, false);
  }
  for (const value of ['example.com/company', 'example.com:8443/company']) {
    const legacy = harness(value); assert.equal(find(legacy.render(), node => node.type === 'input' && node.props.name === 'website').props.value, 'https://' + value);
  }
  for (const value of ['https://', 'http://', 'https:example.com', 'example.com', 'not a website', 'ftp://example.com', 'javascript:alert(1)', 'https://user:password@example.com']) {
    const h = harness(''); h.change(value); await h.submit(); assert.equal(h.calls.length, 0, value); assert.equal(h.updates.length, 0); assert.match(h.errors[0], /complete http/);
  }
  const invalidStored = harness('not a website'); assert.equal(find(invalidStored.render(), node => node.type === 'input' && node.props.name === 'website').props.value, 'not a website');
});

test('returned errors, zero updated rows and thrown failures never announce success or leave saving stuck, and Retry succeeds', async () => {
  for (const failure of [{ data: null, error: { message: 'read-only' } }, { data: null, error: null }, Error('offline')]) {
    const h = harness('', failure); await h.submit(); assert.equal(h.updates.length, 0); assert.match(h.errors[0], /Failed to update profile/);
    const saveButton = find(h.render(), node => node.type === 'button' && node.props.type === 'submit'); assert.equal(saveButton.props.disabled, false);
    h.setFailure(null); await h.submit(); assert.equal(h.updates.length, 1); assert.equal(h.updates[0].website, '');
  }
  let resolve;
  const pendingResponse = new Promise(done => { resolve = done; });
  const h = harness('', pendingResponse); h.change('https://EXAMPLE.com/first'); const save = h.submit();
  h.change('https://example.com/second'); resolve({ data: { id: 'owned-client' }, error: null }); await save;
  assert.equal(h.updates[0].website, 'https://example.com/first');
  assert.equal(find(h.render(), node => node.type === 'input' && node.props.name === 'website').props.value, 'https://example.com/second');
});
