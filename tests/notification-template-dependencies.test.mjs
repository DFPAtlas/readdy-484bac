import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
function harness(code,env){
 const slots=[],effects=[],pending=[];let cursor=0;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
 const hooks={useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next]},useRef:v=>{const i=cursor++;if(!(i in slots))slots[i]={current:v};return slots[i]},useCallback:(fn,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn},useEffect:(fn,deps)=>{const i=cursor++;if(!effects[i]||!same(effects[i].deps,deps))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()}})}};
 const args={...hooks,...env};const component=new Function(...Object.keys(args),compile(code))(...Object.values(args));
 return {render(props){cursor=0;return component(props)},async runEffects(){pending.splice(0).forEach(fn=>fn());await flush()},unmount(){effects.forEach(e=>e?.cleanup?.())}};
}

for(const [path,marker,key] of [
 ['app/client/dashboard/NotificationsPanel.tsx','export default function NotificationsPanel({ userId }: { userId: string }) {','userId'],
 ['app/guard/dashboard/NotificationBell.tsx','export default function NotificationBell({ guardUserId }: NotificationBellProps) {','guardUserId'],
]){
 test(key+' notification effect rejects old identities and older realtime loads',async()=>{
  const source=fs.readFileSync(path,'utf8'),start=source.indexOf(marker)+marker.length;const first=source.indexOf('  useEffect(() => {',start),end=source.indexOf('  useEffect(() => {',first+10);const body=source.slice(start,end);
  const pending=[],channels=[],removed=[];let reads=0;const db={from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>{reads++;return pending.shift()||Promise.resolve({data:[{id:'fresh',is_read:false}]})}};return q},channel:name=>{const c={name,on:(kind,options,fn)=>{c.notify=fn;return c},subscribe:()=>{channels.push(c);return c}};return c},removeChannel:c=>removed.push(c)};
  const r=harness('return function component({'+key+'}){'+body+'return {notifications,loading};}',{supabase:db,useRouter:()=>({})});const old=deferred();pending.push(old.promise);r.render({[key]:'A'});await r.runEffects();r.render({[key]:'B'});await r.runEffects();old.resolve({data:[{id:'old-A'}]});await flush();let api=r.render({[key]:'B'});assert.equal(api.notifications[0].id,'fresh');const older=deferred();pending.push(older.promise);channels[1].notify();channels[1].notify();await flush();older.resolve({data:[{id:'old-B'}]});await flush();api=r.render({[key]:'B'});assert.equal(api.notifications[0].id,'fresh');const count=reads;r.render({[key]:'B'});await r.runEffects();assert.equal(reads,count);r.unmount();channels[1].notify();await flush();assert.equal(reads,count);assert.equal(removed.length,2);
 });
}
test('template image insertion runs once while callbacks and form objects change',async()=>{
 const source=fs.readFileSync('app/admin/email-templates/TemplateEditor.tsx','utf8');const body=source.slice(source.indexOf('  const editorRef ='),source.indexOf('  const insertVariable ='));
 const changes=[],handled=[];const r=harness('return function component({formData,onChange,imageToInsert,onImageInsertHandled}){'+body+'return {editorRef};}',{requestAnimationFrame:fn=>fn()});
 let props={formData:{body_html:'original'},imageToInsert:'<img>',onChange:v=>changes.push(v),onImageInsertHandled:()=>handled.push(true)};let api=r.render(props);api.editorRef.current={selectionStart:8,selectionEnd:8,focus(){},setSelectionRange(){}};await r.runEffects();assert.equal(changes.length,1);assert.equal(handled.length,1);
 props={...props,formData:changes[0],onChange:v=>changes.push(v),onImageInsertHandled:()=>handled.push(true)};r.render(props);await r.runEffects();assert.equal(changes.length,1);r.render({...props,imageToInsert:null});await r.runEffects();r.render(props);await r.runEffects();assert.equal(changes.length,2);assert.equal(handled.length,2);
});
