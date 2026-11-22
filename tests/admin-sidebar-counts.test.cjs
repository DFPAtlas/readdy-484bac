const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {load}=require('./helpers/enterprise-module.cjs');
const {readAdminSidebarCounts}=load('supabase/functions/_shared/admin-sidebar-counts.ts');
const tables=['transactions','guards','sia_verifications','guard_payouts','contact_submissions','complaints'];
const expected={failedPayments:1,guardVerifications:2,siaVerifications:1,heldPayments:1,contactSubmissions:1,complaints:2};

function countDatabase(resolve, auth={}) {
  const calls=[];
  const db={calls,schema(){return db;},auth:{getUser:async()=>({data:{user:auth.user===false?null:{id:'admin'}},error:null})},from(table){
    if(table==='admin_users') { const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:auth.active===false?null:{id:'admin',role:auth.role||'super_admin',is_active:true},error:null})}; return q; }
    const call={table,filters:[]};calls.push(call);
    const q={select(fields,options){assert.equal(fields,'id');assert.deepEqual(options,{count:'exact',head:true});return q;},
      eq(column,value){call.filters.push({column,value,op:'eq'});return q;},in(column,value){call.filters.push({column,value,op:'in'});return q;},
      then(onfulfilled,onrejected){return Promise.resolve().then(()=>resolve(call)).then(onfulfilled,onrejected);}};return q;
  }};return db;
}

test('sidebar counts use the real SIA status column and actual unresolved complaints against PostgreSQL',async()=>{
  const pg=new PGlite();try {
    await pg.exec(`create schema app;
      create table app.transactions(id int,status text);insert into app.transactions values(1,'failed'),(2,'completed');
      create table app.guards(id int,verification_status text);insert into app.guards values(1,'manual_review'),(2,'pending_sia_check'),(3,'approved');
      create table app.sia_verifications(id int,verification_status text);insert into app.sia_verifications values(1,'pending'),(2,'verified');
      create table app.guard_payouts(id int,status text);insert into app.guard_payouts values(1,'held'),(2,'paid_out');
      create table app.contact_submissions(id int,status text);insert into app.contact_submissions values(1,'new'),(2,'resolved');
      create table app.complaints(id int,status text);insert into app.complaints values(1,'open'),(2,'pending'),(3,'resolved');`);
    const db=countDatabase(async call=>{
      assert.ok(tables.includes(call.table));const values=[];
      const where=call.filters.map(f=>{assert.ok(['status','verification_status'].includes(f.column));
        if(f.op==='in') return f.column+' in ('+f.value.map(value=>{values.push(value);return '$'+values.length;}).join(',')+')';
        values.push(f.value);return f.column+'=$'+values.length;
      }).join(' and ');
      const result=await pg.query('select count(*)::integer as count from app.'+call.table+' where '+where,values);
      return {count:result.rows[0].count,error:null};
    });
    assert.deepEqual(await readAdminSidebarCounts(async (table,column,value)=>{
      const query=db.from(table).select('id',{count:'exact',head:true});
      return typeof value==='string'?await query.eq(column,value):await query.in(column,value);
    }),expected);
  } finally {await pg.close();}
});

function endpoint(file,resolve,auth={}) {
  let handler;const db=countDatabase(resolve,auth);
  load(file,{'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:()=>db}}, {
    Deno:{env:{get:()=> 'fixture'},serve:fn=>handler=fn},
  });
  const token='h.'+Buffer.from(JSON.stringify({aal:auth.aal||'aal2'})).toString('base64url')+'.s';
  return {db,request:()=>handler(new Request('https://example.test/function',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'dashboard_stats'})}))};
}
const endpoints=['supabase/functions/admin-security/index.ts','supabase/functions/security-dashboard/index.ts'];

test('both protected stats endpoints reject failed, missing or malformed counts instead of inventing zeros',async()=>{
  for(const file of endpoints) {
    for(const table of tables) {
      for(const failure of [{count:null,error:{message:'PRIVATE DATABASE DETAIL'}},{count:null,error:null},{count:-1,error:null},{count:0.5,error:null},{count:Infinity,error:null}]) {
        const h=endpoint(file,call=>call.table===table?failure:{count:0,error:null});
        const response=await h.request();assert.equal(response.status,503);
        assert.deepEqual(await response.json(),{error:'Unable to load admin sidebar counts'});
      }
    }
    const thrown=endpoint(file,()=>{throw new Error('PRIVATE NETWORK DETAIL');});assert.equal((await thrown.request()).status,503);
    const zero=endpoint(file,()=>({count:0,error:null}));assert.equal((await zero.request()).status,200);
    const result=await (await zero.request()).json();assert.ok(Object.values(result).every(value=>value===0));
  }
});

test('stats retain authenticated active admin and MFA gates before querying counters',async()=>{
  for(const file of endpoints) {
    for(const auth of [{user:false},{active:false},{role:'guard'},{aal:'aal1'}]) {
      const h=endpoint(file,()=>({count:1,error:null}),auth);assert.ok((await h.request()).status>=400);assert.equal(h.db.calls.length,0);
    }
    const allowed=endpoint(file,()=>({count:1,error:null}),{role:'finance_admin'});assert.equal((await allowed.request()).status,200);
  }
});
