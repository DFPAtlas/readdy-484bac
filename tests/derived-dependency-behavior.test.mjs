import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
function harness(code,env){
 const slots=[],effects=[],pending=[];let cursor=0;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
 const hooks={useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next]},useRef:v=>{const i=cursor++;if(!(i in slots))slots[i]={current:v};return slots[i]},useCallback:(fn,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn},useMemo:(fn,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={value:fn(),deps};return slots[i].value},useEffect:(fn,deps)=>{const i=cursor++;if(!effects[i]||!same(effects[i].deps,deps))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()}})}};
 const args={...hooks,...env};const component=new Function(...Object.keys(args),compile(code))(...Object.values(args));
 return {render(props){cursor=0;return component(props)},async runEffects(){pending.splice(0).forEach(fn=>fn());await flush()},unmount(){effects.forEach(e=>e?.cleanup?.())}};
}

test('chat history pagination does not scroll to bottom but new messages still do',async()=>{
 const source=fs.readFileSync('app/client/messages/MessagesClient.tsx','utf8');const body=source.slice(source.indexOf('  // Older-page inserts'),source.indexOf('  const activeConversation ='));
 let scrolls=0;const skipScrollRef={current:false};const r=harness('return function component({activeMessages,msgLoadingOlder}){'+body+'return {};}',{skipScrollRef,messagesEndRef:{current:{scrollIntoView:()=>scrolls++}}});
 const latest={id:'latest'};r.render({activeMessages:[latest],msgLoadingOlder:false});await r.runEffects();assert.equal(scrolls,1);
 r.render({activeMessages:[latest],msgLoadingOlder:true});await r.runEffects();skipScrollRef.current=true;r.render({activeMessages:[{id:'older'},latest],msgLoadingOlder:false});await r.runEffects();assert.equal(scrolls,1);
 r.render({activeMessages:[{id:'older'},latest,{id:'new'}],msgLoadingOlder:false});await r.runEffects();assert.equal(scrolls,2);
});
test('matching preferences recompute scores from current loaded guards',async()=>{
 const source=fs.readFileSync('app/client/advanced-matching/page.tsx','utf8');const marker='export default function AdvancedMatchingPage() {';const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf('  const loadData ='));
 const scoring=source.slice(source.indexOf('function computeMatchScore'),source.indexOf('function getMatchLabel'));
 const r=harness(scoring+'return function component(){'+body+'return {guards,setRawGuards,setSpecialityFilter,setExperienceFilter};}',{useRouter:()=>({}),useClientGuard:()=>({}),useRouteGuard:()=>({})});let api=r.render();api.setRawGuards([{id:'one',match_score:0,sia_verified:false,licence_types:['events'],rating:0,years_experience:0,hourly_rate:15}]);api=r.render();const initial=api.guards[0].match_score;api.setSpecialityFilter('events');api=r.render();assert.equal(api.guards[0].match_score,initial+10);assert.equal(api.guards[0].id,'one');const scored=api.guards;api=r.render();assert.equal(api.guards,scored);
});
