const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const compiled=ts.transpileModule(fs.readFileSync('lib/financeAmounts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const mod={exports:{}}; new Function('module','exports',compiled)(mod,mod.exports);
const {paymentAmounts}=mod.exports;
test('two sandbox payments reconcile £184 collected, £112 refunded and £72 remaining',()=>{
 const rows=[{amount:92,status:'refunded',refunded:true,refund_amount:92},{amount:92,status:'partially_refunded',refunded:false,refund_amount:20}].map(p=>paymentAmounts(p,1.58));
 assert.equal(rows.reduce((s,p)=>s+p.collected,0),184);
 assert.equal(rows.reduce((s,p)=>s+p.refunded,0),112);
 assert.equal(rows.reduce((s,p)=>s+p.remaining,0),72);
 assert.equal(rows[0].net,-1.58); assert.equal(rows[1].net,70.42);
});
test('failed and pending attempts are not collected funds',()=>{for(const status of ['failed','pending']) assert.deepEqual(paymentAmounts({amount:92,status},1.58),{collected:0,refunded:0,remaining:0,net:0});});
test('legacy full refund and numeric strings reconcile safely',()=>{assert.equal(paymentAmounts({amount:'92',status:'refunded',refunded:true}).refunded,92);assert.equal(paymentAmounts({amount:'92',status:'partially_refunded',refund_amount:'20'}).remaining,72);});
