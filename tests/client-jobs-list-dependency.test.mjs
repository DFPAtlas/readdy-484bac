import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

test('jobs list ignores superseded refresh and pagination responses and clears empty payment maps', async () => {
 const source=fs.readFileSync('app/client/jobs/page.tsx','utf8');
 const body=source.slice(source.indexOf('  const loadJobs ='),source.indexOf('  const loadJobsRef'));
 const reads=[],moreReads=[],updates=[];
 const setters=[...new Set([...body.matchAll(/\b(set[A-Z]\w*)\(/g)].map(m=>m[1]))];
 const env={clientId:'client',cancelledRef:{current:false},requestRef:{current:0},moreRequestRef:{current:0},useCallback:fn=>fn,buildJobQuery:()=>new Promise(resolve=>reads.push(resolve)),activeTab:'all',showToast:(...args)=>updates.push(['toast',args]),JOBS_PER_PAGE:50,STATUS_FILTERS:{},loadingMore:false,searchQuery:'',statusFilter:'all',dateFrom:'',dateTo:'',jobs:[],paymentMap:{old:'paid'},
 supabase:{from(table){let selected='';const q=new Proxy({},{get:(_,key)=>key==='then'?(resolve,reject)=>{if(table==='jobs'&&!selected.startsWith('id, status'))return new Promise(r=>moreReads.push(r)).then(resolve,reject);return Promise.resolve({data:[]}).then(resolve,reject)}:(...args)=>{if(key==='select')selected=args[0];return q}});return q;},schema(){return this;}},
 ...Object.fromEntries(setters.map(name=>[name,value=>updates.push([name,value])]))};
 const js=ts.transpileModule(body+'\nreturn {loadJobs,loadMore};',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const api=new Function(...Object.keys(env),js)(...Object.values(env));
 const first=api.loadJobs(),second=api.loadJobs();reads[1]({data:[],count:0});await second;
 assert(updates.some(([name,value])=>name==='setPaymentMap'&&Object.keys(value).length===0));
 const count=updates.length;reads[0]({data:[{id:'stale'}],count:1});await first;assert.equal(updates.length,count);
 const more=api.loadMore();await Promise.resolve();assert.equal(moreReads.length,1);
 const fresh=api.loadJobs();reads[2]({data:[],count:0});await fresh;const afterFresh=updates.length;
 moreReads[0]({data:[{id:'stale-page'}],count:1});await more;assert.equal(updates.length,afterFresh);
 const closing=api.loadJobs();const afterStart=updates.length;env.cancelledRef.current=true;reads[3]({data:[],count:0});await closing;assert.equal(updates.length,afterStart);
});
