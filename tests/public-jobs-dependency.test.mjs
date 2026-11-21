import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('app/jobs/JobsClient.tsx','utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
test('public jobs reject superseded fetches and clear old applicant counts on empty results',async()=>{
 const start=source.indexOf('  const fetchJobs =');const body=source.slice(start,source.indexOf('  useEffect(() => {',start));
 const reads=[],updates=[];const env={mountedRef:{current:true},requestRef:{current:0},showExpired:false,londonCalendarDate:()=> '2026-11-21',useCallback:fn=>fn,setLoading:v=>updates.push(['loading',v]),setLoadError:v=>updates.push(['error',v]),setJobs:v=>updates.push(['jobs',v]),setApplicantCounts:v=>updates.push(['counts',v]),supabase:{rpc(){const q=new Proxy({},{get:(_,key)=>key==='then'?(resolve,reject)=>new Promise(r=>reads.push(r)).then(resolve,reject):()=>q});return q;}}};
 const fetchJobs=new Function(...Object.keys(env),compile(body+'\nreturn fetchJobs;'))(...Object.values(env));
 const first=fetchJobs(),second=fetchJobs();await Promise.resolve();reads[1]({data:[]});await second;
 assert(updates.some(([name,value])=>name==='counts'&&Object.keys(value).length===0));
 const count=updates.length;reads[0]({data:[{id:'old'}]});await first;assert.equal(updates.length,count);
 const closing=fetchJobs();await Promise.resolve();const afterStart=updates.length;env.mountedRef.current=false;reads[2]({data:[]});await closing;assert.equal(updates.length,afterStart);
});

test('public job cutoff excludes past dates before the result limit and the toggle restores them', async () => {
 const dateModule={exports:{}};
 new Function('module','exports',compile(fs.readFileSync('lib/date-only.ts','utf8')))(dateModule,dateModule.exports);
 const fixtures=[
  ...Array.from({length:60},(_,i)=>({id:`past-${i}`,start_date:'2026-11-20',created_at:'2026-11-20',status:'open',is_deleted:false})),
  {id:'today',start_date:'2026-11-21',created_at:'2026-11-19',status:'open',is_deleted:false},
  {id:'future',start_date:'2026-11-22',created_at:'2026-11-19',status:'open',is_deleted:false},
 ];
 const start=source.indexOf('  const fetchJobs =');
 const body=source.slice(start,source.indexOf('  useEffect(() => {',start));
 async function run(showExpired){
  let jobs;const filters=[];let limit=Infinity;
  const q={select:()=>q,eq(key,value){filters.push(row=>row[key]===value);return q},gte(key,value){filters.push(row=>row[key]>=value);return q},order:()=>q,limit(value){limit=value;return q},then(resolve,reject){return Promise.resolve({data:fixtures.filter(row=>filters.every(filter=>filter(row))).slice(0,limit)}).then(resolve,reject)}};
  const env={mountedRef:{current:true},requestRef:{current:0},showExpired,londonCalendarDate:()=>dateModule.exports.londonCalendarDate(new Date('2026-11-21T16:00:00Z')),useCallback:fn=>fn,setLoading(){},setLoadError(){},setJobs:value=>{jobs=value},setApplicantCounts(){},supabase:{rpc(name){assert.equal(name,'get_public_jobs');return q},from(table){assert.equal(table,'job_applications');return {select(){return this},in:async()=>({data:[]})}}}};
  await new Function(...Object.keys(env),compile(body+'\nreturn fetchJobs;'))(...Object.values(env))();
  return jobs;
 }
 assert.deepEqual((await run(false)).map(job=>job.id),['today','future']);
 const includingPast=await run(true);assert.equal(includingPast.length,50);assert.ok(includingPast.every(job=>job.start_date==='2026-11-20'));
 assert.deepEqual((await run(false)).map(job=>job.id),['today','future']);
});
test('public job filters derive new results without mutating the source list',()=>{
 const body=source.slice(source.indexOf('  const filteredJobs ='),source.indexOf('  const clearFilters'));
 const jobs=[{id:'low',hourly_rate:10,created_at:'2026-01-01',is_featured:false},{id:'high',hourly_rate:30,created_at:'2026-01-02',is_featured:false}];
 const env={jobs,useMemo:fn=>fn(),searchQuery:'',siaRequired:false,uniformRequired:false,selectedUrgency:'all',selectedCity:'all',selectedSiaType:'all',dateFrom:'',dateTo:'',sortBy:'highest-pay',minRate:'20',foundingClientsOnly:false};
 const run=()=>new Function(...Object.keys(env),compile(body+'\nreturn filteredJobs;'))(...Object.values(env));
 assert.deepEqual(run().map(j=>j.id),['high']);env.minRate='0';assert.deepEqual(run().map(j=>j.id),['high','low']);assert.deepEqual(jobs.map(j=>j.id),['low','high']);
});
