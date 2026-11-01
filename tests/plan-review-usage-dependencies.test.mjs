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

test('plan list updates do not reload the plan card or recreate its realtime subscription',async()=>{
 const source=fs.readFileSync('components/PlanManagementCard.tsx','utf8');const marker="export default function PlanManagementCard({ userId, audience }: { userId: string; audience: 'client' | 'guard' }) {";const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf('  const handleCancel'));
 let plan='basic';const reads=[],channels=[],removed=[],pending=[];
 const db={from:table=>{const q={select:()=>q,eq:()=>q,order:()=>q,maybeSingle:()=>q,then:(resolve,reject)=>{reads.push(table);return (pending.shift()||Promise.resolve({data:table==='user_entitlements_data'?{plan_slug:plan,plan_name:plan+' name'}:table==='plans'?[{slug:plan,name:plan+' name'}]:{stripe_subscription_id:'sub'}})).then(resolve,reject)}};return q},channel:name=>{const c={name,on:(kind,options,fn)=>{c.notify=fn;return c},subscribe:()=>{channels.push(c);return c}};return c},removeChannel:c=>removed.push(c)};
 const r=harness('return function component({userId,audience}){'+body+'return {subscription,allPlans,loading,toastData,load};}',{supabase:db});const props={userId:'one',audience:'guard'};r.render(props);await r.runEffects();let api=r.render(props);await r.runEffects();assert.equal(api.subscription.plan_slug,'basic');assert.equal(reads.length,3);assert.equal(channels.length,1);
 r.render({...props});await r.runEffects();assert.equal(reads.length,3);assert.equal(channels.length,1);
 plan='pro';channels[0].notify();await flush();api=r.render(props);await r.runEffects();assert.equal(api.toastData.oldPlanName,'basic name');assert.equal(api.toastData.newPlanName,'pro name');assert.equal(channels.length,1);
 const late=deferred();pending.push(late.promise);const old=api.load();await flush();r.render({...props,userId:'two'});await r.runEffects();late.resolve({data:{plan_slug:'old',plan_name:'old'}});await old;api=r.render({...props,userId:'two'});assert.equal(api.subscription.plan_slug,'pro');assert.equal(api.toastData.show,false);assert.equal(removed.length,1);r.unmount();assert.equal(removed.length,2);
});
for (const [path,marker,end,propsA,propsB,api,envKey] of [
 ['components/GuardUsageWidget.tsx','export default function GuardUsageWidget({ guardId, refreshTrigger }: Props) {','  if (loading)',{guardId:'A',refreshTrigger:0},{guardId:'B',refreshTrigger:0},'limitData','usage'],
 ['app/guard/dashboard/ReviewsTab.tsx','export default function ReviewsTab({ guardId, rating, totalReviews }: ReviewsTabProps) {','  const formatDate',{guardId:'A'},{guardId:'B'},'reviews','reviews'],
]) {
 test(envKey+' discards old identity responses and closes cleanly',async()=>{
  const source=fs.readFileSync(path,'utf8');const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf(end));const pending=[];
  const db={from:()=>{const q={select:()=>q,eq:()=>q,order:()=>pending.shift()||Promise.resolve({data:[{id:'B',jobs:null}],error:null})};return q}};
  const r=harness('return function component({guardId,refreshTrigger}){'+body+'return {'+api+',loading};}',{supabase:db,oneRelation:x=>x,checkGuardApplicationLimit:()=>pending.shift()||Promise.resolve({planSlug:'B'})});
  const late=deferred();pending.push(late.promise);r.render(propsA);await r.runEffects();r.render(propsB);await r.runEffects();late.resolve(envKey==='usage'?{planSlug:'A'}:{data:[{id:'A'}]});await flush();let state=r.render(propsB);assert.equal(envKey==='usage'?state.limitData.planSlug:state.reviews[0].id,'B');assert.equal(state.loading,false);
  const closing=deferred();pending.push(closing.promise);r.render(propsA);await r.runEffects();r.unmount();closing.resolve(envKey==='usage'?{planSlug:'closed'}:{data:[{id:'closed'}]});await flush();state=r.render(propsA);assert.equal(envKey==='usage'?state.limitData:state.reviews.length,envKey==='usage'?null:0);
 });
}
