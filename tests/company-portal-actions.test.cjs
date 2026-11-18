const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, dependencies = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'exports', code)(name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), mod.exports);
  return mod.exports;
}

const contact = load('lib/contact-enquiry.ts');
const link = { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };

function companyTab(tab, unread = 0, subscriptionStatus = '') {
  const company = { id: 'company-fixture', company_name: 'Example company', total_revenue: 0, subscription_status: subscriptionStatus };
  const hooks = { ...React, useState(initial) {
    const state = React.useState(initial);
    if (initial === null) return [company, () => {}];
    if (initial === true) return [false, () => {}];
    if (initial === 'overview') return [tab, () => {}];
    if (initial === 0) return [unread, () => {}];
    return state;
  } };
  const page = load('app/company/dashboard/CompanyDashboardClient.tsx', {
    react: hooks,
    'next/navigation': { useRouter: () => ({ replace() {} }), useSearchParams: () => new URLSearchParams({ tab }) },
    'next/link': link,
    '@/lib/supabase': { supabase: {} },
    '@/lib/company-dashboard-data': { loadCompanyDashboardData() { assert.fail('Rendering must not fetch data'); } },
    '@/lib/company-navigation': load('lib/company-navigation.ts'),
    '@/components/PortalSidebar': { __esModule: true, default: () => null },
  });
  return renderToStaticMarkup(React.createElement(page.default));
}

test('company reports are labelled as planned with a support destination instead of dead controls', () => {
  const html = companyTab('reports');
  assert.match(html, /report generation and downloads are not available/);
  assert.equal((html.match(/>Planned<\/p>/g) || []).length, 6);
  assert.match(html, /href="\/contact\?subject=company-reports"/);
});

test('company billing shows recorded status without fabricating a Free plan or a billing-management link', () => {
  const missing = companyTab('billing');
  assert.match(missing, /Recorded Subscription Status/);
  assert.match(missing, />Not recorded<\/p>/);
  assert.doesNotMatch(missing, />Free<\/p>|Manage Billing/);
  assert.match(missing, /href="\/contact\?subject=company-billing"/);
  assert.match(companyTab('billing', 0, 'active'), />active<\/p>/);
});

test('company message view describes its count-only capability for empty and non-empty accounts', () => {
  assert.match(companyTab('messages'), /No unread messages recorded/);
  const html = companyTab('messages', 2);
  assert.match(html, /2 unread messages/);
  assert.match(html, /Reading and replying to messages are not available/);
  assert.doesNotMatch(html, /Check your messages for updates/);
  assert.match(html, /href="\/contact\?subject=company-messages"/);
});

test('every company support destination resolves to an editable contact form with the intended context', async () => {
  const companySource = fs.readFileSync('app/company/dashboard/CompanyDashboardClient.tsx', 'utf8');
  const topics = [...new Set([...companySource.matchAll(/\/contact\?subject=(company-[a-z-]+)/g)].map(match => match[1]))];
  const ContactClient = load('app/contact/ContactClient.tsx', {
    '../../components/Footer': { __esModule: true, default: () => null },
    '../../components/NavSidebar': { __esModule: true, default: () => null },
    './ContactSchema': { __esModule: true, default: () => null },
    '@/lib/customer-guidance': { HUMAN_SUPPORT_HOURS: 'Mon–Fri 9AM–6PM' },
    '@/lib/supabase': { supabase: new Proxy({}, { get() { assert.fail('Rendering must not submit a request'); } }) },
  }).default;
  const page = load('app/contact/page.tsx', {
    './ContactClient': { __esModule: true, default: ContactClient },
    './ContactSchema': { __esModule: true, default: () => null },
    '@/lib/contact-enquiry': contact,
  }).default;
  assert.equal(topics.length, 10);
  for (const topic of topics) {
    const enquiry = contact.getContactEnquiry(topic);
    assert.ok(enquiry.subject); assert.ok(enquiry.category);
    const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ subject: topic }) }));
    assert.ok(html.includes(`value="${enquiry.subject}"`));
    assert.ok(html.includes(`name="category" value="${enquiry.category}"`));
    assert.doesNotMatch(html, /readOnly|readonly/);
    assert.match(html, /name="name"[^>]*value=""/);
    assert.match(html, /name="email"[^>]*value=""/);
  }
  assert.equal(contact.getContactEnquiry('company-billing').category, 'Billing');
});

test('unknown or repeated contact query values cannot inject a subject or select an inherited property', () => {
  for (const topic of [undefined, null, ['company-billing', 'company-reports'], '__proto__', 'constructor', '<script>alert(1)</script>', 'https://example.test']) {
    assert.deepEqual(contact.getContactEnquiry(topic), { subject: '', category: '' });
  }
});
