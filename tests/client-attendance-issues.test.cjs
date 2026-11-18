const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const compile = source => ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
function load(file,mocks={},globals={}) {const module={exports:{}};new Function('module','exports','require',...Object.keys(globals),compile(fs.readFileSync(file,'utf8')))(module,module.exports,name=>name in mocks?(mocks[name]?.default?{...mocks[name],__esModule:true}:mocks[name]):require(name),...Object.values(globals));return module.exports;}
const server=load('supabase/functions/_shared/client-attendance-issue.ts');
const frontend=load('lib/client-attendance-issues.ts');
const ids={clientId:'11111111-1111-4111-8111-111111111111',jobId:'22222222-2222-4222-8222-222222222222',assignmentId:'33333333-3333-4333-8333-333333333333'};
const assignment={id:ids.assignmentId,job_id:ids.jobId,status:'confirmed',attendance_status:'confirmed',check_in_time:null,check_out_time:null,updated_at:'2026-11-18T10:00:00Z'};
const saved={...assignment,issue_reported:true,issue_type:'other',issue_notes:'notes'};
const issue={type:'other',notes:' notes '};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};

function database(custom=()=>undefined,row=assignment) {
  const calls=[];
  const db={from(table){const call={table,filters:[]};calls.push(call);const q={};for(const method of ['eq','is','select'])q[method]=(...args)=>{call.filters.push([method,...args]);return q;};q.update=changes=>{call.changes=changes;return q;};q.maybeSingle=async()=>{
    const overridden=await custom(call,calls.length-1);if(overridden!==undefined)return overridden;
    return{data:table==='account_closures'?null:table==='clients'?{id:ids.clientId}:table==='jobs'?{id:ids.jobId,client_id:ids.clientId,is_deleted:false}:call.changes?{...row,...call.changes}:row,error:null};
  };return q;}};
  return{db,calls,writes:()=>calls.filter(c=>c.changes)};
}
const record=(db,body={...ids,issue})=>server.recordClientAttendanceIssue(db,'user',body);

test('server verifies open account and ownership, scopes and acknowledges exactly one issue update',async()=>{
  const h=database();const row=await record(h.db);
  assert.equal(row.issue_type,'other');assert.equal(row.issue_notes,'notes');assert.equal(row.attendance_status,'confirmed');
  assert.equal(h.writes().length,1);
  assert.deepEqual(h.calls[0].filters,[['select','user_id'],['eq','user_id','user']]);
  assert.ok(h.calls[1].filters.some(f=>JSON.stringify(f)===JSON.stringify(['eq','user_id','user'])));
  assert.ok(h.calls[2].filters.some(f=>JSON.stringify(f)===JSON.stringify(['eq','client_id',ids.clientId])));
  assert.ok(h.writes()[0].filters.some(f=>JSON.stringify(f)===JSON.stringify(['eq','job_id',ids.jobId])));
  assert.ok(h.writes()[0].filters.some(f=>JSON.stringify(f)===JSON.stringify(['eq','updated_at',assignment.updated_at])));
  assert.deepEqual(Object.keys(h.writes()[0].changes).sort(),['issue_notes','issue_reported','issue_type','updated_at']);
});

test('server rejects closed accounts, foreign clients/jobs/assignments and deleted jobs before writing',async()=>{
  const cases=[['account_closures',{user_id:'user'}],['clients',null],['clients',{id:'foreign'}],['jobs',null],['jobs',{id:ids.jobId,client_id:'foreign',is_deleted:false}],['jobs',{id:ids.jobId,client_id:ids.clientId,is_deleted:true}],['job_assignments',null],['job_assignments',{...assignment,job_id:'foreign'}]];
  for(const[table,data]of cases){const h=database(call=>call.table===table?{data}:undefined);await assert.rejects(record(h.db));assert.equal(h.writes().length,0);}
});

test('missing identity and malformed/oversized issue requests cannot reach database writes',async()=>{
  for(const body of [null,{}, {...ids,issue:undefined},{...ids,assignmentId:'bad',issue},{...ids,issue:{type:'payment_status',notes:''}},{...ids,issue:{type:'other',notes:123}},{...ids,issue:{type:'other',notes:'x'.repeat(501)}}]){
    const h=database();await assert.rejects(record(h.db,body));assert.equal(h.calls.length,0);
  }
  const h=database();await assert.rejects(server.recordClientAttendanceIssue(h.db,'',{...ids,issue}));assert.equal(h.calls.length,0);
});

