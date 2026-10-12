const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
const ROOT = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';
function compile(path) {
  return ts.transpileModule(fs.readFileSync(path, 'utf8').replace(/^import .*;\n/gm, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
}
const helper = {};
new Function('exports',compile('supabase/functions/admin-delete-user/storage-cleanup.ts'))(helper);
function makeStorage(objects = {}, { listError, removeError, keepFiles = false } = {}) {
  const removed = []; const listed = [];
  const store = new Map(Object.entries(objects).map(([bucket, paths]) => [bucket,new Set(paths)]));
  return { removed, listed, storage: {from(bucket){return {
    async list(folder, options) {
      listed.push({bucket,folder,options});
      if(listError) return {data:null,error:{message:listError}};
      const items=new Map();
      for(const path of store.get(bucket)||[]) {
        if(!path.startsWith(folder+'/')) continue;
        const part=path.slice(folder.length+1), slash=part.indexOf('/');
        const name=slash<0?part:part.slice(0,slash);
        items.set(name,{name,id:slash<0?'file-'+path:null});
      }
      return {data:[...items.values()].sort((a,b)=>a.name.localeCompare(b.name)).slice(options.offset,options.offset+options.limit),error:null};
    },
    async remove(paths) {
      removed.push({bucket,paths});
      if(removeError) return {data:null,error:{message:removeError}};
      if(!keepFiles) for(const path of paths) store.get(bucket)?.delete(path);
      return {data:paths.map(name=>({name})),error:null};
    },
  }}}};
}
function harness(options={}) {
  const writes=[];
  const storage=makeStorage(options.objects,options);
  function clientFor(schema) {return {
    schema:clientFor,
    storage:storage.storage,
    auth:{
      async getUser(){return {data:{user:options.unauthenticated?null:{id:ADMIN}},error:null}},
      admin:{
        async getUserById(){return {data:{user:{id:USER}},error:null}},
        async deleteUser(id){writes.push({schema:'auth',table:'users',op:'delete',id});return {error:options.authDeleteError?{message:'auth delete failed'}:null}},
      },
    },
    from(table) {
      let op='select',payload,head=false;const filters=[];
      const q={
        select(_cols,opts){head=opts?.head===true;return q},
        insert(value){op='insert';payload=value;return q},
        update(value){op='update';payload=value;return q},
        delete(){op='delete';return q},
        eq(col,value){filters.push([col,value]);return q},
        maybeSingle(){return q},
        then(resolve,reject){
          let data=null,count=null,error=null;
          if(op!=='select') {
            writes.push({schema,table,op,payload,filters});
            if(options.auditError && table==='admin_deletion_audit_log' && op==='insert') error={message:'audit unavailable'};
            if(options.rowDeleteError===table && op==='delete') error={message:'row delete failed'};
          } else if(head) {
            if(options.countError===table) error={message:'count failed'};
            else count = table==='admin_users'?2: table==='users'?1: options.counts?.[`${schema}.${table}`] || 0;
          } else if(table==='admin_users' && filters.some(([col,id])=>col==='user_id' && id===ADMIN)) {
            data={id:'admin',user_id:ADMIN,is_active:true,role:options.nonAdmin?'support':'super_admin'};
          } else if(table=== (options.userType==='client'?'clients':'guards')) {
            data={id:ROOT,user_id:USER,email:'test@example.com'};
          }
          return Promise.resolve({data,count,error}).then(resolve,reject);
        },
      };return q;
    },
  }}
  let handler;
  const Deno={env:{get:name=>name==='SUPABASE_URL'?'https://project.test':'service-key'}};
  new Function('serve','createClient','Deno','crypto','listAccountStorageFiles','removeAccountStorageFiles',compile('supabase/functions/admin-delete-user/index.ts'))(
    fn=>handler=fn,()=>clientFor('app'),Deno,webcrypto,helper.listAccountStorageFiles,helper.removeAccountStorageFiles);
  const token='header.'+Buffer.from(JSON.stringify({aal:options.aal||'aal2'})).toString('base64url')+'.signature';
  const request=(dry_run=true, overrides={})=>new Request('https://project.test/functions/v1/admin-delete-user',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({user_id:ROOT,user_type:options.userType||'guard',reason:'Requested erasure',dry_run,...overrides})});
  return {handler,request,writes,...storage};
}

test('inventory finds nested uploads and all pages, deduplicates account roots',async()=>{
  const paths=Array.from({length:1001},(_,i)=>`${ROOT}/file-${i}.jpg`);
  paths.push(`${ROOT}/sia/front.jpg`,`${ROOT}/profile/avatar.png`,`${USER}/back.jpg`);
  const h=makeStorage({'sia-licences':paths});
  const files=await helper.listAccountStorageFiles(h,['sia-licences'],[ROOT,ROOT,USER]);
  assert.equal(files.length,1004);
  assert.ok(files.includes(`sia-licences/${ROOT}/sia/front.jpg`));
  assert.ok(h.listed.some(call=>call.options.offset===1000));
  const progress=[];
  await helper.removeAccountStorageFiles(h,files,async files=>progress.push(files.length));
  assert.deepEqual(progress,[1000,1004]);
  assert.equal((await helper.listAccountStorageFiles(h,['sia-licences'],[ROOT,USER])).length,0);
});
test('inventory fails closed on list failures and refuses root scans',async()=>{
  await assert.rejects(()=>helper.listAccountStorageFiles(makeStorage({}, {listError:'offline'}),['sia-licences'],[ROOT]),/Cannot list/);
  for(const root of ['', '../other', 'not-an-account']) await assert.rejects(()=>helper.listAccountStorageFiles(makeStorage(),['sia-licences'],[root]),/verified account/);
});
test('unauthenticated and non-MFA/non-admin callers cannot mutate anything',async()=>{
  for(const options of [{unauthenticated:true},{aal:'aal1'},{nonAdmin:true}]) {
    const h=harness(options);const response=await h.handler(h.request(false));
    assert.ok([401,403].includes(response.status));assert.equal(h.writes.length,0);assert.equal(h.removed.length,0);
  }
});
test('dry run writes the real public audit and does not delete records or files',async()=>{
  const h=harness({objects:{'sia-licences':[`${ROOT}/sia/front.jpg`]}});
  const r=await h.handler(h.request());const body=await r.json();
  assert.equal(r.status,200);assert.equal(body.summary.totalFiles,1);
  assert.ok(h.writes.some(w=>w.schema==='public'&&w.table==='admin_deletion_audit_log'&&w.op==='insert'&&w.payload.status==='dry_run'));
  assert.ok(!h.writes.some(w=>w.op==='delete'));assert.equal(h.removed.length,0);
});
test('client dry run uses actual client columns rather than nonexistent child columns',async()=>{
  const h=harness({userType:'client'});const r=await h.handler(h.request());
  assert.equal(r.status,200);
});
test('missing explicit dry_run cannot trigger a destructive request',async()=>{
  const h=harness();const r=await h.handler(h.request(true,{dry_run:undefined}));assert.equal(r.status,400);assert.equal(h.writes.length,0);
});
test('count/list/audit failures abort before destructive actions',async()=>{
  for(const options of [{countError:'transactions'},{listError:'offline'},{auditError:true}]) {
    const h=harness(options);const r=await h.handler(h.request(false));
    assert.equal(r.status,500);assert.ok(!h.writes.some(w=>w.op==='delete'));assert.equal(h.removed.length,0);
  }
});
test('financial, booking, dispute and linked-role evidence blocks erasure without modifications',async()=>{
  for(const table of ['app.subscriptions','app.guard_payouts','app.job_assignments','app.disputes','public.payment_fee_breakdowns','app.clients']) {
    const h=harness({counts:{[table]:1}});const r=await h.handler(h.request(false));
    assert.equal(r.status,409,table);assert.equal((await r.json()).success??false,false);
    assert.ok(!h.writes.some(w=>w.op==='delete'));assert.equal(h.removed.length,0);
    assert.ok(!h.writes.some(w=>['transactions','subscriptions','guard_payouts'].includes(w.table)&&w.op==='update'));
  }
});
test('successful deletion verifies nested storage removal and finalises the audit',async()=>{
  const h=harness({objects:{'sia-licences':[`${USER}/sia/front.jpg`],'guard-profiles':[`${USER}/profile/avatar.jpg`]}});
  const r=await h.handler(h.request(false));const body=await r.json();
  assert.equal(r.status,200);assert.equal(body.success,true);assert.equal(body.status,'completed');
  assert.equal(body.deleted_files.length,2);
  assert.ok(h.writes.some(w=>w.schema==='public'&&w.payload?.status==='completed'));
  assert.ok(h.writes.some(w=>w.schema==='auth'&&w.op==='delete'));
});
test('storage failures or remaining files preserve profile/Auth and report incomplete',async()=>{
  for(const options of [{removeError:'offline'},{keepFiles:true}]) {
    const h=harness({...options,objects:{'sia-licences':[`${ROOT}/sia/front.jpg`]}});
    const r=await h.handler(h.request(false));const body=await r.json();
    assert.equal(r.status,409);assert.equal(body.success,false);assert.equal(body.status,'partial');
    assert.ok(!h.writes.some(w=>w.op==='delete'));
  }
});
test('row deletion and Auth API returned errors cannot report completion',async()=>{
  for(const options of [{rowDeleteError:'notifications'},{authDeleteError:true},{rowDeleteError:'guards'}]) {
    const h=harness(options);const r=await h.handler(h.request(false));const body=await r.json();
    assert.equal(r.status,409);assert.equal(body.success,false);assert.ok(body.failed_items.length);
  }
});
