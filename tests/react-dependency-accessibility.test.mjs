import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function runner(path,mocks,extra={}){
 const slots=[];let cursor=0;let pending=[];
 const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useCallback(fn,deps){const i=cursor++;if(!slots[i]||!equal(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn},useEffect(fn,deps){const i=cursor++;if(!slots[i]||!equal(slots[i].deps,deps)){pending.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()}})}},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i]}};
 const mod={exports:{}};
 new Function('module','exports','require',...Object.keys(extra),compile(path))(mod,mod.exports,name=>name==='react'?hooks:name in mocks?mocks[name]:require(name),...Object.values(extra));
 return {render(name,...args){cursor=0;return mod.exports[name](...args)},async effects(){const work=pending;pending=[];work.forEach(fn=>fn());for(let i=0;i<10;i++)await Promise.resolve()}};
}
test('admin pagination stays on the requested page and filter changes reset once without request loops',async()=>{
 const calls=[];const db={auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}};
 const r=runner('app/admin/jobs/useAdminJobs.ts',{'@/lib/supabase':{supabase:db}},{fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({data:[],totalCount:100})}}});
 let hook=r.render('useAdminJobs');await r.effects();assert.deepEqual(calls.map(c=>c.page),[1]);
 hook.goToPage(3);await r.effects();hook=r.render('useAdminJobs');await r.effects();assert.equal(hook.page,3);assert.deepEqual(calls.map(c=>c.page),[1,3]);
 hook.refresh();await r.effects();hook=r.render('useAdminJobs');await r.effects();assert.deepEqual(calls.map(c=>c.page),[1,3,3]);
 hook.setFilter('search','venue');hook=r.render('useAdminJobs');await r.effects();hook=r.render('useAdminJobs');await r.effects();assert.equal(hook.page,1);assert.equal(calls.at(-1).search,'venue');assert.deepEqual(calls.map(c=>c.page),[1,3,3,1]);
 r.render('useAdminJobs');await r.effects();assert.equal(calls.length,4);
});
test('client monthly spending recomputes the month on refetch without remounting',async()=>{
 let now='2026-10-31T12:00:00Z';
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}}
 const tx=[{id:'oct',amount:10,status:'paid',created_at:'2026-10-20T12:00:00Z'},{id:'nov',amount:20,status:'paid',created_at:'2026-11-01T12:00:00Z'}];
 const db={auth:{getUser:async()=>({data:{user:{id:'user'}}})},from:table=>{const data=table==='clients'?{id:'client'}:table==='transactions'?tx:[];const q={select:()=>q,eq:()=>q,order:()=>q,maybeSingle:async()=>({data}),then:resolve=>Promise.resolve({data}).then(resolve)};return q}};
 const totals=rows=>({collected:rows.reduce((n,r)=>n+r.amount,0),refunded:0,remaining:rows.reduce((n,r)=>n+r.amount,0)});
 const r=runner('hooks/useClientPaymentCentre.ts',{'@/lib/supabase':{supabase:db},'@/lib/financeAmounts':{paymentTotals:totals,paymentAmounts:()=>({refunded:0}),isCollected:()=>true},'@/lib/client-journey':{planLabel:()=> 'Free'}},{Date:Clock});
 let hook=r.render('useClientPaymentCentre');await r.effects();hook=r.render('useClientPaymentCentre');assert.equal(hook.spendingSummary.thisMonthSpend,30);
 now='2026-11-02T12:00:00Z';await hook.refetch();hook=r.render('useClientPaymentCentre');assert.equal(hook.spendingSummary.thisMonthSpend,20);
});
test('radio validation has named groups and real error-description targets while preserving native controls',()=>{
 const mod={exports:{}};new Function('module','exports','require',compile('app/client/post-job/StepGuardRequirements.tsx'))(mod,mod.exports,require);
 const errors={siaLicenceRequired:'Choose SIA requirement',uniformRequired:'Choose uniform requirement',drivingRequired:'Choose driving requirement'};
 const formData={siaLicenceRequired:'',specificLicences:[],experienceLevel:'',uniformRequired:'',uniformDetails:'',drivingRequired:'',dressCode:'',specialInstructions:'',additionalRequirements:''};
 const props={formData,errors,onChange(){},onCheckboxChange(){},onNext(){},onBack(){}};
 const html=renderToStaticMarkup(React.createElement(mod.exports.default,props));
 assert.equal((html.match(/role="radiogroup"/g)||[]).length,3);assert.equal((html.match(/type="radio"/g)||[]).length,6);
 for(const [key,message] of Object.entries(errors)){assert.match(html,new RegExp(`id="error-${key}"`));assert.ok(html.includes(message));assert.match(html,new RegExp(`aria-describedby="error-${key}"`))}
 assert.doesNotMatch(html,/<input[^>]*type="radio"[^>]*aria-invalid/);
 const valid=renderToStaticMarkup(React.createElement(mod.exports.default,{...props,errors:{}}));assert.doesNotMatch(valid,/role="alert"/);
});


test('notification polling keeps one interval and uses current admin permissions',async()=>{
 let reads=0;let intervalId=0;const active=new Map();const cleared=[];
 const db={from:()=>{reads++;const q={select:()=>q,order:()=>q,limit:async()=>({data:[]})};return q}};
 const r=runner('app/admin/digital-footprint/NotificationBell.tsx',{'@/lib/supabase':{supabase:db}},{setInterval:fn=>{active.set(++intervalId,fn);return intervalId},clearInterval:id=>{cleared.push(id);active.delete(id)}});
 r.render('default',{isSuperAdmin:true});await r.effects();assert.equal(reads,1);assert.equal(active.size,1);
 r.render('default',{isSuperAdmin:true});await r.effects();assert.equal(reads,1);assert.equal(active.size,1);
 await [...active.values()][0]();assert.equal(reads,2);
 r.render('default',{isSuperAdmin:false});await r.effects();assert.equal(active.size,1);assert.deepEqual(cleared,[1]);
 await [...active.values()][0]();assert.equal(reads,2);
});

test('support drawer refreshes its selected ticket once and does not create an update loop',()=>{
 for(const path of ['app/client/support/SupportPage.tsx','app/guard/support/SupportPage.tsx']){
  const source=fs.readFileSync(path,'utf8');const start=source.indexOf('    if (!selectedTicket) return;');const end=source.indexOf('  }, [tickets, selectedTicket]);',start);
  assert.ok(start>=0&&end>start);const fn=new Function('tickets','selectedTicket','setSelectedTicket',ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText);
  const initial={id:'ticket',status:'open',updated_at:'before',priority:'normal'};const fresh={...initial,status:'resolved',updated_at:'after'};let selected=initial;let changes=0;
  const setter=value=>{selected=value;changes++};fn([fresh],selected,setter);assert.equal(selected,fresh);assert.equal(changes,1);fn([fresh],selected,setter);assert.equal(changes,1);
 }
});
