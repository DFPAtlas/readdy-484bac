const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/enterprise-module.cjs');
const {stripeAppOrigin,QUICKGUARD_SANDBOX_URL:BASE,QUICKGUARD_SANDBOX_ORIGIN:APP}=load('supabase/functions/_shared/environment-isolation.ts');
test('sandbox payment redirects require the exact sandbox app and test key, preserving legacy production URLs',()=>{
  for(const key of ['sk_test_fixture','rk_test_fixture'])assert.equal(stripeAppOrigin(BASE,key,APP,'https://quickguard.uk'),APP);
  for(const key of ['sk_live_fixture','rk_live_fixture','unknown'])assert.throws(()=>stripeAppOrigin(BASE,key,APP,'https://quickguard.uk'));
  for(const url of [undefined,'https://quickguard.uk',APP+'/unsafe',APP+'?next=x'])assert.throws(()=>stripeAppOrigin(BASE,'sk_test_fixture',url,'https://quickguard.uk'));
  assert.equal(stripeAppOrigin('https://vnywjfpkepjgclkbcmsj.supabase.co','sk_live_fixture',undefined,'https://legacy.example.invalid'),'https://legacy.example.invalid');
});
function endpoint(name,{key='sk_test_fixture',app=APP,existing=true}={}){
  let handler;const calls=[];
  const db={auth:{getUser:async()=>({data:{user:{id:'user-fixture'}},error:null})},from(){const q={select(){return q;},eq(){return q;},update(row){calls.push({update:row});return q;},maybeSingle:async()=>({data:{id:'guard-fixture',stripe_account_id:existing?'acct_fixture':null,email:'synthetic@example.invalid',full_name:'Synthetic Test'},error:null}),then(resolve,reject){return Promise.resolve({data:null,error:null}).then(resolve,reject);}};return q;}};
  class Stripe{constructor(){this.accounts={create:async input=>{calls.push({account:input});return{id:'acct_fixture'};},retrieve:async()=>({id:'acct_fixture'})};this.accountLinks={create:async input=>{calls.push({link:input});return{url:'https://connect.stripe.com/test/fixture'};}};}}
  load('supabase/functions/'+name+'/index.ts',{'https://deno.land/std@0.168.0/http/server.ts':{serve(fn){handler=fn;}},'https://esm.sh/stripe@14.10.0?target=deno':Stripe,'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:()=>db}},{Deno:{env:{get:name=>({STRIPE_SECRET_KEY:key,SUPABASE_URL:BASE,SUPABASE_SERVICE_ROLE_KEY:'service-fixture',APP_URL:app})[name]}},console:{error(){}}});
  return{calls,run:()=>handler(new Request(BASE,{method:'POST',headers:{Authorization:'Bearer fixture'}}))};
}
for(const name of ['create-guard-connect-account','create-guard-onboarding-link']){
  test(name+' uses sandbox return/refresh and business URLs even without SITE_URL',async()=>{
    for(const existing of [true,false]){const h=endpoint(name,{existing});assert.equal((await h.run()).status,200);const link=h.calls.find(c=>c.link).link;assert.equal(link.return_url,APP+'/guard/bank-settings?stripe_onboarding=return');assert.equal(link.refresh_url,APP+'/guard/bank-settings?stripe_onboarding=refresh');if(!existing)assert.equal(h.calls.find(c=>c.account).account.business_profile.url,APP+'/guard/dashboard');}
  });
  test(name+' rejects unsafe configuration before provider calls or profile writes',async()=>{
    for(const options of [{key:'sk_live_fixture'},{app:'https://quickguard.uk'},{app:undefined,key:'bad'}]){const h=endpoint(name,options);assert.equal((await h.run()).status,500);assert.deepEqual(h.calls,[]);}
  });
}
