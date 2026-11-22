-- Sandbox-only RPC/RLS acceptance. No Edge HTTP delivery or browser test is claimed.
-- Exact fixture and isolation checks deliberately reject the production dataset.
-- All fixtures, counters, notifications, queue rows and synthetic licence fields roll back.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
select set_config('qg.boundary.failed','',true),set_config('qg.boundary.checks','[]',true);

do $$
declare g constant uuid:='20826398-1bcf-4a93-9b61-493c3e156610';
 u constant uuid:='8ec6113d-7b78-4c69-a90c-86d0e4b69714';
 c constant uuid:='567a2518-86ec-4b78-9230-12794f0ead27';
 usage jsonb;
begin
 if exists(select 1 from cron.job where active)
 or not exists(select 1 from pg_trigger where tgrelid='app.job_applications'::regclass and tgname='job_applications_status_notify' and tgenabled='D')
 or not exists(select 1 from app.guards where id=g and user_id=u and email='sandbox.guard@example.invalid' and is_test_account and is_active and profile_completed and verified_by is not null)
 or not exists(select 1 from auth.users where id=u and email='sandbox.guard@example.invalid')
 or not exists(select 1 from app.clients where id=c and user_id='8a6451b5-6b9f-4b42-a1d2-1bf36e5a8a0b' and company_name='QG E2E Sandbox — Test Only')
 or not exists(select 1 from app.payment_audit_logs where id='b08b2911-9e16-4aa5-b1b9-202611220200' and metadata->>'phase'='closed')
 then raise exception 'Exact isolated closed sandbox fixtures required';end if;
 if exists(select 1 from app.jobs where id in ('b08b2911-9e16-4aa5-b1b9-202611220301','b08b2911-9e16-4aa5-b1b9-202611220302','b08b2911-9e16-4aa5-b1b9-202611220303'))
 or exists(select 1 from app.user_entitlements_data where user_id=u)
 or exists(select 1 from app.user_feature_usage where user_id=u)
 then raise exception 'Baseline changed; inspect before rerunning';end if;

 -- Explicit synthetic licence fields model the existing reviewed sandbox guard.
 -- They are not a real SIA check; reviewer and approval status are never changed.
 update app.guards set sia_verified=true,sia_licence_number='0000000000000000',sia_expiry_date='2028-10-01' where id=g;
 insert into app.user_entitlements(user_id,plan_slug,plan_name,audience,features,monthly_price_pence,subscription_status,current_period_end,cancel_at_period_end)
 select u,slug,name,audience,features,monthly_price_pence,'active',now()+interval '30 days',false from app.plans where slug='guard-elite' and active and job_limit_per_month=40;
 if not found then raise exception 'Expected Elite 40-application catalogue plan';end if;
 usage:=app.check_monthly_usage(u,'guard_application',false);
 if (usage->>'limit')::int<>40 or (usage->>'used')::int<>0 then raise exception 'Unexpected initial quota';end if;
 insert into app.user_feature_usage(user_id,account_type,feature_key,usage_count,period_start,period_end)
 values(u,'guard','guard_application',39,(usage->>'period_start')::timestamptz::date,(usage->>'period_end')::timestamptz::date);

 -- Operator-only fixture insertion is not a client posting/quota acceptance test.
 insert into app.jobs(id,client_id,job_title,security_type,number_of_guards,start_date,end_date,start_time,end_time,number_of_days,urgency,venue_name,venue_address_line1,venue_city,venue_postcode,job_description,hourly_rate,status,payment_status,is_deleted,is_draft,latitude,longitude,job_access_level,sia_licence_required,required_license_type)
 select id,c,'QA ONLY — sandbox boundary '||label,'security-guard',1,day,day,time '10:00',time '11:00',1,'standard','Synthetic boundary venue','Synthetic test address','Synthetic QA','AL1 1AA','Isolated rollback test: no actual shift, service delivery, payment or booking.',20,'open','pending',false,false,0,0,'elite',false,'any'
 from(values
 ('b08b2911-9e16-4aa5-b1b9-202611220301'::uuid,'final application',(now() at time zone 'Europe/London')::date+1),
 ('b08b2911-9e16-4aa5-b1b9-202611220302'::uuid,'exhausted invitation',(now() at time zone 'Europe/London')::date+1),
 ('b08b2911-9e16-4aa5-b1b9-202611220303'::uuid,'expired job',(now() at time zone 'Europe/London')::date-1)) f(id,label,day);
 perform set_config('qg.boundary.checks','["sandbox isolation and temporary Elite quota fixture"]',true);
