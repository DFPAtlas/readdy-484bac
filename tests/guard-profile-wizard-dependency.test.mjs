import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

test('wizard initialization discards the previous lifetime after cleanup and restart',async()=>{
 const source=fs.readFileSync('app/guard/complete-profile-wizard/page.tsx','utf8');
 const body=source.slice(source.indexOf('  useEffect(() => {'),source.indexOf('  const handleFileChange'));
 const sessions=[],loaded=[],redirects=[],updates=[];let cleanup,unsubscribed=0;
 const env={mountedRef:{current:true},editParam:null,router:{push:p=>redirects.push(p)},useEffect:fn=>{cleanup=fn()},setLoading:v=>updates.push(v),setLoadError:()=>{},setRoleSwitch:()=>{},setTimeout:()=>1,clearTimeout:()=>{},setGuardWizardEditFlag:()=>{},loadProfile:async user=>loaded.push(user.id),supabase:{auth:{getSession:()=>new Promise(resolve=>sessions.push(resolve)),onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>unsubscribed++}}})},from(table){const p=Promise.resolve({data:table==='guards'?{id:'guard'}:null});const q=new Proxy({},{get:(_,key)=>key==='then'?p.then.bind(p):()=>q});return q;}}};
 const js=ts.transpileModule(body,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const run=()=>new Function(...Object.keys(env),js)(...Object.values(env));const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
 run();cleanup();run();sessions[1]({data:{session:{user:{id:'current'}}}});await flush();assert.deepEqual(loaded,['current']);
 const count=updates.length;sessions[0]({data:{session:null}});await flush();assert.deepEqual(redirects,[]);assert.equal(updates.length,count);assert.equal(unsubscribed,1);
 cleanup();assert.equal(unsubscribed,2);
});
