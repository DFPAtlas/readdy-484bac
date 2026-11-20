const {test}=require('node:test'),assert=require('node:assert/strict');
const {loader,hooks,deferred,flush,nodes,text}=require('./helpers/finish-test-runtime.cjs');
function authDb(){let notify;const db={actor:'owner',profiles:[],calls:[],auth:{getUser:async()=>({data:{user:db.actor?{id:db.actor}:null}}),onAuthStateChange(fn){notify=fn;return{data:{subscription:{unsubscribe(){}}}};},signOut:async()=>{}},from(){return{select(){return this;},eq(_key,value){db.calls.push(value);return this;},maybeSingle(){return db.profiles.shift()||Promise.resolve({data:{id:'client-'+db.actor,company_name:db.actor}});}}},event(event,actor){db.actor=actor;notify(event,actor?{user:{id:actor}}:null);}};return db;}
function provider(db){const h=hooks(),load=loader({react:h.react,'./supabase':{supabase:db}}),Component=load('lib/ClientAuthContext.tsx').ClientAuthProvider;return{h,render:()=>h.render(Component,{children:'portal'})};}
test('provider cannot restore a previous user after sign-out or update state after unmount',async()=>{
 const db=authDb(),pending=deferred();db.profiles.push(pending.promise);const r=provider(db);r.render();await r.h.effects();db.event('SIGNED_OUT',null);assert.equal(r.render().props.value.userId,null);pending.resolve({data:{id:'old-client',company_name:'OLD'}});await flush();assert.equal(r.render().props.value.userId,null);
 const db2=authDb(),late=deferred();db2.profiles.push(late.promise);const other=provider(db2);other.render();await other.h.effects();other.h.unmount();const writes=other.h.writes;late.resolve({data:{id:'late'}});await flush();assert.equal(other.h.writes,writes);
});
test('new identity wins old profile and stale route hydration cannot cancel the new identity load',async()=>{
 const db=authDb(),old=deferred(),fresh=deferred();db.profiles.push(old.promise,fresh.promise);const r=provider(db);r.render();await r.h.effects();db.event('SIGNED_IN','new-owner');await flush();
 const api=r.render().props.value;api.setAuth({user:{id:'owner'},clientId:'old',companyName:'OLD',subscriptionTier:'old'});await flush();fresh.resolve({data:{id:'new-client',company_name:'NEW'}});await flush();old.resolve({data:{id:'old-client',company_name:'OLD'}});await flush();
 assert.equal(r.render().props.value.userId,'new-owner');assert.equal(r.render().props.value.clientId,'new-client');assert.equal(r.render().props.value.isLoaded,true);
});
test('profile failures produce an accessible recovery and retry can restore the account',async()=>{
 const db=authDb();db.profiles.push(Promise.resolve({error:{message:'private backend detail'},data:null}));const r=provider(db);r.render();await r.h.effects();let tree=r.render();assert.equal(tree.props.value.isLoaded,true);assert.match(text(tree),/could not be verified/);assert.doesNotMatch(text(tree),/private backend/);
 const retry=nodes(tree).find(n=>n.type==='button'&&text(n)==='Retry account verification');await retry.props.onClick();await flush();tree=r.render();assert.equal(tree.props.value.authError,null);assert.equal(tree.props.value.clientId,'client-owner');
});
test('normal same-owner token refresh preserves the loaded provider state and does not refetch',async()=>{
 const db=authDb(),r=provider(db);r.render();await r.h.effects();const before=r.render().props.value,count=db.calls.length;db.event('TOKEN_REFRESHED','owner');await flush();const after=r.render().props.value;assert.equal(after.clientId,before.clientId);assert.equal(after.isLoaded,true);assert.equal(db.calls.length,count);
});
test('guard retires a previously allowed path immediately and rejects a late verification response',async()=>{
 const h=hooks(),auth={isLoaded:true,userId:'owner',clientId:'client',companyName:'Owner',subscriptionTier:'Pro',authError:null,reportAuthError(){}},router={replace(){}},db={rpc:async()=>({data:false}),auth:{getUser:async()=>({data:{user:{id:auth.userId}}})},from:table=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:table==='admin_users'?null:{id:'client',profile_completed:true,is_active:true}})})};let pathname='/client/jobs';
 const load=loader({react:h.react,'next/navigation':{usePathname:()=>pathname},'./useSafeRouter':{useSafeRouter:()=>router},'@/lib/supabase':{supabase:db},'@/lib/ClientAuthContext':{useClientAuth:()=>auth}});const guard=load('hooks/useClientGuard.ts').useClientGuard;
 h.render(guard);await h.effects();assert.equal(h.render(guard).allowed,true);pathname='/client/reports';assert.equal(h.render(guard).allowed,false);assert.equal(h.render(guard).clientData,null);await h.effects();assert.equal(h.render(guard).allowed,true);
});
test('guard reports lookup failures for provider recovery and inactive clients leave Support without a loop',async()=>{
 for(const failure of ['error','inactive']){
  const h=hooks(),errors=[],routes=[],auth={isLoaded:true,userId:'owner',clientId:'client',companyName:'Owner',subscriptionTier:'Pro',authError:null,reportAuthError:x=>errors.push(x)},db={rpc:async()=>({data:false}),auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from:table=>({select(){return this;},eq(){return this;},maybeSingle:async()=>table==='admin_users'?{data:null}:failure==='error'?{data:null,error:{message:'private'}}:{data:{id:'client',profile_completed:true,is_active:false}}})};
  const load=loader({react:h.react,'next/navigation':{usePathname:()=>'/client/support'},'./useSafeRouter':{useSafeRouter:()=>({replace:x=>routes.push(x)})},'@/lib/supabase':{supabase:db},'@/lib/ClientAuthContext':{useClientAuth:()=>auth}}),guard=load('hooks/useClientGuard.ts').useClientGuard;
  h.render(guard);await h.effects();const result=h.render(guard);assert.equal(result.allowed,false);if(failure==='error'){assert.equal(errors.length,1);assert.match(result.error,/could not be verified/);}else assert.deepEqual(routes,['/client/account-status']);
 }
});
test('chat composer retains drafts, uses one request across an uncertain retry and ignores late unmounted confirmation',async()=>{
 const h=hooks(),pending=deferred(),calls=[];let fail=true;const Component=loader({react:h.react,'next/link':{default:()=>null}})('app/client/messages/ChatPanel.tsx').default;
 const props={conversation:{id:'conversation',other_name:'Guard',other_initials:'GU',other_rating:null,is_support:false},messages:[],job:null,guard:null,clientUserId:'owner',sending:false,onSend:(value,id)=>{calls.push({value,id});return fail?Promise.resolve(false):pending.promise;},onBack(){},messagesEndRef:{current:null}};
 let tree=h.render(Component,props);await h.effects();nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'Retain this draft'}});tree=h.render(Component,props);const button=()=>nodes(tree).find(n=>n.type==='button'&&n.props.onClick?.name==='handleSend');
 await button().props.onClick();tree=h.render(Component,props);assert.equal(nodes(tree).find(n=>n.type==='input').props.value,'Retain this draft');fail=false;const send=button().props.onClick();await flush();assert.equal(calls[0].id,calls[1].id);h.unmount();const writes=h.writes;pending.resolve(true);await send;assert.equal(h.writes,writes);
});

