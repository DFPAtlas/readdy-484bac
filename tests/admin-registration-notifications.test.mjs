import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
const migration = fs.readFileSync('supabase/migrations/20261101110812_admin_registration_notifications.sql', 'utf8');
const user = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
async function setup() {
  const db = new PGlite();
  await db.exec(`create schema app; create role anon; create role authenticated;
    create table app.email_queue(id uuid default gen_random_uuid() primary key, user_id uuid, email_type text, recipient_email text not null, recipient_name text, subject text not null, body_html text not null, status text, priority int, metadata jsonb, dedupe_key text, created_at timestamptz, updated_at timestamptz);
    create table app.guards(id uuid primary key, user_id uuid unique, first_name text, last_name text, full_name text, email text, sia_verified boolean, created_at timestamptz default now());
    create table app.clients(id uuid primary key, user_id uuid unique, contact_name text, email text, created_at timestamptz default now());`);
  // Preserve the real queue's BEFORE INSERT key derivation behavior.
  const phase2 = fs.readFileSync('supabase/migrations/20261006212325_immediate_booking_phase2.sql', 'utf8');
  await db.exec(phase2.slice(phase2.indexOf('CREATE OR REPLACE FUNCTION app.set_email_queue_dedupe_key()'), phase2.indexOf('-- 6b-4.')));
  await db.exec('create trigger dedupe before insert on app.email_queue for each row execute function app.set_email_queue_dedupe_key()');
  await db.exec(migration);
  return db;
}
test('email/social profile inserts queue fixed-recipient notifications; updates and retries do not duplicate', async () => {
  const db = await setup();
  try {
    await db.query('insert into app.guards(id,user_id,full_name,email) values($1,$2,$3,$4)', [id,user,'<img src=x onerror=alert(1)>','guard@example.com']);
    await db.query('insert into app.clients(id,user_id,contact_name,email) values($1,$2,$3,$4)', [id,user,'Client Name','client@example.com']);
    await db.query('update app.guards set full_name=$1 where id=$2', ['Updated',id]);
    const rows = (await db.query('select * from app.email_queue order by dedupe_key')).rows;
    assert.equal(rows.length,2);
    assert.ok(rows.every(r=>r.recipient_email==='martin.s.hewett@outlook.com' && r.status==='pending'));
    const guard = rows.find(r=>r.metadata.account_role==='guard');
    assert.match(guard.body_html,/&lt;img/); assert.doesNotMatch(guard.body_html,/<img/);
    assert.match(guard.body_html,new RegExp(`role=guard&amp;id=${id}`));
    assert.match(guard.body_html,/SIA verified at registration: No/);
    assert.match(rows.find(r=>r.metadata.account_role==='client').body_html,/Client Name/);
    await db.exec("update app.email_queue set status='sent'");
    await db.query('delete from app.guards where id=$1',[id]);
    await db.query('insert into app.guards(id,user_id,email) values($1,$2,$3)', [id,user,'guard@example.com']);
    assert.equal((await db.query('select * from app.email_queue')).rows.length,2);
    const privilege = (await db.query("select has_function_privilege('authenticated','app.queue_admin_registration_email()','execute') allowed")).rows[0];
    assert.equal(privilege.allowed,false);
  } finally { await db.close(); }
});
test('rolled-back registration leaves no notification and installing migration does not backfill', async()=>{
  const db=await setup();
  try {
    await db.exec('begin');
    await db.query('insert into app.clients(id,user_id,email) values($1,$2,$3)',[id,user,'client@example.com']);
    await db.exec('rollback');
    assert.equal((await db.query('select * from app.email_queue')).rows.length,0);
    await db.query('insert into app.clients(id,user_id,email) values($1,$2,$3)',[id,user,'client@example.com']);
    await db.exec('delete from app.email_queue');
    await db.exec(migration);
    assert.equal((await db.query('select * from app.email_queue')).rows.length,0);
  } finally { await db.close(); }
});
function loadLinks() {
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('lib/admin-application-link.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('module','exports',code)(mod,mod.exports); return mod.exports;
}
test('review return path survives login/MFA and rejects external, unrelated, or malformed destinations',()=>{
 const links=loadLinks(); const values=new Map();
 global.window={location:{pathname:'/admin/accounts',search:`?role=guard&id=${id}`}};
 global.sessionStorage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k),removeItem:k=>values.delete(k)};
 try {
  links.rememberApplicationLink();
  window.location.pathname='/admin/mfa';
  assert.equal(links.takeApplicationReturnPath(),`/admin/accounts?role=guard&id=${id}`);
  assert.equal(links.takeApplicationReturnPath(),'/admin/dashboard');
  for(const path of ['https://evil.example','//evil.example','/admin/dashboard','/admin/accounts?role=admin&id='+id,'/admin/accounts?role=guard&id=invalid','/admin/accounts?role=guard&id='+id+'&next=https://evil.example']) {
   const parsed=links.parseApplicationLink(path);
   if(path.includes('&next=')) assert.deepEqual(parsed,{role:'guard',id}); else assert.equal(parsed,null);
  }
 } finally {delete global.window;delete global.sessionStorage;}
});

test('worker sends stable provider idempotency key and retries unconfirmed delivery', async()=>{
 let handler; const requests=[]; const calls=[]; let accepted=false;
 const email={id, email_type:'admin_registration',recipient_email:'martin.s.hewett@outlook.com',subject:'New guard application',body_html:'<p>Review</p>',metadata:{}};
 const supabase={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='claim_email_queue'?[email]:true,error:null}},from:()=>({insert:async()=>({error:null})})};
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('supabase/functions/process-email-queue/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 new Function('module','exports','require','Deno','fetch',code)(mod,mod.exports,
   name=>name.includes('/http/server.ts')?{serve:fn=>handler=fn}:{createClient:()=>supabase},
   {env:{get:key=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service',RESEND_API_KEY:'test-resend'})[key]}},
   async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify(accepted?{id:'provider-id'}:{}),{status:200})});
 const request=()=>new Request('https://worker.test',{method:'POST',headers:{Authorization:'Bearer test-service'}});
 await handler(request());
 assert.equal(calls.some(c=>c.name==='complete_email_queue'),false);
 assert.equal(calls.some(c=>c.name==='fail_email_queue'),true);
 accepted=true; calls.length=0;
 await handler(request());
 assert.equal(calls.some(c=>c.name==='complete_email_queue'),true);
 assert.equal(requests.length,2);
 assert.ok(requests.every(r=>r.options.headers['Idempotency-Key']===`admin-registration:${id}`));
 const before=requests.length;
 const unauthorized=await handler(new Request('https://worker.test',{method:'POST'}));
 assert.equal(unauthorized.status,401);assert.equal(requests.length,before);
});
