const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
function load(path,mocks={}) {const module={exports:{}};new Function('module','exports','require',compile(fs.readFileSync(path,'utf8')))(module,module.exports,name=>mocks[name]??require(name));return module.exports;}
const lifecycle=load('lib/client-job-tracker.ts',{'./attendance-display.cjs':require('../lib/attendance-display.cjs')});
const journey=load('lib/client-journey.ts');
const flush=async()=>{for(let i=0;i<80;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const job=(id,status,extra={})=>({id,status,client_id:'client',is_deleted:false,job_title:id,created_at:'2026-11-01T00:00:00Z',hourly_rate:20,number_of_guards:1,job_applications:[{count:0}],...extra});
const fixtures=[job('draft','draft'),...Array.from({length:4},(_,i)=>job('paid'+i,'paid_out')),...Array.from({length:4},(_,i)=>job('cancel'+i,'cancelled')),job('deleted','cancelled',{is_deleted:true}),job('archived','closed',{is_deleted:true}),job('foreign','in_progress',{client_id:'another-client'})];

function harness(options={}) {
  const source=fs.readFileSync('app/client/jobs/tracker/JobTrackerClient.tsx','utf8');
  const start=source.indexOf('export default function JobTrackerClient() {')+'export default function JobTrackerClient() {'.length;
  const body=source.slice(start,source.indexOf('  if (loading ||',start));
  const prelude=source.slice(source.indexOf('function getInitials'),source.indexOf('export default function'));
  const slots=[],effects=[],pending=[],queries=[],channels=[],removed=[],timers=new Map();let cursor=0,writes=0,timerId=0;
  let context={clientId:'client',userId:'user',companyName:'Test',subscriptionTier:'starter',allowed:true,authLoading:false,checking:false,blocked:false};
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
  const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{writes++;slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},useCallback(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn;},useEffect(fn,deps){const i=cursor++;if(!effects[i]||!same(effects[i].deps,deps))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});}};
  const normal=call=>{
    let rows=call.table==='jobs'?options.jobs??fixtures:call.table==='job_assignments'?options.assignments??[]:options.replacements??[];
    for(const [method,key,value] of call.filters){if(method==='eq')rows=rows.filter(row=>row[key]===value);if(method==='in')rows=rows.filter(row=>value.includes(row[key]));}
    const count=rows.length;
    if(call.table==='jobs'){rows=[...rows].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));if(call.range)rows=rows.slice(call.range[0],call.range[1]+1);}
    return {data:rows,error:null,count};
  };
  const db={from(table){const call={table,filters:[]};queries.push(call);const q={select(fields,options){call.fields=fields;call.options=options;return q;},eq(key,value){call.filters.push(['eq',key,value]);return q;},in(key,value){call.filters.push(['in',key,value]);return q;},order(key,options){(call.orders??=[]).push([key,options]);return q;},range(first,last){call.range=[first,last];return q;},then(resolve,reject){return Promise.resolve().then(()=>options.read?options.read(call,()=>normal(call)):normal(call)).then(resolve,reject);}};return q;},channel(name){const channel={name,on(kind,filter,notify){channel.filter=filter;channel.notify=notify;return channel;},subscribe(callback){channels.push(channel);channel.callback=callback;return channel;}};return channel;},removeChannel(channel){removed.push(channel);}};
  const env={...hooks,...lifecycle,...journey,supabase:db,PAGE_SIZE:8,REALTIME_DEBOUNCE_MS:500,useClientAuth:()=>context,useClientGuard:()=>({loading:context.authLoading,allowed:context.allowed}),useRouteGuard:()=>({checking:context.checking,blocked:context.blocked}),setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)};
  const component=new Function(...Object.keys(env),compile(prelude+'return function(){'+body+'return {jobs,loading,refreshing,error,totalCount,hasMore,filter,liveStatus,loadJobs,handleFilterChange,handleLoadMore};}'))(...Object.values(env));
  return {queries,channels,removed,get writes(){return writes;},render(next={}){context={...context,...next};cursor=0;return component();},async effects(){pending.splice(0).forEach(fn=>fn());await flush();},async start(next={}){this.render(next);await this.effects();return this.render();},async timers(){const fns=[...timers.values()];timers.clear();fns.forEach(fn=>fn());await flush();},unmount(){effects.forEach(e=>e?.cleanup?.());}};
}

