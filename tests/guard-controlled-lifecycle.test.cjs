const {test}=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const {load}=require('./helpers/enterprise-module.cjs');
const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs');

test('controlled current shift confirms, checks in/out and requests completion through the actual server handlers without real delivery',async()=>{
 const U=randomUUID(),G=randomUUID(),C=randomUUID(),J=randomUUID(),A=randomUUID();let owner=U;const deliveries=[];
 const tables={guards:[{id:G,user_id:U,full_name:'QA ONLY synthetic guard'}],clients:[{id:C,user_id:randomUUID(),company_name:'QA ONLY'}],jobs:[{id:J,client_id:C,job_title:'QA ONLY current controlled shift',status:'confirmed',payment_status:'funded',start_date:new Date().toISOString().slice(0,10),start_time:'00:00:00',is_deleted:false,disputed:false}],job_assignments:[{id:A,job_id:J,guard_id:G,status:'confirmed',payment_status:'funded',check_in_time:null,check_out_time:null,guard_confirmed_at:null,issue_reported:false,replacement_requested:false}],notifications:[],payment_audit_logs:[],job_completion_requests:[]};
 const db={auth:{getUser:async()=>({data:{user:{id:owner}}})},from(table){const filters=[];let mode='read',body,single=false;const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},is(k,v){filters.push(r=>(r[k]??null)===v);return q;},update(v){mode='update';body=v;return q;},insert(v){mode='insert';body=v;return q;},delete(){mode='delete';return q;},maybeSingle(){single=true;return q;},single(){single=true;return q;},then(resolve,reject){const rows=tables[table]??=[];let found=rows.filter(r=>filters.every(f=>f(r)));if(mode==='update')found.forEach(r=>Object.assign(r,body));if(mode==='insert'){const row={id:randomUUID(),...body};rows.push(row);found=[row];}if(mode==='delete')tables[table]=rows.filter(r=>!found.includes(r));return Promise.resolve({data:single?found[0]??null:found,error:null}).then(resolve,reject);}};return q;}};
 const endpoint=slug=>{let handler;load('supabase/functions/'+slug+'/index.ts',{'https://deno.land/std@0.168.0/http/server.ts':{serve:fn=>handler=fn},'https://esm.sh/@supabase/supabase-js@2.39.0':{createClient:()=>db},'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:()=>db}},{Deno:{env:{get:()=> 'synthetic-config'}},fetch:async(url,options)=>{deliveries.push({url,body:JSON.parse(options.body)});return Response.json({success:true});}});return async body=>{const r=await handler(new Request('https://example.test/qa',{method:'POST',headers:{Authorization:'Bearer synthetic',Origin:'https://quickguard.uk','Content-Type':'application/json'},body:JSON.stringify(body)}));return{status:r.status,body:await r.json()};};};
 const attendance=endpoint('guard-shift-attendance'),complete=endpoint('request-job-completion');const ids={assignmentId:A,jobId:J};
 owner=randomUUID();assert.equal((await attendance({...ids,action:'check_in'})).status,404);owner=U;
 const confirmed=await attendance({...ids,action:'confirm_shift'});assert.equal(confirmed.status,200);assert.equal(confirmed.body.alreadyConfirmed,false);assert.ok(tables.job_assignments[0].guard_confirmed_at);
 assert.equal((await attendance({...ids,action:'confirm_shift'})).body.alreadyConfirmed,true);
 assert.equal((await attendance({...ids,action:'check_in'})).status,200);assert.equal(tables.job_assignments[0].status,'in_progress');assert.ok(tables.job_assignments[0].check_in_time);
 assert.equal((await complete(ids)).status,400,'checkout required');
 assert.equal((await attendance({...ids,action:'check_out'})).status,200);assert.ok(tables.job_assignments[0].check_out_time);
 assert.equal((await complete(ids)).status,200);assert.equal(tables.job_assignments[0].status,'completed');assert.equal(tables.jobs[0].status,'awaiting_client_approval');assert.equal(tables.job_completion_requests.length,1);
 assert.equal((await complete(ids)).status,400);assert.equal(tables.job_completion_requests.length,1);
 assert.ok(tables.notifications.every(n=>n.user_id===tables.clients[0].user_id));assert.equal(deliveries.length,0,'no email address or external delivery is configured in this isolated fixture');
});

test('controlled settled-job review uses the real atomic review RPC and cannot duplicate or target another guard',async()=>{
 const db=new PGlite(),C=randomUUID(),G=randomUUID(),CID=randomUUID(),GID=randomUUID(),J=randomUUID(),A=randomUUID();
 try{
  await db.exec(fs.readFileSync('tests/fixtures/quickguard-finish-schema.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261120170000_quickguard_finish_writes.sql','utf8'));
  await db.query("insert into auth.users(id) values($1),($2)",[C,G]);
  await db.query("insert into app.users(id,user_type) values($1,'client'),($2,'guard')",[C,G]);
  await db.query("insert into app.clients(id,user_id) values($1,$2)",[CID,C]);await db.query('insert into app.guards(id,user_id) values($1,$2)',[GID,G]);
  await db.query("insert into app.jobs(id,client_id,status,job_title) values($1,$2,'paid_out','QA ONLY isolated settled job')",[J,CID]);
  await db.query("insert into app.job_assignments(id,job_id,guard_id,status,payment_status) values($1,$2,$3,'completed','paid_out')",[A,J,GID]);
  await db.exec('set role service_role');const submit=payload=>db.query('select app.submit_client_review($1,$2::jsonb) as result',[C,JSON.stringify(payload)]);const review={jobId:J,guardId:GID,rating:5,attendanceStatus:'present',issueReported:false,reviewText:'QA ONLY controlled regression'};
  const first=(await submit(review)).rows[0].result;assert.ok(first);assert.equal((await db.query('select count(*)::int n from app.reviews')).rows[0].n,1);
  const retry=(await submit(review)).rows[0].result;assert.equal(retry.replayed,true);assert.equal((await db.query('select count(*)::int n from app.reviews')).rows[0].n,1);
  await assert.rejects(()=>submit({...review,guardId:randomUUID()}));
 }finally{await db.close();}
});
