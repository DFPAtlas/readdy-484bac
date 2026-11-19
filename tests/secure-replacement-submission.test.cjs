const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {PGlite} = require('@electric-sql/pglite');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const migration=fs.readFileSync('supabase/migrations/20261118215349_secure_client_replacement_submission.sql','utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function load(file,mocks={},globals={}){const module={exports:{}};new Function('module','exports','require',...Object.keys(globals),compile(fs.readFileSync(file,'utf8')))(module,module.exports,name=>name in mocks?mocks[name]:require(name),...Object.values(globals));return module.exports;}
const body={requestId:id(30),clientId:id(2),jobId:id(3),assignmentId:id(5),reason:'no_show',urgency:'urgent',arrival:'2099-01-01T18:00',notes:'Preferred guard: informational only',phone:'',createTicket:true};
const receipt={requestId:body.requestId,clientId:body.clientId,jobId:body.jobId,ticketId:id(40),status:'requested'};

test('replacement transaction enforces service-only ownership, atomic saves, replay safety and browser read-only access',async t=>{
  const db=new PGlite();
  try{
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA app; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
      CREATE TABLE app.clients(id uuid PRIMARY KEY,user_id uuid);
      CREATE TABLE app.account_closures(user_id uuid PRIMARY KEY);
      CREATE TABLE app.jobs(id uuid PRIMARY KEY,client_id uuid,job_title text,is_deleted boolean DEFAULT false,status text DEFAULT 'in_progress');
      CREATE TABLE app.guards(id uuid PRIMARY KEY);
      CREATE TABLE app.job_assignments(id uuid PRIMARY KEY,job_id uuid REFERENCES app.jobs(id),guard_id uuid REFERENCES app.guards(id),status text DEFAULT 'confirmed',replacement_requested boolean DEFAULT false,issue_reported boolean DEFAULT false,issue_type text,updated_at timestamptz DEFAULT now());
      CREATE TABLE app.support_tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_id uuid,related_job_id uuid,category text,subject text NOT NULL,description text NOT NULL,priority text,status text,contact_preference text,dfp_sync_status text);
      CREATE TABLE app.replacement_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_id uuid REFERENCES app.clients(id),job_id uuid REFERENCES app.jobs(id),assignment_id uuid REFERENCES app.job_assignments(id),guard_id uuid REFERENCES app.guards(id),reason text NOT NULL,urgency text NOT NULL,required_arrival_time text,notes text,contact_phone text,status text NOT NULL,support_ticket_id uuid REFERENCES app.support_tickets(id));
      CREATE TABLE app.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,user_type text NOT NULL,type text NOT NULL,title text NOT NULL,message text NOT NULL,link text,is_read boolean);
      GRANT USAGE ON SCHEMA app,auth TO anon,authenticated,service_role;
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA app TO service_role;
      GRANT SELECT ON app.clients,app.account_closures TO authenticated,anon;
      GRANT SELECT,INSERT,UPDATE,DELETE ON app.replacement_requests TO authenticated,anon;
      GRANT UPDATE(status) ON app.replacement_requests TO authenticated;
      ALTER TABLE app.replacement_requests ENABLE ROW LEVEL SECURITY;
      CREATE POLICY client_select_own_replacements ON app.replacement_requests FOR SELECT TO authenticated USING(client_id IN(SELECT id FROM app.clients WHERE user_id=auth.uid()));
      CREATE POLICY client_insert_own_replacements ON app.replacement_requests FOR INSERT TO authenticated WITH CHECK(client_id IN(SELECT id FROM app.clients WHERE user_id=auth.uid()));
      CREATE POLICY client_update_own_replacements ON app.replacement_requests FOR UPDATE TO authenticated USING(client_id IN(SELECT id FROM app.clients WHERE user_id=auth.uid()));
      CREATE POLICY client_delete_own_replacements ON app.replacement_requests FOR DELETE TO authenticated USING(client_id IN(SELECT id FROM app.clients WHERE user_id=auth.uid()));
      CREATE POLICY qg_closed_account_block ON app.replacement_requests AS RESTRICTIVE TO authenticated USING(NOT EXISTS(SELECT 1 FROM app.account_closures WHERE user_id=auth.uid())) WITH CHECK(NOT EXISTS(SELECT 1 FROM app.account_closures WHERE user_id=auth.uid()));
      INSERT INTO app.clients VALUES('${id(2)}','${id(1)}'),('${id(12)}','${id(11)}');
      INSERT INTO app.jobs(id,client_id,job_title) VALUES('${id(3)}','${id(2)}','Owned job'),('${id(13)}','${id(12)}','Foreign job');
      INSERT INTO app.guards VALUES('${id(4)}'),('${id(14)}');
      INSERT INTO app.job_assignments(id,job_id,guard_id) VALUES('${id(5)}','${id(3)}','${id(4)}'),('${id(15)}','${id(13)}','${id(14)}');
      INSERT INTO app.replacement_requests(id,client_id,job_id,assignment_id,reason,urgency,status) VALUES('${id(90)}','${id(2)}','${id(3)}','${id(5)}','other','normal','requested');
    `);
    const role=async who=>db.exec(`RESET ROLE; SELECT set_config('test.uid','${id(1)}',false); SET ROLE ${who};`);
    const rpc=async(overrides={},user=id(1))=>{const b={...body,...overrides};await role('service_role');return(await db.query('select app.submit_client_replacement_request($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as receipt',[user,b.requestId,b.clientId,b.jobId,b.assignmentId,b.reason,b.urgency,b.arrival,b.notes,b.phone,b.createTicket])).rows[0].receipt;};
    const counts=async()=>{await role('service_role');return(await db.query('select (select count(*)::int from app.replacement_requests) requests,(select count(*)::int from app.support_tickets) tickets,(select count(*)::int from app.notifications) notifications')).rows[0];};
    await t.test('reproduces direct status forgery and verifies transactional DDL rollback',async()=>{
      await db.exec(`SELECT set_config('test.uid','${id(1)}',false);SET ROLE authenticated;UPDATE app.replacement_requests SET status='replacement_confirmed' WHERE id='${id(90)}';RESET ROLE;BEGIN;`);
      await db.exec(migration);await db.exec('ROLLBACK');
      assert.equal((await db.query("select to_regprocedure('app.submit_client_replacement_request(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,boolean)') as fn")).rows[0].fn,null);
      await db.exec(`SET ROLE authenticated;UPDATE app.replacement_requests SET status='requested' WHERE id='${id(90)}';RESET ROLE;`);
      await db.exec(migration);await db.exec(migration);
    });
    await t.test('auth/anonymous roles cannot execute RPC or mutate rows, including independent column grants; reads stay owned',async()=>{
      for(const who of ['authenticated','anon']){
        await role(who);
        for(const sql of ["UPDATE app.replacement_requests SET status='replacement_confirmed'",'DELETE FROM app.replacement_requests',"INSERT INTO app.replacement_requests(reason,urgency,status) VALUES('other','normal','requested')",'SELECT app.submit_client_replacement_request(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)'])await assert.rejects(db.exec(sql),e=>e.code==='42501');
      }
      await role('authenticated');assert.equal((await db.query('select count(*)::int n from app.replacement_requests')).rows[0].n,1);
      await db.exec(`SELECT set_config('test.uid','${id(11)}',false)`);assert.equal((await db.query('select count(*)::int n from app.replacement_requests')).rows[0].n,0);
    });
    await t.test('foreign client/job/assignment, closed account, invalid payload and terminal jobs cannot write',async()=>{
      const before=await counts();
      for(const overrides of [{clientId:id(12)},{jobId:id(13)},{assignmentId:id(15)},{reason:'forged'},{urgency:'forged'},{arrival:'2026-02-30T12:00'},{arrival:'2000-01-01T12:00'},{arrival:'2099-03-29T01:30'},{urgency:'emergency',phone:'  '},{notes:'x'.repeat(2001)}])await assert.rejects(rpc(overrides));
      await role('service_role');await db.exec(`INSERT INTO app.account_closures VALUES('${id(1)}')`);await assert.rejects(rpc());await db.exec('DELETE FROM app.account_closures');
      await db.exec(`UPDATE app.jobs SET status='completed' WHERE id='${id(3)}'`);await assert.rejects(rpc());await db.exec(`UPDATE app.jobs SET status='in_progress',is_deleted=true WHERE id='${id(3)}'`);await assert.rejects(rpc());await db.exec(`UPDATE app.jobs SET is_deleted=false WHERE id='${id(3)}'`);
      assert.deepEqual(await counts(),before);
    });
    await t.test('one transaction creates request, ticket/link, flags and notification; replay does not duplicate or reset status',async()=>{
      const first=await rpc();assert.equal(first.requestId,body.requestId);assert.ok(first.ticketId);assert.equal(first.status,'requested');
      assert.deepEqual(await counts(),{requests:2,tickets:1,notifications:1});
      const row=(await db.query('select * from app.replacement_requests where id=$1',[body.requestId])).rows[0];assert.equal(row.guard_id,id(4));assert.equal(row.support_ticket_id,first.ticketId);assert.equal(row.required_arrival_time,'2099-01-01T18:00:00Z');
      assert.equal((await db.query('select replacement_requested from app.job_assignments where id=$1',[id(5)])).rows[0].replacement_requested,true);
      assert.equal((await db.query('select dfp_sync_status from app.support_tickets')).rows[0].dfp_sync_status,'pending');
      await db.query("UPDATE app.replacement_requests SET status='searching' WHERE id=$1",[body.requestId]);const replay=await rpc();assert.equal(replay.status,'searching');assert.equal(replay.ticketId,first.ticketId);assert.deepEqual(await counts(),{requests:2,tickets:1,notifications:1});
      for(const override of [{notes:'changed'},{reason:'late'},{assignmentId:id(15)},{createTicket:false}])await assert.rejects(rpc(override));
    });
    await t.test('normal/opt-out submissions omit tickets and UK summer times are converted to UTC',async()=>{
      const one=await rpc({requestId:id(31),urgency:'normal',arrival:'2099-07-01T18:00'});assert.equal(one.ticketId,null);
      const row=(await db.query('select required_arrival_time from app.replacement_requests where id=$1',[id(31)])).rows[0];assert.equal(row.required_arrival_time,'2099-07-01T17:00:00Z');
      const two=await rpc({requestId:id(32),createTicket:false});assert.equal(two.ticketId,null);assert.equal((await counts()).tickets,1);
    });
    await t.test('late notification or assignment failure rolls back every request/ticket/flag write',async()=>{
      await role('service_role');await db.exec('UPDATE app.job_assignments SET replacement_requested=false,issue_reported=false');const before=await counts();
      await db.exec('RESET ROLE; CREATE FUNCTION app.test_fail_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'synthetic failure\'; END $$; CREATE TRIGGER fail_notification BEFORE INSERT ON app.notifications FOR EACH ROW EXECUTE FUNCTION app.test_fail_notification();');
      await assert.rejects(rpc({requestId:id(33)}));assert.deepEqual(await counts(),before);assert.equal((await db.query('select replacement_requested from app.job_assignments where id=$1',[id(5)])).rows[0].replacement_requested,false);
      await db.exec('RESET ROLE; DROP TRIGGER fail_notification ON app.notifications; CREATE FUNCTION app.test_fail_assignment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$; CREATE TRIGGER fail_assignment BEFORE UPDATE ON app.job_assignments FOR EACH ROW EXECUTE FUNCTION app.test_fail_assignment();');
      await assert.rejects(rpc({requestId:id(34)}));assert.deepEqual(await counts(),before);
    });
  }finally{await db.close();}
});

test('browser submission helper requires an authenticated matching receipt and ignores retired results',async()=>{
  const {submitReplacementRequest}=load('lib/replacement-submission.ts');
  const db={auth:{getUser:async()=>({data:{user:{id:id(1)}}})},functions:{invoke:async()=>({data:{success:true,receipt,supportSyncPending:true}})}};
  assert.deepEqual(await submitReplacementRequest(db,body,()=>true),{requestId:body.requestId,ticketId:receipt.ticketId,supportSyncPending:true});
  for(const data of [null,{success:false},{success:true,receipt:{...receipt,requestId:id(999)},supportSyncPending:false},{success:true,receipt:{...receipt,clientId:id(999)},supportSyncPending:false},{success:true,receipt,supportSyncPending:undefined}])await assert.rejects(submitReplacementRequest({...db,functions:{invoke:async()=>({data})}},body,()=>true));
  await assert.rejects(submitReplacementRequest({...db,auth:{getUser:async()=>({data:{user:null}})},functions:{invoke:()=>assert.fail('unauthenticated write')}},body,()=>true));
  for(const [status,outcome,editable] of [[400,'rejected',true],[403,'rejected',true],[409,'rejected',false],[503,'rejected',false],[400,'unconfirmed',false]]) {
    const error={context:new Response(JSON.stringify({outcome}),{status})};
    await assert.rejects(submitReplacementRequest({...db,functions:{invoke:async()=>({error})}},body,()=>true),e=>e.canEdit===editable);
  }
  let active=true;const slow=deferred();const work=submitReplacementRequest({...db,functions:{invoke:()=>slow.promise}},body,()=>active);await Promise.resolve();active=false;slow.resolve({data:{success:true,receipt,supportSyncPending:false}});await assert.rejects(work);
});

function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function nodes(tree){if(Array.isArray(tree))return tree.flatMap(nodes);if(!tree||typeof tree!=='object')return[];return[tree,...nodes(tree.props?.children)];}
function text(tree){if(Array.isArray(tree))return tree.map(text).join('');if(tree&&typeof tree==='object')return text(tree.props?.children);return tree==null||typeof tree==='boolean'?'':String(tree);}
function button(tree,label){const node=nodes(tree).find(n=>n.type==='button'&&text(n).trim()===label);assert.ok(node,`missing ${label}`);return node;}
function modal(submit=async(_db,payload)=>({requestId:payload.requestId,ticketId:id(40),supportSyncPending:true})){
  const slots=[body.assignmentId,'urgent','no_show',body.arrival,'Notes','',false,'',false,2,true],effects=[],calls=[];let cursor=0,writes=0,closed=0,finished=0;
  const hooks={...React,useState(initial){const n=cursor++;if(!(n in slots))slots[n]=initial;return[slots[n],value=>{writes++;slots[n]=typeof value==='function'?value(slots[n]):value;}];},useRef(initial){const n=cursor++;if(!(n in slots))slots[n]={current:initial};return slots[n];},useEffect(fn){const n=cursor++;if(!effects[n])effects[n]={cleanup:fn()};}};
  const api=load('app/client/jobs/[id]/ReplacementRequestModal.tsx',{'react':hooks,'@/lib/supabase':{supabase:{}},'@/lib/replacement-submission':{submitReplacementRequest:async(...args)=>{calls.push(structuredClone(args[1]));return submit(...args);}}});
  const props={jobId:body.jobId,clientId:body.clientId,jobTitle:'Job',assignmentId:body.assignmentId,onClose:()=>closed++,onSuccess:()=>finished++};
  return{calls,slots,get writes(){return writes;},get closed(){return closed;},get finished(){return finished;},render(){cursor=0;return api.default(props);},unmount(){effects.forEach(e=>e?.cleanup?.());}};
}

test('modal retries one frozen intent, blocks duplicate clicks, retains receipt/warnings and only finishes on explicit acknowledgement',async()=>{
  let failed=true;const wait=deferred();const h=modal(async(_db,payload)=>{if(failed)return wait.promise;return{requestId:payload.requestId,ticketId:id(40),supportSyncPending:true};});
  const submit=button(h.render(),'Request Replacement').props.onClick;const pending=submit();await submit();assert.equal(h.calls.length,1);assert.equal(button(h.render(),'Back').props.disabled,true);assert.equal(nodes(h.render()).find(n=>n.props?.['aria-label']==='Close replacement request').props.disabled,true);
  wait.reject(Error('offline'));await pending;assert.match(renderToStaticMarkup(h.render()),/role="alert"/);assert.equal(nodes(h.render()).find(n=>n.type==='textarea').props.value,'Notes');assert.equal(nodes(h.render()).find(n=>n.type==='textarea').props.disabled,true);
  failed=false;await button(h.render(),'Retry request').props.onClick();assert.deepEqual(h.calls[0],h.calls[1]);assert.match(text(h.render()),/request recorded.*synchronisation is pending/s);assert.equal(h.finished,0);
  await submit();assert.equal(h.calls.length,2);const done=button(h.render(),'Done').props.onClick;done();done();assert.equal(h.finished,1);assert.equal(h.closed,0);
});

test('modal validates assignment, UK time and trimmed emergency phone; unmounts cannot save UI or finish later',async()=>{
  for(const change of [[0,''],[3,'18:00'],[1,'emergency']]){const h=modal();h.slots[change[0]]=change[1];if(change[0]===1)h.slots[5]='   ';await button(h.render(),'Request Replacement').props.onClick();assert.equal(h.calls.length,0);assert.match(renderToStaticMarkup(h.render()),/role="alert"/);}
  for(const failure of [false,true]){const wait=deferred();const h=modal(()=>wait.promise);const submit=button(h.render(),'Request Replacement').props.onClick;const work=submit();h.unmount();const writes=h.writes;if(failure)wait.reject(Error('late'));else wait.resolve({requestId:h.calls[0].requestId,ticketId:null,supportSyncPending:false});await work;await submit();assert.equal(h.writes,writes);assert.equal(h.finished,0);assert.equal(h.calls.length,1);}
});

test('a definitive rejection permits correction and a new intent; unknown outcomes retain the original intent',async()=>{
  const h=modal(async()=>{throw Object.assign(Error('rejected'),{canEdit:true});});
  await button(h.render(),'Request Replacement').props.onClick();assert.equal(nodes(h.render()).find(n=>n.type==='textarea').props.disabled,false);
  nodes(h.render()).find(n=>n.type==='textarea').props.onChange({target:{value:'Corrected notes'}});
  await button(h.render(),'Request Replacement').props.onClick();assert.notEqual(h.calls[0].requestId,h.calls[1].requestId);assert.equal(h.calls[1].notes,'Corrected notes');
});

test('edge handler derives actor from verified token, restricts RPC parameters and preserves receipts when support sync fails',async()=>{
  let handler,valid=true,rpcError=null,bridgeOkay=false,bridgeThrows=false,record=receipt;const calls=[],fetches=[];
  load('supabase/functions/submit-replacement-request/index.ts',{
    'https://deno.land/std@0.168.0/http/server.ts':{serve:fn=>handler=fn},
    'https://esm.sh/@supabase/supabase-js@2.39.0':{createClient:()=>({auth:{getUser:async()=>({data:{user:valid?{id:id(1)}:null}})},rpc:async(...args)=>{calls.push(args);return{data:record,error:rpcError};}})},
  },{Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://project.example':'placeholder'}},fetch:async(...args)=>{fetches.push(args);if(bridgeThrows)throw Error('offline');return{ok:bridgeOkay,json:async()=>({success:bridgeOkay})};}});
  const req=(data=body,auth='Bearer token',method='POST')=>new Request('https://example.test',{method,headers:auth?{Authorization:auth}:{},...(method==='POST'?{body:JSON.stringify(data)}:{})});
  assert.equal((await handler(req(body,'','OPTIONS'))).status,204);assert.equal((await handler(req(body,'','GET'))).status,405);assert.equal((await handler(req(body,''))).status,401);valid=false;assert.equal((await handler(req())).status,401);valid=true;
  assert.equal((await handler(req({...body,requestId:'bad'}))).status,400);assert.equal(calls.length,0);
  let response=await handler(req({...body,userId:id(999),status:'replacement_confirmed',guardId:id(999)}));assert.equal(response.status,200);const data=await response.json();assert.deepEqual(data.receipt,receipt);assert.equal(data.supportSyncPending,true);
  assert.equal(calls[0][0],'submit_client_replacement_request');assert.equal(calls[0][1].p_user_id,id(1));assert.equal(calls[0][1].status,undefined);assert.equal(calls[0][1].guardId,undefined);
  assert.equal(fetches[0][0],'https://project.example/functions/v1/dfp-support-ticket-bridge');assert.deepEqual(JSON.parse(fetches[0][1].body),{ticketId:receipt.ticketId});assert.equal(fetches[0][1].headers.Authorization,'Bearer token');
  bridgeOkay=true;assert.equal((await(await handler(req())).json()).supportSyncPending,false);bridgeThrows=true;assert.equal((await(await handler(req())).json()).supportSyncPending,true);
  const previous=fetches.length;record={...receipt,ticketId:null};assert.equal((await handler(req())).status,503);assert.equal((await(await handler(req({...body,createTicket:false}))).json()).supportSyncPending,false);assert.equal(fetches.length,previous);
  for(const[code,status]of [['42501',403],['22023',400],['23505',409],['XX000',503]]){rpcError={code,message:'private detail'};response=await handler(req());assert.equal(response.status,status);assert.doesNotMatch(await response.text(),/private detail/);}assert.equal(fetches.length,previous);
});