test('all deployed lifecycle states have explicit labels and completed work never returns to step one',()=>{
  const supported='draft open pending awaiting_guard_selection awaiting_payment funded confirmed in_progress completed awaiting_client_approval awaiting_client_confirmation payout_approved paid_out review_pending cancelled closed'.split(' ');
  assert.deepEqual(Object.keys(lifecycle.TRACKER_LIFECYCLE).sort(),supported.sort());
  for(const status of ['completed','payout_approved','paid_out','review_pending']){assert.equal(lifecycle.trackerLifecycle(status).stage,5);for(let step=1;step<=5;step++)assert.equal(lifecycle.trackerStepState(status,step),'done');assert.ok(lifecycle.TRACKER_FILTER_STATUSES.completed.includes(status));}
  assert.equal(lifecycle.trackerStepState('awaiting_client_approval',5),'active');
  for(const status of ['draft','closed','cancelled','future_status','toString'])assert.equal(lifecycle.trackerLifecycle(status).stage,null);
  assert.equal(lifecycle.trackerLifecycle('paid_out').label,'Paid Out');assert.equal(lifecycle.trackerLifecycle('payout_approved').label,'Payout Pending');assert.equal(lifecycle.trackerLifecycle('future_status').label,'Status unavailable');
});

test('active attendance excludes checkout/completion/cancelled assignments and terminal jobs',()=>{
  const rows=[{status:'confirmed',attendance_status:'checked_in'},{status:'in_progress',attendance_status:'late',check_in_time:'now',issue_reported:true,replacement_requested:true},{status:'confirmed',attendance_status:'no_show'},{status:'completed',attendance_status:'checked_in',issue_reported:true},{status:'cancelled',attendance_status:'no_show',replacement_requested:true},{status:'in_progress',attendance_status:'checked_out',check_out_time:'now',issue_reported:true}];
  assert.deepEqual(lifecycle.trackerAttendance(rows,'in_progress'),{checkedIn:2,late:1,noShow:1,issues:1,replacements:1});
  for(const status of ['completed','paid_out','review_pending','cancelled','closed'])assert.deepEqual(lifecycle.trackerAttendance(rows,status),{checkedIn:0,late:0,noShow:0,issues:0,replacements:0});
});

test('all tabs and load-more counts use owned non-deleted rows with stable ordering',async()=>{
  const r=harness();let api=await r.start();assert.equal(api.jobs.length,0);assert.equal(api.totalCount,0);
  api.handleFilterChange('completed');await flush();api=r.render();assert.equal(api.jobs.length,4);assert.equal(api.totalCount,4);assert.ok(api.jobs.every(j=>j.status==='paid_out'));
  api.handleFilterChange('cancelled');await flush();api=r.render();assert.equal(api.totalCount,4);
  api.handleFilterChange('all');await flush();api=r.render();assert.equal(api.jobs.length,8);assert.equal(api.totalCount,9);assert.equal(api.hasMore,true);
  api.handleLoadMore();await flush();api=r.render();assert.equal(api.jobs.length,9);assert.equal(api.hasMore,false);assert.equal(new Set(api.jobs.map(j=>j.id)).size,9);assert.ok(api.jobs.every(j=>j.client_id==='client'&&j.is_deleted===false));
  for(const q of r.queries.filter(q=>q.table==='jobs')){assert.ok(q.filters.some(f=>JSON.stringify(f)===JSON.stringify(['eq','client_id','client'])));assert.ok(q.filters.some(f=>JSON.stringify(f)===JSON.stringify(['eq','is_deleted',false])));assert.deepEqual(q.orders.map(v=>v[0]),['created_at','id']);assert.equal(q.options.count,'exact');}
  r.unmount();
});

