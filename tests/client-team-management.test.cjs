const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {webcrypto}=require('node:crypto');
const U='11111111-1111-4111-8111-111111111111', C='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', M='22222222-2222-4222-8222-222222222222', D='44444444-4444-4444-8444-444444444444', F='33333333-3333-4333-8333-333333333333', FC='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CID='77777777-7777-4777-8777-777777777777', API='client.api_access', TEAM='client.team_access', POST='client.post_job';
const scope={userId:U,clientId:C};
function load(path,mocks={},globals={}) {const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('module','exports','require','crypto',...Object.keys(globals),code)(m,m.exports,n=>n in mocks?mocks[n]:require(n),webcrypto,...Object.values(globals));return m.exports;}
const keys=['client.post_job','client.view_guard_profiles','client.advanced_matching','client.priority_support','client.job_templates','client.analytics_dashboard','client.direct_contact','client.unlimited_jobs','client.bulk_posting','client.multi_site','client.team_access','client.custom_contracts','client.api_access','client.escrow_payments','client.job_history','client.job_tracker'];
const api=load('lib/client-team-management.ts',{'./entitlements':{CLIENT_FEATURE_KEYS:keys}});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};};
const row=(i=0)=>({config_id:i?i.toString(16).padStart(8,'0')+'-0000-4000-8000-000000000000':CID,owner_user_id:U,member_user_id:i?(i+1000).toString(16).padStart(8,'0')+'-0000-4000-8000-000000000000':M,email:i?`member${i}@example.test`:'member@example.test',full_name:i?'Member '+i:'Existing Member',enabled_features:[],member_available:true});
function database(options={}) {
  const calls=[],receipts=new Map();let listener;
  const db={userId:U,clientId:C,members:options.members||[row()],revision:0,writes:0,behavior:options.rpc,calls,
    auth:{async getUser(){return {data:{user:db.userId?{id:db.userId}:null},error:null}},onAuthStateChange(fn){listener=fn;return{data:{subscription:{unsubscribe(){if(listener===fn)listener=null}}}}}},
    event(event,userId){db.userId=userId;listener?.(event,userId?{user:{id:userId}}:null)},
    schema(name){assert.equal(name,'app');return db},from(){throw Error('No browser directory or membership table access is allowed')},
    async rpc(name,{p_request:p}) {
      assert.equal(name,'manage_my_client_team');calls.push(structuredClone(p));
      const normal=()=>{
        if(p.expected_user_id!==db.userId||p.expected_client_id!==db.clientId)return{data:null,error:{code:'42501',message:'Account context changed. Reload your team'}};
        const base={request_id:p.request_id,action:p.action,owner_user_id:db.userId,client_id:db.clientId,company_name:'Synthetic Company',subscription_tier:'Enterprise',allowed_features:[TEAM,API,POST],team_revision:db.revision};
        if(p.action==='list') {
          const rows=[...db.members].sort((a,b)=>a.config_id.localeCompare(b.config_id)).filter(r=>!p.after_id||r.config_id>p.after_id),page=rows.slice(0,200);
          return{data:{...base,members:structuredClone(page),has_more:rows.length>200,next_after_id:rows.length>200?page.at(-1).config_id:null},error:null};
        }
        if(p.action==='search') {
          const id=p.email==='second@example.test'?D:p.email==='member@example.test'?M:null;
          const candidate=id&&!db.members.some(m=>m.member_user_id===id)?[{member_user_id:id,email:p.email,full_name:id===D?'New Member':'First Candidate'}]:[];
          return{data:{...base,candidates:candidate},error:null};
        }
        if(receipts.has(p.operation_id))return{data:{...base,...receipts.get(p.operation_id),replayed:true},error:null};
        if(p.expected_revision!==db.revision)return{data:null,error:{code:'P0001',message:'Team changed elsewhere. Reload before saving'}};
        let outcome,configId=p.config_id;
        if(p.action==='add') {
          const exists=db.members.find(m=>m.member_user_id===p.member_user_id);
          if(exists){outcome='already_present';configId=exists.config_id}else{db.members.push({...row(),config_id:p.config_id,member_user_id:p.member_user_id,email:p.email,full_name:'New Member'});outcome='added'}
        } else if(p.action==='update') {
          const member=db.members.find(m=>m.config_id===p.config_id&&m.member_user_id===p.member_user_id);
          if(!member)return{data:null,error:{code:'P0001',message:'Team member changed. Reload before saving'}};
          member.enabled_features=[...p.enabled_features];outcome='updated';
        } else {db.members=db.members.filter(m=>m.config_id!==p.config_id);outcome='removed'}
        db.revision++;db.writes++;
        const result={operation_id:p.operation_id,config_id:configId,member_user_id:p.member_user_id,outcome,committed:true,operation_revision:db.revision};receipts.set(p.operation_id,result);
        return{data:{...base,...result,replayed:false,team_revision:db.revision},error:null};
      };
      return db.behavior?db.behavior(p,normal,db):normal();
    },
  };return db;
}
function nodes(t){return Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[]}
function content(t){return Array.isArray(t)?t.map(content).join(''):t&&typeof t==='object'?content(t.props?.children):t==null||typeof t==='boolean'?'':String(t)}
function button(t,label){const n=nodes(t).find(n=>n.type==='button'&&(content(n).trim()===label||n.props['aria-label']===label));assert.ok(n,'Missing '+label);return n}
const flush=async()=>{for(let i=0;i<120;i++)await Promise.resolve()};
function harness(options={}) {
  const db=options.db||database(options),slots=[],effects=[],pending=[];let cursor=0,writes=0;
  let context={...scope,isLoaded:true,companyName:'Synthetic Company',subscriptionTier:'Enterprise'};
  const router={push(){}};
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const hooks={...React,
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{writes++;slots[i]=typeof v==='function'?v(slots[i]):v}]},
    useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i]},
    useCallback(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn},
    useEffect(fn,deps){const i=cursor++;if(!effects[i]||!same(effects[i].deps,deps))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()}})},
  };
  const Component=load('app/client/team-access/TeamAccessClient.tsx',{react:hooks,'next/navigation':{useRouter:()=>router},'@/lib/supabase':{supabase:db},'@/lib/ClientAuthContext':{useClientAuth:()=>context},'@/components/PortalSidebar':{__esModule:true,default:()=>null},'@/lib/client-team-management':api}).default;
  const h={db,get writes(){return writes},render(next){if(next)context={...context,...next};cursor=0;return Component()},
    async settle(){for(let i=0;i<5;i++){this.render();pending.splice(0).forEach(fn=>fn());await flush()}return this.render()},
    async start(){return this.settle()},
    click(label){button(this.render(),label).props.onClick?.()},
    input(value){nodes(this.render()).find(n=>n.props?.id==='team-email').props.onChange({target:{value}})},
    submit(){nodes(this.render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}})},
    toggle(){nodes(this.render()).find(n=>n.props?.role==='switch'&&n.props['aria-label'].startsWith('API Access')).props.onClick()},
    unmount(){effects.forEach(e=>e?.cleanup?.())},
  };return h;
}

