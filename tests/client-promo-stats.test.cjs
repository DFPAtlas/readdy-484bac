const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const migration=fs.readFileSync('supabase/migrations/20261005150402_expose_client_promo_stats_in_app.sql','utf8');
test('app promo RPC preserves aggregate calculations without exposing config or private client rows',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create schema app;create role anon;create role authenticated;create role service_role;
   grant usage on schema app to anon,authenticated,service_role;
   create table app.clients(id integer,client_promo_tier text,email text);
   insert into app.clients values(1,'founding_client','private@example.test'),(2,'launch_client','another@example.test');
   create function public.get_client_promo_stats() returns jsonb language sql security definer as $$
    select jsonb_build_object('counts',jsonb_build_object('founding',(select count(*) from app.clients where client_promo_tier='founding_client'),'early',0,'launch',(select count(*) from app.clients where client_promo_tier='launch_client')),
     'caps',jsonb_build_object('tier1',50,'tier2',250,'tier3',1000),'tier3_window_end','2026-08-06','config',jsonb_build_object('internal_setting','hidden'))$$;
   revoke all on function public.get_client_promo_stats() from public,anon,authenticated;`);
  await db.exec(migration);await db.exec(migration);
  await db.exec('set role authenticated');
  const stats=(await db.query('select app.get_client_promo_stats() stats')).rows[0].stats;
  assert.deepEqual(stats,{counts:{founding:1,early:0,launch:1},caps:{tier1:50,tier2:250,tier3:1000},tier3_window_end:'2026-08-06'});
  await assert.rejects(db.query('select * from app.clients'));
  await assert.rejects(db.query('select public.get_client_promo_stats()'));
  await db.exec('reset role;set role anon');
  await assert.rejects(db.query('select app.get_client_promo_stats()'));
  await db.exec('reset role;set role service_role');
  assert.deepEqual((await db.query('select app.get_client_promo_stats() stats')).rows[0].stats,stats);
 } finally {await db.close();}
});
