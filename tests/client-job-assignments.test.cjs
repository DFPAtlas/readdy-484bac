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
    assert.equal(table, 'job_assignments', 'Browser must not query private guard records');
    const call = { table }; calls.push(call);
    const query = { select(fields) { call.fields = fields; return query; }, eq(key, value) { call[key] = value; return query; }, then(resolve, reject) { return Promise.resolve(results[table]).then(resolve, reject); } };
    return query;
  }, functions: { async invoke(name, options) { calls.push({ function: name, body: options.body }); return results.profiles; } } };
}
test('assigned profile hydrates inactive guard without requiring a visible application', async () => {
  const db = fixture({job_assignments: {data: [{id:'a1', guard_id:'g1', status:'confirmed'}]}, profiles: {data:{profiles:[{id:'g1', full_name:'Test Guard', rating:4.5, is_active:false, profile_image_url:'test-image'}]}}});
  const result = await loadClientJobAssignments(db, 'job-1');
  assert.equal(result[0].guards.full_name, 'Test Guard');
  assert.equal(result[0].guards.average_rating, 4.5);
  assert.equal(result[0].guards.profile_photo_url, 'test-image');
  assert.equal(result[0].guards.is_active, false);
  assert.equal(result[0].guards.phone, null);
  assert.equal(result[0].guards.sia_licence_front_url, null);
  assert.equal(result[0].status, 'confirmed');
  assert.equal(db.calls[0].job_id, 'job-1');
  assert.equal(db.calls[1].function, 'get-client-assigned-guards');
  assert.deepEqual(db.calls[1].body, {job_id:'job-1'});
});
test('failed or malformed profile responses produce retryable errors, not unknown guards', async () => {
  for (const profiles of [{error:new Error('endpoint failed')}, {data:{}}, {data:{profiles:[]}}]) {
    await assert.rejects(loadClientJobAssignments(fixture({job_assignments:{data:[{guard_id:'g1'}]},profiles}), 'j'), /profile/i);
  }
});
test('empty assignments avoid unnecessary profile calls and failed assignment reads are explicit', async () => {
  const db=fixture({job_assignments:{data:[]}});
  assert.deepEqual(await loadClientJobAssignments(db,'j'),[]);
  assert.equal(db.calls.length,1);
  const error=new Error('assignment read failed');
  await assert.rejects(loadClientJobAssignments(fixture({job_assignments:{error}}),'j'),error);
});

test('private document redaction does not imply the licence documents were never uploaded', () => {
  const code = ts.transpileModule(fs.readFileSync('app/client/jobs/[id]/compliance/useCompliance.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const complianceModule = { exports: {} };
  new Function('module', 'exports', code)(complianceModule, complianceModule.exports);
  const input = { id: 'g1', full_name: 'Synthetic Guard', sia_verified: true, sia_expiry_date: '2099-12-31', sia_licence_number: 'TEST-LICENCE', verification_status: 'approved', profile_completed: true, licence_documents_private: true };
  const result = complianceModule.exports.computeComplianceInfo(input);
  assert.equal(result.siaStatus, 'valid');
  assert.equal(result.attentionReasons.includes('Licence documents not uploaded'), false);
  const missing = complianceModule.exports.computeComplianceInfo({ ...input, sia_licence_number: null, sia_verified: false });
  assert.equal(missing.siaStatus, 'missing');
});
