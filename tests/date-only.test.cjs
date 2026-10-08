const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const compiled = ts.transpileModule(fs.readFileSync('lib/date-only.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', compiled)(mod, mod.exports);
const { formatDateOnly, inclusiveDateOnlyDays } = mod.exports;

test('database dates stay on the same calendar day', () => {
  assert.equal(formatDateOnly('2026-10-08', { day: 'numeric', month: 'short' }), '8 Oct');
  assert.equal(formatDateOnly('2026-10-08T00:00:00.000Z', { day: 'numeric', month: 'short' }), '8 Oct');
});

test('missing and invalid dates are not guessed', () => {
  assert.equal(formatDateOnly(null), '—');
  assert.equal(formatDateOnly('2026-02-31'), '—');
});

test('inclusive date-only arithmetic is stable across DST boundaries', () => {
  assert.equal(inclusiveDateOnlyDays('2026-10-08', '2026-10-08'), 1);
  assert.equal(inclusiveDateOnlyDays('2026-10-24', '2026-10-26'), 3);
  assert.equal(inclusiveDateOnlyDays('invalid', '2026-10-08'), 1);
});

test('financial UAT booking surfaces use timezone-safe date-only formatting', () => {
  const sources = [
    'app/client/post-job/StepReviewPost.tsx',
    'app/client/post-job/DuplicateJobModal.tsx',
    'app/guard/dashboard/RecommendedJobsPanel.tsx',
    'app/guard/dashboard/GuardDashboardClient.tsx',
    'app/client/jobs/[id]/select-guards/ApplicantDashboardHeader.tsx',
    'app/client/jobs/[id]/select-guards/ConfirmSelectionModal.tsx',
    'app/client/jobs/[id]/select-guards/ConfirmModal.tsx',
  ].map((file) => fs.readFileSync(file, 'utf8'));

  for (const source of sources) assert.match(source, /formatDateOnly/);
  assert.doesNotMatch(sources[0], /new Date\(formData\.(?:startDate|endDate)\)/);
  assert.doesNotMatch(sources[1], /new Date\(job\.start_date\)/);
  assert.doesNotMatch(sources[2], /new Date\(job\.start_date\)/);
  assert.doesNotMatch(sources[3], /new Date\(\(nextShift\.jobs as any\)\?\.start_date\)/);
  for (const source of sources.slice(4)) {
    assert.doesNotMatch(source, /new Date\(job\.(?:start_date|end_date)\)/);
  }
});

test('job date displays cannot bypass the shared date-only formatter', () => {
  const roots = ['app', 'components'];
  const sourceFiles = [];
  const visit = (entry) => {
    for (const child of fs.readdirSync(entry, { withFileTypes: true })) {
      const childPath = path.join(entry, child.name);
      if (child.isDirectory()) visit(childPath);
      else if (/\.(?:ts|tsx)$/.test(child.name)) sourceFiles.push(childPath);
    }
  };
  roots.forEach(visit);

  const unsafeDirectFormat = /new Date\([^\n]*(?:\.start_date|\.end_date)[^\n]*\)\.toLocaleDateString/;
  const offenders = sourceFiles.filter((file) => unsafeDirectFormat.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);

  const delegatedJobDateFiles = sourceFiles.filter((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return /format(?:Date|ShortDate|LongDate)\([^\n]*(?:\.start_date|\.end_date)/.test(source);
  });
  const missingSharedFormatter = delegatedJobDateFiles.filter(
    (file) => !fs.readFileSync(file, 'utf8').includes('formatDateOnly')
  );
  assert.deepEqual(missingSharedFormatter, []);
});
