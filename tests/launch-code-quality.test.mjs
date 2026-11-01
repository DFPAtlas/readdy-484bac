import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const compile = path => ts.transpileModule(fs.readFileSync(path,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function pushHarness(payload) {
 const writes=[],registered=[],states=[];
 const registration={pushManager:{getSubscription:async()=>null,subscribe:async()=>({toJSON:()=>payload})}};
 const navigator={serviceWorker:{register:async url=>{registered.push(url);return registration},ready:Promise.resolve(registration)}};
 const supabase={functions:{invoke:async()=>({data:{publicKey:'AQID'},error:null})},auth:{getSession:async()=>({data:{session:{user:{id:'user'}}}})},from:()=>({upsert:async row=>{writes.push(row);return {error:null}}})};
 const hooks={useState:()=>[{supported:true},v=>states.push(v({supported:true}))],useEffect:()=>{},useCallback:fn=>fn,useRef:value=>({current:value})};
 const mod={exports:{}};
 new Function('module','exports','require','navigator','Notification','window','atob',compile('hooks/usePushNotifications.ts'))(mod,mod.exports,name=>name==='react'?hooks:{supabase},navigator,{requestPermission:async()=> 'granted'},{},v=>Buffer.from(v,'base64').toString('binary'));
 return {api:mod.exports.usePushNotifications('guard'),writes,registered,states};
}
test('push uses a hosted worker and only saves complete encryption material',async()=>{
 const good=pushHarness({endpoint:'https://push.example/1',keys:{p256dh:'public-key',auth:'auth-key'}});
 await good.api.subscribe();
 assert.deepEqual(good.registered,['/push-sw.js']);
 assert.equal(good.writes.length,1);assert.equal(good.writes[0].p256dh,'public-key');
 for(const payload of [{},{endpoint:'https://push.example/1'},{endpoint:'https://push.example/1',keys:{auth:'auth-key'}}]){
  const h=pushHarness(payload);await h.api.subscribe();assert.equal(h.writes.length,0);assert.match(h.states.at(-1).error,/missing/);
 }
});
test('notification clicks cannot open another origin or a script URL',async()=>{
 const events={},opened=[];const origin='https://quickguard.uk';
 vm.runInNewContext(fs.readFileSync('public/push-sw.js','utf8'),{URL,self:{location:{origin},addEventListener:(name,fn)=>events[name]=fn,clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}}});
 for(const url of ['/guard/dashboard','https://evil.example/x','javascript:alert(1)']){
  let pending;events.notificationclick({notification:{data:{url},close(){}},waitUntil:p=>pending=p});await pending;
 }
 assert.deepEqual(opened,[origin+'/guard/dashboard',origin+'/',origin+'/']);
});
test('configured consent fields do not duplicate the canonical guard consent control',()=>{
 let index=0;
 const initial=[{},'',false,null,false,false,[{id:'terms',field_key:'terms_accepted',field_type:'checkbox',is_enabled:true,is_required:true,field_label:'Terms duplicate'},{id:'email',field_key:'email',field_type:'email',is_enabled:true,field_label:'Email'}],false,null,'none',''];
 const mocks={react:{...React,useState:v=>[initial[index++]??v,()=>{}],useEffect:()=>{}},'next/navigation':{useRouter:()=>({})},'next/link':{default:({children,...props})=>React.createElement('a',props,children)}};
 const mod={exports:{}};
 new Function('module','exports','require',compile('app/guard/register/page.tsx'))(mod,mod.exports,name=>name in mocks?mocks[name]:name.startsWith('@/')||name.startsWith('./')?{default:()=>null}:require(name));
 const html=renderToStaticMarkup(React.createElement(mod.exports.default));
 assert.equal((html.match(/id="terms"/g)||[]).length,1);
 assert.doesNotMatch(html,/id="terms_accepted"/);
 assert.doesNotMatch(html,/SIA Approved|HMRC Compliant|500\+|4\.9\/5/);
});

function guardAdminHarness({updateError=null,updated=true,status='pending'}={}) {
 let handler; const writes=[];
 const guard={id:'guard-id',user_id:null,email:'guard@example.invalid',verification_status:status};
 const db={from:()=>{
  let mutation=false;
  const query={select:()=>query,eq:()=>query,update:changes=>{mutation=true;writes.push(changes);return query},maybeSingle:async()=>mutation?{data:updated?{id:guard.id}:null,error:updateError}:{data:guard,error:null}};
  return query;
 }};
 const mod={exports:{}};
 new Function('module','exports','require','Deno',compile('supabase/functions/admin-verify-guard/index.ts'))(mod,mod.exports,()=>({createClient:()=>db}),{env:{get:key=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-secret'})[key]},serve:fn=>handler=fn});
 return {writes,call:(action,token='service-secret')=>handler(new Request('https://worker.test',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({guardId:'guard-id',action})}))};
}
test('guard administration never reports success after rejected or unconfirmed database writes',async()=>{
 for(const action of ['manual_sia_verify','approve','reject','suspend','restore']) {
  for(const opts of [{updateError:{message:'write failed'}},{updated:false}]) {
   const h=guardAdminHarness({...opts,status:action==='restore'?'suspended':'pending'});const response=await h.call(action);
   assert.equal(response.status,500,action);assert.equal((await response.json()).error,'Internal server error');
  }
 }
 const success=guardAdminHarness();assert.equal((await success.call('manual_sia_verify')).status,200);
});
