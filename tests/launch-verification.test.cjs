const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const source=fs.readFileSync('supabase/functions/launch-readiness/index.ts','utf8');
const block=source.slice(source.indexOf('    let rlsStatus:'),source.indexOf('    const needsVerification'));
const code=ts.transpileModule(block,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
async function run(result,response){const checks=[];await new Function('supabaseQ','fetch','checks','auto',`return (async()=>{${code}})()` )({rpc:async()=>result},async()=>{if(!response)throw Error('offline');return response;},checks,(id,severity,label,status,notes)=>({id,status,notes}));return checks;}
const site=(url='https://quickguard.uk',status=200,body='QuickGuard')=>({url,status,ok:status===200,text:async()=>body});
test('RLS errors, empty inventories and disabled tables cannot pass',async()=>{
 for(const result of [{error:{}},{data:[]},{data:[{schema_name:'app',rls_enabled:false,table_name:'jobs'}]}]){assert.notEqual((await run(result,site()))[0].status,'pass');}
 const c=await run({data:[{schema_name:'app',rls_enabled:true}]},site());assert.equal(c[0].status,'pass');assert.equal(c[1].status,'not_verified');
});
test('domain pass requires actual production HTTPS response and content',async()=>{
 for(const response of [undefined,site('https://edge-runtime.supabase.com'),site('http://quickguard.uk'),site('https://quickguard.uk',500),site('https://quickguard.uk',200,'Other site')])assert.notEqual((await run({data:[]},response))[2].status,'pass');
 assert.equal((await run({data:[]},site()))[2].status,'pass');
});