test('returned and thrown failures at each server stage fail closed; empty/wrong acknowledgements never succeed',async()=>{
  for(let stage=0;stage<5;stage++)for(const thrown of [false,true]){
    const h=database((_call,n)=>{if(n!==stage)return;if(thrown)throw Error('private');return{data:null,error:{message:'private'}};});
    await assert.rejects(record(h.db));assert.equal(h.calls.length,stage+1);assert.equal(h.writes().length,stage===4?1:0);
  }
  for(const data of [null,{...saved,id:'foreign'},{...saved,job_id:'foreign'},{...saved,issue_reported:false},{...saved,issue_notes:'wrong'}]){
    const h=database(call=>call.changes?{data}:undefined);await assert.rejects(record(h.db),e=>e.status===409);
  }
});

test('all report types and resolution write only their allowed fields and preserve recorded attendance evidence',async()=>{
  for(const type of ['no_show','late','poor_performance','other']){
    const h=database();await record(h.db,{...ids,issue:{type,notes:''},payment_status:'paid',status:'completed'});
    assert.equal(h.writes()[0].changes.attendance_status,['no_show','late'].includes(type)?type:undefined);
    assert.equal(h.writes()[0].changes.status,undefined);assert.equal(h.writes()[0].changes.payment_status,undefined);
  }
  for(const evidence of [{check_in_time:'2026-11-18T10:01:00Z'}, {check_out_time:'2026-11-18T18:00:00Z'}, {attendance_status:'checked_in'}, {attendance_status:'checked_out'}, {attendance_status:'completed'}, {status:'completed'}, {status:'cancelled'}]){
    const h=database(()=>undefined,{...assignment,...evidence});await record(h.db,{...ids,issue:{type:'no_show',notes:''}});assert.equal(h.writes()[0].changes.attendance_status,undefined);
  }
  const h=database();const result=await record(h.db,{...ids,issue:null});assert.equal(result.issue_reported,false);assert.equal(result.issue_type,null);assert.equal(result.issue_notes,null);assert.equal(h.writes()[0].changes.attendance_status,undefined);
  const nullable=database(()=>undefined,{...assignment,updated_at:null});await record(nullable.db);assert.ok(nullable.writes()[0].filters.some(f=>f[0]==='is'&&f[1]==='updated_at'&&f[2]===null));
});

test('browser helper requires authentication and a matching acknowledged saved row',async()=>{
  let invoked=0;
  for(const result of [{error:{message:'denied'}},{data:{success:false}},{data:{success:true,assignment:null}},{data:{success:true,assignment:{...saved,id:'foreign'}}},{data:{success:true,assignment:{...saved,issue_notes:'wrong'}}}]){
    const db={auth:{getUser:async()=>({data:{user:{id:'user'}}})},functions:{invoke:async()=>{invoked++;return result;}}};await assert.rejects(frontend.saveClientAttendanceIssue(db,ids,issue));
  }
  assert.equal(invoked,5);
  let alive=true;const response=deferred();const calls=[];
  const db={auth:{getUser:async()=>({data:{user:{id:'user'}}})},functions:{invoke:async(...args)=>{calls.push(args);return response.promise;}}};
  const pending=frontend.saveClientAttendanceIssue(db,ids,issue,()=>alive);await Promise.resolve();alive=false;response.resolve({data:{success:true,assignment:saved}});await assert.rejects(pending);
  assert.equal(calls[0][0],'client-attendance-issue');assert.deepEqual(calls[0][1].body,{...ids,issue});
  const unauth={auth:{getUser:async()=>({data:{user:null}})},functions:{invoke:()=>assert.fail('unauthenticated invocation')}};await assert.rejects(frontend.saveClientAttendanceIssue(unauth,ids,issue));
  const ok={auth:db.auth,functions:{invoke:async()=>({data:{success:true,assignment:saved}})}};assert.deepEqual(await frontend.saveClientAttendanceIssue(ok,ids,issue),saved);
});

