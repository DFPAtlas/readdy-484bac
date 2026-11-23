import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync('app/admin/guard-verifications/GuardVerificationsClient.tsx','utf8');
const handlers = source.slice(source.indexOf('  const submitApproval ='),source.indexOf('  const handleReject ='));
const compiled = ts.transpileModule(handlers+'\nreturn {confirmApprove,confirmOverrideApprove};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const ack = extra => ({success:true,guard_id:'fixture-guard',status:'approved',action:'approved',...extra});
function fixture(response = ack({notification_status:'accepted'}), options = {}) {
 const events=[],requests=[];const refs={run:{current:false},active:{current:true},guard:{current:'fixture-guard'},review:{current:0}};
 const deps={selectedGuard:{id:'fixture-guard'},processing:false,approvalRunRef:refs.run,approvalActiveRef:refs.active,approvalGuardRef:refs.guard,approvalReviewRef:refs.review,
  setShowOverrideModal(){},setShowApproveModal(){},setProcessing:value=>events.push(['processing',value]),admin:{name:'Fixture admin'},
  supabase:{auth:{getSession:async()=>({data:{session:options.noSession?null:{access_token:'fixture-token'}},error:null})}},
  process:{env:{}},fetch:async(url,request)=>{requests.push(JSON.parse(request.body));const data=typeof response==='function'?await response():response;return {ok:options.ok!==false,json:async()=>{if(options.badJson)throw Error('Invalid JSON');return data;}};},
  showToast:(message,type)=>events.push(['toast',message,type]),closeGuardDetails:()=>{events.push(['closed']);refs.guard.current=null;},
  fetchGuards:tab=>events.push(['refresh',tab]),fetchAllCounts:()=>events.push(['counts']),activeTab:'pending'};
 const handlers=new Function(...Object.keys(deps),compiled)(...Object.values(deps));return{...handlers,events,requests,refs};
}
test('normal and override approval distinguish email acceptance, deduplication and unconfirmed sending',async()=>{
 for(const override of [false,true])for(const status of ['accepted','already_sent','failed',undefined,'unknown']){
  const f=fixture(ack({notification_status:status}));await (override?f.confirmOverrideApprove():f.confirmApprove());
  assert.equal(f.requests.length,1);assert.equal(f.requests[0].guardId,'fixture-guard');assert.equal(f.requests[0].override,override?true:undefined);
  const toast=f.events.find(e=>e[0]==='toast');assert.ok(toast);assert.equal(f.events.filter(e=>e[0]==='closed').length,1);
  if(status==='accepted'){assert.match(toast[1],/accepted for sending/);assert.equal(toast[2],'success');}
  else if(status==='already_sent')assert.match(toast[1],/already sent within the last 24 hours/);
  else{assert.match(toast[1],/Guard approved.*email could not be confirmed/);assert.equal(toast[2],'error');assert.doesNotMatch(toast[1],/Approval failed|email sent/);}
 }
});
test('already-recorded approval never presents an unperformed email request as confirmed',async()=>{
 const f=fixture(ack({already_approved:true,notification_status:'not_requested'}));await f.confirmApprove();
 assert.match(f.events.find(e=>e[0]==='toast')[1],/already recorded.*not checked/);
});
test('denied, unknown, wrong-guard and malformed acknowledgement cannot close the review or claim saved approval',async()=>{
 for(const [result,options] of [[null,{}],[{},{}],[ack({guard_id:'different'}),{}],[ack({status:['approved']}),{}],[ack({status:'pending'}),{}],[ack({action:'rejected'}),{}],[ack({success:'true'}),{}],[ack(),{ok:false}],[ack(),{badJson:true}]]){
  const f=fixture(result,options);await f.confirmApprove();assert.equal(f.events.some(e=>e[0]==='closed'||e[0]==='refresh'),false);
  assert.match(f.events.find(e=>e[0]==='toast')[1],/Approval not confirmed/);
 }
 const f=fixture(ack(),{noSession:true});await f.confirmApprove();assert.equal(f.requests.length,0);
});
test('one synchronous approval lock prevents normal/override overlap',async()=>{
 let resolve;const waiting=new Promise(r=>resolve=r);const f=fixture(()=>waiting);
 const first=f.confirmApprove();await Promise.resolve();await Promise.resolve();await f.confirmOverrideApprove();
 assert.equal(f.requests.length,1);resolve(ack({notification_status:'accepted'}));await first;
});
test('late approval callbacks cannot close another guard review or update an unmounted screen',async()=>{
 for(const change of ['closed','different','reopened','unmounted']){
  let resolve;const waiting=new Promise(r=>resolve=r);const f=fixture(()=>waiting);const first=f.confirmApprove();await Promise.resolve();await Promise.resolve();
  if(change==='unmounted')f.refs.active.current=false;else if(change==='reopened')f.refs.review.current++;else f.refs.guard.current=change==='closed'?null:'other-guard';
  const before=f.events.length;resolve(ack({notification_status:'accepted'}));await first;
  const late=f.events.slice(before);assert.equal(late.some(e=>['closed','toast','refresh','counts'].includes(e[0])),false);
  if(change==='unmounted')assert.equal(late.length,0);
 }
});
test('server-side MFA and review errors stay visible without claiming an approval was saved',async()=>{
 const f=fixture({error:'MFA required',details:'Verify your admin session'},{ok:false});await f.confirmApprove();
 const toast=f.events.find(e=>e[0]==='toast');assert.match(toast[1],/MFA required: Verify your admin session/);
 assert.equal(f.events.some(e=>e[0]==='closed'||e[0]==='refresh'),false);
});
test('a missing-reviewer conflict stays visible in both approval flows without closing or refreshing the review',async()=>{
 for(const override of [false,true]){
  const f=fixture({error:'Existing approval has no recorded reviewer; an authorised provenance review is required. No approval data was changed',code:'APPROVAL_REVIEWER_MISSING',guard_id:'fixture-guard',status:'approved'},{ok:false});
  await (override?f.confirmOverrideApprove():f.confirmApprove());
  assert.equal(f.requests.length,1);
  const toast=f.events.find(e=>e[0]==='toast');assert.equal(toast[2],'error');
  assert.match(toast[1],/Approval not confirmed:.*recorded reviewer.*provenance review/);
  assert.equal(f.events.some(e=>['closed','refresh','counts'].includes(e[0])),false);
  assert.equal(f.refs.run.current,false);
 }
});
