import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

test('bank settings ignores superseded authentication and bank reads after cleanup',async()=>{
 const source=fs.readFileSync('app/guard/bank-settings/page.tsx','utf8');
 const body=source.slice(source.indexOf('  const mountedRef ='),source.indexOf('  useEffect(() => {',source.indexOf('  const mountedRef =')));
 const auth=[],bank=[],updates=[],redirects=[];
 const setters=[...new Set([...body.matchAll(/\b(set[A-Z]\w*)\(/g)].map(m=>m[1]))];
 const env={useRef:current=>({current}),useCallback:fn=>fn,router:{push:p=>redirects.push(p)},supabase:{auth:{getUser:()=>new Promise(resolve=>auth.push(resolve))},from(table){const q=new Proxy({},{get:(_,key)=>key==='then'?(resolve,reject)=>(table==='guards'?Promise.resolve({data:{id:'guard',full_name:'Current Guard'}}):new Promise(r=>bank.push(r))).then(resolve,reject):()=>q});return q;}},...Object.fromEntries(setters.map(name=>[name,value=>updates.push([name,value])]))};
 const js=ts.transpileModule(body+'\nreturn {checkAuthAndLoadData,mountedRef};',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const api=new Function(...Object.keys(env),js)(...Object.values(env));api.mountedRef.current=true;
 const old=api.checkAuthAndLoadData(),current=api.checkAuthAndLoadData();auth[1]({data:{user:{id:'user'}}});
 for(let i=0;i<20;i++)await Promise.resolve();assert.equal(bank.length,1);
 api.mountedRef.current=false;const count=updates.length;bank[0]({data:{account_number:'12345678'}});await current;
 auth[0]({data:{user:null}});await old;assert.equal(updates.length,count);assert.deepEqual(redirects,[]);
 assert(!updates.some(([name])=>name==='setBankDetails'));
});
