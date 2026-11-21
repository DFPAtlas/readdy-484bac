const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const sql=fs.readFileSync('supabase/migrations/20261121115426_enable_message_realtime.sql','utf8');
test('message publication repair preserves owner SELECT policy and is safe to replay',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create schema app;create role authenticated;create table app.messages(id uuid primary key,receiver_id uuid,read boolean);alter table app.messages enable row level security;grant select on app.messages to authenticated;create policy message_owner on app.messages for select to authenticated using(receiver_id=current_setting('test.user_id')::uuid);create publication supabase_realtime;create table app.notifications(id uuid);alter publication supabase_realtime add table app.notifications;");
  const snapshot=async()=>({policies:(await db.query("select policyname,roles,cmd,qual,with_check from pg_policies where schemaname='app' and tablename='messages'")).rows,flags:(await db.query("select relrowsecurity,relreplident,relacl from pg_class where oid='app.messages'::regclass")).rows});
  const before=await snapshot();
  await db.exec(sql);await db.exec(sql);
  assert.deepEqual((await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='app' order by tablename")).rows,[{tablename:'messages'},{tablename:'notifications'}]);
  assert.deepEqual(await snapshot(),before);
 }finally{await db.close();}
});
test('missing realtime publication fails clearly without creating a replacement',async()=>{
 const db=new PGlite();
 try{await db.exec('create schema app;create table app.messages(id uuid primary key);');await assert.rejects(db.exec(sql),/supabase_realtime publication is required/);assert.equal((await db.query("select count(*)::int n from pg_publication where pubname='supabase_realtime'")).rows[0].n,0);}
 finally{await db.close();}
});
