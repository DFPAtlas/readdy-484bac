const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
async function request(status, throws=false){
 let handler;
 const q=new Proxy({}, {get:(_,key)=>key==='then'?(resolve)=>resolve({count:0}):()=>q});
 const code=ts.transpileModule(fs.readFileSync('supabase/functions/geocode-address/index.ts','utf8').replace(/^import .*;\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('serve','createClient','Deno','fetch',code)(h=>handler=h,()=>({from:()=>q}),{env:{get:()=> 'secret-key'}},async()=>{if(throws)throw Error('secret-key');return new Response(JSON.stringify({status,results:status==='OK'?[{geometry:{location:{lat:51,lng:0}},formatted_address:'London'}]:[]}));});
 return handler(new Request('https://example.test',{method:'POST',body:JSON.stringify({query:'London'})}));
}
test('only zero results means address not found; provider rejection and quota errors remain diagnostic',async()=>{
 for(const status of ['ZERO_RESULTS','REQUEST_DENIED','OVER_QUERY_LIMIT','OVER_DAILY_LIMIT']){const r=await request(status);assert.equal(r.status,status==='ZERO_RESULTS'?404:502);assert.equal((await r.json()).code,status);}
});
test('successful coordinates remain compatible and fetch errors never expose secrets',async()=>{
 assert.equal((await (await request('OK')).json()).latitude,51);
 const r=await request('',true);assert.equal(r.status,500);assert(!(await r.text()).includes('secret-key'));
});
