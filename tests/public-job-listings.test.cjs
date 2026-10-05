const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const migration=fs.readFileSync('supabase/migrations/20261005103038_public_job_listings.sql','utf8');

test('anonymous advertisements exclude private states and contacts without granting table access',async()=>{
 const db=new PGlite();
 try {
  const cols=migration.match(/RETURNS TABLE \(([\s\S]*?)\)\nLANGUAGE/)[1].replace(/, clients jsonb/, '');
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema app;
   grant usage on schema app to anon,authenticated;
   create table app.jobs(${cols},client_id uuid,venue_address_line1 text,contact_email text,payment_status text);
   create table app.clients(id uuid,company_name text,client_promo_tier text,founding_client_badge boolean,email text,phone text);
   alter table app.jobs enable row level security;alter table app.clients enable row level security;
   insert into app.clients values('11111111-1111-4111-8111-111111111111','Public Company','founding',true,'private@example.invalid','PRIVATE PHONE');
   insert into app.jobs(id,client_id,job_title,status,is_deleted,venue_postcode,venue_address_line1,contact_email,payment_status) values
   ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Public advert','open',false,'SW1A 1AA','PRIVATE ADDRESS','private@example.invalid','PRIVATE PAYMENT'),
   ('33333333-3333-4333-8333-333333333333',null,'Draft','draft',false,null,null,null,null),
   ('44444444-4444-4444-8444-444444444444',null,'Deleted','open',true,null,null,null,null),
   ('55555555-5555-4555-8555-555555555555',null,'Cancelled','cancelled',false,null,null,null,null),
   ('66666666-6666-4666-8666-666666666666',null,'Funded booking','confirmed',false,null,null,null,null);`);
  await db.exec(migration);
  await db.exec('set role anon');
  const result=await db.query('select * from app.get_public_jobs()');
  assert.equal(result.rows.length,1);
  const job=result.rows[0];assert.equal(job.job_title,'Public advert');assert.equal(job.venue_postcode,'SW1A');
  assert.equal(job.clients.company_name,'Public Company');
  assert.doesNotMatch(JSON.stringify(result.rows),/PRIVATE|private@example|client_id|contact_email|venue_address_line1|payment_status/);
  assert.equal((await db.query("select * from app.get_public_jobs() where id='33333333-3333-4333-8333-333333333333'")).rows.length,0);
  await assert.rejects(db.query('select * from app.jobs'),/permission denied/);
  await assert.rejects(db.query('select * from app.clients'),/permission denied/);
  await db.exec('reset role');
  assert.equal((await db.query("select prosecdef,proconfig from pg_proc where proname='get_public_jobs'")).rows[0].prosecdef,true);
 } finally {await db.close();}
});

test('public list, detail, similar jobs and discovery use the restricted query',()=>{
 for(const file of ['app/jobs/JobsClient.tsx','app/jobs/[id]/JobDetailClient.tsx','app/jobs/[id]/SimilarJobs.tsx','app/jobs/[id]/page.tsx','app/sitemap.ts']) {
  const code=fs.readFileSync(file,'utf8');assert.match(code,/rpc\(['"]get_public_jobs['"]\)/);assert.doesNotMatch(code,/from\(['"]jobs['"]\)/);
 }
 const detail=fs.readFileSync('app/jobs/[id]/JobDetailClient.tsx','utf8');
 assert.match(detail,/Job could not be loaded/);assert.doesNotMatch(detail,/venue_address_line1|venue_address_line2/);
 assert.match(fs.readFileSync('app/jobs/JobsClient.tsx','utf8'),/Jobs could not be loaded/);
});
