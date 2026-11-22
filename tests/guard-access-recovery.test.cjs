const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loader,hooks,deferred,flush,nodes,text}=require('./helpers/finish-test-runtime.cjs');

function fixture() {
  let notify;
  const db={actor:'guard-a',guardReads:[],calls:[],unsubscribed:0,
    auth:{getUser:async()=>({data:{user:db.actor?{id:db.actor}:null},error:null}),
      onAuthStateChange(fn){notify=fn;return{data:{subscription:{unsubscribe(){db.unsubscribed++;}}}};}},
    from(table){return{select(){return this;},eq(_key,id){db.calls.push({table,id});return this;},
      maybeSingle(){return table==='guards'?(db.guardReads.shift()||Promise.resolve({data:{id:'profile-'+db.actor,verification_status:'approved'},error:null})):Promise.resolve({data:null,error:null});}};},
    event(event,actor){db.actor=actor;notify(event,actor?{user:{id:actor}}:null);}};
  const h=hooks();
  const load=loader({react:h.react,'@/lib/supabase':{supabase:db}});
  const hook=load('hooks/useGuardGuard.ts').useGuardGuard;
  return{db,h,render:()=>h.render(hook)};
}

test('profile query errors give a settled retry state and cannot masquerade as a missing profile',async()=>{
  const f=fixture();f.db.guardReads.push(Promise.resolve({data:null,error:{message:'private backend detail'}}));
  f.render();await f.h.effects();const result=f.render();
  assert.equal(result.loading,false);assert.equal(result.allowed,false);
  assert.match(result.error,/could not be verified/i);assert.doesNotMatch(result.error,/private backend/i);
  assert.equal(f.db.calls.filter(x=>x.table==='clients').length,0);
});

test('retry can recover a failed guard lookup',async()=>{
  const f=fixture();f.db.guardReads.push(Promise.resolve({data:null,error:{message:'offline'}}));
  f.render();await f.h.effects();f.render().retry();f.render();await f.h.effects();
  const result=f.render();assert.equal(result.error,null);assert.equal(result.allowed,true);assert.equal(result.userId,'guard-a');
});

test('missing session and missing profiles settle with recovery instead of an endless access spinner',async()=>{
  for(const kind of ['session','profile']){
    const f=fixture();if(kind==='session')f.db.actor=null;else f.db.guardReads.push(Promise.resolve({data:null,error:null}));
    f.render();await f.h.effects();const result=f.render();assert.equal(result.loading,false);assert.equal(result.allowed,false);assert.ok(result.error);
  }
});

test('sign-out retires an allowed guard immediately and stale lookups cannot restore it',async()=>{
  const f=fixture();f.render();await f.h.effects();assert.equal(f.render().allowed,true);
  const late=deferred();f.db.guardReads.push(late.promise);f.render().retry();f.render();await f.h.effects();
  f.db.event('SIGNED_OUT',null);assert.equal(f.render().allowed,false);
  late.resolve({data:{id:'old',verification_status:'approved'},error:null});await flush();
  assert.equal(f.render().allowed,false);assert.equal(f.render().userId,null);
});

test('new sign-in supersedes an older lookup; same-owner token refresh keeps verified access',async()=>{
  const f=fixture(),old=deferred();f.db.guardReads.push(old.promise);f.render();await f.h.effects();
  f.db.event('SIGNED_IN','guard-b');await new Promise(resolve=>setTimeout(resolve,0));await flush();assert.equal(f.render().userId,'guard-b');assert.equal(f.render().allowed,true);
  old.resolve({data:{id:'old',verification_status:'expired'},error:null});await flush();assert.equal(f.render().verificationStatus,'approved');
  const count=f.db.calls.length;f.db.event('TOKEN_REFRESHED','guard-b');await flush();assert.equal(f.render().allowed,true);assert.equal(f.db.calls.length,count);
});

test('a hydrated initial session can recover a check that completed before sign-in became available',async()=>{
  const f=fixture();f.db.actor=null;f.render();await f.h.effects();assert.equal(f.render().allowed,false);
  f.db.event('INITIAL_SESSION','guard-a');await new Promise(resolve=>setTimeout(resolve,0));await flush();
  assert.equal(f.render().allowed,true);assert.equal(f.render().userId,'guard-a');
});

test('retired hook removes auth subscription and ignores late completion',async()=>{
  const f=fixture(),late=deferred();f.db.guardReads.push(late.promise);f.render();await f.h.effects();f.h.unmount();const writes=f.h.writes;
  late.resolve({data:{id:'late',verification_status:'approved'},error:null});await flush();assert.equal(f.h.writes,writes);assert.equal(f.db.unsubscribed,1);
});

