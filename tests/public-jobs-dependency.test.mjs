import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('app/jobs/JobsClient.tsx','utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
test('public jobs reject superseded fetches and clear old applicant counts on empty results',async()=>{
 const start=source.indexOf('  const fetchJobs =');const body=source.slice(start,source.indexOf('  useEffect(() => {',start));
 const reads=[],updates=[];const env={mountedRef:{current:true},requestRef:{current:0},showExpired:false,useCallback:fn=>fn,setLoading:v=>updates.push(['loading',v]),setLoadError:v=>updates.push(['error',v]),setJobs:v=>updates.push(['jobs',v]),setApplicantCounts:v=>updates.push(['counts',v]),supabase:{rpc(){const q=new Proxy({},{get:(_,key)=>key==='then'?(resolve,reject)=>new Promise(r=>reads.push(r)).then(resolve,reject):()=>q});return q;}}};
 const fetchJobs=new Function(...Object.keys(env),compile(body+'\nreturn fetchJobs;'))(...Object.values(env));
 const first=fetchJobs(),second=fetchJobs();await Promise.resolve();reads[1]({data:[]});await second;
 assert(updates.some(([name,value])=>name==='counts'&&Object.keys(value).length===0));
 const count=updates.length;reads[0]({data:[{id:'old'}]});await first;assert.equal(updates.length,count);
 const closing=fetchJobs();await Promise.resolve();const afterStart=updates.length;env.mountedRef.current=false;reads[2]({data:[]});await closing;assert.equal(updates.length,afterStart);
});
test('public job filters derive new results without mutating the source list',()=>{
 const body=source.slice(source.indexOf('  const filteredJobs ='),source.indexOf('  const clearFilters'));
 const jobs=[{id:'low',hourly_rate:10,created_at:'2026-01-01',is_featured:false},{id:'high',hourly_rate:30,created_at:'2026-01-02',is_featured:false}];
 const env={jobs,useMemo:fn=>fn(),searchQuery:'',siaRequired:false,uniformRequired:false,selectedUrgency:'all',selectedCity:'all',selectedSiaType:'all',dateFrom:'',dateTo:'',sortBy:'highest-pay',minRate:'20',foundingClientsOnly:false};
 const run=()=>new Function(...Object.keys(env),compile(body+'\nreturn filteredJobs;'))(...Object.values(env));
 assert.deepEqual(run().map(j=>j.id),['high']);env.minRate='0';assert.deepEqual(run().map(j=>j.id),['high','low']);assert.deepEqual(jobs.map(j=>j.id),['low','high']);
});
