#!/usr/bin/env node
// Transform an exported HAL workflow locally. Never contacts n8n or Stripe.
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');

function hasCompletionApproval(job, assignment, requests, payouts, now = Date.now()) {
  const times = [assignment.payout_released_at, ...payouts.filter(p => p.assignment_id === assignment.id).map(p => p.created_at)].filter(Boolean);
  if (times.some(t => !Number.isFinite(Date.parse(t)))) return false;
  const cutoff = Math.min(now, ...times.map(t => Date.parse(t)));
  return requests.some(r => r.job_id === job.id && r.guard_id === assignment.guard_id && r.client_id === job.client_id && r.status === 'approved' &&
    [r.client_approved_at, r.admin_approved_at, r.auto_approved_at].some(t => t && Number.isFinite(Date.parse(t)) && Date.parse(t) <= cutoff));
}

const oldGuard = `    if(['payout_pending','payout_processing','paid_out'].includes(pay) && j.client_confirmed!==true){
      incident('PAYOUT_STATE_WITHOUT_CLIENT_APPROVAL','P0',
        \`Assignment \${a.id} entered payout state before client approval\`,j.id,a.id,{clientConfirmed:j.client_confirmed});
    }`;
const newGuard = `    if(['payout_pending','payout_processing','paid_out'].includes(pay) && !hasCompletionApproval(j,a,completionRequests,jp)){
      incident('PAYOUT_STATE_WITHOUT_CLIENT_APPROVAL','P0',
        \`Assignment \${a.id} entered payout state without timely completion approval\`,j.id,a.id,{approvalSource:'job_completion_requests'});
    }`;

function patchWorkflow(input) {
  if (input.id && input.id !== 'TG4JyKI67D1Fro4b') throw Error('Unexpected HAL workflow ID; manual review required.');
  const w = structuredClone(input);
  const reasoning = w.nodes?.find(n => n.name === 'Payout Reasoning');
  const reviews = w.nodes?.find(n => n.name === 'Load Reviews');
  const code = reasoning?.parameters?.jsCode;
  if (typeof code !== 'string' || !reviews || w.nodes.some(n => n.name === 'Load Completion Approvals') || code.split(oldGuard).length !== 2)
    throw Error('Workflow differs from the inspected payout pack; no output written.');
  const edge = w.connections?.['Merge + Reviews'];
  if (JSON.stringify(edge) !== JSON.stringify({main:[[{node:'Payout Reasoning',type:'main',index:0}]]}))
    throw Error('Unexpected payout wiring; no output written.');
  const loader = structuredClone(reviews);
  loader.id = randomUUID(); loader.name = 'Load Completion Approvals';
  loader.parameters.url = "={{ $('Build Agent Config').item.json.endpoints.supabase + '/rest/v1/job_completion_requests?select=id,job_id,guard_id,client_id,status,client_approved_at,admin_approved_at,auto_approved_at' }}";
  loader.position = [reasoning.position[0] - 200, reasoning.position[1]];
  loader.continueOnFail = false; loader.onError = 'stopWorkflow'; loader.alwaysOutputData = true;
  reasoning.parameters.jsCode = "const completionRequests=$('Load Completion Approvals').all().flatMap(i=>Array.isArray(i.json)?i.json:[i.json]).filter(r=>r?.job_id);\n" + hasCompletionApproval.toString() + '\n' + code.replace(oldGuard,newGuard);
  w.nodes.push(loader);
  w.connections['Merge + Reviews'] = {main:[[{node:loader.name,type:'main',index:0}]]};
  w.connections[loader.name] = edge;
  return w;
}

if (require.main === module) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || input === output) throw Error('Usage: node patch-payout-worker.cjs CURRENT-EXPORT.json NEW-EXPORT.json');
  const result = patchWorkflow(JSON.parse(fs.readFileSync(input,'utf8')));
  fs.writeFileSync(output, JSON.stringify(result,null,2) + '\n', { flag:'wx',mode:0o600 });
  console.log('Patched export written privately. Review and deploy through HAL; no workflow executed.');
}
module.exports = { patchWorkflow, hasCompletionApproval, oldGuard };
