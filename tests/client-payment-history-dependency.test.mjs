import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

test('payment history rejects superseded subscription reads and job reads after cleanup',async()=>{
 const source=fs.readFileSync('app/client/payment-history/page.tsx','utf8');
 const body=source.slice(source.indexOf('  const mountedRef ='),source.indexOf('  const fetchUserAndPayments'));
 const reads=[],updates=[];
 const env={useRef:current=>({current}),useCallback:fn=>fn,setSubscriptionPayments:data=>updates.push(['subscription',data]),setJobPayments:data=>updates.push(['jobs',data]),supabase:{from(table){const q=new Proxy({},{get:(_,key)=>key==='then'?(resolve,reject)=>new Promise(r=>reads.push({table,resolve:r})).then(resolve,reject):()=>q});return q;}}};
 const js=ts.transpileModule(body+'\nreturn {fetchSubscriptionPayments,fetchJobPayments,mountedRef};',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const api=new Function(...Object.keys(env),js)(...Object.values(env));api.mountedRef.current=true;
 const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve()};
 const first=api.fetchSubscriptionPayments('user'),second=api.fetchSubscriptionPayments('user');await flush();
 reads[1].resolve({data:[{id:'new'}]});await second;reads[0].resolve({data:[{id:'old'}]});await first;
 assert.deepEqual(updates,[['subscription',[{id:'new'}]]]);
 const jobs=api.fetchJobPayments('user');await flush();assert.equal(reads[2].table,'clients');
 api.mountedRef.current=false;reads[2].resolve({data:{id:'client'}});await jobs;assert.equal(reads.length,3);assert.equal(updates.length,1);
});
