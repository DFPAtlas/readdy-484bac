const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const compile = (file, jsx = false) => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: jsx ? ts.JsxEmit.ReactJSX : undefined, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
const mod = { exports: {} }; new Function('exports', compile('lib/company-dashboard-data.ts'))(mod.exports);
const { loadCompanyDashboardData } = mod.exports;

function client(failedTable = null) {
  const calls = []; const values = { company_staff: [{ full_name: 'Staff', company_sites: { site_name: 'Site' } }], rotas: [{ guards: { full_name: 'Guard' }, company_sites: { site_name: 'Site' } }], messages: [{ id: 'message' }] };
  return { calls, from(table) { const call = { table, filters: [] }; calls.push(call);
    const q = { select(fields) { call.fields = fields; return q; }, eq(key, value) { call.filters.push([key, value]); return q; }, order() { return q; }, limit() { return q; }, gte() { return q; },
      then(resolve, reject) { return Promise.resolve(table === failedTable ? { data: null, error: { message: 'unavailable' } } : { data: values[table] || [], error: null }).then(resolve, reject); } };
    return q;
  } };
}

test('company reads use the live read flag and preserve company/user scope and joined display fields', async () => {
  const db = client(); const result = await loadCompanyDashboardData(db, 'company', 'user');
  assert.equal(result.unreadMessages, 1); assert.equal(result.staff[0].site_name, 'Site'); assert.equal(result.rotas[0].guard_name, 'Guard');
  for (const call of db.calls) {
    if (call.table === 'messages') assert.deepEqual(call.filters, [['receiver_id', 'user'], ['read', false]]);
    else assert.deepEqual(call.filters, [['company_id', 'company']]);
    assert.equal(call.filters.some(([key]) => key === 'is_read'), false);
  }
});

test('a failed source rejects the dashboard instead of manufacturing empty rows or zero messages', async () => {
  for (const table of ['company_sites', 'company_staff', 'rotas', 'incidents', 'compliance_records', 'training_records', 'messages']) {
    await assert.rejects(loadCompanyDashboardData(client(table), 'company', 'user'), /could not be loaded/);
  }
});

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
test('company refresh ignores superseded data and closed-screen reads without signing out on read failures', async () => {
  const source = fs.readFileSync('app/company/dashboard/CompanyDashboardClient.tsx', 'utf8');
  const start = source.indexOf('  const loadDashboard = useCallback'); const end = source.indexOf('\n  useEffect(() => {', start);
  const code = ts.transpileModule(source.slice(start, end) + '\nreturn loadDashboard;', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const setters = [...new Set([...source.slice(start, end).matchAll(/\b(set[A-Z]\w*)\(/g)].map(match => match[1]))];
  const writes = [], redirects = [], reads = [deferred(), deferred(), deferred()]; let next = 0; let owner = 'one';
  const mountedRef = { current: true }, requestRef = { current: 0 };
  const env = { mountedRef, requestRef, useCallback: fn => fn, router: { replace: path => redirects.push(path) },
    loadCompanyDashboardData: () => reads[next++].promise,
    supabase: { auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }), signOut() { assert.fail('read failures must not sign out'); } },
      from() { const q = { select: () => q, eq: (key, value) => { q.owner = value; return q; }, maybeSingle: async () => ({ data: { id: q.owner, company_name: q.owner }, error: null }) }; return q; } },
    ...Object.fromEntries(setters.map(name => [name, value => writes.push({ name, value })])) };
  const load = new Function(...Object.keys(env), code)(...Object.values(env));
  const first = load(); await flush(); owner = 'two'; const second = load(); await flush();
  const data = { sites: [], staff: [], rotas: [], incidents: [], compliance: [], training: [], unreadMessages: 2 };
  reads[1].resolve(data); await second; const count = writes.length;
  reads[0].resolve({ ...data, unreadMessages: 99 }); await first;
  assert.equal(writes.length, count); assert.equal(writes.filter(w => w.name === 'setCompany').at(-1).value.id, 'two');
  const third = load(); await flush(); mountedRef.current = false; const closed = writes.length; reads[2].resolve(data); await third;
  assert.equal(writes.length, closed); assert.deepEqual(redirects, []);
});

test('company data errors render a retry state rather than an apparently empty successful dashboard', () => {
  const page = { exports: {} }; const react = { ...React, useState(initial) { const state = React.useState(initial); return initial === true ? [false, () => {}] : initial === '' ? ['Company dashboard data could not be loaded.', () => {}] : state; } };
  new Function('require', 'exports', compile('app/company/dashboard/CompanyDashboardClient.tsx', true))(name => {
    if (name === 'react') return react;
    if (name === 'next/navigation') return { useRouter: () => ({ replace() {} }), useSearchParams: () => new URLSearchParams() };
    if (name === '@/lib/company-dashboard-data') return mod.exports;
    if (name === '@/lib/company-navigation') return { resolveCompanyTab: () => 'overview' };
    if (name === '@/lib/supabase') return { supabase: {} };
    if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (name === '@/components/PortalSidebar') return { __esModule: true, default: () => null };
    return require(name);
  }, page.exports);
  const html = renderToStaticMarkup(React.createElement(page.exports.default));
  assert.match(html, /Company dashboard unavailable/); assert.match(html, /Retry dashboard/); assert.doesNotMatch(html, /No new messages|No sites added yet/);
});
