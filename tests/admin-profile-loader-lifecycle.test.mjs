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

for (const kind of ['Reviews','Payouts']) test('admin '+kind+' rejects older responses and responses after close',async()=>{
 const source=fs.readFileSync('app/admin/guard-profiles/GuardProfileDetailModal.tsx','utf8');const body=source.slice(source.indexOf('  const scopeRef ='),source.indexOf('  const handleApprove'));const queue=[];const r=harness('return function component({local,activeTab}){const [reviews,setReviews]=useState([]);const [payouts,setPayouts]=useState([]);const [reviewsLoading,setReviewsLoading]=useState(false);const [payoutsLoading,setPayoutsLoading]=useState(false);const [reviewsError,setReviewsError]=useState(null);const [payoutsError,setPayoutsError]=useState(null);'+body+'return {reviews,payouts,fetchReviews,fetchPayouts};}',{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}},fetch:()=>queue.shift()||Promise.resolve({ok:true,json:async()=>({data:[]})}),process:{env:{}}});
 const props={local:{id:'guard'},activeTab:'overview'};r.render(props);await r.runEffects();let api=r.render(props);const old=deferred();queue.push(old.promise);const first=api['fetch'+kind]();await flush();queue.push(Promise.resolve({ok:true,json:async()=>({data:[{id:'new'}]})}));await api['fetch'+kind]();old.resolve({ok:true,json:async()=>({data:[{id:'old'}]})});await first;api=r.render(props);assert.equal(api[kind.toLowerCase()][0].id,'new');const closing=deferred();queue.push(closing.promise);const last=api['fetch'+kind]();await flush();r.unmount();closing.resolve({ok:true,json:async()=>({data:[{id:'closed'}]})});await last;api=r.render(props);assert.equal(api[kind.toLowerCase()][0].id,'new');
});
