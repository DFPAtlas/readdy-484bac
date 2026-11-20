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
  const schemaFixture = require('./fixtures/account-deletion-schema.json');
  const writes=[], queries=[], audits=new Map(), deleted=new Set();
  const storage=makeStorage(options.objects,options);
  let authGone=!!options.authInitiallyMissing;
  let profileReads=0;
  const profileTable=options.userType==='client'?'clients':'guards';
  function clientFor(schema) {return {
    schema:clientFor,
    storage:storage.storage,
    auth:{
      async getUser(){return {data:{user:options.unauthenticated?null:{id:ADMIN}},error:null}},
      admin:{
        async getUserById(){
          if(options.authLookupError) return {data:{user:null},error:{status:503,message:'unavailable'}};
          if(options.emptyAuth || (authGone && options.emptyAuthAfterDelete)) return {data:{user:null},error:null};
          if(authGone) return {data:{user:null},error:{status:404,code:'user_not_found'}};
          return {data:{user:{id:options.foreignAuth?ADMIN:USER}},error:null};
        },
        async deleteUser(id){
          writes.push({schema:'auth',table:'users',op:'delete',id});
          if(!options.authDeleteError && !options.silentAuthDelete) authGone=true;
          return {error:options.authDeleteError?{message:'auth delete failed'}:null};
        },
      },
    },
    from(table) {
      let op='select',payload,head=false,columns='*';const filters=[];
      const q={
        select(cols,opts){columns=cols;head=opts?.head===true;return q},
        insert(value){op='insert';payload=value;return q},
        update(value){op='update';payload=value;return q},
        delete(){op='delete';return q},
        eq(col,value){filters.push([col,value]);return q},
        maybeSingle(){return q},
        then(resolve,reject){
          let data=null,count=null,error=null;
          const key=`${schema}.${table}`;
          const allowed=schemaFixture[key];
          const checked=[...filters.map(([col])=>col),...columns.split(',').map(c=>c.trim()).filter(c=>c!=='*'),...Object.keys(payload||{})];
          if(!allowed || checked.some(col=>!allowed.includes(col))) {
            return Promise.reject(new Error(`Schema mismatch: ${key}: ${checked.filter(c=>!allowed?.includes(c))}`)).then(resolve,reject);
          }
          queries.push({schema,table,op,columns,filters});
          if(op!=='select') {
            writes.push({schema,table,op,payload,filters});
            if(table==='admin_deletion_audit_log') {
              if(options.auditThrow && op==='update') return Promise.reject(new Error('audit transport failed')).then(resolve,reject);
              if(options.auditError && op==='insert') error={message:'audit unavailable'};
              else if(!(options.auditZero && op==='insert') && !(options.auditUpdateZero && op==='update') && !(options.finalAuditZero && payload.status==='completed')) {
                const id=op==='insert'?payload.id:filters.find(([col])=>col==='id')[1];
                const row={...audits.get(id),...payload};audits.set(id,row);
                data={...row,id:options.auditForeign?ADMIN:id};
              }
            } else if(options.rowDeleteError===table && op==='delete') error={message:'row delete failed'};
            else if(op==='delete' && options.silentDelete!==table) for(const [col,id] of filters) deleted.add(`${key}:${col}:${id}`);
          } else if(head) {
            if(options.countError===table) error={message:'count failed'};
            else if(options.nullCount===table) count=null;
            else if(filters.some(([col,id])=>deleted.has(`${key}:${col}:${id}`))) count=0;
            else if(table==='admin_users') count=filters.some(([col])=>col==='role')?2:options.targetAdmin?1:0;
            else if(table==='users') count=1;
            else if(table===profileTable) count=options.duplicateProfile?2:1;
            else count=options.counts?.[key]||0;
          } else if(table==='admin_users' && filters.some(([col,id])=>col==='user_id' && id===ADMIN)) {
            data={id:'admin',user_id:options.foreignAdmin?USER:ADMIN,is_active:true,role:options.nonAdmin?'support':'super_admin'};
          } else if(table==='admin_users' && options.targetAdmin) {
            data={id:'target-admin',user_id:USER,role:'super_admin'};
          } else if(table===profileTable) {
            profileReads++;
            data={id:ROOT,user_id:USER,email:'test@example.com',...options.profile};
            if(profileReads>1 && options.changedProfile) data={...data,...options.changedProfile};
          } else if(table==='user_entitlements_data' && options.entitlement) {
            data={user_id:USER,...options.entitlement};
          } else if(table==='users') {
            data={id:USER,...options.appUser};
          }
          return Promise.resolve({data,count,error}).then(resolve,reject);
        },
      };return q;
    },
  }}
  let handler;
  const Deno={env:{get:name=>name==='SUPABASE_URL'?'https://project.test':'service-key'}};
  new Function('serve','createClient','Deno','crypto','listAccountStorageFiles','removeAccountStorageFiles','assertAccountStorageReferences',compile('supabase/functions/admin-delete-user/index.ts'))(
    fn=>handler=fn,()=>clientFor('app'),Deno,webcrypto,helper.listAccountStorageFiles,helper.removeAccountStorageFiles,helper.assertAccountStorageReferences);
  const token='header.'+Buffer.from(JSON.stringify({aal:options.aal||'aal2'})).toString('base64url')+'.signature';
  const request=(dry_run=true, overrides={})=>new Request('https://project.test/functions/v1/admin-delete-user',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({user_id:ROOT,user_type:options.userType||'guard',reason:'Requested erasure',dry_run,confirmation:options.userType==='client'?'DELETE CLIENT':'DELETE GUARD',expected_user_id:USER,...overrides})});
  return {handler,request,writes,queries,...storage};
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
  for(const table of ['app.subscriptions','app.guard_payouts','app.job_assignments','app.disputes','app.client_reviews','app.clients']) {
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

test('legacy verification references require review rather than a false purge result',()=>{
  assert.throws(()=>helper.assertAccountStorageReferences({sia_licence_front_url:'other-owner/front.jpg'},[ROOT,USER],'documents'),/ownership review/);
  assert.throws(()=>helper.assertAccountStorageReferences({sia_licence_front_url:'https://external.test/front.jpg'},[ROOT,USER],'documents'),/ownership review/);
  assert.doesNotThrow(()=>helper.assertAccountStorageReferences({sia_licence_front_url:`https://project.test/storage/v1/object/sign/sia-licences/${USER}/sia/front.jpg?token=old`},[ROOT,USER],'documents'));
});

test('identity mismatches, missing bindings and ambiguous Auth reads stop before audit or deletion',async()=>{
  for(const options of [{foreignAdmin:true},{profile:{id:ADMIN}},{profile:{user_id:null}},{profile:{user_id:'bad-id'}},
    {foreignAuth:true},{emptyAuth:true},{authLookupError:true},{duplicateProfile:true},{targetAdmin:true}]) {
    const h=harness(options);const r=await h.handler(h.request(false));
    assert.ok(r.status>=400,JSON.stringify(options));
    assert.equal(h.writes.length,0);assert.equal(h.removed.length,0);
  }
});

test('authentication precedes bounded parsing; invalid, null and oversized bodies do not write',async()=>{
  for(const payload of ['{', 'null', '[]', JSON.stringify({reason:'a'.repeat(8200)})]) {
    const h=harness();const base=h.request(false);
    const r=await h.handler(new Request(base.url,{method:'POST',headers:base.headers,body:payload}));
    assert.equal(r.status,400);assert.equal(h.writes.length,0);
  }
  const h=harness({unauthenticated:true});
  const r=await h.handler(new Request(h.request().url,{method:'POST',body:'invalid JSON'}));
  assert.equal(r.status,401);assert.equal(h.writes.length,0);
});

test('destructive requests require the exact role confirmation before any write',async()=>{
  for(const confirmation of [undefined,'DELETE CLIENT','DELETE GUARD ','delete guard']) {
    const h=harness();const r=await h.handler(h.request(false,{confirmation}));
    assert.equal(r.status,400);assert.equal(h.writes.length,0);
  }
});

test('real deletion must match the Auth identity returned by the reviewed impact check',async()=>{
  const h=harness();const impact=await h.handler(h.request());const body=await impact.json();
  assert.equal(body.target_user_id,USER);
  for(const expected_user_id of [undefined,ADMIN,ROOT]) {
    const before=h.writes.length;const r=await h.handler(h.request(false,{expected_user_id}));
    assert.equal(r.status,409);assert.equal(h.writes.length,before);assert.equal(h.removed.length,0);
  }
});

test('provider and entitlement links block erasure without exposing their identifiers',async()=>{
  for(const options of [{profile:{stripe_account_id:'acct_private'}},{profile:{stripe_customer_id:'cus_private'}},
    {userType:'client',profile:{stripe_subscription_id:'sub_private'}},
    {userType:'client',profile:{payment_method_id:'pm_private'}},
    {profile:{stripe_session_id:'cs_private'}},{entitlement:{stripe_subscription_id:'sub_private'}},
    {appUser:{stripe_customer_id:'cus_private'}},{appUser:{stripe_subscription_id:'sub_private'}}]) {
    const h=harness(options);const r=await h.handler(h.request(false));const text=await r.text();
    assert.equal(r.status,409);assert.equal(JSON.parse(text).retentionReviewRequired,true);
    assert.ok(!text.includes('_private'));assert.ok(!JSON.stringify(h.writes).includes('_private'));
    assert.ok(!h.writes.some(w=>w.op==='delete'));assert.equal(h.removed.length,0);
  }
});

test('booking/support/review evidence is retained for both account roles',async()=>{
  for(const userType of ['guard','client']) for(const table of ['job_invites','job_completion_requests','reviews','client_reviews','support_tickets','client_responses']) {
    const h=harness({userType,counts:{['app.'+table]:1}});const r=await h.handler(h.request(false));
    assert.equal(r.status,409,`${userType}:${table}`);assert.ok(!h.writes.some(w=>w.op==='delete'));
  }
});

test('existing closure and retention-hold workflows cannot be bypassed by admin erasure',async()=>{
  for(const userType of ['guard','client']) {
    const h=harness({userType,counts:{'app.account_closures':1}});
    const r=await h.handler(h.request(false));assert.equal(r.status,409);
    assert.ok(!h.writes.some(w=>w.op==='delete'));assert.equal(h.removed.length,0);
  }
});

test('Auth cascades cannot erase reward ledgers, redemptions, referral anchors or privacy requests',async()=>{
  for(const table of ['privacy_requests','qg_token_ledger','qg_token_redemptions','qg_referral_codes']) {
    const h=harness({counts:{['app.'+table]:1}});const r=await h.handler(h.request(false));
    assert.equal(r.status,409,table);assert.ok(!h.writes.some(w=>w.op==='delete'));assert.equal(h.removed.length,0);
  }
});

test('zero-row and wrong-row audit inserts never permit deletion',async()=>{
  for(const options of [{auditZero:true},{auditForeign:true}]) {
    const h=harness(options);const r=await h.handler(h.request(false));
    assert.equal(r.status,500);assert.ok(!h.writes.some(w=>w.op==='delete'));assert.equal(h.removed.length,0);
  }
});

test('unconfirmed audit progress stops before account deletion and final audit failure cannot report success',async()=>{
  for(const options of [{auditUpdateZero:true},{auditThrow:true},{finalAuditZero:true}]) {
    const h=harness({...options,objects:{'sia-licences':[`${USER}/front.jpg`]}});
    const r=await h.handler(h.request(false));const body=await r.json();
    assert.equal(r.status,409);assert.equal(body.success,false);assert.ok(body.audit_id);
    if(!options.finalAuditZero) assert.ok(!h.writes.some(w=>w.op==='delete'));
  }
});

test('silent database and Auth deletes must confirm absence before reporting completion',async()=>{
  for(const options of [{silentDelete:'notifications',counts:{'app.notifications':1}},{silentDelete:'guards'},
    {silentDelete:'users'},{silentAuthDelete:true},{emptyAuthAfterDelete:true}]) {
    const h=harness(options);const r=await h.handler(h.request(false));const body=await r.json();
    assert.equal(r.status,409,JSON.stringify(options));assert.equal(body.success,false);
    if(options.silentDelete==='notifications') assert.ok(!h.writes.some(w=>w.schema==='auth'));
  }
});

test('changed profile/provider binding stops before file or account deletion',async()=>{
  for(const changedProfile of [{user_id:ADMIN},{stripe_customer_id:'cus_new'}]) {
    const h=harness({changedProfile,objects:{'sia-licences':[`${USER}/front.jpg`]}});
    const r=await h.handler(h.request(false));
    assert.equal(r.status,409);assert.equal(h.removed.length,0);assert.ok(!h.writes.some(w=>w.op==='delete'));
  }
});

test('an explicitly absent Auth account can be cleaned up with matching profile/user filters',async()=>{
  const h=harness({userType:'client',authInitiallyMissing:true});const r=await h.handler(h.request(false));
  assert.equal(r.status,200);assert.equal((await r.json()).auth_action,'already_absent');
  const deletion=h.writes.find(w=>w.schema==='app'&&w.table==='clients'&&w.op==='delete');
  assert.deepEqual(deletion.filters,[['id',ROOT],['user_id',USER]]);
  assert.ok(!h.writes.some(w=>w.schema==='auth'));
});

test('both role branches use only captured production tables/columns and physical entitlements',async()=>{
  for(const userType of ['guard','client']) {
    const h=harness({userType});const r=await h.handler(h.request(false));
    assert.equal(r.status,200);
    assert.ok(h.queries.some(q=>q.table==='user_entitlements_data'&&q.op==='delete'));
    assert.ok(!h.queries.some(q=>q.table==='user_entitlements'));
    assert.ok(h.queries.filter(q=>q.schema==='public').every(q=>q.table==='admin_deletion_audit_log'));
  }
});
