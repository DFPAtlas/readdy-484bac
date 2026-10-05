const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const code = ts.transpileModule(fs.readFileSync('lib/relations.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const sandbox = { exports: {} };
vm.runInNewContext(code, sandbox);
const { oneRelation, requiredRelation } = sandbox.exports;

test('to-one embeds support PostgREST object and array shapes without dropping row fields', () => {
  const job = { id: 'job-1', job_title: 'Night shift', clients: { company_name: 'Test client' } };
  assert.equal(requiredRelation(job), job);
  assert.equal(requiredRelation([job]), job);
  assert.equal(requiredRelation(requiredRelation([job]).clients).company_name, 'Test client');
});

test('absent optional embeds stay null for safe fallback rendering', () => {
  for (const missing of [null, undefined, []]) assert.equal(oneRelation(missing), null);
});

test('a missing required embed fails rather than creating a fictitious job or client', () => {
  for (const missing of [null, undefined, []]) assert.throws(() => requiredRelation(missing), /Required related record/);
});
