const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, mocks = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('module', 'exports', 'require', code)(mod, mod.exports, name => name in mocks ? mocks[name] : require(name));
  return mod.exports;
}
const links = load('lib/job-links.ts');
const id = 'a0cc62ce-7cf8-4c14-be5f-c285818204a9';

test('historic job notifications resolve to permanent public, guard and client pages', () => {
  for (const [prefix, actions] of Object.entries({ '': ['detail'], 'guard/': ['detail', 'apply'], 'client/': ['detail', 'payment', 'confirmation', 'select-guards'] })) {
    for (const action of actions) {
      const suffix = action === 'detail' ? '' : `/${action}`;
      const result = new URL(links.normalizeJobLink(`/${prefix}jobs/${id}${suffix}?cancelled=1#booking`), 'https://quickguard.uk');
      assert.equal(result.pathname, `/${prefix}jobs/${action === 'select-guards' ? 'applicants' : action}`);
      assert.equal(result.searchParams.get('id'), id);
      assert.equal(result.searchParams.get('cancelled'), '1');
      assert.equal(result.hash, '#booking');
      assert.ok(fs.existsSync(`app${result.pathname}/page.tsx`), `missing page ${result.pathname}`);
    }
  }
});

test('normalization leaves unrelated, permanent and external links unchanged', () => {
  for (const link of ['/client/jobs', '/jobs/detail?id=test', '/jobs/tracker', '/guard/dashboard', 'https://outside.invalid/jobs/' + id, '//outside.invalid/jobs/' + id]) {
    assert.equal(links.normalizeJobLink(link), link);
  }
  const redirect = load('lib/safe-redirect.ts', { './job-links': links });
  assert.equal(redirect.sanitizeRedirectPath(`/client/jobs/${id}/payment?cancelled=1`, 'client'), `/client/jobs/payment?cancelled=1&id=${id}`);
  assert.equal(redirect.sanitizeRedirectPath('//outside.invalid/jobs/' + id, 'client'), '/client/dashboard');
});

test('client notification renders an existing saved applicant link as a permanent route', () => {
  const Link = ({ children, ...props }) => React.createElement('a', props, children);
  const Badge = () => null;
  const Card = load('app/client/notifications/NotificationCard.tsx', {
    '@/lib/job-links': links, 'next/link': { default: Link }, './CategoryBadge': { default: Badge }, './PriorityBadge': { default: Badge },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Card, {
    id: 'notification', title: 'New application', message: 'Review applicant', category: 'jobs', priority: 1,
    is_read: false, created_at: new Date().toISOString(), link: `/client/jobs/${id}/select-guards`,
  }));
  assert.match(html, new RegExp(`href="/client/jobs/applicants\\?id=${id}"`));
});

test('job URL producers never generate build-time dynamic job paths', () => {
  function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const file = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(file) : /\.tsx?$/.test(file) ? [file] : [];
    });
  }
  for (const file of ['app', 'components', 'lib', 'supabase/functions'].flatMap(walk)) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\/(?:client\/|guard\/)?jobs\/\$\{(?!route\})/, file);
  }
  const checkout = fs.readFileSync('supabase/functions/create-job-payment/index.ts', 'utf8');
  assert.match(checkout, /cancel_url:.*\/client\/jobs\/payment\?id=\$\{encodeURIComponent\(jobId\)\}&cancelled=1/);
});
