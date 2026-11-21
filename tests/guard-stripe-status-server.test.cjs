const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const source=fs.readFileSync('supabase/functions/get-guard-stripe-status/index.ts','utf8').replace(/^import .*;\n/gm,'');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function fixture({account,error,profileError=false,saveError=false,zero=false,noAccount=false,noUser=false}={}){
 let handler;const writes=[],calls=[],logs=[];const db={auth:{getUser:async()=>({data:{user:noUser?null:{id:'owner'}}})},from(table){const call={table,filters:[]};calls.push(call);let update=false;const q={select(){return q;},eq(k,v){call.filters.push([k,v]);return q;},update(p){update=true;writes.push(p);return q;},maybeSingle:async()=>update?{data:zero?null:{id:'guard'},error:saveError?Error('private db'):null}:{data:{id:'guard',stripe_account_id:noAccount?null:'acct_controlled'},error:profileError?Error('private db'):null}};return q;}};
 class Stripe{static createFetchHttpClient(){return{};}accounts={retrieve:async id=>{assert.equal(id,'acct_controlled');if(error)throw error;return{details_submitted:true,charges_enabled:false,payouts_enabled:true,capabilities:{transfers:'active'},requirements:{currently_due:[],disabled_reason:null},...account};}};}
 new Function('serve','Stripe','createClient','Deno','console',compiled)(h=>handler=h,Stripe,()=>db,{env:{get:()=> 'fixture'}},{warn:(...x)=>logs.push(x),error:(...x)=>logs.push(x)});
 return{writes,calls,logs,run:async(auth='Bearer fixture')=>{const r=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:auth},body:JSON.stringify({guardId:'foreign'})}));return{status:r.status,body:await r.json()};}};
}
test('status uses authenticated owner, preserves transfers-based readiness and confirms a matching link before returning success',async()=>{
 const f=fixture();const r=await f.run();assert.equal(r.status,200);assert.equal(r.body.status,'ready');assert.equal(r.body.transfersEnabled,true);assert.equal(r.body.chargesEnabled,false);
 assert.deepEqual(f.calls[0].filters,[['user_id','owner']]);assert.deepEqual(f.calls[1].filters,[['id','guard'],['stripe_account_id','acct_controlled']]);
 for(const opts of [{saveError:true},{zero:true}]){const x=fixture(opts);const bad=await x.run();assert.equal(bad.status,409);assert.ok(bad.body.error);assert.equal(bad.body.status,undefined);}
});
test('inaccessible/missing/mismatched provider links are preserved, never reset, never expose raw Stripe errors',async()=>{
 for(const code of ['account_invalid','resource_missing','api_key_expired']){const f=fixture({error:{code,message:'secret account/key data',raw:{key:'secret'}}});const r=await f.run();assert.equal(r.status,code==='api_key_expired'?503:409);assert.equal(f.writes.length,0);assert.doesNotMatch(JSON.stringify([r,f.logs]),/secret account|raw|key data/);assert.equal(r.body.connected,undefined);}
});
test('restricted/pending accounts never become ready; absence and database/auth failures stay explicit',async()=>{
 for(const account of [{payouts_enabled:false},{details_submitted:false},{capabilities:{transfers:'inactive'}},{capabilities:{transfers:'pending'}},{requirements:{currently_due:['identity'],disabled_reason:null}},{requirements:{currently_due:[],disabled_reason:'restricted'}}]){const r=await fixture({account}).run();assert.notEqual(r.body.status,'ready');}
 const missing=fixture({noAccount:true});const r=await missing.run();assert.equal(r.body.status,'not_started');assert.equal(r.body.transfersEnabled,false);assert.equal(missing.writes.length,0);
 assert.equal((await fixture({profileError:true}).run()).status,503);assert.equal((await fixture({noUser:true}).run()).status,401);assert.equal((await fixture().run('')).status,401);
});