exception when others then perform set_config('qg.boundary.failed','setup: '||sqlstate||' '||sqlerrm,true);
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"8a6451b5-6b9f-4b42-a1d2-1bf36e5a8a0b","role":"authenticated"}',true);
do $$
declare a jsonb;b jsonb;r jsonb;
begin
 if current_setting('qg.boundary.failed')<>'' then return;end if;
 a:=app.create_client_job_invite('b08b2911-9e16-4aa5-b1b9-202611220301','20826398-1bcf-4a93-9b61-493c3e156610','QA ONLY — rollback invitation A');
 b:=app.create_client_job_invite('b08b2911-9e16-4aa5-b1b9-202611220302','20826398-1bcf-4a93-9b61-493c3e156610','QA ONLY — rollback invitation B');
 r:=app.create_client_job_invite('b08b2911-9e16-4aa5-b1b9-202611220301','20826398-1bcf-4a93-9b61-493c3e156610','Retry must preserve the original invitation');
 if a->>'invite_id' is null or b->>'invite_id' is null or r->>'invite_id' is distinct from a->>'invite_id' or (r->>'replayed')::boolean is not true then raise exception 'Invitation replay mismatch';end if;
 perform set_config('qg.boundary.invite_a',a->>'invite_id',true);
 perform set_config('qg.boundary.invite_b',b->>'invite_id',true);
 perform set_config('qg.boundary.checks',(current_setting('qg.boundary.checks')::jsonb||jsonb_build_array('owned client invitation creation and idempotent replay'))::text,true);
exception when others then perform set_config('qg.boundary.failed','client invitation: '||sqlstate||' '||sqlerrm,true);
end $$;
reset role;

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare u constant uuid:='8ec6113d-7b78-4c69-a90c-86d0e4b69714';g constant uuid:='20826398-1bcf-4a93-9b61-493c3e156610';
 a constant uuid:='b08b2911-9e16-4aa5-b1b9-202611220301';b constant uuid:='b08b2911-9e16-4aa5-b1b9-202611220302';
 v jsonb;r jsonb;q jsonb;
begin
 if current_setting('qg.boundary.failed')<>'' then return;end if;
 begin
  perform app.submit_job_application('8a6451b5-6b9f-4b42-a1d2-1bf36e5a8a0b',g,a,'Wrong owner',null,false);
  raise exception 'Expected ownership denial';
 exception when others then if sqlerrm not like 'qg_apply:forbidden%' then raise;end if;end;
 begin
  perform app.submit_job_application(u,g,'b08b2911-9e16-4aa5-b1b9-202611220303','Expired test',null,false);
  raise exception 'Expected expired-job denial';
 exception when others then if sqlerrm not like 'qg_apply:job_expired%' then raise;end if;end;
 q:=app.check_monthly_usage(u,'guard_application',false);
 if (q->>'used')::int<>39 then raise exception 'Failed attempts consumed quota';end if;

 v:=app.submit_job_application(u,g,a,'QA ONLY — 40th controlled application',null,false);
 q:=app.check_monthly_usage(u,'guard_application',false);
 if v->>'applicationId' is null or (q->>'used')::int<>40 or (q->>'remaining')::int<>0 then raise exception '40th application mismatch';end if;
 perform set_config('qg.boundary.application_id',v->>'applicationId',true);
 begin
  perform app.submit_job_application(u,g,a,'Duplicate',null,false);
  raise exception 'Expected duplicate denial';
 exception when others then if sqlerrm not like 'qg_apply:already_applied%' then raise;end if;end;
 begin
  perform app.submit_job_application(u,g,b,'Must remain pending',current_setting('qg.boundary.invite_b')::uuid,false);
  raise exception 'Expected quota denial';
 exception when others then if sqlerrm not like 'qg_apply:limit_reached%' then raise;end if;end;
 if exists(select 1 from app.job_applications where job_id=b and guard_id=g)
 or (select status from app.job_invites where id=current_setting('qg.boundary.invite_b')::uuid)<>'pending'
 then raise exception 'Exhausted acceptance was partially saved';end if;

 r:=app.submit_job_application(u,g,a,'Existing application invitation',current_setting('qg.boundary.invite_a')::uuid,false);
 if r->>'applicationId' is distinct from v->>'applicationId' or (r->>'replayed')::boolean is not true
 or (select status from app.job_invites where id=current_setting('qg.boundary.invite_a')::uuid)<>'accepted' then raise exception 'Existing application invitation mismatch';end if;
 begin
  perform app.submit_job_application(u,g,b,'Cross-job invitation',current_setting('qg.boundary.invite_a')::uuid,false);
  raise exception 'Expected cross-job invitation denial';
 exception when others then if sqlerrm not like 'qg_apply:invite_not_found%' then raise;end if;end;
 q:=app.check_monthly_usage(u,'guard_application',false);
 if (q->>'used')::int<>40 or (select count(*) from app.job_applications where job_id in(a,b) and guard_id=g)<>1 then raise exception 'Quota or duplicate count mismatch';end if;
 perform set_config('qg.boundary.checks',(current_setting('qg.boundary.checks')::jsonb||jsonb_build_array('wrong owner denied without quota consumption','expired job denied without quota consumption','40th Elite application allowed','duplicate application denied','41st application and invitation acceptance denied atomically','existing application invite replay uses no additional quota','cross-job invitation rejected'))::text,true);
