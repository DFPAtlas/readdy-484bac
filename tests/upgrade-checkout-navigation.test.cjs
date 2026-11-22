const {test}=require('node:test');
const assert=require('node:assert/strict');
const {hooksHarness,nodes}=require('./helpers/guard-ui-fixture.cjs');
function fixture({blocked=true,changedOwner=false}={}){
 let reads=0;const opened=[],assigned=[],notices=[],requests=[];
 const db={auth:{getUser:async()=>({data:{user:{id:changedOwner&&++reads>=3?'other':'owner',email:'qa@example.invalid'}},error:null}),getSession:async()=>({data:{session:{access_token:'qa-token'}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:{user_type:'guard'},error:null})};return q;},rpc:async()=>({data:{enabled:false},error:null})};
 const plan={slug:'guard-elite',name:'Guard Elite',audience:'guard',monthly_price_pence:2900,stripe_price_id:'price_test',stripe_annual_price_id:null,features:['guard.profile_boost'],job_limit_per_month:40};
 const h=hooksHarness('app/upgrade/page.tsx',{'@/lib/supabase':{supabase:db},'next/navigation':{useSearchParams:()=>new URLSearchParams()},'@/lib/entitlements':{getActivePlan:async()=>null},'@/lib/use-public-pricing':{usePublicPricing:()=>({plans:[plan],loading:false,error:null,feesError:false})}},
 {window:{location:{origin:'https://quickguard.uk',pathname:'/upgrade',assign:url=>assigned.push(url)},open:(url,target)=>{opened.push({url,target});return blocked?null:{};}},fetch:async(url,request)=>{requests.push({url,body:JSON.parse(request.body)});await Promise.resolve();return{ok:true,json:async()=>({url:'https://checkout.stripe.com/c/pay/cs_test_fixture'})};},alert:v=>notices.push(v)});
 async function execute(){const Inner=h.render().props.children.type;h.renderComponent(Inner);await h.effects();const subscribe=nodes(h.renderComponent(Inner)).find(n=>n.type==='button'&&n.props.children==='Subscribe');assert.ok(subscribe);await subscribe.props.onClick();h.unmount();}
 return{execute,opened,assigned,notices,requests};
}
test('actual upgrade continues in the same tab when async checkout popup is blocked',async()=>{const h=fixture();await h.execute();assert.equal(h.requests.length,1);assert.equal(h.requests[0].body.planId,'guard-elite');assert.deepEqual(h.assigned,['https://checkout.stripe.com/c/pay/cs_test_fixture']);assert.equal(h.opened.length,1);});
test('actual upgrade keeps the working new-tab flow when popup is allowed',async()=>{const h=fixture({blocked:false});await h.execute();assert.equal(h.opened.length,1);assert.equal(h.opened[0].target,'_blank');assert.deepEqual(h.assigned,[]);});
test('account changes during checkout prevent both navigation paths',async()=>{const h=fixture({changedOwner:true});await h.execute();assert.deepEqual(h.opened,[]);assert.deepEqual(h.assigned,[]);assert.equal(h.notices.length,1);});
