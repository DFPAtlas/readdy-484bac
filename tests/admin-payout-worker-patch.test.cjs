const { test } = require('node:test');
const assert = require('node:assert/strict');
const { patchWorkflow, hasCompletionApproval, oldGuard } = require('../scripts/ops/patch-payout-worker.cjs');
const job={id:'job',client_id:'client',client_confirmed:false};
const assignment={id:'assignment',guard_id:'guard',payout_released_at:'2026-10-08T15:00:00Z'};
const approved={job_id:'job',guard_id:'guard',client_id:'client',status:'approved',client_approved_at:'2026-10-08T14:59:00Z'};
test('completion approval replaces booking confirmation and must precede payout initiation',()=>{
  assert.equal(hasCompletionApproval(job,assignment,[approved],[]),true);
  assert.equal(hasCompletionApproval(job,assignment,[approved],[{assignment_id:'assignment',created_at:'2026-10-08T14:58:00Z'}]),false);
  for(const change of [{status:'pending'},{guard_id:'other'},{client_id:'other'},{job_id:'other'},{client_approved_at:null},{client_approved_at:'bad'},{client_approved_at:'2026-10-08T15:01:00Z'}])
    assert.equal(hasCompletionApproval({...job,client_confirmed:true},assignment,[{...approved,...change}],[]),false);
  assert.equal(hasCompletionApproval(job,assignment,[{...approved,client_approved_at:null,admin_approved_at:approved.client_approved_at}],[]),true);
});
test('local patch preserves unrelated nodes and stops rather than reporting success after approval read errors',()=>{
  const current={id:'TG4JyKI67D1Fro4b',nodes:[{name:'Load Reviews',parameters:{url:'old',headerParameters:{parameters:[{name:'Accept-Profile',value:'app'}]}},continueOnFail:true},{name:'Payout Reasoning',parameters:{jsCode:oldGuard},position:[1,2]},{name:'Untouched',parameters:{value:42}}],connections:{'Merge + Reviews':{main:[[{node:'Payout Reasoning',type:'main',index:0}]]}}};
  const result=patchWorkflow(current), loader=result.nodes.find(n=>n.name==='Load Completion Approvals');
  assert.equal(loader.continueOnFail,false);assert.equal(loader.onError,'stopWorkflow');assert.equal(loader.alwaysOutputData,true);
  assert.match(loader.parameters.url,/job_completion_requests\?select=id,job_id,guard_id,client_id,status/);
  assert.deepEqual(result.nodes[2],current.nodes[2]);assert.equal(current.nodes.length,3);
  assert.match(result.nodes[1].parameters.jsCode,/!hasCompletionApproval\(j,a,completionRequests,jp\)/);
  assert.doesNotMatch(result.nodes[1].parameters.jsCode,/j.client_confirmed!==true/);
  assert.throws(()=>patchWorkflow(result),/differs/);
  assert.throws(()=>patchWorkflow({...current,id:'other'}),/Unexpected/);
  assert.throws(()=>patchWorkflow({...current,connections:{}}),/wiring/);
});
