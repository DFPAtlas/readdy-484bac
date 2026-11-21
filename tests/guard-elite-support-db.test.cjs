const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const C=randomUUID(),G=randomUUID(),CID=randomUUID(),GID=randomUUID();
test('actual support trigger derives priority from active guard/client entitlements and preserves severity and immutable tier',async t=>{
 const db=new PGlite();
 try {
  await db.exec(fs.readFileSync('tests/fixtures/quickguard-finish-schema.sql','utf8'));
  const role=fs.readFileSync('supabase/migrations/20261120183707_quickguard_profile_role_compatibility.sql','utf8');
  await db.exec(role.slice(0,role.indexOf('create or replace function app.get_my_message_partners')));
  await db.exec(`alter table app.support_tickets add support_tier text default 'standard';
   create table app.user_entitlements_data(user_id uuid,is_active boolean,audience text,features jsonb);
   create function app.qg_client_has_owned_feature(p_user uuid,p_feature text) returns boolean language sql stable security definer set search_path='' as $$
    select app.qg_active_message_role(p_user)='client' and exists(select 1 from app.user_entitlements_data e where e.user_id=p_user and e.is_active is true and e.audience='client' and jsonb_typeof(e.features)='array' and e.features @> jsonb_build_array(p_feature))$$;
   insert into auth.users(id) values('${C}'),('${G}');
   insert into app.clients(id,user_id) values('${CID}','${C}');
   insert into app.guards(id,user_id) values('${GID}','${G}');
   insert into app.user_entitlements_data values('${G}',true,'guard','["guard.priority_support"]'),('${C}',true,'client','["client.priority_support"]');`);
  await db.exec(fs.readFileSync('supabase/migrations/20261121230522_guard_elite_support_routing.sql','utf8'));
  await db.exec('create trigger support_tier before insert or update on app.support_tickets for each row execute function app.set_support_service_tier()');
  const ticket=async(guard=GID,client=null,tier='priority')=>(await db.query("insert into app.support_tickets(id,guard_id,client_id,priority,support_tier) values($1,$2,$3,'urgent',$4) returning id,support_tier,priority",[randomUUID(),guard,client,tier])).rows[0];
  await t.test('Elite guard and priority client receive priority without changing safety severity',async()=>{
   assert.deepEqual((({support_tier,priority})=>({support_tier,priority}))(await ticket()),{support_tier:'priority',priority:'urgent'});
   assert.equal((await ticket(null,CID)).support_tier,'priority');
  });
  await t.test('client requester takes precedence when a related guard is included',async()=>{
   await db.query("update app.user_entitlements_data set features='[]' where user_id=$1",[C]);
   assert.equal((await ticket(GID,CID)).support_tier,'standard');
  });
  await t.test('Basic, inactive, wrong audience, malformed and missing entitlement cannot self-label priority',async()=>{
   for(const patch of ["features='[]'","is_active=false","audience='client'","features='{}'"]){
    await db.query("update app.user_entitlements_data set is_active=true,audience='guard',features='[\"guard.priority_support\"]' where user_id=$1",[G]);
    await db.query('update app.user_entitlements_data set '+patch+' where user_id=$1',[G]);
    assert.equal((await ticket()).support_tier,'standard',patch);
   }
   await db.query('delete from app.user_entitlements_data where user_id=$1',[G]);assert.equal((await ticket()).support_tier,'standard');
   await db.query("insert into app.user_entitlements_data values($1,true,'guard','[\"guard.priority_support\"]')",[G]);
  });
  await t.test('closed/inactive guard cannot receive priority',async()=>{
   await db.query('update app.guards set is_active=false where id=$1',[GID]);assert.equal((await ticket()).support_tier,'standard');
   await db.query('update app.guards set is_active=true where id=$1',[GID]);
   await db.query('insert into app.account_closures(user_id) values($1)',[G]);assert.equal((await ticket()).support_tier,'standard');
   await db.query('delete from app.account_closures where user_id=$1',[G]);
  });
  await t.test('updates cannot promote/demote the stored tier, and application roles cannot execute the internal trigger',async()=>{
   const row=await ticket();await db.query("update app.support_tickets set support_tier='standard',priority='low' where id=$1",[row.id]);
   const saved=(await db.query('select support_tier,priority from app.support_tickets where id=$1',[row.id])).rows[0];assert.deepEqual(saved,{support_tier:'priority',priority:'low'});
   assert.equal((await db.query("select has_function_privilege('authenticated','app.set_support_service_tier()','execute') as allowed")).rows[0].allowed,false);
  });
 } finally {await db.close();}
});
