const {test}=require('node:test');const assert=require('node:assert/strict');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./helpers/enterprise-module.cjs');const {hooksHarness,nodes}=require('./helpers/guard-ui-fixture.cjs');
const Link={__esModule:true,default:p=>React.createElement('a',p,p.children)};
test('all four £144 client booking examples agree with authoritative fee math; unavailable fees are never zero',()=>{
 const Examples=load('components/pricing/ClientBookingExamples.tsx').default;const policy=load('supabase/functions/_shared/booking-policy.ts');
 const plans=[['client_free',0,15],['client-starter',4900,10],['client-pro',9900,7.5],['client-enterprise',19900,5]].map(([slug,monthly,fee])=>({slug,name:slug,audience:'client',monthly_price_pence:monthly,bookingFee:fee,bookingFeeFixedPence:0}));
 const html=renderToStaticMarkup(React.createElement(Examples,{plans}));
 for(const [i,total]of [16560,15840,15480,15120].entries()){assert.equal(policy.bookingAmounts(14400,plans[i].bookingFee).clientTotalPence,total);assert.match(html,new RegExp('£'+(total/100).toFixed(2).replace('.','\\.')));}
 assert.match(html,/8 hours at £18\/hour/);assert.match(html,/£144\.00/);
 assert.match(html,/QuickGuard is not VAT registered/);assert.match(html,/No VAT is added/);assert.match(html,/Monthly subscription is additional/);
 const failed=renderToStaticMarkup(React.createElement(Examples,{plans:[{...plans[0],bookingFee:undefined}]}));assert.match(failed,/Fee unavailable/);assert.match(failed,/Total unavailable/);assert.doesNotMatch(failed,/£138\.00/);
});
function guardUpgrade(pending=false){const calls=[];const db={auth:{getUser:async()=>({data:{user:{id:'guard'}},error:null}),getSession:async()=>({data:{session:{access_token:'synthetic'}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(){const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{user_type:'guard'},error:null})};return q;},rpc:async()=>({data:{enabled:false,balance:500,pence_per_100:1000,max_percent:50,pending:pending?{request_id:'33333333-3333-4333-8333-333333333333',plan_slug:'guard-elite',billing_cycle:'monthly',tokens:100}:null},error:null})};
 const h=hooksHarness('app/upgrade/page.tsx',{'next/link':Link,'@/lib/supabase':{supabase:db},'@/components/NavSidebar':{__esModule:true,default:()=>null},'next/navigation':{useSearchParams:()=>new URLSearchParams('reason=guard_application_limit_reached&plan=guard-elite')},'@/lib/entitlements':{getActivePlan:async()=>({plan_slug:'guard-elite',monthly_price_pence:2900,plan_name:'Existing paid plan'})},'@/lib/use-public-pricing':{usePublicPricing:()=>({plans:[{slug:'guard-elite',audience:'guard',monthly_price_pence:2900,features:['guard.profile_boost']}],loading:false,error:null})}},{fetch:async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});return{ok:true,json:async()=>({cancelled:true})};},alert(){}});
 const outer=h.render().props.children.type;const render=()=>h.renderComponent(outer);return{h,render,calls};}
test('signed-in formerly paid guard sees free access even with stale paid catalogue/limit URL; no sales or token selector',async()=>{
 const f=guardUpgrade();f.render();await f.h.effects();const html=renderToStaticMarkup(f.render());assert.match(html,/Free guard account/);assert.match(html,/Find Jobs/);assert.match(html,/Membership &amp; billing records/);assert.doesNotMatch(html,/Subscribe|Monthly Application Limit Reached|Tokens to redeem|£29\.00/);assert.deepEqual(f.calls,[]);f.h.unmount();
});
test('guard can cancel a historical pending token checkout without being offered a new purchase',async()=>{
 const f=guardUpgrade(true);f.render();await f.h.effects();const tree=f.render();const cancel=nodes(tree).find(n=>n.type==='button'&&n.props.children==='Cancel pending checkout');assert.ok(cancel);await cancel.props.onClick();assert.equal(f.calls.length,1);assert.equal(f.calls[0].body.cancelTokenCheckout,true);assert.equal(f.calls[0].body.planId,'guard-elite');f.h.unmount();
});
