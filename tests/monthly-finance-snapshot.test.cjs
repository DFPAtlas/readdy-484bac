const{test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const{PGlite}=require('@electric-sql/pglite');const{fixture,id}=require('./helpers/monthly-finance-fixture.cjs');
const month='2026-10-01',oct='2026-10-10T00:00:00.000Z';
function baseRows(){return{subscription_payments:[{id:'s1',amount:10,status:'paid',created_at:oct},{id:'s2',amount:5,status:'failed',created_at:oct}],transactions:[{id:'t1',amount:100,status:'completed',refund_amount:20,created_at:oct,transaction_type:'job'},{id:'t2',amount:10,status:'paid',created_at:oct,transaction_type:'subscription'},{id:'old',amount:1000,status:'paid',created_at:'2026-09-10T00:00:00Z'}],platform_costs:[{id:'cost',monthly_cost:5}],guard_payouts:[{id:'p',net_amount:40,status:'paid_out',created_at:oct},{id:'failed',net_amount:500,status:'failed',created_at:oct}],subscriptions:[{id:'annual',status:'active',plan_amount:120000,billing_interval:'year',created_at:'2026-09-01T00:00:00.000Z'},{id:'monthly',status:'active',plan_amount:1000,billing_interval:'monthly',created_at:'2026-09-01T00:00:00.000Z'},{id:'cancel',status:'cancelled',created_at:oct,cancelled_at:oct}],guards:[{id:'g',created_at:oct}],clients:[{id:'c',created_at:oct}]};}
test('only POST can generate: GET/HEAD/PUT/DELETE and preflight do not access authentication or data',async()=>{
 for(const method of ['GET','HEAD','PUT','DELETE','OPTIONS']){const f=fixture();const r=await f.call(method);assert.equal(r.status,method==='OPTIONS'?204:405);assert.equal(f.calls.length,0);assert.equal(f.authCalls,0);assert.equal(f.inserts,0);assert.equal(r.headers.get('cache-control'),'no-store');}
});
test('service auth is exact; manual calls require a verified active finance admin and MFA before financial reads',async()=>{
 for(const options of [{signed:false},{role:'guard'},{role:'admin'},{active:false}]){const f=fixture(options);assert.ok((await f.call('POST','aal2')).status>=400);assert.ok(f.calls.every(c=>c.table==='admin_users'));assert.equal(f.inserts,0);}
 for(const aal of ['none','aal1']){const f=fixture();assert.ok((await f.call('POST',aal,{service_role:true})).status>=400);assert.equal(f.inserts,0);}
 for(const role of ['super_admin','finance_admin']){const f=fixture({role});assert.equal((await f.call('POST','aal2')).status,200);assert.equal(f.inserts,1);}
 for(const options of [{authThrow:true},{profileError:true}]){const f=fixture(options);const r=await f.call('POST','aal2');assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/PRIVATE/);assert.equal(f.inserts,0);}
});
test('monthly cohort totals preserve GBP payments, pence plan prices, fees, refunds and payout deductions; annual interval is actually selected',async()=>{
 const f=fixture({rows:baseRows()});const r=await f.call('POST','service',{snapshot_month:'1999-01-01'});assert.equal(r.status,200);const body=await r.json();assert.equal(body.status,'created');assert.equal(body.snapshot_month,month);assert.equal(body.snapshot_id,id);const s=body.snapshot;
 assert.equal(s.gross_revenue,110);assert.equal(s.refunds,20);assert.equal(s.stripe_fees,2.05);assert.equal(s.net_revenue,87.95);assert.equal(s.running_costs,5);assert.equal(s.vat_estimate,17.59);assert.equal(s.estimated_profit,25.36);assert.equal(s.mrr,110);assert.equal(s.arr,1320);assert.equal(s.arpu,55);assert.equal(s.failed_payments,1);assert.equal(s.active_subscriptions,2);assert.equal(s.churn_rate,0.5);assert.equal(s.new_guards,1);assert.equal(s.new_clients,1);
 const selects=f.calls.filter(c=>c.table==='subscriptions'&&c.fields.includes('plan_amount'));assert.ok(selects.every(c=>c.fields.includes('billing_interval')));
});
test('all snapshot lists exceed the default 1000-row API cap safely and retain filters across pages',async()=>{
 const many=(fn)=>Array.from({length:1201},(_,i)=>({id:String(i).padStart(5,'0'),created_at:oct,...fn(i)}));
 const rows={subscription_payments:many(()=>({amount:1,status:'paid'})),transactions:[],platform_costs:many(()=>({monthly_cost:1})),guard_payouts:many(()=>({net_amount:1,status:'paid_out'})),subscriptions:many(()=>({status:'active',plan_amount:100,billing_interval:'month'})),guards:many(()=>({})),clients:many(()=>({}))};
 const f=fixture({rows});const r=await f.call();assert.equal(r.status,200);const s=(await r.json()).snapshot;assert.equal(s.gross_revenue,1201);assert.equal(s.running_costs,1201);assert.equal(s.mrr,1201);assert.equal(s.active_subscriptions,1201);assert.equal(s.new_guards,1201);assert.equal(s.new_clients,1201);assert.equal(s.estimated_profit,Math.round((s.net_revenue-1201-1201-s.vat_estimate)*100)/100);
 assert.ok(f.calls.filter(c=>c.table!=='finance_snapshots'&&c.table!=='admin_users').every(c=>c.order==='id'&&c.range));
});
test('retry returns the real saved reference without another financial scan or insert',async()=>{
 const f=fixture();assert.equal((await f.call()).status,200);const count=f.calls.length;const r=await f.call();assert.equal(r.status,200);const body=await r.json();assert.equal(body.status,'already_exists');assert.equal(body.snapshot_id,id);assert.equal(body.skipped,true);assert.equal(f.inserts,1);assert.equal(f.calls.length,count+1);
});
test('overlapping requests recover a database unique conflict as the same confirmed snapshot',async()=>{
 const f=fixture();f.race=true;const responses=await Promise.all([f.call(),f.call()]);assert.ok(responses.every(r=>r.status===200));const bodies=await Promise.all(responses.map(r=>r.json()));assert.deepEqual(bodies.map(b=>b.status).sort(),['already_exists','created']);assert.ok(bodies.every(b=>b.snapshot_id===id&&b.snapshot_month===month));assert.equal(f.rows.finance_snapshots.length,1);
});
test('query failures and missing pages never become zero totals or a saved success',async()=>{
 for(const table of ['subscription_payments','transactions','platform_costs','guard_payouts','subscriptions','guards','clients'])for(const key of ['fail','nullPage']){const f=fixture();f[key]=table;const r=await f.call();assert.equal(r.status,500);assert.equal(f.inserts,0);assert.doesNotMatch(await r.text(),/PRIVATE/);}
});
test('unconfirmed insert replies, malformed prior rows and unrelated unique conflicts never report success',async()=>{
 const bad=fixture();bad.badReceipt=true;assert.equal((await bad.call()).status,500);
 const old=fixture({rows:{finance_snapshots:[{id:'invalid',snapshot_month:month}]}});assert.equal((await old.call()).status,500);assert.equal(old.inserts,0);
 const conflict=fixture();conflict.insertError={code:'23505',message:'PRIVATE CONSTRAINT'};const r=await conflict.call();assert.equal(r.status,500);assert.doesNotMatch(await r.text(),/PRIVATE/);
});
const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_monthly_finance_snapshot_idempotency.sql'));const sql=fs.readFileSync('supabase/migrations/'+migration,'utf8');
test('database migration adds true per-month uniqueness, preserves rows and is repeatable',async()=>{
 const db=new PGlite();try{await db.exec("create schema app;create table app.finance_snapshots(id uuid not null default gen_random_uuid(),snapshot_month date not null,gross_revenue numeric);insert into app.finance_snapshots(snapshot_month,gross_revenue) values('2026-10-01',123.45)");const before=(await db.query('select * from app.finance_snapshots')).rows;await db.exec(sql);await db.exec(sql);assert.deepEqual((await db.query('select * from app.finance_snapshots')).rows,before);await assert.rejects(db.query("insert into app.finance_snapshots(snapshot_month) values('2026-10-01')"),e=>e.code==='23505');await db.exec("insert into app.finance_snapshots(snapshot_month) values('2026-11-01')");}finally{await db.close();}
});
test('duplicate history and a conflicting index name fail closed without deleting history',async()=>{
 for(const collision of [false,true]){const db=new PGlite();try{await db.exec("create schema app;create table app.finance_snapshots(id int,snapshot_month date);insert into app.finance_snapshots values(1,'2026-10-01')");if(collision)await db.exec('create index finance_snapshots_month_unique on app.finance_snapshots(id)');else await db.exec("insert into app.finance_snapshots values(2,'2026-10-01')");const before=(await db.query('select * from app.finance_snapshots')).rows;await assert.rejects(db.exec(sql));assert.deepEqual((await db.query('select * from app.finance_snapshots')).rows,before);}finally{await db.close();}}
});
