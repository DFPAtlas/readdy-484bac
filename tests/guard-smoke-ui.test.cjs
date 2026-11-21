const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/enterprise-module.cjs');
const {hooksHarness,nodes,content,childMocks,uiDatabase}=require('./helpers/guard-ui-fixture.cjs');
const ready={connected:true,detailsSubmitted:true,payoutsEnabled:true,transfersEnabled:true,status:'ready',requirementsDue:[],restrictedReason:null,lastCheckedAt:'2026-11-21T19:00:00Z'};
const settings=()=>({profile:{id:'guard',userId:'owner'},status:null,loading:false,refreshing:false,error:'',statusError:'Stripe status unavailable',refresh:async()=>{}});

test('actual application tracker renders seven Selected outcomes separately from accepted offers',()=>{
  const Tracker=load('app/guard/dashboard/ApplicationTracker.tsx',childMocks).default;
  const tree=Tracker({applications:Array.from({length:7},()=>({status:'selected'}))});
  const groups=nodes(tree).filter(n=>n.type==='div').map(content);
  assert.ok(groups.includes('7Selected'));assert.ok(groups.includes('0Accepted'));
});

test('actual earnings screen hydrates completed jobs and includes four paid_out receipts in both views',async()=>{
  const db=uiDatabase();const h=hooksHarness('app/guard/earnings/page.tsx',{...childMocks,'@/lib/supabase':{supabase:db},'@/hooks/useRouteGuard':{useRouteGuard:()=>({checking:false,blocked:false})}});
  h.render();await h.effects();let tree=h.render();
  const summary=nodes(tree).find(n=>n.props?.totalEarned!==undefined);assert.equal(summary.props.totalEarned,250);assert.equal(summary.props.paidCount,4);
  const historyButton=nodes(tree).find(n=>n.type==='button'&&content(n).includes('Payout History'));historyButton.props.onClick();tree=h.render();
  assert.match(content(tree),/£250\.00/);assert.match(content(tree),/4 completed payout/);
  const query=db.calls.find(c=>c.table==='job_assignments');assert.ok(query.fields.includes('assigned_at'));assert.ok(!query.fields.includes('shift_start_time'));
  h.unmount();
});

test('failed earnings reads and account changes show recovery instead of healthy zero balances',async()=>{
  for(const mode of ['failed','changed','foreign-history']) {
    const db=uiDatabase();if(mode==='failed')db.failure='job_assignments';if(mode==='changed')db.afterHistory=()=>{db.owner='other';};if(mode==='foreign-history')db.historyGuard='other';
    const h=hooksHarness('app/guard/earnings/page.tsx',{...childMocks,'@/lib/supabase':{supabase:db},'@/hooks/useRouteGuard':{useRouteGuard:()=>({checking:false,blocked:false})}});
    h.render();await h.effects();const tree=h.render();assert.equal(tree.props.role,'alert',mode);assert.match(content(tree),/Retry earnings/);assert.doesNotMatch(content(tree),/No payouts found|£0\.00/);h.unmount();
  }
});

test('mobile uses the owned history response, not a public embedded read that hides selected jobs',async()=>{
  const db=uiDatabase(),payout=settings();payout.status=ready;
  const h=hooksHarness('app/guard/mobile/MobileGuardDashboard.tsx',{...childMocks,'@/lib/supabase':{supabase:db},'next/navigation':{useRouter:()=>({push(){}})},'@/hooks/useGuardPayoutSettings':{useGuardPayoutSettings:()=>payout},'@/hooks/usePushNotifications':{usePushNotifications:()=>({subscribed:false})}});
  h.render();await h.effects();const tree=h.render();
  assert.match(content(tree),/4Selected/);assert.match(content(tree),/250\.00/);assert.doesNotMatch(content(tree),/Add bank details/);
  assert.equal(db.calls.filter(c=>c.table==='job_applications'||c.table==='job_assignments').length,0);h.unmount();
});

test('Payment Centre never converts cached ready flags into verified readiness and gates actions until verification',async()=>{
  const db=uiDatabase(),payout=settings();let requests=0;
  const h=hooksHarness('hooks/useGuardPaymentCentre.ts',{'@/lib/supabase':{supabase:db},'@/hooks/useGuardPayoutSettings':{useGuardPayoutSettings:()=>payout}},{fetch:async()=>{requests++;return Response.json({url:'https://dashboard.stripe.com/test'});}});
  let api=h.renderHook('useGuardPaymentCentre');await h.effects();api=h.renderHook('useGuardPaymentCentre');
  assert.equal(api.stripeStatus,null);assert.equal(api.stripeError,'Stripe status unavailable');
  await assert.rejects(api.handleDashboardLink(),/verify/);assert.equal(requests,0);
  payout.status=ready;payout.statusError='';api=h.renderHook('useGuardPaymentCentre');db.owner='other';
  await assert.rejects(api.handleDashboardLink(),/account has changed/);assert.equal(requests,0);h.unmount();
});

test('actual Payment Centre renders unavailable and checking states without Stripe setup actions',()=>{
  for(const stripeLoading of [false,true]) {
    const api={loading:false,error:null,refetch(){},earningsSummary:{availableBalance:250,pendingBalance:0,thisMonthEarnings:0,lifetimeEarnings:250,nextEstimatedPayout:'—'},stripeStatus:null,stripeLoading,stripeError:stripeLoading?'':'Stripe status unavailable',jobPayments:[],refreshStripeStatus(){},handleConnectStripe(){},handleOnboardingLink(){},handleDashboardLink(){},exportCsv(){}};
    const h=hooksHarness('app/guard/payment-centre/page.tsx',{...childMocks,'@/lib/supabase':{supabase:uiDatabase()},'@/lib/SidebarContext':{useSidebar:()=>({collapsed:false})},'@/hooks/useGuardGuard':{useGuardGuard:()=>({loading:false,allowed:true})},'@/hooks/useGuardPaymentCentre':{useGuardPaymentCentre:()=>api}});
    const text=content(h.render());assert.match(text,stripeLoading?/Checking Stripe account status/:/Stripe status unavailable/);assert.doesNotMatch(text,/Ready for Payouts|Set Up Payouts|Update Bank Details/);
  }
});
