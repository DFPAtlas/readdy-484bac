const {test}=require('node:test');
const assert=require('node:assert/strict');
const {hooksHarness,nodes,content,childMocks,uiDatabase}=require('./helpers/guard-ui-fixture.cjs');
const link={__esModule:true,default:()=>null};
const button=(tree,label)=>nodes(tree).find(n=>n.type==='button'&&content(n).trim()===label);

function savedFixture({fail=false,zero=false,open=false}={}) {
 const calls=[],rows=[{id:'saved-closed',saved_at:'2026-11-21',notes:null,jobs:open?{id:'open-job',job_title:'QA future open job',status:'open',start_date:'2099-01-01',start_time:'09:00',end_time:'17:00',hourly_rate:20,venue_city:'QA',clients:{company_name:'QA client'}}:null}];
 const db={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){const c={table,filters:[]};calls.push(c);const q={select(){return q;},eq(k,v){c.filters.push([k,v]);return q;},order(){return q;},maybeSingle(){return q;},delete(){c.deleting=true;return q;},then(resolve,reject){const data=table==='jobs'?{id:'open-job',status:'open',start_date:'2099-01-01'}:table==='guards'?{id:'guard',full_name:'QA Guard',verification_status:'approved'}:table==='saved_jobs'?c.deleting?(fail||zero?[]:[{id:'saved-closed'}]):rows:[];return Promise.resolve({data,error:c.deleting&&fail?{message:'private error'}:null}).then(resolve,reject);}};return q;}};
 const h=hooksHarness('app/guard/saved-jobs/page.tsx',{...childMocks,'@/lib/guard-application-limits':{checkGuardApplicationLimit:async()=>({allowed:true})},'@/lib/guard-applications':{submitGuardApplication:async request=>{calls.push({application:request});return{ok:true};}},'next/navigation':{useRouter:()=>({push(){}})},'@/lib/supabase':{supabase:db}},{setTimeout(){}});
 return{h,calls};
}
test('closed/inaccessible saved job stays visible, cannot be applied to, and can be removed with a confirmed owned delete',async()=>{
 const {h,calls}=savedFixture();h.render();await h.effects();let tree=h.render();assert.match(content(tree),/1 saved job/);assert.match(content(tree),/Job no longer available/);assert.doesNotMatch(content(tree),/Apply Now/);
 await button(tree,'Remove saved job').props.onClick();tree=h.render();assert.match(content(tree),/No saved jobs yet/);
 assert.deepEqual(calls.find(c=>c.deleting).filters,[['id','saved-closed'],['guard_id','guard']]);h.unmount();
});
test('failed or zero-row removal retains the bookmark and shows recovery, without false success',async()=>{
 for(const opts of [{fail:true},{zero:true}]){const {h}=savedFixture(opts);h.render();await h.effects();await button(h.render(),'Remove saved job').props.onClick();const text=content(h.render());assert.match(text,/Job no longer available/);assert.match(text,/removal could not be confirmed/);assert.doesNotMatch(text,/Job removed from saved list/);h.unmount();}
});

function profileFixture({zero=false,stale=false,fail=false}={}){
 const record={id:'guard',full_name:'QA Guard',bio:'Original',availability:null,licence_types:[],postcode:''};const writes=[];
 const db={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(){let payload,identity=false;const q={select(fields){identity=fields==='id';return q;},eq(){return q;},update(value){payload=value;writes.push(value);return q;},maybeSingle(){return q;},single(){return q;},then(resolve,reject){const data=payload?zero?null:{...record,...payload,availability:stale?null:payload.availability}:identity?{id:'guard'}:{...record};if(payload&&!zero&&!stale&&!fail)Object.assign(record,data);return Promise.resolve({data,error:payload&&fail?{message:'Save failed'}:null}).then(resolve,reject);}};return q;}};
 const h=hooksHarness('app/guard/profile/page.tsx',{...childMocks,'next/navigation':{useSearchParams:()=>new URLSearchParams()},'@/lib/supabase':{supabase:db},'@/hooks/useGuardGuard':{useGuardGuard:()=>({loading:false,allowed:true})},'@/lib/supabase-storage':{getProfilePhotoUrl:async()=>null},'@/lib/geocoding':{geocodePostcode:async()=>null},'@/components/CloseAccountSection':link,'@/components/SIALicenceImage':link,'@/components/ImageCropper':link},{setTimeout(){}});
 const nested=h.render().props.children.type;
 return{h,writes,record,render:()=>h.renderComponent(nested)};
}
test('actual Work profile save persists Flexible and clearing to null; returned row drives display',async()=>{
 const f=profileFixture();f.render();await f.h.effects();button(f.render(),'Work').props.onClick();button(f.render(),'Edit Profile').props.onClick();const tree=f.render();const select=nodes(tree).find(n=>n.type==='select'&&n.props.name==='availability');assert.ok(select);
 select.props.onChange({target:{name:'availability',value:'flexible',type:'select-one'}});await button(f.render(),'Save Changes').props.onClick();assert.equal(f.writes[0].availability,'flexible');assert.equal(f.record.availability,'flexible');assert.match(content(f.render()),/flexible/);
 button(f.render(),'Edit Profile').props.onClick();nodes(f.render()).find(n=>n.type==='select'&&n.props.name==='availability').props.onChange({target:{name:'availability',value:'',type:'select-one'}});await button(f.render(),'Save Changes').props.onClick();assert.equal(f.writes[1].availability,null);assert.equal(f.record.availability,null);f.h.unmount();
});
test('profile update errors, zero rows and mismatched persisted availability never show save success',async()=>{
 for(const opts of [{zero:true},{stale:true},{fail:true}]){const f=profileFixture(opts);f.render();await f.h.effects();button(f.render(),'Work').props.onClick();button(f.render(),'Edit Profile').props.onClick();nodes(f.render()).find(n=>n.type==='select'&&n.props.name==='availability').props.onChange({target:{name:'availability',value:'flexible',type:'select-one'}});await button(f.render(),'Save Changes').props.onClick();assert.ok(button(f.render(),'Save Changes'));assert.doesNotMatch(content(f.render()),/Profile updated successfully|Saved successfully/);f.h.unmount();}
});