test('support modal retries one uncertain create and carries a saved-but-sync-pending warning to its parent',async()=>{
 const h=hooks(),calls=[],warnings=[];let first=true;
 const db={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},rpc:async(name,{p_request})=>{calls.push({name,p_request});if(first){first=false;return{error:{message:'reply lost'}};}return{data:{id:p_request.operation_id,client_id:'client',replayed:true}};}};
 const Component=loader({react:h.react,'@/lib/supabase':{supabase:db},'@/lib/support-routing':{routeTicketToCommandCentre:async()=>({ok:false})},'@/lib/client-activity':{logClientActivity:async()=>{},ACTIVITY_TYPES:{},ACTIVITY_CATEGORIES:{}}})('app/client/support/CreateTicketModal.tsx').default;
 const props={clientId:'client',ownerUserId:'owner',jobs:[],prefillCategory:'general_support',onClose(){},onSuccess:warning=>warnings.push(warning)};
 let tree=h.render(Component,props);await h.effects();
 nodes(tree).find(n=>n.props?.placeholder==='Brief summary of the issue...').props.onChange({target:{value:'Synthetic subject'}});
 nodes(tree).find(n=>n.type==='textarea'&&String(n.props.placeholder).startsWith('Describe the issue')).props.onChange({target:{value:'Retain these details'}});
 tree=h.render(Component,props);await nodes(tree).find(n=>n.props.onClick?.name==='handleSubmit').props.onClick();tree=h.render(Component,props);
 assert.equal(warnings.length,0);assert.equal(nodes(tree).find(n=>n.props?.placeholder==='Brief summary of the issue...').props.value,'Synthetic subject');
 await nodes(tree).find(n=>n.props.onClick?.name==='handleSubmit').props.onClick();assert.equal(calls[0].p_request.operation_id,calls[1].p_request.operation_id);assert.match(warnings[0],/saved.*pending/);
});
test('review modal retains details on failure, unlocks retry and does not finish an unmounted submission',async()=>{
 const h=hooks(),calls=[],late=deferred();let first=true,completed=0;
 const db={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},functions:{invoke:async(_name,{body})=>{calls.push(body);return first?(first=false,{error:{message:'failed'}}):late.promise;}}};
 const Component=loader({react:h.react,'@/lib/supabase':{supabase:db},'next/link':{default:()=>null},'@/lib/date-only':{formatDateOnly:value=>value}})('components/reviews/RateGuardModal.tsx').default;
 const props={isOpen:true,jobId:'job',guardId:'guard',guardName:'Synthetic guard',jobTitle:'Synthetic job',shiftDate:'2026-11-20',onClose(){completed++;},onSuccess(){completed++;}};
 let tree=h.render(Component,props);await h.effects();nodes(tree).find(n=>n.props?.label===''&&typeof n.props.onChange==='function').props.onChange(5);
 nodes(tree).find(n=>n.props?.placeholder==='Share your experience with this guard...').props.onChange({target:{value:'Retain review text'}});
 tree=h.render(Component,props);await nodes(tree).find(n=>n.props.onClick?.name==='handleSubmit').props.onClick();tree=h.render(Component,props);
 assert.match(text(tree),/could not be confirmed/);assert.equal(nodes(tree).find(n=>n.type==='fieldset').props.disabled,false);
 assert.equal(nodes(tree).find(n=>n.props?.placeholder==='Share your experience with this guard...').props.value,'Retain review text');
 const request=nodes(tree).find(n=>n.props.onClick?.name==='handleSubmit').props.onClick();await flush();tree=h.render(Component,props);assert.equal(nodes(tree).find(n=>n.type==='fieldset').props.disabled,true);
 assert.equal(calls[0].operationId,calls[1].operationId);h.unmount();const writes=h.writes;late.resolve({data:{success:true,review_id:'review',job_status:'closed'}});await request;assert.equal(h.writes,writes);assert.equal(completed,0);
});
