const {test}=require('node:test');const assert=require('node:assert/strict');
const {load}=require('./helpers/enterprise-module.cjs');
test('job matching handler queues free and former paid guards without subscription reads; licence and travel filters remain',async()=>{
  let handler;const reads=[],queued=[],pushes=[],filters=[];
  const guards=[{id:'free',user_id:'free-user',home_latitude:51.5,home_longitude:-0.1,max_distance_miles:10,sia_verified:true,sia_licence_number:'QA',sia_expiry_date:'2099-01-01'},
    {id:'former-paid',user_id:'former-user',home_latitude:51.5,home_longitude:-0.1,max_distance_miles:10,sia_verified:true,sia_licence_number:'QA',sia_expiry_date:'2099-01-01'},
    {id:'expired-sia',user_id:'expired-user',sia_verified:true,sia_licence_number:'QA',sia_expiry_date:'2000-01-01'},
    {id:'too-far',user_id:'far-user',home_latitude:55,home_longitude:-0.1,max_distance_miles:10,sia_verified:true,sia_licence_number:'QA',sia_expiry_date:'2099-01-01'}];
  const db={from(table){reads.push(table);const q={select:()=>q,eq:()=>q,in:()=>q,not(...args){filters.push(args);return q;},contains:()=>q,maybeSingle:()=>q,then(resolve,reject){return Promise.resolve({data:table==='guards'?guards:table==='clients'?{client_type:'agency'}:{id:'job',client_id:'client',job_access_level:'elite',sia_licence_required:true,latitude:51.5,longitude:-0.1,hourly_rate:15,security_type:'door-supervisor'},error:null}).then(resolve,reject);}};return q;},rpc:async(name,params)=>{queued.push({name,params});return{data:'queued',error:null};}};
  load('supabase/functions/notify-matching-guards/index.ts',{'https://deno.land/std@0.168.0/http/server.ts':{serve:fn=>handler=fn},'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:()=>db}},{Deno:{env:{get:()=> 'synthetic-service-config'}},fetch:async(url,options)=>{pushes.push(JSON.parse(options.body));return Response.json({success:true});}});
  const r=await handler(new Request('https://example.invalid/matching',{method:'POST',headers:{Authorization:'Bearer synthetic-service-config','Content-Type':'application/json'},body:JSON.stringify({jobId:'job'})}));
  assert.equal(r.status,200);const body=await r.json();assert.equal(body.eligible,2);assert.equal(body.queued,2);
  assert.deepEqual(queued.map(q=>q.params.p_guard_id),['free','former-paid']);assert.equal(pushes.length,2);
  assert.equal(reads.some(t=>/entitlement|subscription|plan/.test(t)),false);assert.ok(filters.some(f=>f[0]==='verified_by'&&f[1]==='is'&&f[2]===null));
});
