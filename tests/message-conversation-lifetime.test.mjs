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

for (const role of ['client','guard']) {
 test(role+' chat drops late conversations and keeps loader stable on unread updates',async()=>{
  const path=role==='client'?'app/client/messages/MessagesClient.tsx':'app/guard/messages/GuardMessagesClient.tsx';
  const source=fs.readFileSync(path,'utf8');
  const start=source.indexOf('  const activeConversation =');
  const end=source.indexOf('  const handle',start);
  const body=source.slice(start,end);
  const pending=[],reads=[],timers=[];
  const db={from:table=>{let job;const q={select:()=>q,or:()=>q,order:()=>q,limit:()=>q,eq:(key,value)=>{if(key==='job_id')job=value;return q},is:()=>q,lt:()=>q,maybeSingle:async()=>({data:{id:table+'-'+job}}),update:()=>q,in:async()=>({data:null}),then:(resolve,reject)=>{reads.push(job);return (pending.shift()||Promise.resolve({data:[]})).then(resolve,reject)}};return q}};
  const states=`const [activeMessages,setActiveMessages]=useState([]);const [activeJob,setActiveJob]=useState(null);const [activeGuard,setActiveGuard]=useState(null);const [activeClient,setActiveClient]=useState(null);const [msgLoadingOlder,setMsgLoadingOlder]=useState(false);const [msgHasMore,setMsgHasMore]=useState(false);const [msgOldestCreatedAt,setMsgOldestCreatedAt]=useState(null);const mountedRef=useRef(true);const skipScrollRef=useRef(false);const messagesEndRef=useRef(null);`;
  const r=harness('return function component({activeConversationId,conversations}){const clientUserId="me",guardUserId="me",MSG_PAGE_SIZE=50;'+states+body+'return {activeMessages,activeJob,loadActiveMessages,msgLoadingOlder};}',{supabase:db,setTimeout:fn=>timers.push(fn),setConversations(){},setTotalUnread(){}});
  const props=id=>({activeConversationId:id,conversations:[{id,job_id:id,other_user_id:'other-'+id}]});
  const late=deferred();pending.push(late.promise);let api=r.render(props('A'));await r.runEffects();const oldLoader=api.loadActiveMessages;
  pending.push(Promise.resolve({data:[{id:'message-B',sender_id:'other-B',receiver_id:'me',read:true,created_at:'today'}]}));
  r.render(props('B'));await r.runEffects();api=r.render(props('B'));await r.runEffects();assert.equal(api.activeMessages[0].id,'message-B');
  late.resolve({data:[{id:'late-A',sender_id:'other-A',receiver_id:'me',read:true}]});await flush();api=r.render(props('B'));assert.equal(api.activeMessages[0].id,'message-B');
  const count=reads.length;await oldLoader();assert.equal(reads.length,count,'old send callback cannot reload previous chat');
  const stable=api.loadActiveMessages;r.render({...props('B'),conversations:props('B').conversations.map(c=>({...c,unread_count:0}))});await r.runEffects();api=r.render(props('B'));assert.equal(api.loadActiveMessages,stable);assert.equal(reads.length,count,'list refresh must not reload chat');
  const afterUnmount=deferred();pending.push(afterUnmount.promise);const request=api.loadActiveMessages();await flush();r.unmount();afterUnmount.resolve({data:[{id:'closed',sender_id:'other-B',receiver_id:'me'}]});await request;api=r.render(props('B'));assert.equal(api.activeMessages[0].id,'message-B');
 });
}