test('attendance/enrichment reads are restricted to the returned job IDs and failures do not invent zeroes',async()=>{
  const rows=[job('live','in_progress')];
  for(const table of ['jobs','job_assignments','replacement_requests'])for(const failure of [{data:null,error:{message:'private detail'}},{data:null,error:null},Error('offline')]){
    let fail=true;const r=harness({jobs:rows,read(call,normal){if(fail&&call.table===table){if(failure instanceof Error)throw failure;return failure;}return normal();}});
    let api=await r.start();assert.match(api.error,/Unable to load current job tracking/);assert.deepEqual(api.jobs,[]);assert.equal(api.hasMore,false);
    fail=false;await api.loadJobs();api=r.render();assert.equal(api.error,null);assert.equal(api.jobs[0].id,'live');
    for(const query of r.queries.filter(q=>q.table!=='jobs'))assert.ok(query.filters.some(f=>f[0]==='in'&&f[1]==='job_id'&&JSON.stringify(f[2])==='["live"]'));
    r.unmount();
  }
});

test('finished attendance is not counted as currently checked in and cancelled assignments are not assigned',async()=>{
  const r=harness({jobs:[job('live','in_progress'),job('finished','paid_out')],assignments:[{job_id:'live',status:'in_progress',attendance_status:'checked_in'},{job_id:'live',status:'completed',attendance_status:'checked_out'},{job_id:'live',status:'cancelled',attendance_status:'no_show'},{job_id:'finished',status:'completed',attendance_status:'checked_in'}]});
  let api=await r.start();assert.equal(api.jobs[0].checked_in_count,1);assert.equal(api.jobs[0].assigned_guards,2);assert.equal(api.jobs[0].no_show_count,0);
  api.handleFilterChange('all');await flush();api=r.render();assert.equal(api.jobs.find(j=>j.id==='finished').checked_in_count,0);r.unmount();
});

test('late requests cannot overwrite newer filters or clear their loading state',async()=>{
  for(const failure of [false,true]){
    const old=deferred(),current=deferred();let reads=0;const r=harness({read(call,normal){if(call.table==='jobs'&&++reads===2)return old.promise;if(call.table==='jobs'&&reads===3)return current.promise;return normal();}});
    let api=await r.start();api.handleFilterChange('all');await flush();api=r.render();api.handleFilterChange('completed');await flush();
    if(failure)old.reject(Error('late'));else old.resolve({data:fixtures,count:12});await flush();assert.equal(r.render().loading,true);
    current.resolve({data:[job('latest','paid_out')],count:1});await flush();api=r.render();assert.equal(api.jobs[0].id,'latest');assert.equal(api.filter,'completed');assert.equal(api.error,null);r.unmount();
  }
});

test('auth gating, identity changes, realtime refresh and unmount retire old work',async()=>{
  const r=harness();await r.start({authLoading:true});assert.equal(r.queries.length,0);assert.equal(r.channels.length,0);
  r.render({authLoading:false});await r.effects();assert.equal(r.channels.length,4);assert.ok(r.channels[0].filter.filter==='client_id=eq.client');assert.ok(r.channels[3].filter.filter==='client_id=eq.client');
  const oldChannel=r.channels[0];r.render({clientId:'new-client'});await r.effects();const reads=r.queries.length;oldChannel.notify();await r.timers();assert.equal(r.queries.length,reads);
  r.channels.at(-1).notify();await r.timers();assert.ok(r.queries.length>reads);r.unmount();assert.equal(r.removed.length,8);
  const waiting=deferred();const pending=harness({read:()=>waiting.promise});await pending.start();pending.unmount();const writes=pending.writes;waiting.resolve({data:[],count:0});await flush();assert.equal(pending.writes,writes);
  const blocked=harness();const locked=await blocked.start({blocked:true});assert.equal(locked.loading,false);assert.equal(blocked.queries.length,0);assert.equal(blocked.channels.length,0);blocked.unmount();
});

