const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const mod = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync('lib/client-job-assignments.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mod, mod.exports);
const { loadClientJobAssignments } = mod.exports;
function fixture(results) {
  const calls = [];
  return { calls, from(table) {
    assert.ok(['job_assignments', 'client_applicant_profiles'].includes(table), 'No direct private guard reads');
    const call = { table }; calls.push(call);
    const query = { select(fields) { call.fields = fields; return query; }, eq(key, value) { call[key] = value; return query; }, in(key, value) { call[key] = value; return query; }, then(resolve, reject) { return Promise.resolve(results[table]).then(resolve, reject); } };
    return query;
  } };
}
test('client-visible profile hydrates assigned guard despite private guards being inaccessible', async () => {
  const db = fixture({job_assignments: {data: [{id:'a1', guard_id:'g1', status:'confirmed'}]}, client_applicant_profiles: {data:[{id:'g1', full_name:'Test Guard', average_rating:4.5}]}});
  const result = await loadClientJobAssignments(db, 'job-1');
  assert.equal(result[0].guards.full_name, 'Test Guard');
  assert.equal(result[0].status, 'confirmed');
  assert.deepEqual(db.calls.map(c=>c.job_id), ['job-1','job-1']);
  assert.deepEqual(db.calls[1].guard_id, ['g1']);
  assert.ok(!db.calls[1].fields.includes('phone'));
});
test('safe profile query failure is reported for drawer retry, not silently shown as unknown', async () => {
  const error = new Error('profile query failed');
  await assert.rejects(loadClientJobAssignments(fixture({job_assignments:{data:[{guard_id:'g1'}]},client_applicant_profiles:{error}}), 'j'), error);
});
test('empty assignments avoid unnecessary profile queries and missing profiles stay null', async () => {
  const db=fixture({job_assignments:{data:[]}});
  assert.deepEqual(await loadClientJobAssignments(db,'j'),[]);
  assert.equal(db.calls.length,1);
  const missing=fixture({job_assignments:{data:[{guard_id:'g1'}]},client_applicant_profiles:{data:[]}});
  assert.equal((await loadClientJobAssignments(missing,'j'))[0].guards,null);
});
