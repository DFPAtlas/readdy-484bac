const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/enterprise-module.cjs');
const {QUICKGUARD_SANDBOX_URL:BASE,QUICKGUARD_SANDBOX_ORIGIN:APP}=load('supabase/functions/_shared/environment-isolation.ts');
const USER='11111111-1111-4111-8111-111111111111',REQUEST='33333333-3333-4333-8333-333333333333';
function fixture({key='sk_test_fixture',app=APP,project=BASE,existingSubscription=false}={}){
  let handler;const provider=[],writes=[],reads=[];
  const plan={name:'Client Pro',audience:'client',stripe_price_id:'price_fixture',stripe_product_id:'prod_fixture',monthly_price_pence:9900,features:[]};
  const db={auth:{getUser:async()=>({data:{user:{id:USER,email:'synthetic@example.invalid'}},error:null})},
    from(table){reads.push(table);let mutation=false;const q={select(){return q;},eq(){return q;},maybeSingle(){return q;},update(row){mutation=true;writes.push({table,row});return q;},insert(row){mutation=true;writes.push({table,row});return q;},then(resolve,reject){
      const data=mutation?[{id:'synthetic',user_id:USER}]:table==='plans'?plan:table==='clients'?{id:'client-fixture',email:'synthetic@example.invalid',stripe_customer_id:null}:table==='subscriptions'&&existingSubscription?{stripe_subscription_id:'sub_fixture',status:'active',plan_slug:'client-starter'}:table==='qg_token_redemptions'?{id:REQUEST,status:'pending',stripe_checkout_session_id:'cs_test_fixture'}:null;
      return Promise.resolve({data,error:null}).then(resolve,reject);
    }};return q;},
    async rpc(name,params){writes.push({rpc:name,params});return{data:name==='reserve_qg_token_checkout'?{id:REQUEST,user_id:USER,tokens_used:100,credit_pence:1000,created_at:new Date().toISOString()}:null,error:null};},
  };
  class Stripe{constructor(){
    this.prices={retrieve:async id=>{provider.push('price_read');return{id,active:true,currency:'gbp',product:'prod_fixture',unit_amount:9900,recurring:{interval:'month',interval_count:1}};}};
    this.customers={create:async()=>{provider.push('customer_create');return{id:'cus_fixture'};}};
    this.subscriptions={retrieve:async()=>{provider.push('subscription_read');return{items:{data:[{id:'si_fixture'}]}};},update:async()=>{provider.push('subscription_update');return{id:'sub_fixture',status:'active',current_period_end:1900000000,cancel_at_period_end:false};}};
    this.coupons={create:async()=>{provider.push('coupon_create');return{id:'coupon_fixture'};}};
    const session={id:'cs_test_fixture',status:'open',client_reference_id:USER,metadata:{qg_token_redemption_id:REQUEST}};
    this.checkout={sessions:{create:async params=>{provider.push({checkout:params});return{id:'cs_test_fixture',url:'https://checkout.stripe.com/synthetic'};},retrieve:async()=>{provider.push('session_read');return session;},expire:async()=>{provider.push('session_expire');return{...session,status:'expired'};}}};
  }}
  load('supabase/functions/create-subscription-checkout/index.ts',{
    'https://deno.land/std@0.168.0/http/server.ts':{serve(fn){handler=fn;}},
    'https://esm.sh/stripe@14.10.0?target=deno':Stripe,
    'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno':{createClient:()=>db},
    '../_shared/payment-freeze.ts':{paymentFreezeResponse:async()=>null},
  },{Deno:{env:{get:name=>({SUPABASE_URL:project,SUPABASE_SERVICE_ROLE_KEY:'fixture-service',STRIPE_SECRET_KEY:key,APP_URL:app,QUICKGUARD_CHRISTMAS_OFFER_ENABLED:'false'})[name]}},fetch:async()=>Response.json({success:true}),console:{log(){},warn(){},error(){}}});
  return{provider,writes,reads,run:body=>handler(new Request(BASE,{method:'POST',headers:{Authorization:'Bearer synthetic',origin:'https://quickguard.uk','Content-Type':'application/json'},body:JSON.stringify({planId:'client-pro',billingCycle:'monthly',...body})}))};
}
test('invalid sandbox configuration blocks subscription creation, switching, redemption and cancellation before provider or account operations',async()=>{
  for(const config of [{key:'sk_live_fixture'},{app:'https://quickguard.uk'},{app:''}])for(const action of [{},{existingSubscription:true},{tokensToRedeem:100,tokenCheckoutRequestId:REQUEST},{cancelTokenCheckout:true,tokenCheckoutRequestId:REQUEST}]){
    const h=fixture({...config,existingSubscription:action.existingSubscription});const response=await h.run(action);
    assert.equal(response.status,500);assert.deepEqual(h.provider,[]);assert.deepEqual(h.writes,[]);assert.deepEqual(h.reads,[]);
  }
});
test('valid sandbox subscription checkout keeps all return URLs on the exact sandbox origin',async()=>{
  const h=fixture();assert.equal((await h.run({siteUrl:'https://quickguard.uk'})).status,200);
  const call=h.provider.find(item=>item.checkout).checkout;assert.equal(call.success_url,APP+'/subscription/success?session_id={CHECKOUT_SESSION_ID}');assert.equal(call.cancel_url,APP+'/pricing?cancelled=true');
});
test('production subscription checkout retains its existing validated return URL',async()=>{
  const h=fixture({project:'https://production.example.invalid',key:'sk_live_fixture',app:''});assert.equal((await h.run({siteUrl:'https://www.quickguard.uk'})).status,200);
  const call=h.provider.find(item=>item.checkout).checkout;assert.equal(call.success_url,'https://www.quickguard.uk/subscription/success?session_id={CHECKOUT_SESSION_ID}');assert.equal(call.cancel_url,'https://www.quickguard.uk/pricing?cancelled=true');
});
