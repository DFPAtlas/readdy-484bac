import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

test('client reviews ignore superseded and closed-screen authentication results',async()=>{
 const source=fs.readFileSync('app/client/reviews/page.tsx','utf8');
 const body=source.slice(source.indexOf('  const mountedRef ='),source.indexOf('  useEffect(() => {',source.indexOf('  const mountedRef =')));
 const auth=[],updates=[],redirects=[];
 const setters=[...new Set([...body.matchAll(/\b(set[A-Z]\w*)\(/g)].map(m=>m[1]))];
 const env={useRef:current=>({current}),useCallback:fn=>fn,router:{push:p=>redirects.push(p)},supabase:{auth:{getUser:()=>new Promise(resolve=>auth.push(resolve))},from(table){const promise=Promise.resolve({data:table==='clients'?{id:'client',company_name:'Current Client'}:[]});const q=new Proxy({},{get:(_,key)=>key==='then'?promise.then.bind(promise):()=>q});return q;}},...Object.fromEntries(setters.map(name=>[name,value=>updates.push([name,value])]))};
 const js=ts.transpileModule(body+'\nreturn {loadReviews,mountedRef};',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const api=new Function(...Object.keys(env),js)(...Object.values(env));api.mountedRef.current=true;
 const first=api.loadReviews(),second=api.loadReviews();auth[1]({data:{user:{id:'user'}}});await second;
 assert(updates.some(([name])=>name==='setPendingReviews'));
 const count=updates.length;auth[0]({data:{user:null}});await first;assert.equal(updates.length,count);assert.deepEqual(redirects,[]);
 const closing=api.loadReviews();const afterStart=updates.length;api.mountedRef.current=false;auth[2]({data:{user:null}});await closing;
 assert.equal(updates.length,afterStart);assert.deepEqual(redirects,[]);
});
