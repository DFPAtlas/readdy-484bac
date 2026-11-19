const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');

const source = fs.readFileSync('app/client/advanced-matching/page.tsx', 'utf8');
// Snapshot of the live app.guard_public_profiles columns, checked 19 Nov 2026.
// Reject private-table reads and unknown fields instead of returning permissive mocks.
const publicColumns = new Set('id full_name profile_image_url bio years_experience hourly_rate availability location city postcode_area willing_to_travel has_transport rating total_reviews total_jobs_completed verification_status sia_verified licence_types certifications availability_status max_distance_miles min_hourly_rate accepts_direct_bookings preferred_venue_categories founding_badge promo_tier signup_number'.split(' '));
const candidate = (id, extra = {}) => ({id, full_name: id, rating: 4.7, total_reviews: 3, total_jobs_completed: 5, hourly_rate: 20, years_experience: 3, sia_verified: true, licence_types: ['Security Guard'], location: 'London', city: 'London', postcode_area: 'SW1A', verification_status: 'approved', availability_status: 'available', is_active: true, ...extra});
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
const flush = async () => { for(let i=0;i<100;i++) await Promise.resolve(); };
function nodes(tree) { if(Array.isArray(tree)) return tree.flatMap(nodes); if(!tree || typeof tree!=='object') return []; return [tree,...nodes(tree.props?.children)]; }
function text(tree) { if(Array.isArray(tree)) return tree.map(text).join(''); if(tree && typeof tree==='object') return text(tree.props?.children); return tree == null || typeof tree==='boolean' ? '' : String(tree); }
function button(tree, label) { const result=nodes(tree).find(n=>n.type==='button' && text(n).trim()===label); assert.ok(result, `Missing button: ${label}`); return result; }
function select(tree, option) { const result=nodes(tree).find(n=>n.type==='select' && nodes(n).some(o=>o.type==='option' && text(o)===option)); assert.ok(result, `Missing select: ${option}`); return result; }

