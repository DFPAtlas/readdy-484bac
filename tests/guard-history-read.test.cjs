const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { load } = require('./helpers/enterprise-module.cjs');
const schema = { ...require('./fixtures/client-history-schema.json'), clients: [...require('./fixtures/client-history-schema.json').clients, 'first_name', 'last_name'], guard_payouts: ['id','guard_id','job_id','amount','net_amount','status','stripe_transfer_id','created_at','completed_date'] };
const links = { job_applications: { jobs: 'job_id' }, job_assignments: { jobs: 'job_id' }, jobs: { clients: 'client_id' }, reviews: { clients: 'client_id' } };
function splitFields(value) {
  const result = []; let depth = 0, start = 0;
  for (let i = 0; i < value.length; i++) { if (value[i] === '(') depth++; if (value[i] === ')') depth--; if (!depth && value[i] === ',') { result.push(value.slice(start,i).trim()); start=i+1; } }
  return [...result,value.slice(start).trim()].filter(Boolean);
}
function fixture() {
  const client = { id: 'client', company_name: 'Synthetic Events' };
  const jobs = Array.from({length:9},(_,i)=>({id:'job-'+i,client_id:client.id,job_title:'QA '+i,status:i<4?'paid_out':'cancelled',payment_status:i<4?'paid_out':'unpaid',guard_payout_amount:i===0?10:80,start_date:'2026-10-09',created_at:'2026-10-09'}));
  return { guards:[{id:'guard',user_id:'owner',full_name:'Controlled QA'},{id:'foreign',user_id:'other',full_name:'PRIVATE'}],clients:[client],jobs,
    job_applications:jobs.slice(0,7).map((j,i)=>({id:'application-'+i,job_id:j.id,guard_id:'guard',status:'selected',applied_at:'2026-10-09'})),
    job_assignments:jobs.map((j,i)=>({id:'assignment-'+i,job_id:j.id,guard_id:'guard',status:i<4?'completed':'cancelled',payment_amount:i===0?10:80,assigned_at:'2026-10-09',payout_released:i<4})),
    guard_payouts:jobs.slice(0,4).map((j,i)=>({id:'payout-'+i,job_id:j.id,guard_id:'guard',amount:i===0?10:80,net_amount:i===0?10:80,status:'paid_out',created_at:'2026-10-09',completed_date:'2026-10-09'})),
    reviews:[{id:'hidden',job_id:jobs[0].id,guard_id:'guard',client_id:'client',status:'hidden',review_text:'PRIVATE hidden feedback'}],
  };
}
function database(rows, { failTable, signedOut=false }={}) {
  const calls=[];
  function project(table,row,fields) {
    const out={};
    for(const field of splitFields(fields)) {
      const nested=/^(\w+)(?:!inner)?\s*\(([\s\S]*)\)$/.exec(field);
      if(nested) {
        const [,target,selection]=nested, key=links[table]?.[target];
        if(!key) throw Error('missing relationship '+table+' -> '+target);
        // Validate even an empty relationship, just as PostgREST does.
        const related=(rows[target]||[]).find(value=>value.id===row?.[key]);
        const projected=project(target,related,selection);out[target]=related?projected:null;
      } else {
        const [alias,column=alias]=field.split(':');
        if(field==='*') Object.assign(out,row);
        else { if(!schema[table]?.includes(column)) throw Error('unknown '+table+'.'+column);out[alias]=row?.[column]; }
      }
    }
    return out;
  }
  return { calls,auth:{getUser:async token=>({data:{user:!signedOut&&token==='fixture-token'?{id:'owner'}:null},error:null})},from(table) {
    const call={table,fields:'*',filters:[],order:null,single:false,limit:Infinity};calls.push(call);
    const q={select(fields){call.fields=fields;return q;},eq(key,value){call.filters.push([key,value]);return q;},order(key,{ascending}){call.order=[key,ascending];return q;},limit(n){call.limit=n;return q;},maybeSingle(){call.single=true;return q;},then(resolve,reject){return Promise.resolve().then(()=>{
      if(table===failTable)return{data:null,error:{message:'PRIVATE database details'}};
      try {
        project(table,null,call.fields);
        let data=(rows[table]||[]).filter(row=>call.filters.every(([key,value])=>row[key]===value));
        if(call.order){const [key,asc]=call.order;data=[...data].sort((a,b)=>String(a[key]||'').localeCompare(String(b[key]||''))*(asc?1:-1));}
        data=data.slice(0,call.limit).map(row=>project(table,row,call.fields));
        return{data:call.single?data[0]||null:data,error:null};
      } catch(error){call.error=error.message;return{data:null,error:{message:error.message}};}
    }).then(resolve,reject);}};return q;
  }};
}
function endpoint(db) {
  let handler;
  const code=ts.transpileModule(fs.readFileSync('supabase/functions/get-guard-job-history/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  new Function('require','Deno','exports',code)(name=>name.startsWith('https://')?{createClient:(_url,_key,options)=>{assert.equal(options.db.schema,'app');return db;}}:load(name.replace('../../../','')),{env:{get:()=> 'fixture'},serve:fn=>handler=fn},{});
  return async(token='fixture-token',method='POST')=>{const response=await handler(new Request('https://qa.invalid',{method,headers:token?{authorization:'Bearer '+token}:{}}));return{status:response.status,body:await response.json()};};
}

test('actual guard endpoint reproduces seven selected applications and £250 from schema-validated records',async()=>{
  const rows=fixture(),db=database(rows);const r=await endpoint(db)();
  assert.equal(r.status,200);assert.equal(r.body.guard.id,'guard');assert.equal(r.body.jobs.length,9);
  assert.equal(r.body.stats.total_applied,7);assert.equal(r.body.stats.total_selected,7);assert.equal(r.body.stats.total_accepted,0);
  assert.equal(r.body.stats.total_earned,250);assert.equal(r.body.stats.released_payout,250);assert.equal(r.body.stats.total_paid_out,4);
  assert.equal(r.body.jobs.filter(j=>j.application_id).length,7);assert.equal(r.body.jobs.filter(j=>j.assignment_id).length,9);
  assert.equal(JSON.stringify(r).includes('PRIVATE'),false);
  assert.ok(db.calls.filter(c=>!['guards'].includes(c.table)).every(c=>c.filters.some(([key,value])=>key==='guard_id'&&value==='guard')));
});

test('all failed related reads fail visibly, rather than manufacturing empty counts or earnings',async()=>{
  for(const failTable of ['guards','job_applications','job_assignments','job_completion_requests','disputes','reviews','client_reviews','payment_audit_logs','guard_payouts']) {
    const r=await endpoint(database(fixture(),{failTable}))();assert.equal(r.status,500,failTable);assert.equal(r.body.jobs,undefined);assert.equal(JSON.stringify(r).includes('PRIVATE'),false);
  }
});

test('schema fixture rejects the old nonexistent columns even on empty tables',async()=>{
  const db=database(fixture());
  for(const [table,fields] of [['job_applications','id,proposed_rate'],['guard_payouts','id,paid_at'],['reviews','id,comment,punctuality_rating']]) assert.ok((await db.from(table).select(fields)).error);
});

test('zero net payout remains zero and cancelled assignments never become earned income',async()=>{
  const rows=fixture();rows.guard_payouts[0].amount=999;rows.guard_payouts[0].net_amount=0;
  const r=await endpoint(database(rows))();assert.equal(r.body.stats.total_earned,240);assert.equal(r.body.stats.pending_payout,0);
});

test('missing profiles and unauthenticated callers cannot retrieve another guard history',async()=>{
  for(const token of [null,'invalid'])assert.equal((await endpoint(database(fixture()))(token)).status,401);
  const rows=fixture();rows.guards=rows.guards.filter(g=>g.user_id!=='owner');assert.equal((await endpoint(database(rows))()).status,404);
  assert.equal((await endpoint(database(fixture()))('fixture-token','GET')).status,405);
});
