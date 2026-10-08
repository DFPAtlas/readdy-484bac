const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const compiled = ts.transpileModule(fs.readFileSync('lib/date-only.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', compiled)(mod, mod.exports);
const { formatDateOnly } = mod.exports;

test('database dates stay on the same calendar day', () => {
  assert.equal(formatDateOnly('2026-10-08', { day: 'numeric', month: 'short' }), '8 Oct');
  assert.equal(formatDateOnly('2026-10-08T00:00:00.000Z', { day: 'numeric', month: 'short' }), '8 Oct');
});

test('missing and invalid dates are not guessed', () => {
  assert.equal(formatDateOnly(null), '—');
  assert.equal(formatDateOnly('2026-02-31'), '—');
});

test('financial UAT booking surfaces use timezone-safe date-only formatting', () => {
  const sources = [
    'app/client/post-job/StepReviewPost.tsx',
    'app/client/post-job/DuplicateJobModal.tsx',
    'app/guard/dashboard/RecommendedJobsPanel.tsx',
    'app/guard/dashboard/GuardDashboardClient.tsx',
  ].map((file) => fs.readFileSync(file, 'utf8'));

  for (const source of sources) assert.match(source, /formatDateOnly/);
  assert.doesNotMatch(sources[0], /new Date\(formData\.(?:startDate|endDate)\)/);
  assert.doesNotMatch(sources[1], /new Date\(job\.start_date\)/);
  assert.doesNotMatch(sources[2], /new Date\(job\.start_date\)/);
  assert.doesNotMatch(sources[3], /new Date\(\(nextShift\.jobs as any\)\?\.start_date\)/);
});
