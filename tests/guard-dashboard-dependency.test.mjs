import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('app/guard/dashboard/GuardDashboardClient.tsx','utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;

test('dashboard entitlement reads reject superseded results and a previous session lifetime',async()=>{
 const scopeCode=source.slice(source.indexOf('  const readScopeRef ='),source.indexOf('  const traceLog'));
 const loader=source.slice(source.indexOf('  const loadUserEntitlement ='),source.indexOf('  const loadJobAssignments ='));
 const reads=[],updates=[];const env={useRef:current=>({current}),useCallback:fn=>fn,ensureEntitlement:()=>new Promise(resolve=>reads.push(resolve)),hasFeature:async()=>true,traceLog:()=>{},setUserEntitlement:v=>updates.push(['entitlement',v]),setFeatureFlags:v=>updates.push(['flags',v]),setEntitlementsLoaded:v=>updates.push(['loaded',v])};
 const api=new Function(...Object.keys(env),compile(scopeCode+loader+'\nreturn {readScopeRef,loadUserEntitlement};'))(...Object.values(env));
 Object.assign(api.readScopeRef.current,{active:true,userId:'guard'});
 const old=api.loadUserEntitlement('guard'),current=api.loadUserEntitlement('guard');reads[1]({plan_slug:'current'});await current;
 const count=updates.length;reads[0]({plan_slug:'old'});await old;assert.equal(updates.length,count);
 const closing=api.loadUserEntitlement('guard');api.readScopeRef.current.active=false;api.readScopeRef.current.epoch++;reads[2]({plan_slug:'late'});await closing;assert.equal(updates.length,count);
 await api.loadUserEntitlement('other-user');assert.equal(reads.length,3);
});

test('dashboard coalesces initial and signed-in events and removes its auth subscription',async()=>{
 const start=source.indexOf('  useEffect(() => {\n    let mounted = true;');
 const body=source.slice(start,source.indexOf('  useEffect(() => {',start+10));
 let authCallback,cleanup,unsubscribed=0;const timers=[],loads=[];
 const env={readScopeRef:{current:{active:false,epoch:0,userId:null,requests:{}}},useEffect:fn=>{cleanup=fn()},traceLog:()=>{},router:{push:()=>{}},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:()=>{},loadDashboardData:async(...args)=>loads.push(args),setIsAdmin:()=>{},setGuardUserId:()=>{},setDataErrors:()=>{},setDataLoadFailed:()=>{},setLoading:()=>{},supabase:{auth:{onAuthStateChange:fn=>{authCallback=fn;return {data:{subscription:{unsubscribe:()=>unsubscribed++}}}}},from(){const p=Promise.resolve({data:null});const q=new Proxy({},{get:(_,key)=>key==='then'?p.then.bind(p):()=>q});return q;}}};
 new Function(...Object.keys(env),compile(body))(...Object.values(env));
 authCallback('INITIAL_SESSION',{user:{id:'guard'}});authCallback('SIGNED_IN',{user:{id:'guard'}});assert.equal(timers.length,1);
 await timers[0]();assert.deepEqual(loads,[['guard',false]]);cleanup();assert.equal(unsubscribed,1);assert.equal(env.readScopeRef.current.active,false);
});
