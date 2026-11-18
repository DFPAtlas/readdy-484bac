const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const source = fs.readFileSync('app/client/jobs/[id]/ReplacementGuardSuggestions.tsx', 'utf8');
const props = {jobId:'job',job:{id:'job',client_id:'client',required_license_type:'door_supervisor'},currentAssignments:[{guard_id:'assigned'}],onRequestReplacement(){}};
const guard = id => ({id,full_name:id});
const deferred = () => {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function nodes(tree) {if(Array.isArray(tree))return tree.flatMap(nodes);if(!tree||typeof tree!=='object')return [];return [tree,...nodes(tree.props?.children)];}
function text(tree) {if(Array.isArray(tree))return tree.map(text).join('');if(tree&&typeof tree==='object')return text(tree.props?.children);return tree==null||typeof tree==='boolean'?'':String(tree);}
function button(tree,label) {const node=nodes(tree).find(n=>n.type==='button'&&text(n).trim()===label);assert.ok(node,`missing ${label}`);return node;}

function harness(read = async () => ({data:[]})) {
  const slots=[],effects=[],calls=[];let cursor=0,writes=0;
  const hooks={...React,
    useState(initial){const n=cursor++;if(!(n in slots))slots[n]=initial;return[slots[n],value=>{writes++;slots[n]=typeof value==='function'?value(slots[n]):value;}];},
    useRef(initial){const n=cursor++;if(!(n in slots))slots[n]={current:initial};return slots[n];},
    useEffect(fn){const n=cursor++;if(!effects[n])effects[n]={cleanup:fn()};},
  };
  const db={from(table){const call={table,filters:[]};calls.push(call);const q={};for(const method of ['select','eq','neq','not','in','contains','order','limit'])q[method]=(...args)=>{call.filters.push([method,...args]);return q;};q.then=(a,b)=>Promise.resolve().then(()=>read(call,calls.length-1)).then(a,b);return q;}};
  const module={exports:{}};
  const code=ts.transpileModule(source+'\nexport {ReplacementSuggestions};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  new Function('module','exports','require',code)(module,module.exports,name=>name==='react'?hooks:name==='@/lib/supabase'?{supabase:db}:name==='@/components/QuickGuardImage'||name==='next/link'?{default:()=>null}:require(name));
  return {calls,get writes(){return writes;},render(context=props){cursor=0;return module.exports.ReplacementSuggestions(context);},key(context=props){return module.exports.default(context).key;},unmount(){effects.forEach(effect=>effect?.cleanup?.());}};
}

test('empty searches can be refreshed; failed refresh hides empty-state claims and Retry recovers',async()=>{
  let fail=false;
  const h=harness(async()=>fail?{error:{message:'private database detail'},data:null}:{data:[]});
  await button(h.render(),'Find Replacements').props.onClick();
  assert.match(text(h.render()),/No immediate matches/);
  fail=true;await button(h.render(),'Refresh').props.onClick();
  const html=renderToStaticMarkup(h.render());
  assert.match(html,/role="alert"/);assert.doesNotMatch(html,/No immediate matches|private database detail/);
  fail=false;await button(h.render(),'Retry').props.onClick();
  assert.match(text(h.render()),/No immediate matches/);
});

test('failed or pending refresh removes old actionable candidates',async()=>{
  let refreshing=false;const pending=deferred();
  const h=harness(call=>refreshing?pending.promise:Promise.resolve({data:call.table==='guard_public_profiles'?[guard('candidate')]:[]}));
  await button(h.render(),'Find Replacements').props.onClick();assert.ok(button(h.render(),'Request guard'));
  refreshing=true;const refresh=button(h.render(),'Refresh').props.onClick();
  assert.equal(nodes(h.render()).some(n=>n.type==='button'&&text(n).trim()==='Request guard'),false);
  assert.equal(button(h.render(),'Searching…').props.disabled,true);
  pending.reject(Error('offline'));await refresh;
  assert.ok(button(h.render(),'Retry'));assert.doesNotMatch(text(h.render()),/candidate/);
});

test('each search stage rejects returned, thrown and malformed reads without treating them as no matches',async()=>{
  for(let stage=0;stage<7;stage++)for(const failure of [{data:null,error:{message:'private detail'}},Error('offline'),{data:null},{data:{unexpected:true}}]){
    let index=0;
    const h=harness(async call=>{
      if(index++===stage){if(failure instanceof Error)throw failure;return failure;}
      return {data:call.table==='guard_public_profiles'?[guard('candidate')]:call.table==='jobs'?[{id:'prior-job'}]:[{guard_id:'candidate'}]};
    });
    await button(h.render(),'Find Replacements').props.onClick();
    assert.ok(button(h.render(),'Retry'));assert.match(text(h.render()),/could not be loaded/);
    assert.doesNotMatch(text(h.render()),/No immediate matches|private detail/);
    assert.equal(h.calls.length,stage+1);
  }
});

test('successful searches preserve job/client scopes, exclusion, licence filter, deduplication and availability qualification',async()=>{
  const h=harness(async call=>({data:call.table==='guard_public_profiles'?[guard('candidate')]:call.table==='jobs'?[{id:'prior-job'}]:[{guard_id:'candidate'}]}));
  await button(h.render(),'Find Replacements').props.onClick();
  assert.equal(h.calls.length,7);
  assert.ok(h.calls[0].filters.some(f=>JSON.stringify(f)===JSON.stringify(['eq','job_id','job'])));
  assert.ok(h.calls[2].filters.some(f=>JSON.stringify(f)===JSON.stringify(['eq','job_id','job'])));
  assert.ok(h.calls[3].filters.some(f=>JSON.stringify(f)===JSON.stringify(['eq','client_id','client'])));
  assert.ok(h.calls[4].filters.some(f=>JSON.stringify(f)===JSON.stringify(['in','job_id',['prior-job']])));
  assert.ok(h.calls[6].filters.some(f=>JSON.stringify(f)===JSON.stringify(['contains','licence_types',['door_supervisor']])));
  for(const n of [0,4,6])assert.ok(h.calls[n].filters.some(f=>f[0]==='not'&&f[3]==='(assigned)'));
  assert.equal(nodes(h.render()).filter(n=>n.type==='button'&&text(n).trim()==='Request guard').length,1);
  assert.match(text(h.render()),/Availability to confirm/);
});

test('missing or inconsistent job/client context cannot issue a query',async()=>{
  for(const context of [{...props,jobId:''},{...props,job:{}},{...props,job:{id:'job'}},{...props,job:{id:'another',client_id:'client'}}]){
    const h=harness();await button(h.render(context),'Find Replacements').props.onClick();
    assert.equal(h.calls.length,0);assert.ok(button(h.render(context),'Retry'));
  }
});

test('newer search wins over old successes and failures without resetting its loading state',async()=>{
  for(const failure of [false,true]){
    const old=deferred(),latest=deferred();let reads=0;
    const h=harness(()=>reads++===0?old.promise:latest.promise);
    const search=button(h.render(),'Find Replacements').props.onClick;
    const a=search();await Promise.resolve();await Promise.resolve();
    const b=search();await Promise.resolve();await Promise.resolve();
    if(failure)old.reject(Error('late failure'));else old.resolve({data:[]});await a;
    assert.equal(button(h.render(),'Searching…').props.disabled,true);
    latest.resolve({data:[]});await b;
    assert.match(text(h.render()),/No immediate matches/);assert.equal(h.calls.length,4);
  }
});

test('unmount retires requests and event callbacks without state writes or more query stages',async()=>{
  for(const failure of [false,true]){
    const pending=deferred();const h=harness(()=>pending.promise);
    const search=button(h.render(),'Find Replacements').props.onClick;
    const promise=search();h.unmount();const writes=h.writes;
    if(failure)pending.reject(Error('late'));else pending.resolve({data:[{guard_id:'candidate'}]});
    await promise;await search();assert.equal(h.writes,writes);assert.equal(h.calls.length,1);
  }
});

test('search identity resets for job, client, licence or assigned-guard changes, while equivalent contexts retain it',()=>{
  const h=harness();const key=h.key();
  assert.equal(h.key({...props,job:{...props.job},currentAssignments:[{guards:{id:'assigned'}}]}),key);
  for(const changed of [{...props,jobId:'another',job:{...props.job,id:'another'}},{...props,job:{...props.job,client_id:'another'}},{...props,job:{...props.job,required_license_type:'security_guard'}},{...props,currentAssignments:[{guard_id:'another'}]}])assert.notEqual(h.key(changed),key);
  const a=h.key({...props,currentAssignments:[{guard_id:'a'},{guard_id:'b'}]});
  assert.equal(h.key({...props,currentAssignments:[{guard_id:'b'},{guard_id:'a'}]}),a);
});
