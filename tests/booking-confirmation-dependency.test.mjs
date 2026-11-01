import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

test('booking confirmation rejects superseded fee quotes and closed-screen redirects', async () => {
 const source=fs.readFileSync('app/client/jobs/[id]/confirmation/BookingConfirmationClient.tsx','utf8');
 const body=source.slice(source.indexOf('  const requestRef ='),source.indexOf('  useEffect(() => {',source.indexOf('  const requestRef =')));
 const auth=[],fees=[],updates=[],redirects=[];
 const setters=[...new Set([...body.matchAll(/\b(set[A-Z]\w*)\(/g)].map(m=>m[1]))];
 const env={jobId:'booking',router:{push:p=>redirects.push(p)},useRef:current=>({current}),useCallback:fn=>fn,getInitials:()=> 'CL',calculateHours:()=>({hours:1,days:1,totalHours:1}),
 supabase:{auth:{getUser:()=>new Promise(resolve=>auth.push(resolve))},functions:{invoke:()=>new Promise(resolve=>fees.push(resolve))},from(table){const result={data:table==='clients'?{id:'client'}:table==='jobs'?{id:'booking',terms_accepted:true}:table==='transactions'?null:[]};const promise=Promise.resolve(result);const q=new Proxy({},{get:(_,key)=>key==='then'?promise.then.bind(promise):()=>q});return q;}},
 ...Object.fromEntries(setters.map(name=>[name,value=>updates.push([name,value])]))};
 const js=ts.transpileModule(body+'\nreturn {loadData,mountedRef};',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const api=new Function(...Object.keys(env),js)(...Object.values(env));
 const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve()};
 api.mountedRef.current=true;
 const first=api.loadData();auth[0]({data:{user:{id:'user'}}});await flush();assert.equal(fees.length,1);
 const second=api.loadData();auth[1]({data:{user:{id:'user'}}});await flush();assert.equal(fees.length,2);
 fees[1]({data:{guardFees:20,platformFee:2,clientTotalCharge:22}});await second;
 assert(updates.some(([name,value])=>name==='setTotal'&&value===22));
 const count=updates.length;fees[0]({data:{guardFees:999,platformFee:9,clientTotalCharge:1008}});await first;assert.equal(updates.length,count);
 const closing=api.loadData();const afterStart=updates.length;api.mountedRef.current=false;auth[2]({data:{user:null}});await closing;
 assert.equal(updates.length,afterStart);assert.deepEqual(redirects,[]);
});
