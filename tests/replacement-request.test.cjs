const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');

function harness(file, initial, mocks = {}) {
  const states = [...initial]; let index = 0;
  const hooks = {...React, useEffect() {}, useState(value) { const i = index++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value; return [states[i], next => states[i] = typeof next === 'function' ? next(states[i]) : next]; }};
  const module = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  new Function('module','exports','require','setTimeout',code)(module,module.exports,name => name === 'react' ? hooks : name in mocks ? mocks[name] : require(name),()=>{});
  return {states,render(props) { index=0; return module.exports.default(props); }};
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree,...nodes(tree.props?.children)];
}
function text(tree) { if(Array.isArray(tree)) return tree.map(text).join(''); if(tree && typeof tree==='object') return text(tree.props?.children); return tree == null || typeof tree === 'boolean' ? '' : String(tree); }
function button(tree,label) {const match=nodes(tree).find(n=>n.type==='button' && text(n).trim()===label); assert.ok(match,`missing ${label}`);return match;}
const dir='app/client/jobs/[id]/';
const common={'@/lib/attendance-display.cjs':require('../lib/attendance-display.cjs'),'@/lib/date-only':{formatDateOnly:value=>value||'—'},'next/navigation':{useRouter:()=>({push(){}})},'next/link':{default:()=>null}};

test('replacement card passes the chosen guard to the required request action',()=>{
  const selected=[];
  const h=harness(dir+'ReplacementGuardSuggestions.tsx',[false,[{id:'candidate',full_name:'Preferred Guard'}],true,''],{...common,'@/lib/supabase':{supabase:{}}});
  const tree=h.render({jobId:'job',job:{},currentAssignments:[],onRequestReplacement:(...args)=>selected.push(args)});
  button(tree,'Request guard').props.onClick();
  assert.deepEqual(selected,[['candidate','Preferred Guard']]);
  assert.ok(!text(tree).includes('Approve'));
});

test('suggestion query errors are visible and Refresh performs a new search',async()=>{
  let calls=0;
  const db={from(){calls++;const q={};for(const method of ['select','eq','not','limit'])q[method]=()=>q;q.then=(resolve)=>Promise.resolve({data:null,error:{message:'query failed'}}).then(resolve);return q;}};
  const h=harness(dir+'ReplacementGuardSuggestions.tsx',[false,[],false,''],{...common,'@/lib/supabase':{supabase:db}});
  const props={jobId:'job',job:{},currentAssignments:[],onRequestReplacement(){}};
  await button(h.render(props),'Find Replacements').props.onClick();
  assert.equal(calls,1);assert.match(text(h.render(props)),/could not be loaded/);
  h.states[1]=[{id:'candidate',full_name:'Guard'}];h.states[2]=true;
  await button(h.render(props),'Refresh').props.onClick();
  assert.equal(calls,2);
});

function modal(assignmentId='original',failed=false) {
  const writes=[];const routed=[];
  const db={auth:{getUser:async()=>({data:{user:{id:'client-user'}}})},from(table){return {insert(payload){writes.push({table,payload});return {select(){return {single:async()=>({data:failed?null:{id:'request'},error:failed?{message:'Could not save'}:null})}}};},update(){return {eq:async()=>({error:null})};}};}};
  const h=harness(dir+'ReplacementRequestModal.tsx',[assignmentId,'urgent','no_show','18:00','Extra instructions','',false,'',false,2,true],{...common,'@/lib/supabase':{supabase:db},'@/lib/support-routing':{routeTicketToCommandCentre:async(id)=>{routed.push(id);return {ok:true};}}});
  const props={jobId:'job',jobTitle:'Test shift',clientId:'client',preferredGuard:{id:'candidate',fullName:'Preferred Guard'},assignmentOptions:[{id:'original',guardId:'absent',guardName:'Absent Guard'},{id:'other',guardId:'late',guardName:'Late Guard'}],onClose(){},onSuccess(){}};
  return {h,props,writes,routed};
}
test('request persists the preferred guard while retaining the original assignment and guard',async()=>{
  const {h,props,writes,routed}=modal();
  await button(h.render(props),'Request Replacement').props.onClick();
  assert.deepEqual(routed,['request'],'replacement ticket is handed to the Command Centre');
  const request=writes.find(w=>w.table==='replacement_requests').payload;
  assert.equal(request.assignment_id,'original');assert.equal(request.guard_id,'absent');assert.equal(request.status,'requested');
  assert.match(request.notes,/Preferred Guard.*candidate/);assert.match(request.notes,/Extra instructions/);
  assert.match(writes.find(w=>w.table==='support_tickets').payload.description,/Preferred Guard.*candidate/);
  assert.equal(h.states[8],true);
});
test('multiple affected guards require an explicit assignment choice',async()=>{
  const {h,props,writes}=modal('');
  await button(h.render(props),'Request Replacement').props.onClick();
  assert.equal(writes.length,0);assert.match(h.states[7],/select the guard/);assert.equal(h.states[8],false);
});
test('failed request insert does not report success or create follow-up writes',async()=>{
  const {h,props,writes}=modal('original',true);
  await button(h.render(props),'Request Replacement').props.onClick();
  assert.equal(writes.length,1);assert.equal(h.states[8],false);assert.equal(h.states[7],'Could not save');
});

test('attendance panel opens the request modal with the candidate and affected assignment choices',()=>{
  const Suggestions=()=>null, Modal=()=>null;
  const mocks={...common,'@/lib/supabase':{supabase:{}},'./ReplacementGuardSuggestions':{default:Suggestions},'./ReplacementRequestModal':{default:Modal}};
  for(const name of ['GuardAttendanceCard','AttendanceSummary','AttendanceWarnings','ReplacementStatusTracker'])mocks['./'+name]={default:()=>null};
  const h=harness(dir+'AttendancePanel.tsx',[],mocks);
  const affected={id:'original',guard_id:'absent',attendance_status:'no_show',guards:{id:'absent',full_name:'Absent Guard'}};
  const props={job:{id:'job',job_title:'Shift',status:'in_progress'},assignments:[affected],clientId:'client'};
  nodes(h.render(props)).find(n=>n.type===Suggestions).props.onRequestReplacement('candidate','Preferred Guard');
  const modalProps=nodes(h.render(props)).find(n=>n.type===Modal).props;
  assert.deepEqual(modalProps.preferredGuard,{id:'candidate',fullName:'Preferred Guard'});
  assert.equal(modalProps.assignmentId,'original');assert.equal(modalProps.guardId,'absent');
  props.assignments.push({...affected,id:'other',guard_id:'late',attendance_status:'late'});
  nodes(h.render(props)).find(n=>n.type===Suggestions).props.onRequestReplacement('second','Second Guard');
  const multiple=nodes(h.render(props)).find(n=>n.type===Modal).props;
  assert.equal(multiple.assignmentId,undefined);assert.equal(multiple.assignmentOptions.length,2);
});
