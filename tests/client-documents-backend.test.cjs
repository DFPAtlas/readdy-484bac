const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
const { webcrypto } = require('node:crypto');
function load(path,mocks={}) { const m={exports:{}}; new Function('module','exports','require','crypto',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m,m.exports,n=>n in mocks?mocks[n]:require(n),webcrypto); return m.exports; }
const rules=load('supabase/functions/_shared/client-document-rules.ts');
const {handleClientDocuments}=load('supabase/functions/manage-client-documents/core.ts',{'../_shared/client-document-rules.ts':rules});
const U='11111111-1111-4111-8111-111111111111',C='22222222-2222-4222-8222-222222222222',I='33333333-3333-4333-8333-333333333333';
const pdf=()=>new File(['%PDF-1.4\nSYNTHETIC TEST CONTENT\n'],'synthetic.pdf',{type:'application/pdf'});
function fixture(options={}) {
 const rows=new Map(),objects=new Map(),calls=[]; let uploads=0;
 const db={calls,rows,objects,closed:false,auth:{async getUser(){return options.authError?{data:{user:null},error:true}:{data:{user:{id:U}},error:null};}},
  from(table){const call={table,filters:[]};calls.push(call);const normal=()=>{
   if(table==='clients')return{data:options.noClient?null:{id:C,user_id:U,is_active:!options.inactive},error:null};
   if(table==='account_closures')return{data:db.closed||options.closed?{id:'closure'}:null,error:null};
   const matching=[...rows.values()].filter(r=>call.filters.every(([k,v])=>r[k]===v));
   if(call.op==='insert'){if(rows.has(call.payload.id))return{data:null,error:{code:'23505'}};const r={created_at:'2026-11-20T10:00:00Z',...call.payload};rows.set(r.id,r);return{data:r,error:null};}
   if(call.op==='delete'){matching.forEach(r=>rows.delete(r.id));return{data:matching[0]?{id:matching[0].id,client_id:matching[0].client_id}:null,error:null};}
   return{data:matching[0]||null,error:null};
  };const q={select(fields){call.fields=fields;return q;},eq(k,v){call.filters.push([k,v]);return q;},maybeSingle(){return q;},insert(payload){call.op='insert';call.payload=payload;return q;},delete(){call.op='delete';return q;},then(a,b){return Promise.resolve().then(()=>options.query?options.query(call,normal,db):normal()).then(a,b);}};return q;},
  storage:{from(bucket){assert.equal(bucket,'client-files');return{
   async upload(path,bytes,opts){calls.push({upload:path,opts});uploads++;const normal=()=>{if(objects.has(path))return{error:{status:409}};objects.set(path,new Blob([bytes],{type:opts.contentType}));return{data:{path},error:null};};return options.upload?options.upload(path,normal,db):normal();},
   async download(path){calls.push({download:path});return options.download?options.download(path,db):objects.has(path)?{data:objects.get(path),error:null}:{data:null,error:{status:404}};},
   async list(folder){calls.push({list:folder});const normal=()=>({data:[...objects.keys()].filter(p=>p.startsWith(folder+'/')).map(p=>({id:'object',name:p.slice(folder.length+1)})),error:null});return options.list?options.list(folder,normal,db):normal();},
   async remove(paths){calls.push({remove:paths});const normal=()=>{paths.forEach(p=>objects.delete(p));return{data:paths.map(name=>({name})),error:null};};return options.remove?options.remove(paths,normal,db):normal();},
  };}},
 };
 async function run(action='upload',patch={}){
  let body;const headers={Authorization:'Bearer synthetic-token'};
  if(action==='upload'){body=new FormData();body.set('action','upload');body.set('id',I);body.set('expected_client_id',C);body.set('document_type','insurance');body.set('description','Synthetic document');body.set('expiry_date','');body.set('file',pdf());for(const[k,v]of Object.entries(patch))body.set(k,v);}
  else{body=JSON.stringify({action,id:I,expected_client_id:C,...patch});headers['Content-Type']='application/json';}
  const response=await handleClientDocuments(new Request('https://example.test/documents',{method:'POST',headers,body}),db);
  return{status:response.status,headers:response.headers,body:response.headers.get('content-type').includes('json')?await response.json():await response.blob()};
 }
 return{db,run,get uploads(){return uploads;}};
}
test('endpoint rejects unauthenticated, inactive, closed and foreign context before files or mutations',async()=>{
 const f=fixture();assert.equal((await handleClientDocuments(new Request('https://example.test'),f.db)).status,405);
 assert.equal((await handleClientDocuments(new Request('https://example.test',{method:'OPTIONS'}),f.db)).status,200);
 assert.equal((await handleClientDocuments(new Request('https://example.test',{method:'POST',body:'{}'}),f.db)).status,401);
 for(const opts of [{authError:true},{noClient:true},{inactive:true},{closed:true}]){const h=fixture(opts);assert.ok([401,403].includes((await h.run()).status));assert.equal(h.uploads,0);assert.equal(h.db.calls.some(c=>c.op),false);}
 assert.equal((await f.run('upload',{expected_client_id:'foreign'})).status,403);assert.equal(f.uploads,0);
});
test('actual endpoint saves real size/type/hash, strips paths from response and returns exact private bytes',async()=>{
 const f=fixture();const saved=await f.run();assert.equal(saved.status,200);assert.equal(saved.body.document.file_size,pdf().size);assert.equal(saved.body.document.mime_type,'application/pdf');assert.equal(saved.body.document.client_id,C);
 assert.doesNotMatch(JSON.stringify(saved.body),/file_url|content_sha256|storage|service|token/);
 const stored=f.db.rows.get(I);assert.equal(stored.file_url,U+'/'+C+'/'+I+'/file.pdf');assert.match(stored.content_sha256,/^[a-f0-9]{64}$/);assert.equal(f.db.calls.find(c=>c.upload).opts.upsert,false);
 const download=await f.run('download');assert.equal(download.status,200);assert.equal(await download.body.text(),await pdf().text());assert.equal(download.headers.get('cache-control'),'no-store');assert.equal(download.headers.get('x-content-type-options'),'nosniff');assert.match(download.headers.get('content-disposition'),/^attachment;/);
});
test('lost upload and committed metadata replies recover under one id without duplicate files or records',async()=>{
 for(const stage of ['upload','insert']){let lose=true;const f=fixture({upload(path,normal){const result=normal();if(stage==='upload'&&lose){lose=false;throw Error('PRIVATE_NETWORK');}return result;},query(c,normal){const result=normal();if(c.op==='insert'&&stage==='insert'&&lose){lose=false;throw Error('PRIVATE_DB');}return result;}});
 assert.equal((await f.run()).status,200);assert.equal((await f.run()).status,200);assert.equal(f.db.rows.size,1);assert.equal(f.db.objects.size,1);assert.equal(f.uploads,1);}
 const f=fixture();await f.run();assert.equal((await f.run('upload',{description:'Different details'})).status,409);assert.equal(f.db.rows.get(I).description,'Synthetic document');assert.equal(f.uploads,1);
});
test('failed metadata keeps recoverable private upload; retry registers it, and mismatching bytes never overwrite',async()=>{
 let fail=true;const f=fixture({query(c,normal){return c.op==='insert'&&fail?{data:null,error:Error('PRIVATE_DATABASE')}:normal();}});
 const error=await f.run();assert.equal(error.status,503);assert.doesNotMatch(JSON.stringify(error.body),/PRIVATE_DATABASE/);assert.equal(f.db.objects.size,1);assert.equal(f.db.rows.size,0);
 fail=false;assert.equal((await f.run()).status,200);assert.equal(f.db.rows.size,1);assert.equal(f.db.objects.size,1);
 const bad=fixture();bad.db.objects.set(U+'/'+C+'/'+I+'/file.pdf',new Blob(['DIFFERENT']));assert.equal((await bad.run()).status,503);assert.equal(await bad.db.objects.values().next().value.text(),'DIFFERENT');assert.equal(bad.db.rows.size,0);
});
test('extension/MIME/header/size/date/type validation runs server-side before uploads',async()=>{
 const files=[new File(['x'],'script.html',{type:'text/html'}),new File(['x'],'fake.pdf',{type:'application/pdf'}),new File(['%PDF-1'],'wrong.pdf',{type:'image/png'}),new File([],'empty.pdf',{type:'application/pdf'}),new File(['x'.repeat(rules.CLIENT_DOCUMENT_MAX_BYTES+1)],'large.pdf',{type:'application/pdf'})];
 for(const file of files){const f=fixture();assert.ok([400,413].includes((await f.run('upload',{file})).status));assert.equal(f.uploads,0);}
 for(const patch of [{document_type:'__proto__'},{expiry_date:'2026-02-30'},{description:'x'.repeat(4001)},{id:'../foreign'}]){const f=fixture();assert.equal((await f.run('upload',patch)).status,400);assert.equal(f.uploads,0);}
 for(const[extension,mime]of Object.entries(rules.DOCUMENT_MIMES))assert.equal(rules.documentFileType('synthetic.'+extension,mime).mime,mime);
});
test('wrong-owner records and arbitrary URLs never select another file; tampering fails integrity checks',async()=>{
 const f=fixture();await f.run();const row=f.db.rows.get(I);row.client_id='foreign';assert.equal((await f.run('download')).status,404);const count=f.db.calls.filter(c=>c.download).length;assert.equal((await f.run('delete')).status,200);assert.equal(f.db.rows.size,1);assert.equal(f.db.calls.filter(c=>c.download).length,count);
 const legacy=fixture();await legacy.run();legacy.db.rows.get(I).file_url='https://evil.example/private';assert.equal((await legacy.run('download')).status,409);assert.equal((await legacy.run('delete')).status,409);
 const changed=fixture();await changed.run();changed.db.objects.set(changed.db.rows.get(I).file_url,new Blob(['tampered']));assert.equal((await changed.run('download')).status,503);
});
test('deletion confirms object absence before removing metadata and supports a lost-reply replay',async()=>{
 const f=fixture();await f.run();assert.equal((await f.run('delete')).body.deleted_id,I);assert.equal(f.db.objects.size,0);assert.equal(f.db.rows.size,0);assert.equal((await f.run('delete')).status,200);
 const removedIndex=f.db.calls.findIndex(c=>c.remove),rowDelete=f.db.calls.findIndex(c=>c.op==='delete');assert.ok(removedIndex<rowDelete);
 for(const mode of ['error','silent','list']){let active=false;const h=fixture({remove(paths,normal){return active?(mode==='error'?{error:Error('PRIVATE_REMOVE')}:{data:[],error:null}):normal();},list(folder,normal){return active&&mode==='list'?{data:null,error:Error('PRIVATE_LIST')}:normal();}});await h.run();active=true;assert.equal((await h.run('delete')).status,503);assert.equal(h.db.rows.size,1);assert.equal(h.db.calls.filter(c=>c.op==='delete').length,0);}
 let fail=true;const retry=fixture({query(c,normal){return c.op==='delete'&&fail?{data:null,error:true}:normal();}});await retry.run();assert.equal((await retry.run('delete')).status,503);assert.equal(retry.db.objects.size,0);assert.equal(retry.db.rows.size,1);fail=false;assert.equal((await retry.run('delete')).status,200);
});
test('closure or verification failures during upload cannot register metadata or return private bytes',async()=>{
 const f=fixture({upload(path,normal,db){const result=normal();db.closed=true;return result;}});assert.equal((await f.run()).status,403);assert.equal(f.db.rows.size,0);
 const dbError=fixture({query(c,normal){return c.table==='account_closures'?{data:null,error:true}:normal();}});assert.equal((await dbError.run()).status,503);assert.equal(dbError.uploads,0);
 const readError=fixture({query(c,normal){return c.table==='client_documents'?{data:null,error:true}:normal();}});assert.equal((await readError.run()).status,503);assert.equal(readError.uploads,0);
});
