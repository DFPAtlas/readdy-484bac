import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

test('client reviews ignore superseded and closed-screen authentication results',async()=>{
 const source=fs.readFileSync('app/client/reviews/page.tsx','utf8');
 const body=source.slice(source.indexOf('  const mountedRef ='),source.indexOf('  useEffect(() => {',source.indexOf('  const mountedRef =')));
 const auth=[],updates=[],redirects=[];
 const setters=[...new Set([...body.matchAll(/\b(set[A-Z]\w*)\(/g)].map(m=>m[1]))];
 const env={authLoading:false,allowed:true,userId:'user',loadClientReviews:async()=>({reviews:[],pendingReviews:[]}),useRef:current=>({current}),useCallback:fn=>fn,router:{push:p=>redirects.push(p)},supabase:{auth:{getUser:()=>new Promise(resolve=>auth.push(resolve))},from(table){const promise=Promise.resolve({data:table==='clients'?{id:'client',company_name:'Current Client'}:[]});const q=new Proxy({},{get:(_,key)=>key==='then'?promise.then.bind(promise):()=>q});return q;}},...Object.fromEntries(setters.map(name=>[name,value=>updates.push([name,value])]))};
 const js=ts.transpileModule(body+'\nreturn {loadReviews,mountedRef};',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const api=new Function(...Object.keys(env),js)(...Object.values(env));api.mountedRef.current=true;
 const first=api.loadReviews(),second=api.loadReviews();auth[1]({data:{user:{id:'user'}}});await second;
 assert(updates.some(([name])=>name==='setPendingReviews'));
 const count=updates.length;auth[0]({data:{user:null}});await first;assert.equal(updates.length,count);assert.deepEqual(redirects,[]);
 const closing=api.loadReviews();const afterStart=updates.length;api.mountedRef.current=false;auth[2]({data:{user:null}});await closing;
 assert.equal(updates.length,afterStart);assert.deepEqual(redirects,[]);
});

test('client review loads discard retired identities, expose errors and retry without fake empty success',async()=>{
 const source=fs.readFileSync('app/client/reviews/page.tsx','utf8');
 const body=source.slice(source.indexOf('  const mountedRef ='),source.indexOf('  useEffect(() => {',source.indexOf('  const mountedRef =')));
 const updates=[],reads=[];let fail=false;
 const setters=[...new Set([...body.matchAll(/\b(set[A-Z]\w*)\(/g)].map(m=>m[1]))];
 const env={authLoading:false,allowed:true,userId:'user',useRef:current=>({current}),useCallback:fn=>fn,router:{push(){}},
  loadClientReviews:()=>fail?Promise.reject(Error('offline')):new Promise(resolve=>reads.push(resolve)),
  supabase:{auth:{getUser:async()=>({data:{user:{id:'user'}}})},from(){const promise=Promise.resolve({data:{id:'client'}});const q=new Proxy({},{get:(_,key)=>key==='then'?promise.then.bind(promise):()=>q});return q;}},
  ...Object.fromEntries(setters.map(name=>[name,value=>updates.push([name,value])]))};
 const js=ts.transpileModule(body+'\nreturn {loadReviews,mountedRef,userRef,eligibleRef};',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const api=new Function(...Object.keys(env),js)(...Object.values(env));api.mountedRef.current=true;
 const pending=api.loadReviews();for(let n=0;n<15;n++)await Promise.resolve();
 assert.equal(reads.length,1);api.userRef.current='other-user';const count=updates.length;
 reads[0]({reviews:[{id:'stale'}],pendingReviews:[{id:'stale'}]});await pending;assert.equal(updates.length,count);
 api.userRef.current='user';fail=true;await api.loadReviews();assert(updates.some(([key,value])=>key==='setLoadError'&&/could not be loaded/.test(value)));
 fail=false;const retry=api.loadReviews();for(let n=0;n<15;n++)await Promise.resolve();reads[1]({reviews:[{id:'current'}],pendingReviews:[]});await retry;
 assert(updates.some(([key,value])=>key==='setReviews'&&value[0]?.id==='current'));
 api.eligibleRef.current=false;const before=updates.length;await api.loadReviews();assert.equal(updates.length,before);
});
