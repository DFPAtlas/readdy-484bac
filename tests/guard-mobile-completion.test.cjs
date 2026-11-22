const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/enterprise-module.cjs');
const {hooksHarness,nodes,content,childMocks,uiDatabase,flush}=require('./helpers/guard-ui-fixture.cjs');
const {deferred}=require('./helpers/finish-test-runtime.cjs');
const button=tree=>nodes(tree).find(n=>n.type==='button'&&content(n)==='Request Completion');
function fixture(){
 const db=uiDatabase(),calls=[],pending=deferred();
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
 db.jobs.splice(0,db.jobs.length,{job_id:'job',job_title:'Synthetic checked-out shift',assignment_id:'assignment',assignment_status:'in_progress',payment_status:'funded',start_date:today,check_in_time:'2026-11-22T01:00:00Z',check_out_time:'2026-11-22T01:30:00Z'});
 const invoke=db.functions.invoke;
 db.functions.invoke=async(name,args)=>{
  if(name!=='request-job-completion')return invoke(name,args);
  calls.push(args.body);const r=await pending.promise;
  if(r.data?.success)db.jobs[0].assignment_status='completed';
  return r;
 };
 const h=hooksHarness('app/guard/mobile/MobileGuardDashboard.tsx',{...childMocks,
  '@/lib/supabase':{supabase:db},'next/navigation':{useRouter:()=>({push(){}})},
  '@/hooks/useGuardPayoutSettings':{useGuardPayoutSettings:()=>({status:null})},
  '@/hooks/usePushNotifications':{usePushNotifications:()=>({subscribed:false})},
  '@/app/guard/messages/GuardMessagesClient':{__esModule:true,default:()=>null},
 },{setTimeout:(fn,ms)=>ms===150?fn():setTimeout(fn,ms)});
 return{db,h,calls,pending,tab(name){nodes(h.render()).find(n=>n.props.tabs).props.onTabChange(name);}};
}
test('checked-out current shift stays visible; completion is submitted once and approval is claimed only after acknowledgement',async()=>{
 const f=fixture();f.h.render();await f.h.effects();f.h.render();await f.h.effects();
 assert.match(content(f.h.render()),/Synthetic checked-out shift/);
 assert.doesNotMatch(content(f.h.render()),/Awaiting Approval|awaiting client approval/);
 f.tab('shifts');let tree=f.h.render();const submit=button(tree);assert.ok(submit);
 const first=submit.props.onClick();await submit.props.onClick();await flush();
 assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0],{assignmentId:'assignment',jobId:'job'});
 assert.match(content(f.h.render()),/Requesting completion/);
 assert.doesNotMatch(content(f.h.render()),/awaiting client approval/);
 f.pending.resolve({data:{success:true,requestId:'request'},error:null});await first;
 assert.match(content(f.h.render()),/Completion requested — awaiting client approval/);
 f.h.unmount();
});
test('failed acknowledgement retains completion action and does not claim client approval',async()=>{
 const f=fixture();f.h.render();await f.h.effects();f.h.render();await f.h.effects();f.tab('shifts');
 const request=button(f.h.render()).props.onClick();f.pending.resolve({data:{success:false},error:{message:'private backend detail'}});await request;
 assert.ok(button(f.h.render()));assert.match(content(f.h.render()),/could not be confirmed/);
 assert.doesNotMatch(content(f.h.render()),/awaiting client approval|private backend/);f.h.unmount();
});
test('unmount retires a pending completion without state updates',async()=>{
 const f=fixture();f.h.render();await f.h.effects();f.h.render();await f.h.effects();f.tab('shifts');
 const request=button(f.h.render()).props.onClick();await flush();f.h.unmount();const writes=f.h.writes;
 f.pending.resolve({data:{success:true,requestId:'request'},error:null});await request;assert.equal(f.h.writes,writes);
});
test('completion helper rejects changed identity, retired scope and malformed receipts',async()=>{
 const {submitGuardCompletion}=load('lib/guard-completion.ts');
 for(const mode of ['changed_before','changed_after','retired','malformed','missing_id']){
  let reads=0,invokes=0;
  const db={auth:{getUser:async()=>({data:{user:{id:(mode==='changed_before'||mode==='changed_after'&&reads++>0)?'other':'owner'}},error:null})},functions:{invoke:async()=>{invokes++;return{data:mode==='malformed'?{requestId:'id'}:mode==='missing_id'?{success:true}:{success:true,requestId:'id'},error:null};}}};
  await assert.rejects(submitGuardCompletion(db,'owner','assignment','job',()=>mode!=='retired'));
  assert.equal(invokes,['changed_before','retired'].includes(mode)?0:1);
 }
});
