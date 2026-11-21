const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loader, hooks, deferred, flush, nodes, text } = require('./helpers/finish-test-runtime.cjs');
const CLIENT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', USER='11111111-1111-4111-8111-111111111111', JOB='22222222-2222-4222-8222-222222222222', SHA='a'.repeat(64);
const button=(tree,label)=>{const value=nodes(tree).find(n=>n.type==='button'&&text(n).trim()===label);assert.ok(value,'Missing '+label);return value;};
const settings={client_id:CLIENT,allowed:true,default_template_id:null,templates:[]};
const jobDetail={job_id:JOB,can_accept:true,contract:{title:'Exact terms',terms:'Recorded terms',content_sha256:SHA,attached_at:'2026-11-21T12:00:00Z',accepted_at:null}};

test('guard contract control requires explicit consent, prevents duplicate acceptance and retires changed identities',async()=>{
 const h=hooks(),pending=deferred(),calls=[];let owner={id:USER,ready:true,error:false,revision:0};
 const Component=loader({react:h.react,'@/hooks/useMessageOwner':{useMessageOwner:()=>owner},'@/lib/client-contracts':{readJobContract:async()=>structuredClone(jobDetail),acceptJobContract:async(...args)=>{calls.push(args);return pending.promise;}}})('components/JobContractPanel.tsx').default;
 const render=()=>h.render(Component,{jobId:JOB});render();await h.effects();let tree=render();assert.equal(button(tree,'Accept job contract').props.disabled,true);
 await button(tree,'Accept job contract').props.onClick();assert.equal(calls.length,0);
 nodes(tree).find(n=>n.type==='input').props.onChange({target:{checked:true}});tree=render();assert.equal(button(tree,'Accept job contract').props.disabled,false);
 const first=button(tree,'Accept job contract').props.onClick();await button(tree,'Accept job contract').props.onClick();assert.deepEqual(calls,[[USER,JOB,SHA]]);
 owner={...owner,id:'other',revision:1};render();await h.effects();const writes=h.writes;
 pending.resolve({...jobDetail,contract:{...jobDetail.contract,accepted_at:'2026-11-21T13:00:00Z'}});await first;await flush();assert.equal(h.writes,writes);assert.ok(!text(render()).includes('Accepted on'));
 h.unmount();
});
test('client contract save freezes its versioned retry and preserves the exact title, terms and expected default',async()=>{
 const h=hooks(),calls=[];let attempt=0;
 const Component=loader({react:h.react,'@/hooks/useMessageOwner':{useMessageOwner:()=>({id:USER,ready:true,error:false,revision:0})},'@/lib/client-contracts':{
  readContractSettings:async()=>settings,saveContractVersion:async(...args)=>{calls.push(args);if(++attempt===1)throw Error('uncertain');return {...settings,default_template_id:'version',templates:[]};},setDefaultContract:async()=>settings,
 }},{crypto:{randomUUID:()=> 'version'}})('app/client/profile/ClientContractSettings.tsx').default;
 const render=()=>h.render(Component,{clientId:CLIENT,userId:USER});render();await h.effects();let tree=render();
 nodes(tree).find(n=>n.type==='input'&&!n.props.type).props.onChange({target:{value:'Company terms'}});nodes(tree).find(n=>n.type==='textarea').props.onChange({target:{value:'Original terms\nSecond line'}});tree=render();
 await nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush();tree=render();assert.equal(nodes(tree).find(n=>n.type==='fieldset').props.disabled,true);assert.ok(text(tree).includes('Retry save'));
 await nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush();assert.deepEqual(calls[0],calls[1]);assert.deepEqual(calls[1],[USER,CLIENT,{id:'version',title:'Company terms',terms:'Original terms\nSecond line',expected:null}]);
 assert.ok(!text(render()).includes('Retry save'));h.unmount();
});
test('API integration requests are owner-scoped, retry one intent and distinguish central routing from local save',async()=>{
 const h=hooks(),calls=[],reads=[];let savedAttempts=0;
 const db={from(table){const filters=[];const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},single:async()=>({data:{id:CLIENT},error:null}),order:async()=>{reads.push({table,filters});return{data:[],error:null};}};return q;}};
 const Component=loader({react:h.react,'next/link':{default:()=>null,__esModule:true},'@/lib/supabase':{supabase:db},'@/hooks/useMessageOwner':{useMessageOwner:()=>({id:USER,ready:true,error:false,revision:0})},'@/hooks/useClientGuard':{useClientGuard:()=>({loading:false,allowed:true})},'@/hooks/useRouteGuard':{useRouteGuard:()=>({checking:false,blocked:false})},'@/components/SupportAvailability':{default:()=>null,__esModule:true},'@/lib/client-support-writes':{createClientSupportTicket:async(...args)=>{calls.push(args.slice(1,5));if(++savedAttempts===1)throw Error('uncertain');return{id:'request',client_id:CLIENT,ticket_reference:'QG-API',replayed:true};}},'@/lib/support-routing':{routeTicketToCommandCentre:async()=>({ok:false})}},{crypto:{randomUUID:()=> 'request'}})('app/client/api-access/page.tsx').default;
 const render=()=>h.render(Component,{});render();await h.effects();let tree=render();assert.ok(reads[0].filters.some(([k,v])=>k==='client_id'&&v===CLIENT));
 nodes(tree).find(n=>n.type==='textarea').props.onChange({target:{value:'Read-only jobs feed for our scheduling system'}});tree=render();await nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush();tree=render();assert.ok(text(tree).includes('Retry integration request'));
 await nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush();tree=render();assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0][0],USER);assert.equal(calls[0][1],CLIENT);assert.match(text(tree),/synchronisation is pending/);assert.ok(text(tree).includes('QG-API'));h.unmount();
});