test('mobile subscribes to app tables and mounts the shared owned inbox while preserving distinct client responses',async()=>{
 const db=uiDatabase(),subscriptions=[];db.channel=name=>{const ch={on(event,filter,cb){subscriptions.push({name,event,filter,cb});return ch;},subscribe(){return ch;}};return ch;};
 db.rows.messages=[{id:'sent',job_id:'job',sender_id:'owner',receiver_id:'client',sender_type:'guard',receiver_type:'client',message_text:'Controlled message',created_at:'2026-11-21',read:false}];
 const Inbox=()=>null;
 const h=hooksHarness('app/guard/mobile/MobileGuardDashboard.tsx',{...childMocks,'@/app/guard/messages/GuardMessagesClient':{__esModule:true,default:Inbox},'@/lib/supabase':{supabase:db},'next/navigation':{useRouter:()=>({push(){}})},'@/hooks/useGuardPayoutSettings':{useGuardPayoutSettings:()=>({status:null})},'@/hooks/usePushNotifications':{usePushNotifications:()=>({subscribed:false})}},{setTimeout:(fn,ms)=>ms===150?fn():setTimeout(fn,ms)});
 h.render();await h.effects();let tree=h.render();await h.effects();const nav=nodes(tree).find(n=>n.props.tabs);assert.ok(nav,content(tree));nav.props.onTabChange('messages');tree=h.render();const inbox=nodes(tree).find(n=>n.type===Inbox);assert.equal(inbox.props.embedded,true);assert.match(content(tree),/Client Responses/);assert.doesNotMatch(content(tree),/Clients will reach out here/);
 const tables=subscriptions.map(s=>s.filter.table);for(const table of ['jobs','client_responses','job_assignments','job_applications','messages'])assert.ok(tables.includes(table),table);
 assert.ok(subscriptions.every(s=>s.filter.schema==='app'));assert.ok(subscriptions.filter(s=>s.filter.table==='messages').every(s=>/owner/.test(s.filter.filter)));inbox.props.onUnreadChange(2);assert.equal(nodes(h.render()).find(n=>n.props.tabs).props.tabs.find(t=>t.id==='messages').badge,2);h.unmount();
});

test('eligible open saved job renders its card and applies through the authoritative application client',async()=>{
 const {h,calls}=savedFixture({open:true});h.render();await h.effects();let tree=h.render();assert.match(content(tree),/QA future open job/);const apply=nodes(tree).find(n=>n.type==='button'&&content(n).includes('Apply Now'));assert.ok(apply);await apply.props.onClick();tree=h.render();assert.match(content(tree),/Application submitted/);assert.match(content(tree),/Applied/);assert.deepEqual(calls.find(c=>c.application).application,{guardId:'guard',jobId:'open-job'});h.unmount();
});

test('embedded shared inbox loads the actual owned conversation and opens its full message',async()=>{
 const db=uiDatabase();db.rows.messages=[{id:'sent',job_id:'job',sender_id:'owner',receiver_id:'client',sender_type:'guard',receiver_type:'client',message_text:'QA ONLY — retained controlled conversation',created_at:'2026-11-21T22:00:00Z',read:false}];db.rpc=async()=>({data:[{user_id:'client',full_name:'QA Client'}],error:null});const unread=[];
 const h=hooksHarness('app/guard/messages/GuardMessagesClient.tsx',{...childMocks,'@/lib/supabase':{supabase:db},'@/hooks/useMessageOwner':{useMessageOwner:()=>({ready:true,id:'owner',revision:1})},'@/hooks/useGuardGuard':{useGuardGuard:()=>({loading:false,allowed:true})}},{localStorage:{getItem:()=>null},setTimeout(){}});const outer=h.render({embedded:true,onUnreadChange:n=>unread.push(n)});const render=()=>h.renderComponent(outer.type,outer.props);render();await h.effects();let tree=render();await h.effects();tree=render();assert.match(content(tree),/QA Client/);assert.match(content(tree),/retained controlled conversation/);assert.equal(unread.at(-1),0,'sent message is not unread incoming');nodes(tree).find(n=>n.type==='li').props.onClick();render();await h.effects();tree=render();assert.match(content(tree),/QA ONLY — retained controlled conversation/);assert.ok(nodes(tree).find(n=>n.type==='input'&&n.props.placeholder==='Type a message...'));h.unmount();
});
