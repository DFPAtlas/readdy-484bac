const {test}=require('node:test');const assert=require('node:assert/strict');
const {load}=require('./helpers/enterprise-module.cjs');
const U='11111111-1111-4111-8111-111111111111';
function fixture(slug,{role='guard',adminRole='finance_admin',owner=U,localType=role,localPlan=role==='guard'?'guard-basic':'client-pro',profileError=false}={}){
 let handler;const provider=[],writes=[],reads=[];
 const db={auth:{getUser:async()=>({data:{user:{id:U,email:'qa@example.invalid'}},error:null})},from(table){const call={table,filters:[],mode:'read'};reads.push(call);const q={select(){return q;},eq(k,v){call.filters.push([k,v]);return q;},maybeSingle(){return q;},update(body){call.mode='write';call.body=body;return q;},insert(body){call.mode='write';call.body=body;return q;},then(resolve,reject){if(call.mode==='write')writes.push(call);let data=null;if(table==='guards'&&role==='guard')data={id:'guard',email:'qa@example.invalid'};if(table==='clients'&&role==='client')data={id:'client',email:'qa@example.invalid'};if(table==='admin_users')data={id:'admin',role:adminRole,is_active:true};if(table==='subscriptions')data={id:'local',user_id:owner,account_type:localType,plan_slug:localPlan};return Promise.resolve({data,error:profileError&&['guards','clients'].includes(table)?{message:'offline'}:null}).then(resolve,reject);}};return q;},rpc:async()=>({data:null,error:null})};
 class Stripe{constructor(){const action=name=>async(...args)=>{provider.push([name,...args]);throw Error('Provider must not be reached');};this.prices={retrieve:action('price')};this.subscriptions={update:action('subscription')};this.checkout={sessions:{create:action('checkout'),retrieve:action('checkout-read')}};this.customers={create:action('customer')};}}
 load('supabase/functions/'+slug+'/index.ts',{
 'https://deno.land/std@0.168.0/http/server.ts':{serve:fn=>handler=fn},
 'https://esm.sh/stripe@14.10.0?target=deno':{default:Stripe,__esModule:true},
 'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno':{createClient:()=>db},
 'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:()=>db},
 '../_shared/payment-freeze.ts':{paymentFreezeResponse:async()=>null}
 },{Deno:{env:{get:()=> 'synthetic-config'}}});
 return{provider,writes,reads,run:async body=>{const r=await handler(new Request('https://example.invalid/'+slug,{method:'POST',headers:{Authorization:'Bearer synthetic',origin:'https://quickguard.uk','Content-Type':'application/json'},body:JSON.stringify(body)}));return{status:r.status,body:await r.json()};}};
}
for(const slug of ['create-subscription-checkout','create-wizard-checkout']){
 test(slug+' rejects paid guard sales before any provider request or local write',async()=>{
  for(const planId of ['guard-basic','guard-pro','guard-elite'])for(const billingCycle of ['monthly','annual']){
   const f=fixture(slug);const r=await f.run({userId:U,accountType:'guard',planId,billingCycle});
   assert.equal(r.status,409);assert.equal(r.body.code,'guard_memberships_retired');assert.deepEqual(f.provider,[]);assert.deepEqual(f.writes,[]);
  }
 });
 test(slug+' ownership and account checks cannot be bypassed by a client plan or foreign user',async()=>{
  for(const body of [{userId:'foreign',accountType:'guard',planId:'guard-pro'},{userId:U,accountType:'client',planId:'client-pro'}]){
   const f=fixture(slug);const r=await f.run(body);assert.ok(r.status>=400);assert.deepEqual(f.provider,[]);assert.deepEqual(f.writes,[]);
  }
 });
}
test('retired guard renewal cannot be resumed, including legacy plan aliases or contradictory local role',async()=>{
 for(const opts of [{},{localType:null,localPlan:'guard_professional'},{localType:'client',localPlan:'guard-pro'}]){
  const f=fixture('resume-subscription',opts);const r=await f.run({stripeSubscriptionId:'sub_synthetic',userId:U});assert.equal(r.status,409);assert.equal(r.body.code,'guard_memberships_retired');assert.deepEqual(f.provider,[]);assert.deepEqual(f.writes,[]);
 }
});
test('renewal classification or ownership uncertainty and wrong admin role fail before provider writes',async()=>{
 for(const opts of [{role:'client',localType:null,localPlan:null},{role:'client',owner:'foreign'},{adminRole:'support_admin'}]){
  const f=fixture('resume-subscription',opts);const r=await f.run({stripeSubscriptionId:'sub_synthetic',userId:U});assert.ok(r.status>=400);assert.deepEqual(f.provider,[]);assert.deepEqual(f.writes,[]);
 }
});
