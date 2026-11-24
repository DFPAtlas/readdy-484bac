const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/enterprise-module.cjs');
const { content, hooksHarness, nodes, flush } = require('./helpers/guard-ui-fixture.cjs');
const { ADMIN_EDGE_FUNCTIONS, loadAdminEdgePings, edgeStatusBadge } = load('lib/adminEdgeHealth.ts');
const Panel = load('components/admin/AdminEdgeChecks.tsx').default;

test('refresh probes only five active GET routes, without credentials, bodies or retired/worker invocations', async () => {
  const calls = [];
  const pings = await loadAdminEdgePings('https://fixture.invalid/', async (url, options) => {
    calls.push({url, options});
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.body, undefined);
    assert.equal(options.headers, undefined);
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    return new Response('', {status:401});
  });
  assert.equal(calls.length, 5);
  assert.equal(new Set(calls.map(c => c.url)).size, 5);
  assert.ok(calls.every(c => !/release-guard-payment|process-overdue-guard-payouts/.test(c.url)));
  assert.deepEqual(pings.map(p => p.slug), ADMIN_EDGE_FUNCTIONS.map(f => f.slug));
  for (const [slug, status] of [['release-guard-payment','retired'],['process-overdue-guard-payouts','server_only']]) {
    const ping = pings.find(p => p.slug === slug);
    assert.equal(ping.status,status);
    assert.equal(ping.httpStatus,null);
    assert.equal(ping.latency,null);
    assert.equal(ping.checkedAt,null);
  }
  assert.equal(pings.filter(p => p.status === 'protected').length, 5);
});

test('protected, missing, rate-limited, server-error and unexpected responses cannot appear Online', async () => {
  for (const [http,status] of [[200,'reachable'],[204,'reachable'],[400,'reachable'],[405,'reachable'],[401,'protected'],[403,'protected'],[404,'not_found'],[410,'not_found'],[429,'rate_limited'],[422,'unknown'],[500,'degraded'],[503,'degraded']]) {
    const pings = await loadAdminEdgePings('https://fixture.invalid',async () => new Response(null,{status:http}));
    for(const ping of pings.filter(p => !['retired','server_only'].includes(p.status))) {
      assert.equal(ping.status,status); assert.equal(ping.httpStatus,http);
      assert.notEqual(edgeStatusBadge(ping.status).label,'Online');
      assert.ok(Number.isFinite(Date.parse(ping.checkedAt)));
    }
    const text = content(Panel({pings,loading:false}));
    assert.doesNotMatch(text,/Online|All Systems Operational/);
    if(http===404||http===410) assert.match(text,/Not found/);
    if(http===401||http===403) assert.match(text,/Authorised operation is not tested/);
  }
});

test('network/CORS errors and deadlines preserve unverified health and expose no private error', async () => {
  const network = await loadAdminEdgePings('https://fixture.invalid',async () => {throw Error('private host credentials');});
  const active = network.filter(p=>p.status==='unknown');
  assert.equal(active.length,5);
  assert.ok(active.every(p=>p.httpStatus===null&&p.latency===null));
  assert.doesNotMatch(JSON.stringify(network),/private host credentials/);
  const slow = await loadAdminEdgePings('https://fixture.invalid',async (_url,{signal}) => new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true})),undefined,2);
  assert.equal(slow.filter(p=>p.status==='unknown').length,5);
  const controller=new AbortController();controller.abort();let calls=0;
  const cancelled=await loadAdminEdgePings('https://fixture.invalid',async()=>{calls++;},controller.signal);
  assert.equal(calls,0);assert.equal(cancelled.filter(p=>p.status==='unknown').length,5);
});

test('panel separates retirement, server-only access and dispatch history from completion, including while loading',async()=>{
  const pings=await loadAdminEdgePings('https://fixture.invalid',async()=>new Response(null,{status:401}));
  for(const loading of [true,false]){
    const tree=Panel({pings:loading?[]:pings,loading});const text=content(tree);
    assert.match(text,/Retired/);assert.match(text,/Server only/);
    assert.match(text,/worker completion is not verified here/);
    assert.doesNotMatch(text,/Retired: returns 410|HTTP —|Offline|Online/);
    for(const slug of ['release-guard-payment','process-overdue-guard-payouts']) {
      const card=nodes(tree).find(n=>n.key===slug);assert.ok(card);assert.doesNotMatch(content(card),/HTTP|\d+ms/);
    }
  }
});

