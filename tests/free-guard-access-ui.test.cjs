const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/enterprise-module.cjs');
const {hooksHarness,nodes,content,childMocks}=require('./helpers/guard-ui-fixture.cjs');
const {renderToStaticMarkup}=require('react-dom/server');
const React=require('react');

test('guard usage shows free applications without upgrade, paid tier or quota progress; old deployment fails explicitly',async()=>{
  for(const usage of [
    {allowed:true,used:50,limit:null,remaining:null,planSlug:'guard-free-access'},
    {allowed:true,used:1,limit:2,remaining:1,planSlug:'guard-basic'},
    {allowed:false,used:0,limit:null,remaining:null,planSlug:'guard-free-access'},null
  ]){
    const h=hooksHarness('components/GuardUsageWidget.tsx',{'@/lib/supabase':{supabase:{}},'@/lib/guard-application-limits':{checkGuardApplicationLimit:async()=>usage}});
    h.render({guardId:'guard'});await h.effects();const tree=h.render({guardId:'guard'}),text=content(tree);
    assert.doesNotMatch(text,/Upgrade|Current Plan|Job Access Level|Resets/);
    if(usage?.allowed&&usage.limit===null){assert.match(text,/50 applications submitted/);assert.match(text,/No monthly application cap or paid job tiers/);}
    else assert.match(text,/could not be confirmed|Unable to load/);
    h.unmount();
  }
});

test('shared usage widget removes guard upsell and retains client quota recovery',()=>{
  const Widget=load('components/UsageLimitWidget.tsx',{'next/link':{__esModule:true,default:p=>React.createElement('a',p)}}).default;
  const props={featureLabel:'Applications',icon:'ri-briefcase-line',limit:1,used:1,remaining:0,planName:'Legacy',periodEnd:'2026-12-01'};
  const guard=renderToStaticMarkup(React.createElement(Widget,{...props,audience:'guard'}));
  assert.doesNotMatch(guard,/Upgrade|\/upgrade|Legacy/);assert.match(guard,/could not be confirmed/);
  const client=renderToStaticMarkup(React.createElement(Widget,{...props,audience:'client'}));
  assert.match(client,/\/upgrade\?reason=job_limit_reached/);assert.match(client,/post more jobs/);
});

function applyFixture({allowed=true,server={ok:true,applicationId:'application'},licences=['Door Supervisor']}={}){
  const redirects=[],applications=[],rpcCalls=[],tables=[];
  const router={push:p=>redirects.push(p)};
  const db={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},rpc:async(name,params)=>{rpcCalls.push({name,params});return{data:{allowed,reason:allowed?'free_access':'guard_inactive',used:50,limit:null,remaining:null,plan_slug:'guard-free-access'},error:null};},from(table){tables.push(table);const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='guards'?{id:'guard',full_name:'QA Guard',verification_status:'approved',licence_types:licences}:table==='jobs'?{id:'job',job_title:'QA free application',start_date:'2099-01-01',status:'open',sia_licence_required:true,required_licence_types:['Door Supervisor'],hourly_rate:15}:null,error:null})};return q;}};
  const h=hooksHarness('app/guard/jobs/[id]/apply/GuardApplyClient.tsx',{...childMocks,'@/components/JobContractPanel':{__esModule:true,default:()=>null},'@/lib/supabase':{supabase:db},'next/navigation':{useRouter:()=>router},'@/lib/guard-applications':{submitGuardApplication:async args=>{applications.push(args);return server;}}},{setTimeout(){}});
  return{h,redirects,applications,rpcCalls,tables};
}
test('actual apply screen submits after fifty applications without reading any subscription and retains licence/failure checks',async()=>{
  for(const opts of [{},{allowed:false},{server:{ok:false,limitReached:true}},{licences:['CCTV Operator']}]){
    const f=applyFixture(opts),props={jobId:'job'};f.h.render(props);await f.h.effects();
    const button=nodes(f.h.render(props)).find(n=>n.type==='button'&&/Submit Application/.test(content(n)));assert.ok(button);await button.props.onClick();
    const text=content(f.h.render(props));assert.equal(f.tables.some(t=>/entitlement|plan|subscription/.test(t)),false);assert.deepEqual(f.redirects,[]);
    if(opts.allowed===false||opts.licences){assert.equal(f.applications.length,0);assert.doesNotMatch(text,/submitted successfully/);}
    else if(opts.server){assert.match(text,/Application access could not be confirmed/);assert.doesNotMatch(text,/submitted successfully/);}
    else{assert.match(text,/submitted successfully/);assert.deepEqual(f.applications,[{guardId:'guard',jobId:'job',coverMessage:''}]);assert.deepEqual(f.rpcCalls,[{name:'get_my_feature_usage',params:{p_feature_key:'guard_application'}}]);}
    f.h.unmount();
  }
});


test('application tracker reports zero monthly submissions accurately and never invents an allowance',()=>{
  const Tracker=load('app/guard/dashboard/ApplicationTracker.tsx').default;
  const rows=[{id:'old',status:'pending'},{id:'selected',status:'selected'}];
  for(const used of [0,50,undefined]){
    const html=renderToStaticMarkup(React.createElement(Tracker,{applications:rows,applicationsUsed:used}));
    assert.doesNotMatch(html,/Upgrade|remaining this month|of 10|Resets/);
    assert.match(html,/No monthly cap/);if(used===0)assert.match(html,/>0<\/p>/);
  }
});