test('owned paging loads 405 members and rejects missing, duplicate, foreign or mixed-revision data',async()=>{
  const db=database({members:Array.from({length:405},(_,i)=>row(i+1))});const result=await api.loadClientTeam(db,scope);
  assert.equal(result.members.length,405);assert.equal(db.calls.filter(c=>c.action==='list').length,3);
  for(const mutate of [data=>{data.members=null},data=>{data.members[0].owner_user_id=F},data=>{data.members.push(data.members[0])},data=>{data.has_more=true;data.next_after_id='bad'},data=>{data.members[0].enabled_features={}}]) {
    const broken=database({rpc:(p,normal)=>{const r=normal();mutate(r.data);return r}});
    await assert.rejects(()=>api.loadClientTeam(broken,scope),/confirmed|incomplete|changed/);
  }
  const changed=database({members:Array.from({length:205},(_,i)=>row(i+1)),rpc:(p,normal)=>{const r=normal();if(p.after_id)r.data.team_revision=2;return r}});
  await assert.rejects(()=>api.loadClientTeam(changed,scope),/changed while loading/);
});
test('candidate lookup uses full exact email and confirms returned identity without browser directory reads',async()=>{
  const db=database();const result=await api.searchClientTeamCandidate(db,scope,' SECOND@EXAMPLE.TEST ');
  assert.equal(result[0].userId,D);assert.equal(db.calls[0].email,'second@example.test');
  await assert.rejects(()=>api.searchClientTeamCandidate(db,scope,'se'),/full email/);
  db.behavior=(p,normal)=>{const r=normal();r.data.candidates[0].email='someoneelse@example.test';return r};
  await assert.rejects(()=>api.searchClientTeamCandidate(db,scope,'second@example.test'),/confirmed/);
});
test('zero, malformed and wrong-scope mutation replies never count as confirmed',async()=>{
  for(const mutate of [r=>{r.data=null},r=>{r.data.committed=false},r=>{r.data.operation_id=F},r=>{r.data.owner_user_id=F},r=>{r.data.operation_revision=7},r=>{r.data.member_user_id=F}]) {
    const db=database({rpc:(p,normal)=>{const r=normal();mutate(r);return r}});
    const op=api.newTeamChange('remove',{configId:CID,userId:M,email:'member@example.test',fullName:'Member',enabledFeatures:[],available:true},0);
    await assert.rejects(()=>api.applyClientTeamChange(db,scope,op),e=>e instanceof api.TeamRequestError&&e.uncertain===true);
  }
});
test('account changes before a request block it; changes after a write leave an uncertain outcome',async()=>{
  const db=database();db.userId=F;await assert.rejects(()=>api.loadClientTeam(db,scope),/sign-in/);assert.equal(db.calls.length,0);
  const changed=database({rpc:(p,normal,d)=>{const result=normal();d.userId=F;return result}});
  await assert.rejects(()=>api.applyClientTeamChange(changed,scope,api.newTeamChange('remove',{configId:CID,userId:M,email:null,fullName:null,enabledFeatures:[],available:true},0)),e=>e.uncertain===true);
});
test('hung requests time out without claiming a write failed or succeeded and clear their timers',async()=>{
  const timers=new Map();let sequence=0;
  const bounded=load('lib/client-team-management.ts',{'./entitlements':{CLIENT_FEATURE_KEYS:keys}},{setTimeout(fn){timers.set(++sequence,fn);return sequence},clearTimeout(id){timers.delete(id)}});
  const db=database({rpc:()=>new Promise(()=>{})});
  const change=bounded.newTeamChange('remove',{configId:CID,userId:M,email:null,fullName:null,enabledFeatures:[],available:true},0);
  const waiting=bounded.applyClientTeamChange(db,scope,change);await flush();
  assert.equal(timers.size,1);for(const fn of timers.values())fn();
  await assert.rejects(()=>waiting,e=>e instanceof bounded.TeamRequestError&&e.uncertain===true);assert.equal(timers.size,0);
});
test('a list failure shows Retry and never an empty-team success; Retry restores confirmed records',async()=>{
  const h=harness({rpc:()=>({data:null,error:{code:'PGRST000',message:'offline'}})});let tree=await h.start();
  assert.ok(content(tree).includes('could not be loaded'));assert.ok(!content(tree).includes('No team members yet'));
  assert.equal(button(tree,'Add Team Member').props.disabled,true);
  h.db.behavior=null;h.click('Retry loading team');tree=await h.settle();assert.ok(content(tree).includes('Existing Member'));
});
test('Search submits real requests, distinguishes failures from zero results and retires closed/changed searches',async()=>{
  const h=harness();await h.start();h.click('Add Team Member');h.input('second@example.test');
  h.db.behavior=(p,normal)=>p.action==='search'?{data:null,error:{code:'PGRST000'}}:normal();h.submit();let tree=await h.settle();
  assert.ok(content(tree).includes('Retry search'));assert.ok(!content(tree).includes('No eligible client'));
  h.db.behavior=null;h.click('Retry search');tree=await h.settle();assert.ok(content(tree).includes('New Member'));
  const waiting=deferred();h.db.behavior=(p,normal)=>p.action==='search'?waiting.promise:normal();h.submit();await flush();
  h.input('missing@example.test');waiting.resolve({data:null,error:{code:'PGRST000'}});tree=await h.settle();assert.ok(!content(tree).includes('Retry search'));
  h.click('Close add member');tree=h.render();assert.ok(!nodes(tree).some(n=>n.props?.role==='dialog'));
});
test('feature values remain saved until confirmed; duplicate clicks cannot start overlapping writes',async()=>{
  const waiting=deferred();let complete;
  const h=harness({rpc:(p,normal)=>{if(p.action==='update'){complete=()=>waiting.resolve(normal());return waiting.promise}return normal()}});
  await h.start();h.toggle();h.toggle();await flush();let tree=h.render();
  assert.equal(h.db.calls.filter(c=>c.action==='update').length,1);
  const toggle=nodes(tree).find(n=>n.props?.role==='switch'&&n.props['aria-label'].startsWith('API Access'));
  assert.equal(toggle.props['aria-checked'],false);assert.equal(toggle.props.disabled,true);
  complete();tree=await h.settle();assert.equal(nodes(tree).find(n=>n.props?.role==='switch'&&n.props['aria-label'].startsWith('API Access')).props['aria-checked'],true);
  assert.ok(content(tree).includes('Change confirmed'));
});
test('lost Add response preserves the exact operation for Retry and does not create another member',async()=>{
  let lose=true;
  const h=harness({rpc:(p,normal)=>{const r=normal();if(p.action==='add'&&lose){lose=false;throw Error('reply lost')}return r}});
  await h.start();h.click('Add Team Member');h.input('second@example.test');h.submit();await h.settle();h.click('Add member');let tree=await h.settle();
  assert.ok(content(tree).includes('Retry change'));assert.equal(h.db.writes,1);assert.equal(button(tree,'Close add member').props.disabled,true);
  h.click('Retry change');tree=await h.settle();assert.equal(h.db.writes,1);assert.equal(h.db.members.length,2);assert.ok(content(tree).includes('Change confirmed'));
  const calls=h.db.calls.filter(c=>c.action==='add');assert.equal(calls.length,2);assert.equal(calls[0].operation_id,calls[1].operation_id);assert.equal(calls[0].config_id,calls[1].config_id);assert.equal(calls[0].expected_revision,calls[1].expected_revision);
});
test('confirmed write plus failed refresh requires read Retry without replaying the write',async()=>{
  const h=harness({rpc:(p,normal,d)=>p.action==='list'&&d.revision>0?{data:null,error:{code:'PGRST000'}}:normal()});
  await h.start();h.toggle();let tree=await h.settle();assert.ok(content(tree).includes('Change confirmed. Reload'));assert.ok(content(tree).includes('Retry loading team'));
  assert.equal(h.db.writes,1);h.db.behavior=null;h.click('Retry loading team');tree=await h.settle();assert.equal(h.db.writes,1);assert.ok(content(tree).includes('Existing Member'));
});
test('removal needs confirmation and an unconfirmed response preserves the member for same-operation Retry',async()=>{
  let wrong=true;
  const h=harness({rpc:(p,normal)=>{const r=normal();if(p.action==='remove'&&wrong){wrong=false;r.data.committed=false}return r}});
  await h.start();h.click('Remove member');assert.equal(h.db.writes,0);h.click('Confirm removal');let tree=await h.settle();
  assert.ok(content(tree).includes('Existing Member'));assert.ok(content(tree).includes('Retry change'));
  h.click('Retry change');tree=await h.settle();assert.ok(content(tree).includes('No team members yet'));assert.equal(h.db.writes,1);
});
test('a confirmed stale-write rejection keeps saved values and unlocks only after a fresh read',async()=>{
  const h=harness({rpc:(p,normal)=>p.action==='update'?{data:null,error:{code:'P0001',message:'Team changed elsewhere. Reload before saving'}}:normal()});
  await h.start();h.toggle();let tree=await h.settle();
  assert.ok(content(tree).includes('Team changed elsewhere'));assert.equal(h.db.writes,0);
  assert.equal(nodes(tree).find(n=>n.props?.role==='switch').props.disabled,true);
  h.db.behavior=null;h.click('Reload team');tree=await h.settle();assert.ok(!content(tree).includes('Team changed elsewhere'));
  h.toggle();tree=await h.settle();assert.equal(h.db.writes,1);assert.ok(content(tree).includes('Change confirmed'));
});
test('legacy feature names are rendered safely and can be removed without prototype lookups',async()=>{
  const member=row();member.enabled_features=['__proto__'];const h=harness({members:[member]});
  await h.start();assert.ok(renderToStaticMarkup(h.render()).includes('__proto__'));
  nodes(h.render()).find(n=>n.props?.role==='switch'&&n.props['aria-label'].startsWith('__proto__')).props.onClick();
  await h.settle();assert.deepEqual(h.db.members[0].enabled_features,[]);
});
test('late reads and write callbacks cannot restore a previous account or update an unmounted screen',async()=>{
  const waiting=deferred();let finish;
  const h=harness({rpc:(p,normal)=>{if(p.action==='update'){finish=()=>waiting.resolve(normal());return waiting.promise}return normal()}});
  await h.start();h.toggle();await flush();h.unmount();const writes=h.writes;finish();await flush();assert.equal(h.writes,writes);
  const x=harness();await x.start();x.db.event('SIGNED_OUT',null);let tree=await x.settle();assert.ok(!content(tree).includes('Existing Member'));
  x.db.userId=F;x.db.clientId=FC;x.db.members=[];x.db.event('SIGNED_IN',F);x.render({userId:F,clientId:FC,companyName:'Other Company'});tree=await x.settle();assert.ok(!content(tree).includes('member@example.test'));
});