exception when others then perform set_config('qg.boundary.failed','application boundary: '||sqlstate||' '||sqlerrm,true);
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"8ec6113d-7b78-4c69-a90c-86d0e4b69714","role":"authenticated"}',true);
do $$
declare n integer;
begin
 if current_setting('qg.boundary.failed')<>'' then return;end if;
 update app.job_invites set status='declined',responded_at=now()
 where id=current_setting('qg.boundary.invite_b')::uuid and guard_id='20826398-1bcf-4a93-9b61-493c3e156610' and status='pending';
 get diagnostics n=row_count;if n<>1 then raise exception 'Owned decline not confirmed';end if;
 update app.job_invites set status='declined',responded_at=now()
 where id=current_setting('qg.boundary.invite_b')::uuid and guard_id='20826398-1bcf-4a93-9b61-493c3e156610' and status='pending';
 get diagnostics n=row_count;if n<>0 then raise exception 'Decline retry changed an already answered invite';end if;
 begin
  update app.job_invites set message='Illegal mutation' where id=current_setting('qg.boundary.invite_b')::uuid;
  raise exception 'Expected immutable invitation denial';
 exception when insufficient_privilege then null;end;
 perform set_config('qg.boundary.checks',(current_setting('qg.boundary.checks')::jsonb||jsonb_build_array('owned guard decline saved under RLS','decline retry updates zero rows','immutable invitation fields protected'))::text,true);
exception when others then perform set_config('qg.boundary.failed','guard decline: '||sqlstate||' '||sqlerrm,true);
end $$;
reset role;

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare q jsonb;
begin
 if current_setting('qg.boundary.failed')<>'' then return;end if;
 begin
  perform app.submit_job_application('8ec6113d-7b78-4c69-a90c-86d0e4b69714','20826398-1bcf-4a93-9b61-493c3e156610','b08b2911-9e16-4aa5-b1b9-202611220302','Declined invite',current_setting('qg.boundary.invite_b')::uuid,false);
  raise exception 'Expected declined-invite denial';
 exception when others then if sqlerrm not like 'qg_apply:invite_not_pending%' then raise;end if;end;
 q:=app.check_monthly_usage('8ec6113d-7b78-4c69-a90c-86d0e4b69714','guard_application',false);
 if (q->>'used')::int<>40 then raise exception 'Decline consumed application quota';end if;
 if (select count(*) from app.email_queue where email_type='job_invite' and metadata->>'invite_id'=current_setting('qg.boundary.invite_a'))<>1
 or (select count(*) from app.email_queue where email_type='job_invite' and metadata->>'invite_id'=current_setting('qg.boundary.invite_b'))<>1 then raise exception 'Invitation email queue dedupe mismatch';end if;
 perform set_config('qg.boundary.checks',(current_setting('qg.boundary.checks')::jsonb||jsonb_build_array('declined invitation cannot be accepted','decline leaves quota unchanged','one queued invitation email per id, unsent and rolled back'))::text,true);
 perform set_config('qg.boundary.quota',q::text,true);
exception when others then perform set_config('qg.boundary.failed','final verification: '||sqlstate||' '||sqlerrm,true);
end $$;
reset role;

select jsonb_build_object('passed',current_setting('qg.boundary.failed')='','failure',nullif(current_setting('qg.boundary.failed'),''),'checks',current_setting('qg.boundary.checks')::jsonb,'quota',nullif(current_setting('qg.boundary.quota',true),'')::jsonb,'scope','sandbox native RPC/RLS; no Edge HTTP, UI, provider or actual shift acceptance; everything rolls back') as boundary_receipt;
rollback;
