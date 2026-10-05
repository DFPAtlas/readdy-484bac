const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function logger(logs=[]) {
 const source=fs.readFileSync('supabase/functions/sia-check/index.ts','utf8').split('Deno.serve(')[0].replace(/^import .*;\n/gm,'');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 return new Function('console',compiled+'\nreturn logSiaVerification;')({error:(...args)=>logs.push(args)});
}
const entry={guard_id:'11111111-1111-4111-8111-111111111111',user_id:'22222222-2222-4222-8222-222222222222',sia_licence_number:'1234567890123456',status:'pending',result:'SIA check queued',webhook_configured:false,webhook_response_code:null,error_message:null,checked_at:'2026-10-05T12:00:00Z',checked_by:'self'};

test('queued attempts persist against the real result requirements without inventing verification',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create schema app;create table app.sia_verifications(
   guard_id uuid,user_id uuid not null,sia_licence_number text,
   verification_status varchar default 'pending',verification_method varchar,
   result text,webhook_configured boolean,webhook_response_code integer,error_message text,checked_at timestamptz,checked_by text,
   verified boolean not null,license_status text not null check(license_status in ('valid','expired','revoked','not_found','error')),verified_at timestamptz not null);`);
  const migration=fs.readFileSync('supabase/migrations/20261005145408_repair_sia_attempt_logging.sql','utf8');
  await db.exec(migration);await db.exec(migration);
  const logs=[];
  const client={from(table){assert.equal(table,'sia_verifications');return {async insert(payload){
   assert.equal('status' in payload,false);
   const keys=Object.keys(payload);
   await db.query(`insert into app.sia_verifications (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(payload));
   return {error:null};
  }};}};
  await logger(logs)(client,entry);
  await logger(logs)(client,{...entry,status:'manual_review',result:'queue_error',error_message:'Queue unavailable'});
  const rows=(await db.query('select verification_status,verified,license_status,verified_at,result from app.sia_verifications order by verification_status')).rows;
  assert.deepEqual(rows.map(r=>r.verification_status),['manual_review','pending']);
  for(const row of rows){assert.equal(row.verified,null);assert.equal(row.license_status,null);assert.equal(row.verified_at,null);}
  assert.equal(logs.length,0);
  await assert.rejects(db.query('insert into app.sia_verifications(user_id,verified) values($1,true)',[entry.user_id]));
  // Completed worker/webhook results still use the same valid result fields.
  await db.query('insert into app.sia_verifications(user_id,verified,license_status,verified_at) values($1,true,$2,$3)',[entry.user_id,'valid',entry.checked_at]);
  assert.equal((await db.query("select count(*)::int n from app.sia_verifications where verified=true and license_status='valid'")).rows[0].n,1);
  await assert.rejects(db.query('insert into app.sia_verifications(user_id,verified,license_status,verified_at) values($1,true,$2,$3)',[entry.user_id,'invented',entry.checked_at]));
 } finally {await db.close();}
});
test('Supabase returned errors and thrown failures are reported without interrupting the check',async()=>{
 for(const thrown of [false,true]) {
  const logs=[];
  await logger(logs)({from(){return {insert:async()=>{if(thrown)throw Error('offline');return {error:{code:'23502',message:'Logging unavailable'}};}};}},entry);
  assert.equal(logs.length,1);assert.equal(logs[0][0],'Failed to log sia verification:');
 }
});
