const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path) {
  const result = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('module', 'exports', js)(result, result.exports);
  return result.exports;
}
const { recommendedFeaturePlan, planIncludesFeature, featurePlanNames } = load('lib/plan-catalogue.ts');
const { resolveCompanyTab, companyTabHref } = load('lib/company-navigation.ts');
const starter = { slug: 'client-starter', name: 'Starter', monthly_price_pence: 4900, features: ['client.job_history', 'client.job_tracker'] };
const pro = { slug: 'client-pro', name: 'Pro', monthly_price_pence: 9900, features: JSON.stringify(['client.job_history', 'client.job_tracker']) };
const basic = { slug: 'guard-basic', name: 'Basic', monthly_price_pence: 1000, features: ['guard.profile_boost'] };

test('recommend the cheapest configured eligible plan and preserve access already owned', () => {
  assert.equal(recommendedFeaturePlan([pro, starter], 'client.job_history'), 'client-starter');
  assert.equal(recommendedFeaturePlan([pro, starter], 'client.job_tracker', starter), 'client-starter');
  assert.equal(recommendedFeaturePlan([pro, starter], 'client.job_history', pro), 'client-pro');
  assert.equal(recommendedFeaturePlan([basic], 'guard.profile_boost'), 'guard-basic');
  assert.equal(featurePlanNames([starter, pro], 'client.job_history'), 'Starter, Pro');
  assert.equal(planIncludesFeature({ ...starter, features: 'malformed' }, 'client.job_history'), false);
  assert.equal(recommendedFeaturePlan([starter], 'unconfigured.feature'), '');
});

test('company navigation maps only known tabs to the existing dashboard route', () => {
  for (const tab of ['sites', 'staff', 'billing', 'messages', 'settings']) {
    const href = companyTabHref(resolveCompanyTab(tab));
    const url = new URL(href, 'https://quickguard.uk');
    assert.equal(url.pathname, '/company/dashboard');
    assert.equal(url.searchParams.get('tab'), tab);
  }
  for (const value of [null, 'sites/new', '../../admin', 'https://example.test']) assert.equal(resolveCompanyTab(value), 'overview');
});