function systemFixture(harness=hooksHarness) {
  const waits=[];let aborted=0;
  const stub=()=>null;
  const h=harness('app/admin/system-status/SystemStatusClient.tsx',{
    'next/link':{__esModule:true,default:stub},
    '@/components/admin/StorageUsageWidget':{__esModule:true,default:stub},
    '@/components/admin/AdminCleanupControl':{__esModule:true,default:stub},
    '@/components/admin/AdminEdgeChecks':{__esModule:true,default:Panel},
    '@/lib/supabase':{supabase:{auth:{async getSession(){return{data:{session:{access_token:'fixture-admin-session'}}};}}}},
    '@/lib/adminMaintenance':{loadAdminCleanupLogs:async()=>({logs:[]})},
    '@/lib/adminCleanupInventory':{loadAdminCleanupInventory:async()=>({targets:[],sampled_at:new Date().toISOString()})},
    '@/lib/adminEdgeHealth':{loadAdminEdgePings:async(_base,_fetch,signal)=>new Promise(resolve=>{waits.push(resolve);signal.addEventListener('abort',()=>{aborted++;},{once:true});})},
  },{fetch:async(url)=>url.includes('admin-system-status')?new Response(JSON.stringify({status:'healthy',checks:{database:{status:'healthy'},stripe:{status:'healthy'},email:{status:'configured'}},metrics:{},payment_pipeline:{counts:{},stuck:{},values:{total_unreleased_client:0,total_guard_payout_pending:0}},cron_jobs:[],cleanup:{status:'healthy'}})):new Response(null,{status:200}),setInterval:()=>1,clearInterval:()=>{}});
  return{h,waits,get aborted(){return aborted;},panel:()=>nodes(h.render()).find(n=>n.type===Panel),refresh:()=>nodes(h.render()).find(n=>n.type==='button'&&content(n).trim()==='Refresh')};
}

test('actual System Status clears stale ping evidence on refresh and aborts on unmount without late state writes',async()=>{
  const f=systemFixture();f.h.render();await f.h.effects();
  assert.equal(f.waits.length,1);f.waits[0]([{slug:'create-job-payment',status:'protected',httpStatus:401,latency:3,checkedAt:new Date().toISOString(),detail:'Unauthenticated request rejected.'}]);await flush();
  assert.equal(f.panel().props.pings.length,1);assert.match(content(f.h.render()),/Core Services Healthy/);
  const refresh=f.refresh().props.onClick();await flush();
  assert.equal(f.waits.length,2);assert.equal(f.panel().props.pings.length,0);assert.equal(f.panel().props.loading,true);
  f.h.unmount();const writes=f.h.writes;f.waits[1]([]);await refresh;await flush();
  assert.equal(f.h.writes,writes);
  assert.ok(f.aborted>=1);
});

function replayHarness(file,mocks,globals){
  const slots=[],effects=[];let cursor=0,cleanups=[];
  const react={...require('react'),useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},useCallback:fn=>fn,useEffect:fn=>{effects.push(fn);}};
  const Component=load(file,{react,...mocks},globals).default;
  return {render(){cursor=0;return Component();},async effects(){const setup=effects.splice(0);cleanups=setup.map(fn=>fn());cleanups.forEach(fn=>fn?.());cleanups=setup.map(fn=>fn());await flush();},unmount(){cleanups.forEach(fn=>fn?.());}};
}
test('Strict Mode replay preserves the initial read instead of displaying a cancelled probe until the next poll',async()=>{
  const f=systemFixture(replayHarness);f.h.render();await f.h.effects();assert.equal(f.waits.length,1);assert.equal(f.aborted,0);
  f.waits[0]([{slug:'create-job-payment',status:'protected',httpStatus:401,latency:3,checkedAt:new Date().toISOString(),detail:'Unauthenticated request rejected.'}]);await flush();
  assert.equal(f.panel().props.pings[0].status,'protected');assert.equal(f.panel().props.loading,false);f.h.unmount();await flush();assert.equal(f.aborted,1);
});