function harness(options={}) {
  const slots=[],effects=[],pending=[],calls=[],redirects=[]; let cursor=0,writes=0;
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
  const hooks={...React,
    useState(initial) {const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{writes++;slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useRef(initial) {const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
    useMemo(fn,deps) {const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={value:fn(),deps};return slots[i].value;},
    useCallback(fn,deps) {return hooks.useMemo(()=>fn,deps);},
    useEffect(fn,deps) {const i=cursor++;if(!effects[i]||!same(effects[i].deps,deps))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});},
  };
  const fixtures={clients:{id:'client',company_name:'Test client',subscription_tier:'starter'},jobs:options.jobs ?? [{id:'job',job_title:'Test job',status:'open',client_id:'client',is_deleted:false}],guard_public_profiles:options.guards ?? [candidate('Alice'),candidate('Bob',{rating:4.1,years_experience:7,hourly_rate:30,licence_types:['door_supervisor']})],job_invites:options.invites ?? [],client_favorites:options.favorites ?? []};
  const defaultRead=call=>{
    if(call.table==='guards')return {data:null,error:{message:'private table denied'}};
    if(call.table==='guard_public_profiles') {
      const selected=call.filters.find(f=>f[0]==='select')[1].split(',').map(s=>s.trim());
      for(const field of selected)if(!publicColumns.has(field))return {data:null,error:{message:`unknown column ${field}`}};
      let rows=fixtures.guard_public_profiles.filter(g=>g.is_active && ['approved','verified'].includes(g.verification_status));
      for(const [method,key,value] of call.filters)if(method==='eq')rows=rows.filter(g=>g[key]===value);
      return {data:rows.map(g=>Object.fromEntries(selected.map(key=>[key,g[key]??null])))};
    }
    if(call.filters.some(f=>['insert','delete'].includes(f[0])))return {data:null,error:null};
    if(call.filters.some(f=>f[0]==='maybeSingle'))return {data:call.table==='clients'?fixtures.clients:null,error:null};
    return {data:fixtures[call.table] ?? [],error:null};
  };
  const db={auth:{getUser:async()=>options.auth ? options.auth() : {data:{user:{id:'client-user'}},error:null}},from(table){const call={table,filters:[]};calls.push(call);const q={};for(const method of ['select','eq','in','order','maybeSingle','insert','delete'])q[method]=(...args)=>{call.filters.push([method,...args]);return q;};q.then=(a,b)=>Promise.resolve().then(()=>options.read ? options.read(call,()=>defaultRead(call)) : defaultRead(call)).then(a,b);return q;}};
  const router={push:path=>redirects.push(path)};
  const module={exports:{}};
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  new Function('module','exports','require',code)(module,module.exports,name=>name==='react'?hooks:name==='@/lib/supabase'?{supabase:db}:name==='next/navigation'?{useRouter:()=>router}:name==='@/hooks/useClientGuard'?{useClientGuard:()=>({loading:false,allowed:true})}:name==='@/hooks/useRouteGuard'?{useRouteGuard:()=>({checking:false,blocked:false})}:name.startsWith('@/components/')||name==='next/link'?{__esModule:true,default:()=>null}:require(name));
  return {calls,redirects,get writes(){return writes;},render(){cursor=0;return module.exports.default();},async start(){this.render();pending.splice(0).forEach(f=>f());await flush();return this.render();},unmount(){effects.forEach(e=>e?.cleanup?.());}};
}

test('catalogue uses the supported public contract and only active approved SIA-verified profiles',async()=>{
  const h=harness({guards:[candidate('Alice'),candidate('Not verified',{sia_verified:false}),candidate('Pending',{verification_status:'pending'}),candidate('Inactive',{is_active:false})]});
  const tree=await h.start();assert.match(text(tree),/Alice/);assert.doesNotMatch(text(tree),/Not verified|Pending|Inactive|No verified guards/);
  assert.equal(h.calls.some(c=>c.table==='guards'),false);
  const query=h.calls.find(c=>c.table==='guard_public_profiles');
  assert.ok(query.filters.some(f=>JSON.stringify(f)===JSON.stringify(['eq','sia_verified',true])));
  for(const c of h.calls.filter(c=>['jobs','job_invites','client_favorites'].includes(c.table)))assert.ok(c.filters.some(f=>f[0]==='eq'&&f[1]==='client_id'&&f[2]==='client'));
  assert.ok(h.calls.find(c=>c.table==='jobs').filters.some(f=>f[0]==='eq'&&f[1]==='is_deleted'&&f[2]===false));
});

test('returned errors, thrown errors and malformed lists cannot masquerade as no guards; Retry recovers',async()=>{
  for(const table of ['clients','jobs','guard_public_profiles','job_invites','client_favorites'])for(const failure of [{data:null,error:{message:'private database detail'}},Error('offline'),{data:null}]) {
    // A genuinely absent client redirects; null array responses must be errors.
    if(table==='clients' && !failure.error && !(failure instanceof Error))continue;
    let fail=true;
    const h=harness({read(call,normal){if(fail&&call.table===table){if(failure instanceof Error)throw failure;return failure;}return normal();}});
    const tree=await h.start();const html=renderToStaticMarkup(tree);
    assert.match(html,/role="alert"/);assert.doesNotMatch(html,/No verified guards available|private database detail|0 guards marked available/);
    fail=false;await button(tree,'Retry').props.onClick();assert.match(text(h.render()),/Alice/);assert.doesNotMatch(text(h.render()),/Failed to load guards/);
  }
});

test('genuine empty catalogue is distinct from query failure; no empty job-id filter is issued',async()=>{
  const h=harness({guards:[],jobs:[]});assert.match(text(await h.start()),/No verified guards available/);
  assert.equal(h.calls.some(c=>c.table==='job_invites'),false);
});

test('licence filters and scores accept stored spaces, underscores and hyphens; search uses safe location fields',async()=>{
  const h=harness();await h.start();
  select(h.render(),'All Licence Types').props.onChange({target:{value:'door-supervisor'}});
  assert.match(text(h.render()),/Bob/);assert.doesNotMatch(text(h.render()),/Alice/);
  select(h.render(),'All Licence Types').props.onChange({target:{value:'security-guard'}});
  assert.match(text(h.render()),/Alice/);assert.doesNotMatch(text(h.render()),/Bob/);
  select(h.render(),'All Licence Types').props.onChange({target:{value:'all'}});
  const search=nodes(h.render()).find(n=>n.type==='input');search.props.onChange({target:{value:'SW1A'}});assert.match(text(h.render()),/Alice/);
  search.props.onChange({target:{value:'No such city'}});assert.match(text(h.render()),/No guards match your criteria/);
  button(h.render(),'Clear Filters').props.onClick();assert.match(text(h.render()),/Alice/);
  select(h.render(),'Highest Rated').props.onChange({target:{value:'experience'}});assert.ok(text(h.render()).indexOf('Bob')<text(h.render()).indexOf('Alice'));
});

test('missing experience and rates do not satisfy entry-level or price filters; profile omits private licence details',async()=>{
  const h=harness({guards:[candidate('Unknown',{years_experience:null,hourly_rate:null}),candidate('Entry',{years_experience:0,hourly_rate:15})]});await h.start();
  select(h.render(),'Any Experience').props.onChange({target:{value:'entry'}});assert.doesNotMatch(text(h.render()),/Unknown/);assert.match(text(h.render()),/Entry/);
  select(h.render(),'Any Experience').props.onChange({target:{value:'all'}});
  select(h.render(),'Any Rate').props.onChange({target:{value:'20'}});assert.doesNotMatch(text(h.render()),/Unknown/);
  select(h.render(),'Any Rate').props.onChange({target:{value:'all'}});
  select(h.render(),'Highest Rated').props.onChange({target:{value:'rate_low'}});
  assert.ok(text(h.render()).indexOf('Entry') < text(h.render()).indexOf('Unknown'));
  button(h.render(),'Details').props.onClick();const html=renderToStaticMarkup(h.render());
  assert.match(html,/Guard Profile|SIA Verified/);assert.doesNotMatch(html,/SIA expires|Licence Number|Languages|Specializations/);
});

test('saved guards and job-specific invitations remain separate, including after reload',async()=>{
  const h=harness({favorites:[{guard_id:'Alice'}],invites:[{job_id:'job',guard_id:'Bob'}]});await h.start();
  assert.ok(nodes(h.render()).some(n=>n.props?.['aria-label']==='Unsave Alice'));
  assert.ok(nodes(h.render()).some(n=>n.props?.['aria-label']==='Save Bob'));
  select(h.render(),'Select a job...').props.onChange({target:{value:'job'}});
  assert.equal(button(h.render(),'Invited').props.disabled,true);assert.equal(button(h.render(),'Invite').props.disabled,false);
});

test('failed bookmark or invitation writes do not report success or create notifications with private user IDs',async()=>{
  for(const kind of ['favorite','invite']) {
    const h=harness({read(call,normal){if(call.filters.some(f=>f[0]==='insert'))return {error:{message:'denied'}};return normal();}});await h.start();
    if(kind==='favorite')await nodes(h.render()).find(n=>n.props?.['aria-label']==='Save Alice').props.onClick();
    else {select(h.render(),'Select a job...').props.onChange({target:{value:'job'}});await button(h.render(),'Invite').props.onClick();}
    assert.match(text(h.render()),/Failed to (update saved guards|send invite)/);assert.equal(h.calls.some(c=>c.table==='notifications'),false);h.unmount();
  }
});

test('successful invitation writes only owned job/guard IDs and does not mark guard as saved',async()=>{
  const h=harness();await h.start();select(h.render(),'Select a job...').props.onChange({target:{value:'job'}});await button(h.render(),'Invite').props.onClick();
  const insert=h.calls.find(c=>c.table==='job_invites'&&c.filters.some(f=>f[0]==='insert')).filters.find(f=>f[0]==='insert')[1];
  assert.equal(insert.job_id,'job');assert.equal(insert.client_id,'client');assert.equal(insert.guard_id,'Alice');assert.equal(insert.status,'pending');
  assert.match(text(h.render()),/Invitation added to Alice's Job Invites/);assert.ok(nodes(h.render()).some(n=>n.props?.['aria-label']==='Save Alice'));
  select(h.render(),'Select a job...').props.onChange({target:{value:'job'}});assert.ok(button(h.render(),'Invited'));h.unmount();
});

test('unmount retires pending catalogue requests before further queries or state writes',async()=>{
  const pending=deferred();const h=harness({read(call,normal){return call.table==='guard_public_profiles'?pending.promise:normal();}});
  await h.start();h.unmount();const before=h.writes,calls=h.calls.length;pending.resolve({data:[candidate('Late')]});await flush();
  assert.equal(h.writes,before);assert.equal(h.calls.length,calls);
});

test('a newer retry wins over an older result or error',async()=>{
  for(const lateError of [false,true]) {
    const older=deferred(),newer=deferred();let fail=true,requests=0;
    const h=harness({read(call,normal){if(call.table!=='guard_public_profiles')return normal();if(fail)return {data:null,error:{message:'offline'}};return ++requests===1?older.promise:newer.promise;}});
    const tree=await h.start();const retry=button(tree,'Retry').props.onClick;fail=false;
    const a=retry();await flush();const b=retry();await flush();
    if(lateError)older.reject(Error('late'));else older.resolve({data:[candidate('Stale')]});await a;
    assert.match(text(h.render()),/Finding your best matches/);
    newer.resolve({data:[candidate('Latest')]});await b;assert.match(text(h.render()),/Latest/);assert.doesNotMatch(text(h.render()),/Stale|Failed to load guards/);
  }
});

test('missing sessions redirect while authentication errors remain retryable',async()=>{
  const absent=harness({auth:()=>({data:{user:null},error:null})});await absent.start();assert.deepEqual(absent.redirects,['/client/login']);assert.equal(absent.calls.length,0);
  const failed=harness({auth:()=>({data:{user:null},error:{message:'offline'}})});assert.ok(button(await failed.start(),'Retry'));assert.equal(failed.calls.length,0);
});
