const {load}=require('./enterprise-module.cjs');
const id='11111111-1111-4111-8111-111111111111';
const fixed='2026-11-24T10:00:00Z';
class Clock extends Date{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return new Date(fixed).getTime();}}
function fixture(options={}){
 const f={rows:{finance_snapshots:[],subscription_payments:[],transactions:[],platform_costs:[],guard_payouts:[],subscriptions:[],guards:[],clients:[],...options.rows},calls:[],inserts:0,authCalls:0,profileCalls:0,fail:null,nullPage:null,race:false};
 const db={auth:{getUser:async()=>{f.authCalls++;if(options.authThrow)throw Error('PRIVATE AUTH');return{data:{user:options.signed===false?null:{id:'actor'}},error:null};}},from(table){
  const call={table,filters:[],fields:'*',range:null,insert:null};f.calls.push(call);
  const q={select(fields='*'){call.fields=fields;return q;},eq(k,v){call.filters.push([k,'eq',v]);return q;},gte(k,v){call.filters.push([k,'gte',v]);return q;},lt(k,v){call.filters.push([k,'lt',v]);return q;},order(k){call.order=k;return q;},range(a,b){call.range=[a,b];return q;},or(v){call.or=v;return q;},insert(row){call.insert=row;return q;},maybeSingle(){call.single=true;return q;},single(){call.single=true;return q;},then(resolve,reject){return (async()=>{
   if(table==='admin_users'){f.profileCalls++;return{data:{role:options.role||'super_admin',is_active:options.active!==false},error:options.profileError?{message:'PRIVATE PROFILE'}:null};}
   if(f.fail===table)return{data:null,error:{code:'PRIVATE',message:'PRIVATE SOURCE ERROR'}};
   if(f.nullPage===table)return{data:null,error:null};
   if(call.insert){f.inserts++;if(f.insertError)return{data:null,error:f.insertError};if(f.rows.finance_snapshots.some(r=>r.snapshot_month===call.insert.snapshot_month))return{data:null,error:{code:'23505'}};const row={...call.insert,id};f.rows.finance_snapshots.push(row);return{data:f.badReceipt?{...row,id:null}:row,error:null};}
   if(f.race&&table==='finance_snapshots'&&!f.rows.finance_snapshots.length){f.raceReads=(f.raceReads||0)+1;if(f.raceReads<2)await new Promise(r=>f.release=r);else f.release();return{data:null,error:null};}
   let rows=(f.rows[table]||[]).filter(r=>call.filters.every(([k,op,v])=>op==='eq'?r[k]===v:op==='gte'?r[k]>=v:r[k]<v));
   if(call.or){if(call.or!=='transaction_type.neq.subscription,transaction_type.is.null')throw Error('Unexpected filter');rows=rows.filter(r=>r.transaction_type!=='subscription');}
   if(call.order)rows=rows.slice().sort((a,b)=>String(a[call.order]).localeCompare(String(b[call.order])));
   if(call.range)rows=rows.slice(call.range[0],call.range[1]+1);else if(!call.single)rows=rows.slice(0,1000);
   if(call.fields!=='*'){const fields=call.fields.split(',').map(s=>s.trim());rows=rows.map(r=>Object.fromEntries(fields.map(k=>[k,r[k]])));}
   return{data:call.single?rows[0]||null:rows,error:null};
  })().then(resolve,reject);}};return q;
 }};
 let handler;const exported=load('supabase/functions/monthly-finance-snapshot/index.ts',{'https://esm.sh/@supabase/supabase-js@2.49.1':{createClient:()=>db}},{Date:Clock,Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://fixture.invalid':'fixture-service'},serve:fn=>{handler=fn;}},console:{error(){}}});
 f.call=(method='POST',auth='service',body)=>{const token=auth==='service'?'fixture-service':auth==='none'?null:'h.'+Buffer.from(JSON.stringify({aal:auth})).toString('base64url')+'.s';return handler(new Request('https://fixture.invalid/snapshot',{method,headers:token?{Authorization:'Bearer '+token}:{},...(['GET','HEAD'].includes(method)||body===undefined?{}:{body:JSON.stringify(body)})}));};
 f.exported=exported;return f;
}
module.exports={fixture,id};
