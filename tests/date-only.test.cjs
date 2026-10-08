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
