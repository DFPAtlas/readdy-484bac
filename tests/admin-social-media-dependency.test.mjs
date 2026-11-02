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

test('social lists load once, discard superseded filters and refreshes, and ignore closed-screen results', async () => {
 const source=fs.readFileSync('app/admin/social-media-content/page.tsx','utf8');
 const marker='export default function SocialMediaContent() {';
 const body=source.slice(source.indexOf(marker)+marker.length,source.indexOf('  useEffect(() => {\n    if (postsSearchTimer'));
 const requests=[];
 const supabase={from(table){const d=deferred();requests.push({table,...d});const q={select(){return this},or(){return this},contains(){return this},eq(){return this},order(){return this},range(){return this},then(a,b){return d.promise.then(a,b)}};return q}};
 const r=harness('return function component(){'+body+'return {posts,ideas,postsTotal,ideasTotal,loading,fetchPosts,fetchIdeas,setPostsStatusFilter,setIdeasPriorityFilter,toast};}',{supabase,POSTS_PER_PAGE:10,IDEAS_PER_PAGE:12,setTimeout(){}});
 let api=r.render();await r.runEffects();assert.equal(requests.length,2,'one initial request per list');
 r.render();await r.runEffects();assert.equal(requests.length,2,'render must not reload');
 const oldFetch=api.fetchPosts;
 api.setPostsStatusFilter('draft');r.render();await r.runEffects();assert.equal(requests.length,3);
 requests[2].resolve({data:[{id:'draft'}],count:1});await flush();
 requests[0].resolve({data:[{id:'old'}],count:99});await flush();
 api=r.render();assert.equal(api.posts[0].id,'draft');assert.equal(api.postsTotal,1);
 await oldFetch();assert.equal(requests.length,3,'old mutation callback cannot reload an obsolete filter');
 const older=api.fetchPosts();const newer=api.fetchPosts();await flush();
 requests[4].resolve({data:[{id:'newest'}],count:2});await newer;
 requests[3].resolve({data:[{id:'older-refresh'}],count:50});await older;
 api=r.render();assert.equal(api.posts[0].id,'newest');assert.equal(api.postsTotal,2);
 api.setIdeasPriorityFilter('high');r.render();await r.runEffects();
 requests[5].resolve({data:[{id:'priority'}],count:3});await flush();
 requests[1].resolve({error:{message:'stale failure'}});await flush();
 api=r.render();assert.equal(api.ideas[0].id,'priority');assert.equal(api.toast,null);assert.equal(api.loading,false);
 const closed=api.fetchIdeas();await flush();r.unmount();
 requests[6].resolve({data:[{id:'closed'}],count:100});await closed;
 api=r.render();assert.equal(api.ideas[0].id,'priority');assert.equal(api.ideasTotal,3);
});