function nodes(tree){if(Array.isArray(tree))return tree.flatMap(nodes);if(!tree||typeof tree!=='object')return[];return[tree,...nodes(tree.props?.children)];}
function text(tree){if(Array.isArray(tree))return tree.map(text).join('');if(tree&&typeof tree==='object')return text(tree.props?.children);return tree==null||typeof tree==='boolean'?'':String(tree);}
function button(tree,label){const node=nodes(tree).find(n=>n.type==='button'&&text(n).trim()===label);assert.ok(node,`missing ${label}`);return node;}
const Card=()=>null;
const panelProps={job:{id:ids.jobId,client_id:ids.clientId,status:'in_progress'},clientId:ids.clientId,assignments:[{...assignment,guards:{id:'guard',full_name:'Guard'}}]};
function panel(save=async()=>saved){
  const slots=[],effects=[],timers=new Map(),calls=[],applied=[];let cursor=0,writes=0,serial=0;
  const hooks={...React,useState(initial){const n=cursor++;if(!(n in slots))slots[n]=typeof initial==='function'?initial():initial;return[slots[n],value=>{writes++;slots[n]=typeof value==='function'?value(slots[n]):value;}];},useRef(initial){const n=cursor++;if(!(n in slots))slots[n]={current:initial};return slots[n];},useEffect(fn){const n=cursor++;if(!effects[n])effects[n]={cleanup:fn()};}};
  const mocks={'react':hooks,'next/navigation':{useRouter:()=>({push(){}})},'@/lib/supabase':{supabase:{}},'@/lib/client-attendance-issues':{saveClientAttendanceIssue:async(...args)=>{calls.push(args);return save(...args);}},'@/lib/attendance-display.cjs':require('../lib/attendance-display.cjs'),'@/lib/date-only':{formatDateOnly:()=>''},'./GuardAttendanceCard':{default:Card}};
  for(const name of ['AttendanceSummary','AttendanceWarnings','ReplacementRequestModal','ReplacementGuardSuggestions','ReplacementStatusTracker'])mocks['./'+name]={default:()=>null};
  const api=load('app/client/jobs/[id]/AttendancePanel.tsx',mocks,{setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id),setInterval:()=>1,clearInterval(){}});
  return{calls,applied,timers,get writes(){return writes;},render(props=panelProps){cursor=0;return api.default({...props,onIssueSaved:row=>applied.push(row)});},open(){nodes(this.render()).find(n=>n.type===Card).props.onReportIssue(ids.assignmentId,'Guard');},unmount(){effects.forEach(e=>e?.cleanup?.());}};
}

test('failed report stays open with notes and an alert, while acknowledged retry closes and updates the parent',async()=>{
  let fail=true;const h=panel(async()=>{if(fail)throw Error('private');return saved;});h.open();await button(h.render(),'Report Issue').props.onClick();
  assert.match(renderToStaticMarkup(h.render()),/role="alert"/);assert.doesNotMatch(text(h.render()),/successfully|private/);assert.equal(h.applied.length,0);
  assert.equal(nodes(h.render()).find(n=>n.type==='textarea').props.value,'Guard did not show up for the shift.');
  fail=false;await button(h.render(),'Report Issue').props.onClick();assert.deepEqual(h.applied,[saved]);assert.match(text(h.render()),/reported successfully/);assert.equal(nodes(h.render()).some(n=>n.type==='textarea'),false);
});

test('report and resolution share one synchronous lock and disable conflicting edits/actions',async()=>{
  const save=deferred();const h=panel(()=>save.promise);h.open();const submit=button(h.render(),'Report Issue').props.onClick;const pending=submit();await submit();
  const card=nodes(h.render()).find(n=>n.type===Card);assert.equal(card.props.actionsDisabled,true);await card.props.onMarkResolved(ids.assignmentId);card.props.onReportIssue(ids.assignmentId,'Another');
  assert.equal(h.calls.length,1);assert.equal(nodes(h.render()).find(n=>n.type==='textarea').props.disabled,true);assert.equal(button(h.render(),'Cancel').props.disabled,true);
  save.resolve(saved);await pending;assert.equal(h.applied.length,1);
});

