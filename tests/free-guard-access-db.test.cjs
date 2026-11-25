const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const U='11111111-1111-4111-8111-111111111111', G='22222222-2222-4222-8222-222222222222', J='33333333-3333-4333-8333-333333333333', I='44444444-4444-4444-8444-444444444444', OTHER='55555555-5555-4555-8555-555555555555';
const migration=fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_free_guard_application_access.sql')),'utf8');

test('free access final migration enforces eligibility and security in PostgreSQL without changing billing',async t=>{
  const db=new PGlite();
  try {
    await db.exec(`create schema app;create schema auth;create role anon;create role authenticated;create role service_role;
      grant usage on schema app,auth to anon,authenticated,service_role;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create table app.guards(id uuid primary key,user_id uuid unique,is_active boolean default true,verified_by uuid,verification_status text default 'approved',sia_expiry_date date default current_date+365,sia_verified boolean default true,sia_licence_number text default 'SYNTHETIC',licence_types text[] default array['Door Supervisor'],profile_completed boolean default true,is_test_account boolean default false);
      create table app.jobs(id uuid primary key default gen_random_uuid(),status text default 'open',is_deleted boolean default false,start_date date default current_date+10,sia_licence_required boolean default true,required_licence_types text[] default array['Door Supervisor'],job_access_level text default 'elite');
      create table app.job_invites(id uuid primary key,guard_id uuid,job_id uuid,status text,responded_at timestamptz);
      create table app.job_applications(id uuid primary key default gen_random_uuid(),job_id uuid,guard_id uuid,status text,cover_message text,cover_letter text,applied_at timestamptz,unique(job_id,guard_id));
      create table app.user_entitlements(user_id uuid,plan_slug text,subscription_status text,current_period_end timestamptz,stripe_subscription_id text);
      create table app.usage(count integer);insert into app.usage values(50);
      create table app.client_applicant_profiles(guard_id uuid);
      create function app.guard_has_current_sia(boolean,text,date,date) returns boolean language sql as $$select coalesce($1 and nullif($2,'') is not null and $3 >= $4,false)$$;
      create function app.check_monthly_usage(uuid,text,boolean) returns jsonb language plpgsql as $$begin if $3 then update app.usage set count=count+1;end if;return '{"allowed":false,"reason":"limit_reached","limit":2,"used":2,"remaining":0}'::jsonb;end$$;
      insert into app.guards(id,user_id,verified_by) values('${G}','${U}','${OTHER}');
      insert into app.jobs(id) values('${J}');
      insert into app.job_invites values('${I}','${G}','${J}','pending',null);
      select set_config('test.uid','${U}',false);`);
    await db.exec(migration);
    const expiry=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_guard_application_expiry.sql'));
    await db.exec(fs.readFileSync('supabase/migrations/'+expiry,'utf8'));
    const result=async(sql,args=[]) => (await db.query(sql,args)).rows[0];
    const submit=(job=J,invite=null,actor=U)=>result('select app.submit_job_application($1,$2,$3,$4,$5,false) as r',[actor,G,job,'Synthetic QA',invite]);
    const usage=()=>result("select app.get_my_feature_usage('guard_application') r");
    const reset=async()=>db.exec(`delete from app.job_applications;update app.job_invites set status='pending',responded_at=null;update app.guards set is_active=true,profile_completed=true,is_test_account=false,verified_by='${OTHER}',verification_status='approved',sia_verified=true,sia_licence_number='SYNTHETIC',sia_expiry_date=current_date+365,licence_types=array['Door Supervisor'];update app.jobs set status='open',is_deleted=false,start_date=current_date+10;`);

    await t.test('no entitlement, exhausted historical quota and highest paid job tier still allow free applications',async()=>{
      assert.equal((await usage()).r.allowed,true);
      for(let i=0;i<12;i++){
        const {id}=await result('insert into app.jobs default values returning id');
        assert.ok((await submit(id)).r.applicationId);
      }
      const u=(await usage()).r;assert.equal(u.used,12);assert.equal(u.limit,null);assert.equal(u.remaining,null);assert.equal(u.reason,'free_access');
      assert.equal((await result('select count from app.usage')).count,50);
    });
    await t.test('free, current paid, cancelled and expired entitlements have identical core access; records remain intact',async()=>{
      for(const [plan,status,days] of [['guard_starter','active',30],['guard-elite','active',30],['guard-pro','cancelled',-30],['guard-basic','past_due',-1]]){
        await reset();await db.exec('delete from app.user_entitlements');
        await db.query('insert into app.user_entitlements values($1,$2,$3,now()+make_interval(days=>$4),$5)',[U,plan,status,days,'sub_synthetic_history']);
        const before=(await db.query('select * from app.user_entitlements')).rows;
        assert.ok((await submit()).r.applicationId);assert.equal((await usage()).r.limit,null);
        assert.deepEqual((await db.query('select * from app.user_entitlements')).rows,before);
      }
      assert.equal((await result('select count from app.usage')).count,50);
    });
    await t.test('client job posting response is unchanged; reads are scoped to the session and anonymous calls are denied',async()=>{
      assert.deepEqual((await result("select app.get_my_feature_usage('client_job_post') r")).r,{allowed:false,reason:'limit_reached',limit:2,used:2,remaining:0});
      await db.query("select set_config('test.uid',$1,false)",[OTHER]);
      assert.equal((await usage()).r.used,0);assert.equal((await usage()).r.allowed,false);
      await db.exec("select set_config('test.uid','',false)");await assert.rejects(usage(),/not_authenticated/);
      await db.query("select set_config('test.uid',$1,false)",[U]);
      await assert.rejects(result('select app.get_my_feature_usage(null)'),/invalid_feature_key/);
      await db.exec('set role anon');await assert.rejects(usage(),/permission denied/);await db.exec('reset role');
      await db.exec('set role authenticated');await assert.rejects(submit(),/permission denied/);await db.exec('reset role');
      const acl=await result("select has_function_privilege('service_role','app.submit_job_application(uuid,uuid,uuid,text,uuid,boolean)','execute') service,has_function_privilege('authenticated','app.submit_job_application(uuid,uuid,uuid,text,uuid,boolean)','execute') browser");assert.deepEqual(acl,{service:true,browser:false});
    });
    await t.test('ownership, inactive accounts, recorded approval, SIA, licence, closed/deleted/expired jobs remain enforced',async()=>{
      const cases=[
        ["update app.guards set is_active=false",/guard_inactive/],
        ["update app.guards set verified_by=null",/guard_not_verified/],
        ["update app.guards set verification_status='pending'",/guard_not_verified/],
        ["update app.guards set sia_expiry_date=current_date-1",/sia_expired/],
        ["update app.guards set sia_verified=false",/sia_required/],
        ["update app.guards set sia_licence_number=null",/sia_required/],
        ["update app.guards set sia_expiry_date=null",/sia_required/],
        ["update app.guards set licence_types=array['CCTV Operator']",/licence_mismatch/],
        ["update app.jobs set status='closed'",/job_closed/],
        ["update app.jobs set is_deleted=true",/job_removed/],
        ["update app.jobs set start_date=current_date-1",/job_expired/],
        ["update app.jobs set start_date=null",/job_expired/],
      ];
      for(const [sql,error] of cases){
        await reset();await db.exec(sql);await assert.rejects(submit(J,I),error);
        assert.equal((await result('select count(*)::int n from app.job_applications')).n,0);
        assert.equal((await result('select status from app.job_invites')).status,'pending');
      }
      await reset();await assert.rejects(submit(J,null,OTHER),/forbidden/);
      assert.equal((await result('select count from app.usage')).count,50);
    });
    await t.test('failed insert leaves invite retryable; duplicate and accepted invitation replay insert exactly once',async()=>{
      await reset();await db.exec("update app.jobs set start_date=current_date-1");await assert.rejects(submit(J,I),/job_expired/);
      await db.exec('update app.jobs set start_date=current_date+1');
      const first=(await submit(J,I)).r,again=(await submit(J,I)).r;
      assert.equal(first.applicationId,again.applicationId);assert.equal(again.replayed,true);
      assert.equal((await result('select count(*)::int n from app.job_applications')).n,1);
      assert.equal((await result('select status from app.job_invites')).status,'accepted');
      await assert.rejects(submit(),/already_applied/);assert.equal((await result('select count from app.usage')).count,50);
    });
    await t.test('public placement is neutral with paid entitlements while retaining approval, SIA, test-account and batch filters',async()=>{
      await reset();const placement=()=>db.query('select * from app.get_guard_placement($1::uuid[])',[[G]]);
      assert.deepEqual((await placement()).rows,[{id:G,profile_boost:false,priority_profile:false}]);
      for(const sql of ["update app.guards set verified_by=null","update app.guards set is_active=false","update app.guards set sia_verified=false","update app.guards set profile_completed=false"]){await reset();await db.exec(sql);assert.equal((await placement()).rows.length,0);}
      await reset();await db.exec('update app.guards set is_test_account=true');await db.query("select set_config('test.uid',$1,false)",[OTHER]);assert.equal((await placement()).rows.length,0);
      await db.query("select set_config('test.uid',$1,false)",[U]);assert.equal((await placement()).rows.length,1);
      assert.equal((await db.query('select * from app.get_guard_placement($1::uuid[])',[Array(201).fill(G)])).rows.length,0);
    });
    await t.test('native job alert trigger includes guards without an entitlement and former paid guards, preserving distance and approval filters',async()=>{
      await reset();
      await db.exec(`
        create table app.clients(id uuid primary key,client_type text);
        create table app.alerts(guard_id uuid);
        create function app.queue_job_match_notification(uuid,uuid,uuid,text,text,text,text,jsonb,integer) returns void language sql as $$insert into app.alerts values($2)$$;
        alter table app.guards add column email text default 'synthetic@example.invalid',add column full_name text default 'QA ONLY',add column home_latitude numeric default 51.5,add column home_longitude numeric default -0.1,add column max_distance_miles numeric default 10,add column default_search_radius_km numeric,add column willing_to_travel boolean default true,add column min_hourly_rate numeric default 0,add column accepts_direct_bookings boolean default true,add column preferred_venue_categories text[];
        alter table app.jobs add column client_id uuid,add column is_draft boolean default false,add column latitude numeric default 51.5,add column longitude numeric default -0.1,add column venue_category text,add column required_license_type text,add column security_type text default 'door-supervisor',add column urgency text,add column booking_source text,add column hourly_rate numeric default 15,add column job_title text default 'Synthetic free access job',add column contact_name text,add column venue_name text,add column venue_city text,add column start_time time,add column end_time time;
        insert into app.guards(id,user_id,verified_by) values('${OTHER}','${OTHER}','${U}');
        create trigger free_access_alert_fixture after insert on app.jobs for each row execute function public.notify_matching_guards_on_job_post();
        insert into app.jobs default values;
      `);
      assert.deepEqual((await db.query('select guard_id from app.alerts order by guard_id')).rows.map(r=>r.guard_id),[G,OTHER]);
      await db.exec(`delete from app.alerts;update app.guards set verified_by=null where id='${G}';update app.guards set home_latitude=55 where id='${OTHER}';insert into app.jobs default values;`);
      assert.equal((await db.query('select * from app.alerts')).rows.length,0);
    });
  } finally {await db.close();}
});
