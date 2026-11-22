const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
function fixture({optedOut=false,preferenceError=false,notificationError=false,providerId='provider-receipt'}={}){
 let handler;const clients=[],writes=[],requests=[],warnings=[];
 const createClient=(_url,_key,options)=>{
  clients.push(options);
  return{from(table){const q={select(){return q;},eq(){return q;},maybeSingle:async()=>({data:{job_matches:!optedOut},error:preferenceError||options?.db?.schema!=='app'?{code:'PGRST106'}:null}),insert:async row=>{writes.push({table,row});return{error:notificationError?{code:'TEST_WRITE_ERROR'}:null};}};return q;}};
 };
 const code=ts.transpileModule(fs.readFileSync('supabase/functions/send-job-match-email/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 new Function('module','exports','require','Deno','fetch','console',code)({exports:{}},{},
  name=>name.includes('/http/server.ts')?{serve:fn=>handler=fn}:{createClient},
  {env:{get:name=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-fixture',SUPABASE_ANON_KEY:'anon-fixture'})[name]}},
  async(url,args)=>{requests.push({url,args});return new Response(JSON.stringify({email_id:providerId}),{status:200});},
  {error:(...args)=>warnings.push(args)});
 const invoke=()=>handler(new Request('https://function.example.invalid',{method:'POST',headers:{Authorization:'Bearer service-fixture','Content-Type':'application/json'},body:JSON.stringify({guard_id:'guard-user',job_id:'synthetic-job',job_title:'QA only',guard_email:'guard@example.invalid',hourly_rate:'0',distance_miles:'0'})}));
 return{clients,writes,requests,warnings,invoke};
}
test('allowed alert reads app preferences and saves a job_match notification for realtime consumers',async()=>{
 const f=fixture(),response=await f.invoke(),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.email_id,'provider-receipt');assert.equal(body.notification_saved,true);
 assert.equal(f.clients[0].db.schema,'app');assert.equal(f.requests.length,1);
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].table,'notifications');
 assert.equal(f.writes[0].row.type,'job_match');assert.equal(f.writes[0].row.user_id,'guard-user');
});
test('an opted-out guard never reaches provider rendering or notification insert',async()=>{
 const f=fixture({optedOut:true}),body=await(await f.invoke()).json();
 assert.equal(body.suppressed,true);assert.equal(body.reason,'preference_disabled');
 assert.equal(f.requests.length,0);assert.equal(f.writes.length,0);
});
test('preference lookup failure stops delivery instead of silently bypassing an opt-out',async()=>{
 const f=fixture({preferenceError:true}),response=await f.invoke();
 assert.equal(response.status,500);assert.equal(f.requests.length,0);assert.equal(f.writes.length,0);
});
test('notification failure is visible without reclassifying accepted email as a retryable delivery failure',async()=>{
 const f=fixture({notificationError:true}),response=await f.invoke(),body=await response.json();
 assert.equal(response.status,200);assert.equal(body.success,true);assert.equal(body.notification_saved,false);
 assert.equal(body.email_id,'provider-receipt');assert.equal(f.warnings.length,1);
});
test('missing provider receipt cannot report successful delivery',async()=>{
 const f=fixture({providerId:null}),response=await f.invoke(),body=await response.json();
 assert.equal(response.status,502);assert.equal(body.success,false);
 assert.equal(f.writes.length,0);
});