test('cards render paid-out/completed stages, explicit terminal/unknown states and safe actions',()=>{
  const Card=load('app/client/jobs/tracker/JobTrackerCard.tsx',{'@/lib/client-job-tracker':lifecycle,'@/lib/client-journey':journey,'@/lib/date-only':{formatDateOnly:x=>x},'next/link':{__esModule:true,default:props=>React.createElement('a',props,props.children)}}).default;
  const render=(status,extra={})=>renderToStaticMarkup(React.createElement(Card,{job:{...job('owned',status),applications_count:0,assigned_guards:1,...extra},onRefresh(){}}));
  for(const status of ['paid_out','payout_approved','review_pending','completed']){const html=render(status,{no_show_count:1,issue_count:1});assert.match(html,/Step 5 of 5/);assert.doesNotMatch(html,/Pending Review|Step 1 of 5|Pay Now|Attendance Issue|request a replacement/);}
  for(const status of ['closed','draft','cancelled','future_status'])assert.doesNotMatch(render(status),/Step [1-5] of 5/);
  assert.match(render('future_status'),/Status unavailable/);assert.match(render('awaiting_client_approval'),/Review Completion/);
  assert.doesNotMatch(render('awaiting_payment',{payment_status:'funded'}),/Pay Now/);
});

test('stats label the loaded scope and include paid-out work without historical attendance',()=>{
  const Stats=load('app/client/jobs/tracker/TrackerStatsBar.tsx',{'@/lib/client-job-tracker':lifecycle}).default;
  const html=renderToStaticMarkup(React.createElement(Stats,{jobs:[job('paid','paid_out',{checked_in_count:2,no_show_count:3}),job('review','review_pending')]}));
  assert.match(html,/Loaded Jobs/);assert.match(html,/Counts cover the loaded jobs/);assert.match(html,/>2<\/p><p[^>]*>Completed/);assert.doesNotMatch(html,/Checked In|No-Show|Requests Open/);
});

test('page-level errors do not present failed reads as empty jobs or zero-valued counters',()=>{
  let state=0;
  const hooks={...React,useState(initial){const n=state++;const original=React.useState(initial);return n===0?[false,()=>{}]:n===1?[[],()=>{}]:n===12?['Unable to load current job tracking and attendance. Please retry.',()=>{}]:original;}};
  const Page=load('app/client/jobs/tracker/JobTrackerClient.tsx',{
    react:hooks,'@/lib/supabase':{supabase:{}},'@/lib/client-job-tracker':lifecycle,'@/lib/client-journey':journey,
    '@/hooks/useRouteGuard':{useRouteGuard:()=>({checking:false,blocked:false})},'@/hooks/useClientGuard':{useClientGuard:()=>({loading:false,allowed:true})},'@/lib/ClientAuthContext':{useClientAuth:()=>({clientId:'client',userId:'user'})},
    '@/components/PortalSidebar':{__esModule:true,default:()=>null},'@/components/LiveIndicator':{__esModule:true,default:()=>null},'@/components/UpgradePrompt':{__esModule:true,default:()=>null},'@/app/client/help/ContextualHelpCard':{__esModule:true,default:()=>null},
    './JobTrackerCard':{__esModule:true,default:()=>null},'./TrackerStatsBar':{__esModule:true,default:()=>React.createElement('p',null,'COUNTERS')},'next/link':{__esModule:true,default:props=>React.createElement('a',props,props.children)},
  }).default;
  const html=renderToStaticMarkup(React.createElement(Page));assert.match(html,/role="alert"/);assert.match(html,/Please retry/);assert.doesNotMatch(html,/No .*jobs to track|COUNTERS|Showing 0 of 0/);
});
