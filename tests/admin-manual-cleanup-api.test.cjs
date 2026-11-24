const {test}=require('node:test');const assert=require('node:assert/strict');
const {load}=require('./helpers/enterprise-module.cjs');
const actor='11111111-1111-4111-8111-111111111111',id='33333333-3333-4333-8333-333333333333';
const names=['admin_registration_audit','email_queue','email_send_log','notifications','processed_stripe_events','rate_limit_events'];
function preview(){return{status:'previewed',request_id:id,expires_at:new Date(Date.now()+300000).toISOString(),inventory:{sampled_at:new Date().toISOString(),targets:names.map((table_name,i)=>({table_name,target_relation:'public.'+table_name,relation_type:['email_queue','notifications','processed_stripe_events'].includes(table_name)?'view':'table',retention_days:[180,90,90,180,365,7][i],total_rows:2,eligible_rows:1}))}};}
function receipt(){return{status:'completed',request_id:id,completed_at:new Date().toISOString(),total_removed:6,results:names.map((table_name,i)=>({table_name,rows_removed:1,retention_days:[180,90,90,180,365,7][i],cleanup_log_id:'a0000000-0000-4000-8000-00000000000'+i}))};}
function endpoint(options={}){
 const f={calls:[],authCalls:0,result:preview(),rpcCode:null,throwRpc:false,...options};let handler;
 const db={auth:{getUser:async()=>{f.authCalls++;return{data:{user:f.invalidAuth?null:{id:actor,user_metadata:{role:'super_admin'}}},error:f.authError?{message:'PRIVATE AUTH'}:null};}},
 from:table=>{assert.equal(table,'admin_users');const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:f.noAdmin?null:{id:'admin',role:f.role||'admin',is_active:f.active!==false},error:f.adminError?{message:'PRIVATE ADMIN'}:null})};return q;},
 rpc:(name,args)=>{f.calls.push({name,args});const q={abortSignal:signal=>{assert.ok(signal instanceof AbortSignal);return q;},then:(resolve,reject)=>f.throwRpc?Promise.reject(Error('PRIVATE RPC')).then(resolve,reject):Promise.resolve({data:f.rpcCode?null:f.result,error:f.rpcCode?{code:f.rpcCode,message:'PRIVATE SQL secret'}:null}).then(resolve,reject)};return q;}};
 load('supabase/functions/admin-run-cleanup/index.ts',{'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:(url,key,options)=>{assert.equal(options.db.schema,'app');assert.equal(options.auth.persistSession,false);return db;}}},{Deno:{serve:fn=>{handler=fn;},env:{get:key=>f.missing===key?undefined:'fixture-service-secret'}}});
 const token='header.'+Buffer.from(JSON.stringify({aal:f.aal||'aal2'})).toString('base64url')+'.signature';
 f.call=(body={action:'preview'},{method='POST',auth=true,contentType='application/json',raw}={})=>handler(new Request('https://fixture.invalid/cleanup',{method,headers:{...(auth?{Authorization:'Bearer '+token}:{}),...(contentType?{'Content-Type':contentType}:{})},...(method==='GET'||method==='OPTIONS'?{}:{body:raw??JSON.stringify(body)})}));return f;
}
test('manual endpoint verifies Auth then MFA and fresh active admin membership before a service-only action',async()=>{
 for(const options of [{invalidAuth:true},{authError:true},{aal:'aal1'},{role:'guard'},{role:'finance_admin'},{active:false},{noAdmin:true},{adminError:true}]){const f=endpoint(options);assert.ok((await f.call()).status>=400);assert.equal(f.calls.length,0);}
 const missing=endpoint();assert.equal((await missing.call(undefined,{auth:false})).status,401);assert.equal(missing.calls.length,0);
 for(const role of ['admin','super_admin']){const f=endpoint({role});const response=await f.call();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(f.calls,[{name:'admin_manual_cleanup',args:{p_actor_user_id:actor,p_action:'preview',p_request_id:null,p_confirmed:false}}]);}
});
test('invalid bodies, unsupported methods, malformed identifiers and nonboolean confirmation cannot execute',async()=>{
 const f=endpoint();for(const body of [{action:'execute',requestId:id},{action:'execute',requestId:id,confirmed:'true'},{action:'execute',requestId:'bad',confirmed:true},{action:['execute'],requestId:id,confirmed:true},{action:'anything'},{action:'status'},null,[]])assert.equal((await f.call(body)).status,400);
 assert.equal((await f.call(undefined,{raw:'{'})).status,400);assert.equal((await f.call(undefined,{raw:'x'.repeat(2100)})).status,413);assert.equal((await f.call(undefined,{contentType:'text/plain'})).status,415);
 assert.equal((await f.call(undefined,{method:'GET'})).status,405);assert.equal((await f.call(undefined,{method:'OPTIONS',auth:false})).status,204);assert.equal(f.calls.length,0);
});
test('execution binds the verified actor rather than body metadata and status never supplies destructive confirmation',async()=>{
 const f=endpoint({result:receipt()});assert.equal((await f.call({action:'execute',requestId:id,confirmed:true,actor_user_id:'other'})).status,200);assert.equal(f.calls[0].args.p_actor_user_id,actor);assert.equal(f.calls[0].args.p_request_id,id);assert.equal(f.calls[0].args.p_confirmed,true);
 await f.call({action:'status',requestId:id,confirmed:true});assert.equal(f.calls[1].args.p_confirmed,false);
});
test('conflicts, contention and unknown SQL/network outcomes remain explicit without exposing internals or fabricated completions',async()=>{
 for(const [rpcCode,status] of [['PCL01',403],['PCL02',404],['PCL03',409],['PCL04',400],['PCL05',409],['55P03',409],['PCL06',503],['57014',503]]){const f=endpoint({rpcCode});const response=await f.call({action:'execute',requestId:id,confirmed:true});assert.equal(response.status,status);assert.doesNotMatch(JSON.stringify(await response.json()),/PRIVATE|fixture-service-secret/);}
 assert.equal((await endpoint({throwRpc:true}).call()).status,503);assert.equal((await endpoint({missing:'SUPABASE_SERVICE_ROLE_KEY'}).call()).status,503);
});
function client(options={}){
 const f={session:{access_token:'fixture-token',user:{id:actor}},reply:preview(),http:200,requests:[],after:null,...options};
 const module=load('lib/adminManualCleanup.ts',{'@/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:f.session}})}}}},{fetch:async(url,opts)=>{f.requests.push({url,opts});f.after?.();if(f.networkError)throw Error('PRIVATE NETWORK');return Response.json(f.reply,{status:f.http});}});
 return{...module,f};
}
test('client uses authenticated bounded POST, requires boolean confirmation and checks each response against the saved request',async()=>{
 const {requestAdminCleanup,f}=client();await requestAdminCleanup('preview');assert.deepEqual(JSON.parse(f.requests[0].opts.body),{action:'preview'});assert.equal(f.requests[0].opts.headers.Authorization,'Bearer fixture-token');assert.ok(f.requests[0].opts.signal instanceof AbortSignal);
 await assert.rejects(requestAdminCleanup('execute',id,false),/Explicit confirmation/);assert.equal(f.requests.length,1);
 f.reply=receipt();await requestAdminCleanup('execute',id,true);assert.deepEqual(JSON.parse(f.requests[1].opts.body),{action:'execute',requestId:id,confirmed:true});await requestAdminCleanup('status',id);assert.deepEqual(JSON.parse(f.requests[2].opts.body),{action:'status',requestId:id});
 f.reply.request_id='44444444-4444-4444-8444-444444444444';await assert.rejects(requestAdminCleanup('execute',id,true),/could not be confirmed/);
});
test('incomplete or contradictory receipts never count as success and lost responses/session changes retain an uncertain result',async()=>{
 for(const alter of [r=>{r.results.pop();},r=>{r.results[1]=r.results[0];},r=>{r.results[0].rows_removed=null;},r=>{r.results[0].cleanup_log_id=r.results[1].cleanup_log_id;},r=>{r.total_removed=0;},r=>{r.status='healthy';}]){const r=receipt();alter(r);const {requestAdminCleanup}=client({reply:r});await assert.rejects(requestAdminCleanup('execute',id,true),/could not be confirmed/);}
 const lost=client({networkError:true});await assert.rejects(lost.requestAdminCleanup('execute',id,true));
 const changed=client({reply:receipt()});changed.f.after=()=>{changed.f.session={access_token:'different',user:{id:'different'}};};await assert.rejects(changed.requestAdminCleanup('execute',id,true),/session changed/);
 const expired=client({reply:{status:'preview_expired',request_id:id}});assert.equal((await expired.requestAdminCleanup('status',id)).status,'preview_expired');
 const notFound=client({http:404,reply:{code:'NOT_FOUND',error:'PRIVATE'}});await assert.rejects(notFound.requestAdminCleanup('status',id),e=>e instanceof notFound.CleanupResponseError&&e.code==='NOT_FOUND'&&!e.message.includes('PRIVATE'));
});
module.exports={preview,receipt,id};
