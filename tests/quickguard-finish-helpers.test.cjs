const {test}=require('node:test'),assert=require('node:assert/strict');
const {loader,deferred}=require('./helpers/finish-test-runtime.cjs');
const load=loader(),api=load('lib/job-messages.ts'),support=load('lib/client-support-writes.ts'),actions=load('lib/client-guard-actions.ts');
const row=(id,other='peer')=>({id,sender_id:other,receiver_id:'owner',job_id:'job',sender_type:'guard',receiver_type:'client',message_text:id,read:false,created_at:'2026-11-20T10:00:00Z'});
function database(rows=[]){
 const db={owner:'owner',rows,calls:[],rpcCalls:[],response:null,auth:{getUser:async()=>({data:{user:{id:db.owner}}})},
  from(table){const c={table,filters:[],orders:[]};db.calls.push(c);const q={select(fields,options){c.fields=fields;c.options=options;return q;},or(value){c.or=value;return q;},eq(k,v){c.filters.push([k,v]);return q;},is(k,v){c.filters.push([k,v]);return q;},order(k,v){c.orders.push([k,v]);return q;},range(a,b){c.range=[a,b];return q;},then(a,b){return Promise.resolve().then(()=>{if(db.response)return db.response(c);let matching=db.rows.filter(r=>r.sender_id===db.owner||r.receiver_id===db.owner);if(c.or?.startsWith('and(')){const ids=[...c.or.matchAll(/\.eq\."([^"]+)"/g)].map(x=>x[1]);matching=matching.filter(r=>(r.sender_id===ids[0]&&r.receiver_id===ids[1])||(r.sender_id===ids[1]&&r.receiver_id===ids[0]));}matching=matching.filter(r=>c.filters.every(([k,v])=>r[k]===v));return{data:matching.slice(c.range[0],c.range[1]+1),count:matching.length};}).then(a,b);}};return q;},
  async rpc(name,request){db.rpcCalls.push({name,request});if(db.rpcResponse)return db.rpcResponse(name,request);return{data:null,error:{message:'fixture'}};}};return db;
}
test('owned message history loads 405 rows and repeats exact pair/job/order/count scoping on every range',async()=>{
 const db=database(Array.from({length:405},(_,n)=>row('m'+n)));const result=await api.readMessageRows(db,'owner',{other:'peer',job:'job'});assert.equal(result.length,405);
 assert.deepEqual(db.calls.map(x=>x.range),[[0,199],[200,399],[400,599]]);for(const call of db.calls){assert.match(call.or,/and\(sender_id\.eq\."owner",receiver_id\.eq\."peer"\)/);assert.deepEqual(call.filters,[['job_id','job']]);assert.deepEqual(call.options,{count:'exact'});assert.deepEqual(call.orders.map(x=>x[0]),['created_at','id']);}
});
test('another busy conversation cannot consume the selected partner page; equal timestamps do not skip older IDs',async()=>{
 const db=database([...Array.from({length:200},(_,n)=>row('other'+n,'busy')),...Array.from({length:41},(_,n)=>row('wanted'+n))]);
 const result=await api.readMessageRows(db,'owner',{other:'peer',job:'job'});assert.equal(result.length,41);const first=api.messageHistoryPage(result);assert.equal(first.messages.length,40);assert.equal(first.hasMore,true);const last=api.messageHistoryPage(result,first.cursor);assert.equal(last.messages.length,1);assert.equal(last.messages[0].id,'wanted40');assert.equal(last.hasMore,false);
});
test('later failures, count drift, duplicates, malformed and foreign records reject the entire history',async()=>{
 for(const fault of ['error','count','duplicate','foreign','empty','missing']){
  const db=database(Array.from({length:205},(_,n)=>row('m'+n)));db.response=c=>{let data=db.rows.slice(c.range[0],c.range[1]+1),count=205;if(c.range[0]){if(fault==='error')return{error:{message:'fixture'},data:null};if(fault==='count')count=204;if(fault==='duplicate')data[0]=db.rows[0];if(fault==='foreign')data[0]={...data[0],sender_id:'x',receiver_id:'y'};if(fault==='empty')data=[];if(fault==='missing')count=null;}return{data,count};};
  await assert.rejects(api.readMessageRows(db,'owner',{other:'peer',job:'job'}));
 }
});
test('retired reads and changed actors cannot return earlier history or issue subsequent ranges',async()=>{
 let active=true;const db=database(Array.from({length:205},(_,n)=>row('m'+n)));db.response=c=>{active=false;return{data:db.rows.slice(c.range[0],c.range[1]+1),count:205};};await assert.rejects(api.readMessageRows(db,'owner',undefined,()=>active));assert.equal(db.calls.length,1);
 const changed=database([row('a')]);changed.response=()=>{changed.owner='foreign';return{data:[row('a')],count:1};};await assert.rejects(api.readMessageRows(changed,'owner'));
});
test('send confirmation verifies exact identity and fields and a stable request safely recovers a lost reply',async()=>{
 const db=database(),stored=new Map();let lost=true;const request={id:'operation',owner:'owner',other:'peer',job:'job',text:'Keep this draft'};
 db.rpcResponse=(_n,{p_request:p})=>{const replay=stored.has(p.operation_id);stored.set(p.operation_id,p);if(lost){lost=false;throw Error('lost reply');}return{data:{id:p.operation_id,sender_id:p.expected_user_id,receiver_id:p.receiver_id,job_id:p.job_id,message_text:p.text,replayed:replay}};};
 await assert.rejects(api.sendJobMessage(db,request));assert.equal((await api.sendJobMessage(db,request)).replayed,true);assert.equal(stored.size,1);
 db.rpcResponse=()=>({data:{id:'wrong'}});await assert.rejects(api.sendJobMessage(db,request));db.owner='foreign';await assert.rejects(api.sendJobMessage(db,request));
});
test('message batches acknowledge only returned requested IDs and preserve an uncertain partial batch',async()=>{
 const ids=Array.from({length:405},(_,n)=>'m'+n),db=database();db.rpcResponse=(_n,{p_request:p})=>db.rpcCalls.length===1?{data:{confirmed_ids:p.ids}}:{error:{message:'later failure'}};
 const result=await api.changeJobMessages(db,'owner',ids,'delete');assert.equal(result.confirmedIds.length,200);assert.equal(result.complete,false);assert.equal(db.rpcCalls.length,2);
 const zero=database();zero.rpcResponse=()=>({data:{confirmed_ids:[]}});assert.equal((await api.changeJobMessages(zero,'owner',['a'],'read')).complete,false);
 zero.rpcResponse=()=>({data:{confirmed_ids:['foreign']}});await assert.rejects(api.changeJobMessages(zero,'owner',['a'],'read'));
});
test('bulk guard invitations call the existing authorized RPC and report partial confirmation accurately',async()=>{
 const db=database();db.rpcResponse=(name,{p_guard_id:id})=>{assert.equal(name,'create_client_job_invite');return id==='good'?{data:{invite_id:'saved',replayed:false}}:{error:{message:'denied'}};};
 const result=await actions.runGuardActionBatch(db,'owner','job',[{id:'good'},{id:'bad'}],'invite',new Map());assert.deepEqual(result,{confirmedIds:['good'],failedIds:['bad']});assert.equal(db.rpcCalls.length,2);assert.equal(db.calls.length,0);
});
test('shortlist message retry reuses its operation ID and does not create browser notification writes',async()=>{
 const db=database(),operations=new Map();db.rpcResponse=(_n,{p_request:p})=>({data:{id:p.operation_id,sender_id:p.expected_user_id,receiver_id:p.receiver_id,job_id:p.job_id,message_text:p.text,replayed:false}});
 await actions.runGuardActionBatch(db,'owner','job',[{id:'guard',user_id:'peer'}],'message',operations);await actions.runGuardActionBatch(db,'owner','job',[{id:'guard',user_id:'peer'}],'message',operations);
 assert.equal(db.rpcCalls[0].request.p_request.operation_id,db.rpcCalls[1].request.p_request.operation_id);assert.equal(db.calls.length,0);
});
test('support creates require exact operation/client confirmation and closures retain precise message receipts',async()=>{
 const db=database();db.rpcResponse=(_n,{p_request:p})=>({data:{id:p.operation_id,client_id:p.client_id,replayed:false}});assert.equal((await support.createClientSupportTicket(db,'owner','client','operation',{})).id,'operation');
 db.rpcResponse=()=>({data:{id:'wrong',client_id:'client',replayed:false}});await assert.rejects(support.createClientSupportTicket(db,'owner','client','operation',{}));
 db.rpcResponse=()=>({data:{confirmed_ids:['a'],closure_message_ids:['notice']}});assert.deepEqual(await support.closeClientSupportTickets(db,'owner','client',['a','b']),{confirmedIds:['a'],closureMessageIds:['notice'],complete:false});
 db.rpcResponse=()=>({data:{confirmed_ids:['a'],closure_message_ids:[]}});await assert.rejects(support.closeClientSupportTickets(db,'owner','client',['a']));
});
test('request deadlines settle a hung request while a late result cannot change the returned outcome',async()=>{
 const {withRequestDeadline}=load('lib/request-deadline.ts'),later=deferred(),keep=setTimeout(()=>{},100);
 try{await assert.rejects(withRequestDeadline(later.promise,2),/timed out/);later.resolve('late');assert.equal(await withRequestDeadline(Promise.resolve('ok'),20),'ok');}finally{clearTimeout(keep);}
});

test('service notification writers use canonical RPC fields and retain one source key across retries',async()=>{
 const {persistUserNotifications}=loader()('supabase/functions/_shared/user-notifications.ts');const calls=[],ID='11111111-1111-4111-8111-111111111111';
 const db={rpc:async(name,args)=>{calls.push({name,args});return{data:ID};}};
 const notification={user_id:'owner',type:'payment',title:'Paid',message:'Confirmed payment',related_id:'job',category:'payment_alert'};
 await persistUserNotifications(db,'source-event',[notification]);await persistUserNotifications(db,'source-event',[notification]);
 assert.equal(calls[0].name,'emit_user_notification');assert.equal(calls[0].args.p_event_key,calls[1].args.p_event_key);assert.equal(calls[0].args.p_user_id,'owner');assert.equal(calls[0].args.p_data.job_id,'job');assert.equal(calls[0].args.related_id,undefined);
 for(const result of [{error:{message:'denied'}},{data:undefined},{data:''},{data:{success:true}}])await assert.rejects(persistUserNotifications({rpc:async()=>result},'source',[notification]),/not confirmed/);
 assert.deepEqual(await persistUserNotifications({rpc:async()=>({data:null})},'suppressed',[notification]),[null]);
});
