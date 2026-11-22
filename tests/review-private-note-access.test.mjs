import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=fs.readFileSync('supabase/migrations/20261122015948_protect_review_private_notes.sql','utf8');
async function setup(){
 const db=new PGlite();
 await db.exec(`create schema app;create role anon;create role authenticated;create role service_role bypassrls;
 create table app.reviews(id uuid primary key,job_id uuid,guard_id uuid,client_id uuid,rating integer,review_text text,created_at timestamptz,status text,punctuality integer,professionalism integer,communication integer,appearance integer,reliability integer,private_note text,would_hire_again boolean,attendance_status text,issue_reported boolean,issue_category text,issue_description text,review_status text,site_instructions_followed boolean,assignment_id uuid);
 alter table app.reviews enable row level security;
 create policy owned_reviews on app.reviews for select to authenticated using(guard_id::text=current_setting('request.jwt.claim.sub',true) or client_id::text=current_setting('request.jwt.claim.sub',true));
 create view public.reviews with(security_invoker=true) as select id,job_id,guard_id,client_id,rating,review_text,created_at,status,punctuality,professionalism,communication,appearance,reliability,private_note,would_hire_again,attendance_status,issue_reported,issue_category,issue_description,review_status,site_instructions_followed from app.reviews;
 grant usage on schema app to anon,authenticated,service_role;
 grant select on app.reviews,public.reviews to anon,authenticated,service_role;
 grant select(private_note) on app.reviews,public.reviews to authenticated;
 insert into app.reviews(id,guard_id,client_id,rating,review_text,private_note,status) values
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',5,'Public QA review','Private QA note','published');
 `);
 return db;
}
test('repair blocks both direct and wildcard private-note reads on the table and compatibility view',async()=>{
 const db=await setup();
 try{
  await db.exec("set role authenticated;set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222'");
  assert.equal((await db.query('select private_note from app.reviews')).rows[0].private_note,'Private QA note');
  await db.exec('reset role');await db.exec(migration);await db.exec('set role authenticated');
  for(const relation of ['app.reviews','public.reviews']){
   if(relation==='app.reviews'){for(const projection of ['private_note','*'])await assert.rejects(db.query('select '+projection+' from '+relation),e=>e.code==='42501');}
   else {assert.equal((await db.query('select * from public.reviews')).rows[0].private_note,null);}
   assert.equal((await db.query('select id,rating,review_text,status from '+relation)).rows[0].review_text,'Public QA review');
  }
 }finally{await db.close();}
});
test('existing owner isolation, count queries and trusted backend private-note handling remain intact',async()=>{
 const db=await setup();
 try{
  const policies=(await db.query("select * from pg_policies where tablename='reviews'")).rows;
  await db.exec(migration);
  assert.deepEqual((await db.query("select * from pg_policies where tablename='reviews'")).rows,policies);
  assert.deepEqual((await db.query("select reloptions from pg_class where oid='public.reviews'::regclass")).rows[0].reloptions,['security_invoker=true']);
  await db.exec("set role authenticated;set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333'");
  assert.equal((await db.query('select count(id)::int n from app.reviews')).rows[0].n,1);
  await assert.rejects(db.query('select private_note from app.reviews'),e=>e.code==='42501');
  await db.exec("set request.jwt.claim.sub='44444444-4444-4444-8444-444444444444'");
  assert.equal((await db.query('select id from app.reviews')).rows.length,0);
  await db.exec('reset role;set role anon');
  assert.equal((await db.query('select id from app.reviews')).rows.length,0);
  await db.exec('reset role;set role service_role');
  assert.equal((await db.query('select private_note from app.reviews')).rows[0].private_note,'Private QA note');
 }finally{await db.close();}
});