test('recovery control provides retry and normal sign-in without exposing backend details',()=>{
  const Component=loader({'next/link':{default:'a'}})('components/GuardAccessRecovery.tsx').default;let retried=0;
  const tree=Component({onRetry:()=>retried++});assert.match(text(tree),/could not be verified/i);
  nodes(tree).find(n=>n.type==='button').props.onClick();assert.equal(retried,1);
  assert.ok(nodes(tree).find(n=>n.props.href==='/guard/login'));
});

test('a changed identity without an auth event cannot authorize the preceding profile',async()=>{
  const f=fixture(),profile=deferred();f.db.guardReads.push(profile.promise);f.render();await f.h.effects();
  f.db.actor='guard-b';profile.resolve({data:{id:'profile-a',verification_status:'approved'},error:null});await flush();
  assert.equal(f.render().allowed,false);assert.ok(f.render().error);assert.equal(f.render().userId,null);
});

test('auth and client lookup failures settle without granting guard access; valid client routing stays intact',async()=>{
  const f=fixture();f.db.auth.getUser=async()=>{throw new Error('private auth failure');};f.render();await f.h.effects();assert.ok(f.render().error);assert.equal(f.render().loading,false);
  for(const error of [null,{message:'private client failure'}]){
    const c=fixture();c.db.from=table=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:table==='clients'&&!error?{id:'client'}:null,error:table==='clients'?error:null})});
    c.render();await c.h.effects();const result=c.render();assert.equal(result.loading,false);assert.equal(result.allowed,false);
    if(error)assert.match(result.error,/could not be verified/);else{assert.equal(result.roleSwitch,'client');assert.equal(result.error,null);}
  }
});

const approvedState={userId:'guard-a',email:null,role:'guard',accountStatus:'active',onboardingComplete:true,profileExists:true,verificationStatus:'verified',requiredNextStep:null};
function gateFixture() {
  let notify,path='/guard/dashboard';const h=hooks(),routes=[];
  const db={reads:[],auth:{onAuthStateChange(fn){notify=fn;return{data:{subscription:{unsubscribe(){}}}};},signOut:async()=>{}},from(){return{select(){return this;},eq(){return this;},maybeSingle:()=>db.reads.shift()||Promise.resolve({data:{full_name:'Test',verification_status:'approved',dashboard_access:true},error:null})};}};
  const resolve={states:[],run:()=>resolve.states.length?resolve.states.shift():Promise.resolve(approvedState)};
  const router={push:value=>routes.push(value)};
  const Component=loader({react:h.react,'next/navigation':{usePathname:()=>path},'@/hooks/useSafeRouter':{useSafeRouter:()=>router},'@/lib/supabase':{supabase:db},'@/lib/account-state':{resolveAccountState:resolve.run},'@/lib/qg-error':{logAuditEvent(){}},'next/link':{default:'a'}})('components/GuardAuthGate.tsx').default;
  return{h,db,resolve,routes,render:()=>h.render(Component,{children:'GUARD PRIVATE CONTENT'}),event:(event,actor)=>notify(event,actor?{user:{id:actor}}:null),setPath:value=>{path=value;}};
}

test('outer gate displays recovery after rejected identity checks and retries successfully',async()=>{
  const f=gateFixture(),failure=deferred();f.resolve.states.push(failure.promise);f.render();await f.h.effects();failure.reject(new Error('private error'));await flush();
  let tree=f.render();assert.equal(tree.type.name,'GuardAccessRecovery');assert.doesNotMatch(text(tree),/GUARD PRIVATE CONTENT/);
  tree.props.onRetry();f.render();await f.h.effects();assert.match(text(f.render()),/GUARD PRIVATE CONTENT/);
});

test('outer gate cannot classify guard-query outages as a verification rejection',async()=>{
  const f=gateFixture();f.db.reads.push(Promise.resolve({data:null,error:{message:'private outage'}}));f.render();await f.h.effects();
  assert.equal(f.render().type.name,'GuardAccessRecovery');assert.deepEqual(f.routes,[]);
});

test('outer gate removes previous route access before checking a new path and ignores retired results',async()=>{
  const f=gateFixture();f.render();await f.h.effects();assert.match(text(f.render()),/GUARD PRIVATE CONTENT/);
  const late=deferred();f.resolve.states.push(late.promise);f.setPath('/guard/job-history');assert.doesNotMatch(text(f.render()),/GUARD PRIVATE CONTENT/);await f.h.effects();
  f.resolve.states.push(Promise.resolve({...approvedState,userId:'',role:null}));
  f.event('SIGNED_OUT');assert.doesNotMatch(text(f.render()),/GUARD PRIVATE CONTENT/);await f.h.effects();
  late.resolve(approvedState);await flush();assert.doesNotMatch(text(f.render()),/GUARD PRIVATE CONTENT/);
});

