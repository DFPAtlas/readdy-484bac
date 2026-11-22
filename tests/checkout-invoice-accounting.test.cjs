const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const helpers={exports:{}};
new Function('module','exports',compile(fs.readFileSync('supabase/functions/_shared/invoice-lifecycle.ts','utf8')))(helpers,helpers.exports);
const source=fs.readFileSync('supabase/functions/enhanced-stripe-webhook/index.ts','utf8');
const block=source.slice(source.indexOf('          const paymentInvoiceId ='),source.indexOf('          const profileUpdate =',source.indexOf('          const paymentInvoiceId =')));
const run=new Function('stripe','appSupabase','session','stripeSub','stripeSubId','isPaidUpfront','subscriptionDbId','userId','periodStart','periodEnd',...Object.keys(helpers.exports),compile(`return (async()=>{${block}})();`));
function harness({amount=1900,existing=false,trial=false,wrongSubscription=false,invoiceStatus='paid',readError=false,writeError=false}={}){
 const writes=[],reads=[];const invoice={id:'in_first',status:invoiceStatus,subscription:wrongSubscription?'sub_foreign':'sub_test',amount_paid:amount,currency:'gbp',status_transitions:{paid_at:1795386080},created:1795386080,payment_intent:'pi_first',charge:'ch_first',billing_reason:'subscription_create'};
 const stripe={invoices:{retrieve:async id=>{reads.push(id);if(readError)throw Error('Stripe unavailable');return invoice;}}};
 const db={from(table){let method='read',body;const filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},maybeSingle(){return q},insert(v){method='insert';body=v;return q},update(v){method='update';body=v;return q},then(resolve,reject){if(method!=='read')writes.push({table,method,body,filters});return Promise.resolve({data:existing?{id:'existing_payment'}:null,error:writeError&&method!=='read'?{message:'Write failed',code:'XX000'}:null}).then(resolve,reject)}};return q}};
 return {writes,reads,execute:()=>run(stripe,db,{invoice:'in_first'},{latest_invoice:'in_newer'},'sub_test',!trial,'db_sub','user','start','end',...Object.values(helpers.exports))};
}
test('discounted first checkout records £19 received and actual invoice references',async()=>{const h=harness();await h.execute();assert.deepEqual(h.reads,['in_first']);assert.equal(h.writes.length,1);const p=h.writes[0].body;assert.equal(p.amount,19);assert.equal(p.stripe_invoice_id,'in_first');assert.equal(p.stripe_payment_intent_id,'pi_first');assert.equal(p.stripe_charge_id,'ch_first');});
test('existing invoice is corrected in place on retry without duplicate payment',async()=>{const h=harness({existing:true});await h.execute();assert.equal(h.writes.length,1);assert.equal(h.writes[0].method,'update');assert.equal(h.writes[0].body.amount,19);assert.deepEqual(h.writes[0].filters,[['id','existing_payment']]);});
for(const amount of [2900,29000,3480])test(`undiscounted, annual or tax-inclusive invoice ${amount} records exact provider amount`,async()=>{const h=harness({amount});await h.execute();assert.equal(h.writes[0].body.amount,amount/100);});
test('trial and zero-paid checkout produce no cash payment ledger entry',async()=>{for(const options of [{trial:true},{amount:0}]){const h=harness(options);await h.execute();assert.equal(h.writes.length,0);}});
for(const options of [{wrongSubscription:true},{invoiceStatus:'open'},{amount:-1},{amount:NaN},{readError:true},{writeError:true}])test(`unverified invoice or provider/database failure rejects: ${JSON.stringify(options)}`,async()=>{const h=harness(options);await assert.rejects(h.execute());if(!options.writeError)assert.equal(h.writes.length,0);});