test('failed resolution is visible, and missing context or unknown assignments cannot save',async()=>{
  const h=panel(async()=>{throw Error('offline');});let card=nodes(h.render()).find(n=>n.type===Card);assert.equal(await card.props.onMarkResolved(ids.assignmentId),false);assert.match(renderToStaticMarkup(h.render()),/role="alert"/);
  await card.props.onMarkResolved('unknown');assert.equal(h.calls.length,1);
  card=nodes(h.render({...panelProps,clientId:'foreign'})).find(n=>n.type===Card);assert.equal(card.props.actionsDisabled,true);await card.props.onMarkResolved(ids.assignmentId);assert.equal(h.calls.length,1);
});

test('unmounted saves cannot close forms, show toasts, update parent or restart writes; toast timers clean up',async()=>{
  for(const failed of [false,true]){
    const pending=deferred();const h=panel(()=>pending.promise);h.open();const submit=button(h.render(),'Report Issue').props.onClick;const work=submit();h.unmount();const writes=h.writes;
    if(failed)pending.reject(Error('late'));else pending.resolve(saved);await work;await submit();assert.equal(h.writes,writes);assert.equal(h.applied.length,0);assert.equal(h.timers.size,0);assert.equal(h.calls.length,1);
  }
  const h=panel();h.open();await button(h.render(),'Report Issue').props.onClick();assert.equal(h.timers.size,1);h.unmount();assert.equal(h.timers.size,0);
});

test('guard card delegates resolution once and performs no independent database update',async()=>{
  const states=[true];let cursor=0;const calls=[];
  const hooks={...React,useState(initial){const n=cursor++;if(!(n in states))states[n]=initial;return[states[n],value=>states[n]=value];}};
  const api=load('app/client/jobs/[id]/GuardAttendanceCard.tsx',{'react':hooks,'next/navigation':{useRouter:()=>({push(){}})},'@/lib/attendance-display.cjs':require('../lib/attendance-display.cjs'),'@/components/QuickGuardImage':{default:()=>null}});
  const props={assignment:{...assignment,issue_reported:true,guards:{id:'guard',full_name:'Guard'}},onMarkResolved:async id=>{calls.push(id);return false;}};
  await button(api.default(props),'Mark Issue Resolved').props.onClick();assert.deepEqual(calls,[ids.assignmentId]);cursor=0;
  assert.equal(button(api.default({...props,actionsDisabled:true}),'Mark Issue Resolved').props.disabled,true);
});

test('edge handler validates bearer authentication, methods, JSON and server errors',async()=>{
  let handler,records=0;let valid=true;let fail;
  load('supabase/functions/client-attendance-issue/index.ts',{
    'https://deno.land/std@0.168.0/http/server.ts':{serve:fn=>handler=fn},
    'https://esm.sh/@supabase/supabase-js@2.39.0':{createClient:()=>({auth:{getUser:async()=>valid?{data:{user:{id:'user'}}}:{data:{user:null}}}})},
    '../_shared/client-attendance-issue.ts':{AttendanceIssueError:server.AttendanceIssueError,recordClientAttendanceIssue:async()=>{records++;if(fail)throw fail;return saved;}},
  },{Deno:{env:{get:()=>''}}});
  const req=(method='POST',auth='Bearer token',body=JSON.stringify({...ids,issue}))=>new Request('https://example.test',{method,headers:auth?{Authorization:auth}:{},...(method==='POST'?{body}:{})});
  assert.equal((await handler(req('OPTIONS',''))).status,204);assert.equal((await handler(req('GET'))).status,405);assert.equal((await handler(req('POST',''))).status,401);
  valid=false;assert.equal((await handler(req())).status,401);valid=true;assert.equal((await handler(req('POST','Bearer token','{'))).status,400);assert.equal(records,0);
  const ok=await handler(req());assert.equal(ok.status,200);assert.deepEqual((await ok.json()).assignment,saved);
  fail=new server.AttendanceIssueError(409,'Reload');assert.equal((await handler(req())).status,409);fail=Error('private');const failure=await handler(req());assert.equal(failure.status,503);assert.doesNotMatch(await failure.text(),/private/);
});
