const {test}=require('node:test');
const assert=require('node:assert/strict');
const {hooksHarness,nodes,content,flush}=require('./helpers/guard-ui-fixture.cjs');
const counts={failedPayments:1,guardVerifications:2,siaVerifications:3,heldPayments:4,complaints:5,contactSubmissions:6};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

function fixture({session=true}={}) {
  const queue=[],intervals=new Map();let nextId=0,invocations=0;
  const h=hooksHarness('components/AdminSidebar.tsx',{
    'next/navigation':{usePathname:()=>'/admin/dashboard'},'next/link':{default:'a'},
    '@/hooks/useSafeRouter':{useSafeRouter:()=>({push(){}})},
    '@/hooks/useAdminAuth':{useAdminAuth:()=>({}),clearAdminAuthCache(){}},'@/components/BrandLogo':{default:()=>null},
    '@/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:session?{access_token:'fixture'}:null}})},functions:{invoke:()=>{invocations++;return queue.length?queue.shift():Promise.resolve({data:counts,error:null});}}}},
  },{
    window:{localStorage:{getItem:()=>null,setItem(){}},addEventListener(){},removeEventListener(){}},document:{body:{style:{overflow:''}}},
    setInterval:fn=>{const id=++nextId;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),
  });
  return {h,queue,render:()=>h.render({}),poll:()=>[...intervals.values()].at(-1)(),get invocations(){return invocations;}};
}
function visibleBadges(tree) {return nodes(tree).filter(n=>typeof n.type==='function'&&n.type.name==='Badge').map(n=>n.type(n.props)).filter(Boolean);}

test('failed or malformed sidebar polls hide stale counts and offer a working retry',async()=>{
  const f=fixture();assert.equal(visibleBadges(f.render()).length,0);await f.h.effects();assert.ok(visibleBadges(f.render()).length>0);
  for(const result of [{data:null,error:{message:'private'}},{data:{},error:null},{data:{...counts,complaints:-1},error:null},{data:{...counts,siaVerifications:'0'},error:null}]) {
    f.queue.push(Promise.resolve(result));await f.poll();await flush();const tree=f.render();
    assert.equal(visibleBadges(tree).length,0);assert.match(content(tree),/Counts unavailable/);assert.doesNotMatch(content(tree),/private/);
  }
  const retry=nodes(f.render()).find(n=>n.props?.['aria-label']==='Retry navigation counts');retry.props.onClick();f.render();await f.h.effects();
  assert.ok(visibleBadges(f.render()).length>0);assert.doesNotMatch(content(f.render()),/Counts unavailable/);f.h.unmount();
});

test('late polls cannot overwrite a newer failure or update an unmounted sidebar',async()=>{
  const f=fixture();f.render();await f.h.effects();const old=deferred(),fresh=deferred();
  f.queue.push(old.promise,fresh.promise);const oldRequest=f.poll();await flush();const freshRequest=f.poll();await flush();
  fresh.resolve({data:null,error:{message:'failed'}});await freshRequest;old.resolve({data:counts,error:null});await oldRequest;
  assert.equal(visibleBadges(f.render()).length,0);assert.match(content(f.render()),/Counts unavailable/);
  const late=deferred();f.queue.push(late.promise);const pending=f.poll();await flush();f.h.unmount();const writes=f.h.writes;
  late.resolve({data:counts,error:null});await pending;assert.equal(f.h.writes,writes);
});

test('missing sessions leave counts unavailable without invoking a privileged endpoint',async()=>{
  const f=fixture({session:false});f.render();await f.h.effects();assert.equal(f.invocations,0);assert.match(content(f.render()),/Counts unavailable/);f.h.unmount();
});
