import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

test('notification history keeps the newest refresh and ignores closed-screen reads',async()=>{
 const source=fs.readFileSync('app/guard/dashboard/NotificationHistory.tsx','utf8');
 const start=source.indexOf('  const mountedRef =');const body=source.slice(start,source.indexOf('  useEffect(() => {',start));
 const reads=[],updates=[];const env={guardUserId:'guard',useRef:current=>({current}),useCallback:fn=>fn,setLoading:v=>updates.push(['loading',v]),setNotifications:v=>updates.push(['notifications',v]),supabase:{from(){const q=new Proxy({},{get:(_,key)=>key==='then'?(resolve,reject)=>new Promise(r=>reads.push(r)).then(resolve,reject):()=>q});return q;}}};
 const js=ts.transpileModule(body+'\nreturn {fetchAll,mountedRef};',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const api=new Function(...Object.keys(env),js)(...Object.values(env));api.mountedRef.current=true;
 const first=api.fetchAll(),live=api.fetchAll();await Promise.resolve();reads[1]({data:[{id:'new-notification'}]});await live;
 const count=updates.length;reads[0]({data:[]});await first;assert.equal(updates.length,count);assert(updates.some(([name,value])=>name==='notifications'&&value[0].id==='new-notification'));
 const closing=api.fetchAll();await Promise.resolve();const afterStart=updates.length;api.mountedRef.current=false;reads[2]({data:[]});await closing;assert.equal(updates.length,afterStart);
});
