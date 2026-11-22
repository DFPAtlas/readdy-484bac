const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const migration = fs.readFileSync('supabase/migrations/' + fs.readdirSync('supabase/migrations').find(n => n.endsWith('_guard_profile_placement_and_token_checkout.sql')), 'utf8');
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222', request = '33333333-3333-4333-8333-333333333333';
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema app;create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.owner',true),'')::uuid$$;
    grant usage on schema app,auth to anon,authenticated,service_role;
    create table app.guards(id uuid primary key,user_id uuid,is_active boolean,profile_completed boolean,verified_by uuid,verification_status text,sia_verified boolean,sia_licence_number text,sia_expiry_date date,is_test_account boolean);
    create table app.clients(user_id uuid,is_active boolean,company_name text);
    create table app.account_closures(user_id uuid);
    create table app.test_applicants(guard_id uuid,client_user_id uuid);
    create view app.client_applicant_profiles as select guard_id from app.test_applicants where client_user_id=auth.uid();
    create table app.user_entitlements_data(user_id uuid,audience text,is_active boolean,subscription_status text,current_period_end timestamptz,features jsonb);
    create table app.plans(slug text primary key,active boolean,audience text,monthly_price_pence integer);
    create table app.subscriptions(user_id uuid,stripe_subscription_id text,status text);
    create table app.qg_launch_reward_settings(key text primary key,value jsonb);
    create table app.qg_token_ledger(user_id uuid,tokens integer,status text,event_type text,created_at timestamptz default now());
    create table app.qg_token_redemptions(id uuid primary key default gen_random_uuid(),user_id uuid,tokens_used integer,credit_pence integer,status text,stripe_checkout_session_id text,stripe_coupon_id text,plan_slug text,account_type text,created_at timestamptz default now(),confirmed_at timestamptz,cancelled_at timestamptz);
    create function app.guard_has_current_sia(boolean,text,date,date) returns boolean language sql as $$select $1 and $2 is not null and $3 >= $4$$;
    insert into app.guards values('${owner}','${owner}',true,true,'${other}','verified',true,'synthetic',current_date+100,false);
    insert into app.plans values('guard-elite',true,'guard',2900);
    insert into app.qg_launch_reward_settings values('programme_enabled','true'),('token_expiry_months','12'),('token_value_pence_per_100','1000'),('max_redemption_percent_per_invoice','50');
    insert into app.qg_token_ledger values('${owner}',500,'approved','referral_approved',now()),('${owner}',5000,'pending','referral_pending',now()),('${owner}',9000,'approved','profile_bonus',now()-interval '13 months'),('${owner}',-20,'approved','clawback',now());`);
  await db.exec(migration);await db.exec(migration);
  return db;
}
const reserve = (db, id = request, count = 100) => db.query(`select app.reserve_qg_token_checkout($1,$2,'guard-elite','monthly',$3) r`, [owner, id, count]).then(r => r.rows[0].r);

test('actual migration: enabled gate, expiry/clawbacks, invoice cap, reservation replay and no double spend', async () => {
  const db = await setup();try {
    await assert.rejects(() => reserve(db), /unavailable/);
    await db.exec("update app.qg_launch_reward_settings set value='true' where key='token_checkout_enabled'");
    assert.equal((await db.query('select app.qg_available_tokens($1) b', [owner])).rows[0].b, 480);
    await assert.rejects(() => reserve(db, request, 146), /invoice limit/);
    const r = await reserve(db);assert.equal(r.credit_pence, 1000);assert.equal((await reserve(db)).id, r.id);
    await assert.rejects(() => reserve(db, other), /existing token checkout/);
    await assert.rejects(() => reserve(db, request, 90), /request mismatch/);
    assert.equal((await db.query('select app.qg_available_tokens($1) b', [owner])).rows[0].b, 380);
    await db.query("select app.attach_qg_token_checkout($1,$2,'cs_test_1','qgt_one')", [r.id, owner]);
    await assert.rejects(() => db.query("select app.finish_qg_token_checkout($1,$2,'cs_other','qgt_one',1000,true,false)", [r.id, owner]), /mismatch/);
    await db.query("select app.finish_qg_token_checkout($1,$2,'cs_test_1','qgt_one',1000,true,false)", [r.id, owner]);
    await db.query("select app.finish_qg_token_checkout($1,$2,'cs_test_1','qgt_one',1000,true,false)", [r.id, owner]);
    assert.equal((await db.query('select count(*)::integer n from app.qg_token_redemptions')).rows[0].n, 1);
    assert.equal((await db.query('select app.qg_available_tokens($1) b', [owner])).rows[0].b, 380);
    await assert.rejects(() => db.query("select app.finish_qg_token_checkout($1,$2,'cs_test_1','qgt_one',1000,false,true)", [r.id, owner]), /closed/);
  } finally { await db.close(); }
});

test('actual migration: expiry releases reservation once; account ownership and service-only writes enforced', async () => {
  const db = await setup();try {
    await db.exec("update app.qg_launch_reward_settings set value='true' where key='token_checkout_enabled'");
    const r = await reserve(db);
    await db.query("select app.finish_qg_token_checkout($1,$2,'cs_expired','qgt_one',1000,false,true)", [r.id, owner]);
    await db.query("select app.finish_qg_token_checkout($1,$2,'cs_expired','qgt_one',1000,false,true)", [r.id, owner]);
    assert.equal((await db.query('select app.qg_available_tokens($1) b', [owner])).rows[0].b, 480);
    await db.exec(`set role authenticated;select set_config('test.owner','${other}',false)`);
    await assert.rejects(() => db.query('select app.get_qg_token_balance($1)', [owner]), /another account/);
    await assert.rejects(() => reserve(db), /permission denied/);
    await db.exec(`select set_config('test.owner','${owner}',false)`);
    assert.equal((await db.query('select app.get_qg_token_balance($1) b', [owner])).rows[0].b, 480);
  } finally { await db.close(); }
});

test('actual placement migration: current entitled reviewed guards only; expiry and test isolation respected', async () => {
  const db = await setup();try {
    await db.exec(`insert into app.user_entitlements_data values('${owner}','guard',true,'active',now()+interval '1 day','["guard.profile_boost","guard.priority_profile"]');set role anon;`);
    assert.deepEqual((await db.query('select * from app.get_guard_placement($1)', [[owner]])).rows, [{ id: owner, profile_boost: true, priority_profile: true }]);
    await db.exec("reset role;update app.user_entitlements_data set current_period_end=now()-interval '1 day';set role anon;");
    assert.equal((await db.query('select * from app.get_guard_placement($1)', [[owner]])).rows[0].profile_boost, false);
    await db.exec('reset role;update app.guards set verified_by=null;set role anon;');assert.equal((await db.query('select * from app.get_guard_placement($1)', [[owner]])).rows.length, 0);
    await db.exec(`reset role;update app.guards set verified_by='${other}',is_test_account=true;set role anon;`);assert.equal((await db.query('select * from app.get_guard_placement($1)', [[owner]])).rows.length, 0);
    await db.exec(`reset role;insert into app.test_applicants values('${owner}','${other}');set role authenticated;select set_config('test.owner','${other}',false);`);
    assert.equal((await db.query('select * from app.get_guard_placement($1)', [[owner]])).rows.length, 1);
  } finally { await db.close(); }
});


test('FIFO expiry does not charge old spending against new rewards or expire the same credit twice', async () => {
 const db=await setup();try {
  await db.exec(`delete from app.qg_token_ledger;insert into app.qg_token_ledger values('${owner}',100,'approved','profile_bonus',now()-interval '13 months'),('${owner}',500,'approved','referral_approved',now()-interval '1 day'),('${owner}',-100,'approved','expiry',now()-interval '1 month');
    insert into app.qg_token_redemptions(user_id,tokens_used,credit_pence,status,created_at) values('${owner}',100,1000,'confirmed',now()-interval '12 months 15 days');`);
  assert.equal((await db.query('select app.qg_available_tokens($1) b',[owner])).rows[0].b,500);
  await db.exec(`insert into app.qg_token_ledger values('${owner}',-50,'approved','clawback',now());`);
  assert.equal((await db.query('select app.qg_available_tokens($1) b',[owner])).rows[0].b,450);
 }finally{await db.close();}
});
