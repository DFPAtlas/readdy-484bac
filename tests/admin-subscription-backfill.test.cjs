const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/enterprise-module.cjs');
const { hooksHarness, nodes, content, flush } = require('./helpers/guard-ui-fixture.cjs');
const localId='58ea2b87-c8e7-484b-a97e-e8d0eccfdaae';
const sub={id:localId,user_id:'user',stripe_subscription_id:'sub_fixture',stripe_customer_id:'cus_fixture',stripe_price_id:'price_fixture',currency:'gbp',last_payment_date:'2026-10-05T19:32:17Z'};
const remote={id:'sub_fixture',customer:'cus_fixture',livemode:false,status:'active',latest_invoice:'in_new',items:{data:[{price:{id:'price_fixture'}}]}};
const invoice={id:'in_new',customer:'cus_fixture',livemode:false,parent:{subscription_details:{subscription:'sub_fixture'}},amount_paid:1000,currency:'gbp',status:'paid',billing_reason:'subscription_cycle',created:1793900000,status_transitions:{paid_at:1793907137},period_start:1791225050,period_end:1793903450,lines:{has_more:false,data:[{parent:{subscription_item_details:{subscription:'sub_fixture',proration:false}},period:{start:1793903450,end:1796495450}}]}};
function backend(options={}) {
 let handler;const calls=[],writes=[],payments=[{id:'older',subscription_id:localId,user_id:'user',stripe_invoice_id:'in_old'}];
 if(options.conflictingInvoice) payments.push({id:'conflict',subscription_id:localId,user_id:'user',stripe_invoice_id:'in_new',status:'failed',amount:10,currency:'gbp'});
 const local={...sub},provider={...remote,...options.remote},bill={...invoice,...options.invoice};
 const db={auth:{async getUser(){return {data:{user:options.invalidUser?null:{id:'admin'}},error:null};}},from(table){let method='read',body,single=false;const filters=[];const q={select(){return q;},not(){return q;},order(){return q;},eq(k,v){filters.push([k,v]);return q;},maybeSingle(){single=true;return q;},insert(v){method='insert';body=v;return q;},update(v){method='update';body=v;return q;},then(resolve,reject){
   let error=null,data=table==='admin_users'?[{id:'admin',user_id:'admin',role:options.role||'finance_admin',is_active:options.active!==false}]:table==='subscriptions'?[local]:payments;
   data=data.filter(r=>filters.every(([k,v])=>r[k]===v));
   if(table==='subscription_payments'&&method==='read'&&options.readError)error={message:'Read unavailable'};
   if(method!=='read'){
    writes.push({table,method,body});
    if(options.writeError)error={message:'Write unavailable'};
    else if(method==='insert') {const row={id:'new',...body};payments.push(row);data=[row];}
    else if(options.zeroUpdate)data=[];
    else {Object.assign(local,body);data=[local];}
   }
   return Promise.resolve({data:single?data[0]||null:data,error}).then(resolve,reject);
 }};return q;}};
 class Stripe {constructor(){this.subscriptions={retrieve:async id=>{calls.push(['subscription',id]);if(options.providerError)throw new Error('Object belongs to another Stripe environment');return provider;}};this.invoices={retrieve:async id=>{calls.push(['invoice',id]);return bill;}};}}
 load('supabase/functions/backfill-subscription-payments/index.ts',{'https://deno.land/std@0.168.0/http/server.ts':{serve:fn=>handler=fn},'https://esm.sh/stripe@14.10.0?target=deno':{__esModule:true,default:Stripe},'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:()=>db}},{Deno:{env:{get:()=> 'fixture-service'}}});
 const token='h.'+Buffer.from(JSON.stringify({aal:options.aal||'aal2'})).toString('base64url')+'.s';
 return {calls,writes,payments,async request(body={},auth='Bearer '+token){const res=await handler(new Request('https://example.test/backfill',{method:'POST',headers:auth?{Authorization:auth}:{},body:JSON.stringify(body)}));return {status:res.status,body:await res.json()};}};
}
test('renewal backfill checks the invoice rather than skipping users with an older payment; replay is safe',async()=>{
 const h=backend(),first=await h.request();assert.equal(first.body.success,true);assert.equal(first.body.results[0].action,'backfilled');
 assert.equal(h.payments.length,2);const row=h.payments[1];assert.equal(row.stripe_invoice_id,'in_new');assert.equal(row.amount,10);assert.equal(row.period_start,'2026-11-05T18:30:50.000Z');assert.equal(row.period_end,'2026-12-05T18:30:50.000Z');assert.equal(row.paid_at,'2026-11-05T19:32:17.000Z');
 const again=await h.request();assert.equal(again.body.results[0].action,'skipped');assert.equal(h.payments.length,2);assert(h.writes.every(w=>!('stripe_customer_id' in w.body)&&!('stripe_price_id'in w.body)&&!('stripe_subscription_id'in w.body)));
});
test('backfill requires an authenticated active finance administrator and MFA before Stripe reads',async()=>{
 for(const options of [{invalidUser:true},{active:false},{role:'support_admin'},{aal:'aal1'}]) {const h=backend(options);assert((await h.request()).status>=400);assert.equal(h.calls.length,0);assert.equal(h.writes.length,0);}
 const missing=backend();assert.equal((await missing.request({},'')).status,401);assert.equal(missing.calls.length,0);
 const service=backend({aal:'aal1'});assert.equal((await service.request({},'Bearer fixture-service')).status,200);
});
test('foreign ownership, mode, price, unpaid invoices, and failed reads cannot create a payment',async()=>{
 for(const options of [{remote:{customer:'cus_other'}},{invoice:{customer:'cus_other'}},{invoice:{livemode:true}},{remote:{items:{data:[{price:{id:'price_other'}}]}}},{invoice:{parent:{subscription_details:{subscription:'sub_other'}}}},{readError:true},{providerError:true},{conflictingInvoice:true}]) {const h=backend(options),r=await h.request();assert.equal(r.body.success,false);assert.equal(r.body.results[0].action,'error');assert.equal(h.writes.length,0);}
 const unpaid=backend({invoice:{status:'open'}});assert.equal((await unpaid.request()).body.results[0].action,'skipped');assert.equal(unpaid.writes.length,0);
});
test('dry run does not write and insert/summary failures cannot be reported as successful',async()=>{
 const dry=backend();assert.equal((await dry.request({dry_run:true,subscription_id:localId})).body.results[0].action,'preview');assert.equal(dry.writes.length,0);
 for(const options of [{writeError:true},{zeroUpdate:true}]) {const h=backend(options),r=await h.request();assert.equal(r.body.success,false);assert.equal(r.body.results[0].action,'error');}
});
test('service periods stay unknown for partial, prorated, missing or conflicting invoice lines',()=>{
 const {invoiceServicePeriod}=load('supabase/functions/_shared/subscription-invoice-period.ts');
 for(const lines of [undefined,{has_more:true,data:invoice.lines.data},{data:[]},{data:[{...invoice.lines.data[0],proration:true}]},{data:[invoice.lines.data[0],{...invoice.lines.data[0],period:{start:1793903450,end:1796500000}}]}])assert.deepEqual(invoiceServicePeriod({...invoice,lines},'sub_fixture'),{start:null,end:null});
});
function frontend(result,session=true){let invocations=0;const db={auth:{async getSession(){return {data:{session:session?{access_token:'admin'}:null},error:null};}},functions:{async invoke(name){assert.equal(name,'backfill-subscription-payments');invocations++;return typeof result==='function'?await result():result;}},from(){const q={select:()=>q,not:()=>q,order:()=>q,limit:()=>q,in:()=>q,then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject);}};return q;}};const h=hooksHarness('app/admin/payments/page.tsx',{'@/lib/supabase':{supabase:db},'../payments-jobs/RefundRequestQueue':{__esModule:true,default:()=>null}},{setTimeout:()=>0});const button=()=>nodes(h.render()).find(n=>n.type==='button'&&/Reconcile all invoices|Reconciling invoices/.test(content(n)));return {h,button,get invocations(){return invocations;}};}
test('admin invoice control never reports a denied or malformed reconciliation as complete',async()=>{
 for(const result of [{data:null,error:{message:'Forbidden'}},{data:{},error:null},{data:{success:false,results:[{action:'error'}]},error:null}]){const f=frontend(result);f.h.render();await f.h.effects();await f.button().props.onClick();const text=content(f.h.render());assert.doesNotMatch(text,/Invoice check complete/);assert.match(text,/failed|incomplete/);}
 const f=frontend({data:{success:true,results:[]},error:null},false);f.h.render();await f.h.effects();await f.button().props.onClick();assert.equal(f.invocations,0);assert.match(content(f.h.render()),/session is unavailable/);
});
test('admin invoice control prevents overlapping requests and ignores results after unmount',async()=>{
 let resolve;const waiting=new Promise(r=>resolve=r),f=frontend(()=>waiting);f.h.render();await f.h.effects();const click=f.button().props.onClick;const first=click();await flush();await click();assert.equal(f.invocations,1);f.h.unmount();const writes=f.h.writes;resolve({data:{success:true,results:[{action:'backfilled'}]},error:null});await first;assert.equal(f.h.writes,writes);
 const good=frontend({data:{success:true,results:[{action:'backfilled'},{action:'skipped'}]},error:null});good.h.render();await good.h.effects();await good.button().props.onClick();assert.match(content(good.h.render()),/Invoice check complete: 1 payment/);
});
