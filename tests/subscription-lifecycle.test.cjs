const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const helper={exports:{}};
new Function('module','exports',compile(fs.readFileSync('supabase/functions/_shared/invoice-lifecycle.ts','utf8')))(helper,helper.exports);
const {invoiceReferences,invoiceOutcome,subscriptionStatus,stripeId}=helper.exports;
const source=fs.readFileSync('supabase/functions/enhanced-stripe-webhook/index.ts','utf8');
const block=source.slice(source.indexOf("      case 'invoice.payment_succeeded':"),source.indexOf("      case 'payment_intent.payment_failed':"));
const run=new Function('stripe','appSupabase','event','requireAudit','subscriptionPeriod',...Object.keys(helper.exports),compile(`return (async()=>{switch(event.type){${block}}})();`));
function harness({paid=false,subStatus='past_due',attempts=4,historical=false,dbFailure=false}={}) {
 const writes=[];
 const invoice={id:'in_test',parent:{subscription_details:{subscription:'sub_test'}},status:paid?'paid':'open',attempted:true,attempt_count:attempts,amount_paid:paid?4900:0,amount_due:4900,created:1791137056,period_start:1791137056,period_end:1793815456,currency:'gbp'};
 const stripe={invoices:{retrieve:async()=>invoice},subscriptions:{retrieve:async()=>({id:'sub_test',status:subStatus,latest_invoice:historical?'in_new':'in_test',cancel_at_period_end:false,current_period_start:1791137056,current_period_end:1793815456})}};
 const db={from(table){let body,filters=[],method='select';const chain={select(){return chain},update(value){method='update';body=value;return chain},insert(value){method='insert';body=value;return chain},eq(key,value){filters.push([key,value]);return chain},order(){return chain},limit(){return chain},maybeSingle(){return chain},then(resolve,reject){let data=table==='subscriptions'?{id:'db_sub',user_id:'user',account_type:'client'}:table==='subscription_payments'?{id:'db_payment'}:null;if(method!=='select')writes.push({table,body,filters});return Promise.resolve({data,error:dbFailure&&method==='update'?new Error('database unavailable'):null}).then(resolve,reject)}};return chain}};
 const execute=type=>run(stripe,db,{type,data:{object:{id:'in_test',subscription:'sub_test',status:paid?'open':'paid'}}},async p=>{const r=await p;if(r.error)throw r.error;return r},s=>({start:new Date(s.current_period_start*1000).toISOString(),end:new Date(s.current_period_end*1000).toISOString()}),...Object.values(helper.exports));
 return {execute,writes};
}
test('modern and legacy invoices resolve string and expanded references',()=>{
 assert.deepEqual(invoiceReferences({subscription:{id:'sub_old'},payment_intent:'pi_old',charge:{id:'ch_old'}}),{subscriptionId:'sub_old',paymentIntentId:'pi_old',chargeId:'ch_old'});
 assert.deepEqual(invoiceReferences({parent:{subscription_details:{subscription:'sub_new'}},payments:{data:[{status:'paid',payment:{payment_intent:{id:'pi_new'}}}]}}),{subscriptionId:'sub_new',paymentIntentId:'pi_new',chargeId:null});
 assert.equal(invoiceReferences({}).subscriptionId,null);
});
test('four failed attempts remain past_due until Stripe cancels and update one ledger row',async()=>{
 const h=harness();await h.execute('invoice.payment_failed');
 const sub=h.writes.find(w=>w.table==='subscriptions').body;
 assert.equal(sub.status,'past_due');assert.equal(sub.payment_failure_count,4);assert.equal(sub.payment_status,'failed');
 assert.equal(h.writes.find(w=>w.table==='subscription_payments').body.status,'failed');
});
test('a delayed failure after recovery records succeeded and preserves Stripe subscription status',async()=>{
 const h=harness({paid:true,subStatus:'active'});await h.execute('invoice.payment_failed');
 assert.equal(h.writes.find(w=>w.table==='subscriptions').body.payment_status,'succeeded');
 assert.equal(h.writes.find(w=>w.table==='subscription_payments').body.amount,49);
 assert.equal(h.writes.find(w=>w.table==='user_entitlements').body.subscription_status,'active');
});
test('old paid invoice cannot reactivate a cancelled subscription or override its latest payment',async()=>{
 const h=harness({paid:true,subStatus:'canceled',historical:true});await h.execute('invoice.payment_succeeded');
 const sub=h.writes.find(w=>w.table==='subscriptions').body;
 assert.equal(sub.status,'cancelled');assert.equal(sub.payment_status,undefined);
 assert.equal(h.writes.find(w=>w.table==='user_entitlements').body.subscription_status,'cancelled');
});
test('database write failure rejects processing so webhook claim can retry',async()=>{
 const h=harness({dbFailure:true});await assert.rejects(h.execute('invoice.payment_failed'),/database unavailable/);
});
test('draft and void invoices do not produce a payment outcome',()=>{
 assert.equal(invoiceOutcome({status:'draft',attempted:true}),null);
 assert.equal(invoiceOutcome({status:'void',attempted:true}),null);
});
test('Stripe disputed charge blocks payout even when local job has not received the webhook',async()=>{
 const src=fs.readFileSync('supabase/functions/create-guard-payout/index.ts','utf8');
 const fn=new Function(compile(src.slice(src.indexOf('async function validateAvailableFunds(')))+';return validateAvailableFunds;')();
 const db={from(){const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,maybeSingle:async()=>({data:{stripe_payment_intent:'pi',status:'completed',refunded:false,refund_amount:0}})};return q}};
 await assert.rejects(fn({paymentIntents:{retrieve:async()=>({status:'succeeded',latest_charge:{id:'ch',paid:true,disputed:true,amount:8800,amount_refunded:0}})}},db,'job','client',8000,'assignment'),e=>e.status===409&&/Disputed/.test(e.message));
});

test('payout replay checks current Stripe reversal state before returning cached success',async()=>{
 const src=fs.readFileSync('supabase/functions/create-guard-payout/index.ts','utf8');
 const start=src.indexOf('    if (operation.replayed) {');
 const block=src.slice(start,src.indexOf('    const guard =',start));
 const run=new Function('stripe','assignment','operation','origin','corsResponse',compile(`return (async()=>{${block}})();`));
 const operation={replayed:true,result:{success:true,transferId:'tr_fixture'}};
 const assignment={stripe_transfer_id:'tr_fixture'};
 const response=(_origin,status,body)=>({status,body});
 for(const state of [{reversed:true,amount_reversed:8000},{reversed:false,amount_reversed:1000}]) {
   await assert.rejects(run({transfers:{retrieve:async()=>state}},assignment,operation,null,response),e=>e.status===409&&/reversed/.test(e.message));
 }
 const ok=await run({transfers:{retrieve:async()=>({reversed:false,amount_reversed:0})}},assignment,operation,null,response);
 assert.equal(ok.status,200);assert.equal(ok.body.transferId,'tr_fixture');
 await assert.rejects(run({transfers:{retrieve:async()=>{throw new Error('Stripe unavailable')}}},assignment,operation,null,response),/Stripe unavailable/);
 await assert.rejects(run({}, {stripe_transfer_id:'tr_other'},operation,null,response),e=>e.status===409);
});