test('outer gate preserves suspended, incomplete, unverified, disabled-dashboard and admin decisions',async()=>{
  for(const kind of ['suspended','incomplete','unverified','dashboard-disabled','admin']){
    const f=gateFixture(),state={...approvedState};
    if(kind==='suspended')state.accountStatus='suspended';
    if(kind==='incomplete')state.onboardingComplete=false;
    if(kind==='admin')state.role='admin';
    f.resolve.states.push(Promise.resolve(state));
    if(kind==='unverified')f.db.reads.push(Promise.resolve({data:{verification_status:'pending',dashboard_access:true},error:null}));
    if(kind==='dashboard-disabled')f.db.reads.push(Promise.resolve({data:{verification_status:'approved',dashboard_access:false},error:null}));
    f.render();await f.h.effects();const value=text(f.render());
    if(kind==='admin')assert.match(value,/GUARD PRIVATE CONTENT/);else assert.doesNotMatch(value,/GUARD PRIVATE CONTENT/);
    if(kind==='incomplete')assert.deepEqual(f.routes,['/guard/complete-profile-wizard']);
  }
});

test('outer gate does not commit a late identity result after unmount',async()=>{
  const f=gateFixture(),late=deferred();f.resolve.states.push(late.promise);f.render();await f.h.effects();f.h.unmount();const writes=f.h.writes;
  late.resolve(approvedState);await flush();assert.equal(f.h.writes,writes);
});

test('normal login stays mounted during its sign-in event',async()=>{
  const f=gateFixture();f.setPath('/guard/login');f.render();await f.h.effects();assert.match(text(f.render()),/GUARD PRIVATE CONTENT/);
  f.event('SIGNED_IN');assert.match(text(f.render()),/GUARD PRIVATE CONTENT/);
});

test('duplicate same-owner sign-in keeps the allowed portal mounted',async()=>{
  const f=gateFixture();f.render();await f.h.effects();assert.match(text(f.render()),/GUARD PRIVATE CONTENT/);
  f.event('SIGNED_IN','guard-a');assert.match(text(f.render()),/GUARD PRIVATE CONTENT/);
  f.event('SIGNED_IN','guard-b');assert.doesNotMatch(text(f.render()),/GUARD PRIVATE CONTENT/);
});

test('a stalled guard request reaches bounded recovery and cannot later grant access',async()=>{
  const h=hooks(),late=deferred();
  const db={auth:{getUser:async()=>({data:{user:{id:'guard'}},error:null}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}};}},from(){return{select(){return this;},eq(){return this;},maybeSingle:()=>late.promise};}};
  const real=loader()('lib/request-deadline.ts').withRequestDeadline;
  const hook=loader({react:h.react,'@/lib/supabase':{supabase:db},'@/lib/request-deadline':{withRequestDeadline:request=>real(request,5)}})('hooks/useGuardGuard.ts').useGuardGuard;
  h.render(hook);await h.effects();await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(h.render(hook).loading,false);assert.ok(h.render(hook).error);
  late.resolve({data:{id:'old',verification_status:'approved'},error:null});await flush();assert.equal(h.render(hook).allowed,false);
});

test('a stalled outer account check reaches bounded recovery',async()=>{
  const h=hooks(),late=deferred(),real=loader()('lib/request-deadline.ts').withRequestDeadline;
  const db={auth:{onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}};}}};
  const Component=loader({react:h.react,'next/navigation':{usePathname:()=>'/guard/dashboard'},'@/hooks/useSafeRouter':{useSafeRouter:()=>({push(){}})},'@/lib/supabase':{supabase:db},'@/lib/account-state':{resolveAccountState:()=>late.promise},'@/lib/qg-error':{logAuditEvent(){}},'@/lib/request-deadline':{withRequestDeadline:request=>real(request,5)},'next/link':{default:'a'}})('components/GuardAuthGate.tsx').default;
  h.render(Component,{children:'PRIVATE'});await h.effects();await new Promise(resolve=>setTimeout(resolve,10));
  const tree=h.render(Component,{children:'PRIVATE'});assert.equal(tree.type.name,'GuardAccessRecovery');assert.doesNotMatch(text(tree),/PRIVATE/);
});
