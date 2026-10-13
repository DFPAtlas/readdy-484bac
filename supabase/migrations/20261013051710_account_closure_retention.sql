-- Existing published policy defaults. No historical account is auto-closed or backdated.
create table app.account_closures (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique,
 profile_id uuid not null, profile_type text not null check(profile_type in ('guard','client')),
 closed_at timestamptz not null default now(), closed_by uuid not null,
 status text not null default 'closing' check(status in ('closing','closed')),
 policy_version text not null default '2026-10-12',
 profile_purge_at timestamptz not null default (now()+interval '2 years'),
 documents_purge_at timestamptz not null default (now()+interval '3 years'),
 financial_review_at timestamptz not null default (now()+interval '7 years'),
 profile_purged_at timestamptz, documents_purged_at timestamptz, financial_review_required_at timestamptz,
 legal_hold boolean not null default false, hold_reason text, hold_set_by uuid,
 lease_token uuid, lease_until timestamptz, leased_stage text,
 attempts integer not null default 0, last_error text, updated_at timestamptz not null default now(),
 check(profile_purge_at >= closed_at and documents_purge_at >= closed_at and financial_review_at >= closed_at),
 check(not legal_hold or length(trim(coalesce(hold_reason,'')))>0)
);
create index account_closures_retention_due on app.account_closures(status,legal_hold,profile_purge_at,documents_purge_at);
alter table app.account_closures enable row level security;
revoke all on app.account_closures from public,anon,authenticated;
grant select on app.account_closures to authenticated;
grant all on app.account_closures to service_role;
create policy account_closure_owner_read on app.account_closures for select to authenticated using(user_id=(select auth.uid()));
create table app.account_retention_events (
 id uuid primary key default gen_random_uuid(), closure_id uuid not null references app.account_closures(id),
 event_type text not null, actor_id uuid, created_at timestamptz not null default now(), details jsonb not null default '{}'::jsonb
);
create index account_retention_events_closure on app.account_retention_events(closure_id);
alter table app.account_retention_events enable row level security;
revoke all on app.account_retention_events from public,anon,authenticated;
grant all on app.account_retention_events to service_role;

create function app.begin_account_closure(p_user_id uuid,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g app.guards%rowtype; c app.clients%rowtype; r app.account_closures%rowtype; typ text; pid uuid;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select * into r from app.account_closures where user_id=p_user_id for update;
 if found then return to_jsonb(r); end if;
 if p_actor_id<>p_user_id and not exists(select 1 from app.admin_users where user_id=p_actor_id and is_active and role='super_admin') then raise insufficient_privilege; end if;
 if exists(select 1 from app.admin_users where user_id=p_user_id) then raise exception 'Administrator accounts require separate review'; end if;
 select * into g from app.guards where user_id=p_user_id for update;
 select * into c from app.clients where user_id=p_user_id for update;
 if g.id is not null and c.id is not null then raise exception 'Review both role profiles before closure'; end if;
 if g.id is null and c.id is null then raise exception 'Account profile not found'; end if;
 typ:=case when g.id is not null then 'guard' else 'client' end; pid:=coalesce(g.id,c.id);
 if exists(select 1 from app.subscriptions where user_id=p_user_id and stripe_subscription_id is not null and coalesce(status,'') not in ('canceled','cancelled','incomplete_expired')) then
  raise exception 'Cancel the paid subscription and wait for cancellation to complete before closure'; end if;
 if (typ='client' and exists(select 1 from app.jobs where client_id=pid and coalesce(status,'') not in ('completed','cancelled','closed','draft'))) or
    (typ='guard' and exists(select 1 from app.job_assignments where guard_id=pid and coalesce(status,'') not in ('completed','cancelled','rejected'))) then
  raise exception 'Complete or cancel outstanding bookings before closure'; end if;
 if exists(select 1 from app.disputes where (guard_id=g.id or client_id=c.id) and coalesce(status,'') not in ('resolved','closed')) then raise exception 'Resolve the open dispute before closure'; end if;
 if typ='guard' and exists(select 1 from app.guard_bank_payouts where guard_id=pid and coalesce(status,'') not in ('paid','canceled','cancelled')) then raise exception 'Resolve bank payouts before closure'; end if;
 if typ='guard' and exists(select 1 from app.guard_payouts where guard_id=pid and coalesce(status,'') not in ('completed','paid','cancelled')) then raise exception 'Resolve outstanding payouts before closure'; end if;
 insert into app.account_closures(user_id,profile_id,profile_type,closed_by) values(p_user_id,pid,typ,p_actor_id) returning * into r;
 if typ='guard' then update app.guards set is_active=false,dashboard_access=false where id=pid;
 else update app.clients set is_active=false where id=pid; end if;
 update app.user_entitlements_data set is_active=false where user_id=p_user_id;
 insert into app.account_retention_events(closure_id,event_type,actor_id) values(r.id,'closure_started',p_actor_id);
 return to_jsonb(r);
end $$;

create function app.confirm_account_closure(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise insufficient_privilege; end if;
 update app.account_closures set status='closed',updated_at=now(),last_error=null where id=p_id and status='closing';
 if found then insert into app.account_retention_events(closure_id,event_type) values(p_id,'auth_access_disabled'); end if;
end $$;

-- Restrictive policies also block access through still-unexpired bearer tokens.
-- Existing active-account policies are untouched; service workers bypass RLS.
do $$ declare t record; begin
 for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('app','public') and c.relkind in ('r','p') and c.relrowsecurity and c.relname not in ('account_closures','account_retention_events') loop
  execute format('create policy qg_closed_account_block on %I.%I as restrictive for all to authenticated using (not exists(select 1 from app.account_closures where user_id=(select auth.uid()))) with check (not exists(select 1 from app.account_closures where user_id=(select auth.uid())))',t.nspname,t.relname);
 end loop;
end $$;
create policy qg_closed_account_storage_block on storage.objects as restrictive for all to authenticated
 using(not exists(select 1 from app.account_closures where user_id=(select auth.uid())))
 with check(not exists(select 1 from app.account_closures where user_id=(select auth.uid())));

-- RLS cannot constrain SECURITY DEFINER RPCs. Reject closed accounts before
-- any Data API request, while leaving anonymous traffic and service jobs alone.
create function app.reject_closed_account_request() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.jwt()->>'role'='authenticated' and exists(select 1 from app.account_closures where user_id=auth.uid()) then
  raise exception 'Account is closed' using errcode='42501';
 end if;
end $$;
revoke all on function app.reject_closed_account_request() from public;
grant execute on function app.reject_closed_account_request() to anon,authenticated,service_role;
do $$ declare existing text; begin
 if exists(select 1 from pg_roles where rolname='authenticator') then
  select setting into existing from pg_roles cross join lateral unnest(rolconfig) setting
   where rolname='authenticator' and setting like 'pgrst.db_pre_request=%';
  if existing is not null and existing<>'pgrst.db_pre_request=app.reject_closed_account_request' then
   raise exception 'Existing Data API pre-request hook must be composed before rollout';
  end if;
  alter role authenticator set pgrst.db_pre_request='app.reject_closed_account_request';
 end if;
end $$;
notify pgrst,'reload config';

create function app.keep_closed_account_inactive() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from app.account_closures where user_id=new.user_id) then
  if tg_op='INSERT' then raise exception 'Closed account cannot create a new profile'; end if;
  new.is_active:=false;
  if tg_table_name='guards' then new.dashboard_access:=false; end if;
 end if;
 return new;
end $$;
create trigger qg_guard_stays_closed before insert or update on app.guards for each row execute function app.keep_closed_account_inactive();
create trigger qg_client_stays_closed before insert or update on app.clients for each row execute function app.keep_closed_account_inactive();
create trigger qg_entitlement_stays_closed before insert or update on app.user_entitlements_data for each row execute function app.keep_closed_account_inactive();

create function app.set_account_retention_hold(p_id uuid,p_hold boolean,p_reason text,p_actor_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' or not exists(select 1 from app.admin_users where user_id=p_actor_id and is_active and role='super_admin') then raise insufficient_privilege; end if;
 if length(trim(coalesce(p_reason,'')))=0 or length(p_reason)>500 then raise exception 'A review reason is required'; end if;
 update app.account_closures set legal_hold=p_hold,hold_reason=p_reason,hold_set_by=p_actor_id,updated_at=now() where id=p_id;
 if not found then raise exception 'Closure not found'; end if;
 insert into app.account_retention_events(closure_id,event_type,actor_id,details) values(p_id,case when p_hold then 'hold_added' else 'hold_released' end,p_actor_id,jsonb_build_object('reason',p_reason));
end $$;

create function app.claim_account_retention_tasks(p_limit integer default 10) returns setof app.account_closures
language plpgsql security definer set search_path='' as $$
declare r app.account_closures%rowtype; stage text;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise insufficient_privilege; end if;
 for r in select * from app.account_closures where status='closed' and not legal_hold and (lease_until is null or lease_until<now()) and
  ((profile_purged_at is null and profile_purge_at<=now()) or (documents_purged_at is null and documents_purge_at<=now()) or (financial_review_required_at is null and financial_review_at<=now()))
  order by closed_at for update skip locked limit greatest(1,least(coalesce(p_limit,10),20)) loop
  stage:=case when r.profile_purged_at is null and r.profile_purge_at<=now() then 'profile'
   when r.documents_purged_at is null and r.documents_purge_at<=now() then 'documents' else 'financial_review' end;
  update app.account_closures set lease_token=gen_random_uuid(),lease_until=now()+interval '15 minutes',leased_stage=stage,attempts=attempts+1,updated_at=now() where id=r.id returning * into r;
  insert into app.account_retention_events(closure_id,event_type,details) values(r.id,'purge_claimed',jsonb_build_object('stage',stage));
  return next r;
 end loop;
end $$;

create function app.check_account_retention_claim(p_id uuid,p_token uuid) returns boolean language sql security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'role','')='service_role' and exists(select 1 from app.account_closures where id=p_id and lease_token=p_token and lease_until>now() and status='closed' and not legal_hold)
$$;

-- Only whitelisted profile fields are minimised. Accounting, booking and dispute
-- evidence is never silently erased by this job. Stable IDs remain pseudonymous.
create function app.finish_account_retention_task(p_id uuid,p_token uuid,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$
declare r app.account_closures%rowtype; t text; col record; patch jsonb; assignments text; predicate text;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise insufficient_privilege; end if;
 select * into r from app.account_closures where id=p_id and lease_token=p_token for update;
 if not found or r.lease_until<=now() then raise exception 'Retention lease expired or invalid'; end if;
 if p_error is not null then
  update app.account_closures set lease_token=null,lease_until=null,leased_stage=null,last_error=left(p_error,300),updated_at=now() where id=p_id;
  insert into app.account_retention_events(closure_id,event_type,details) values(p_id,'purge_failed',jsonb_build_object('stage',r.leased_stage,'error',left(p_error,300))); return;
 end if;
 if r.legal_hold or r.status<>'closed' then raise exception 'Retention hold blocks completion'; end if;
 if r.leased_stage='profile' then
  for t in select unnest(array['guards','clients','users']) loop
   patch:='{}'::jsonb; assignments:='';
   for col in select column_name,is_nullable,data_type from information_schema.columns where table_schema='app' and table_name=t and column_name=any(array[
    'full_name','first_name','last_name','contact_name','company_name','trading_name','email','phone','billing_email','address','address_line1','address_line2','business_address','billing_address_line1','billing_address_line2','city','postcode','location','date_of_birth','bio','website','description','home_latitude','home_longitude','profile_image_url','profile_image_path','profile_photo_url','logo_url']) loop
    patch:=patch||jsonb_build_object(col.column_name,case
     when col.column_name='email' then to_jsonb('closed-'||r.user_id::text||'@deleted.quickguard.invalid')
     when col.is_nullable='NO' then to_jsonb(case when col.column_name like '%name%' then 'Closed account' else '' end)
     else 'null'::jsonb end);
    assignments:=assignments||case when assignments='' then '' else ',' end||format('%I=x.%I',col.column_name,col.column_name);
   end loop;
   if assignments<>'' then
    predicate:=case when t='users' then 'target.id=$2' else 'target.user_id=$2' end;
    execute format('update app.%I target set %s from jsonb_populate_record(null::app.%I,$1) x where %s',t,assignments,t,predicate) using patch,r.user_id;
   end if;
  end loop;
  delete from app.push_subscriptions where user_id=r.user_id;
  delete from app.notification_preferences where user_id=r.user_id;
  delete from app.notifications where user_id=r.user_id;
  update app.account_closures set profile_purged_at=now() where id=p_id;
 elsif r.leased_stage='documents' then
  update app.guards set sia_licence_front_url=null,sia_licence_back_url=null,sia_licence_front_path=null,sia_licence_back_path=null,sia_supporting_document_path=null,sia_licence_photo_url=null,
   driving_licence_front_url=null,driving_licence_back_url=null,proof_of_address_url=null,sia_licence_number=null,license_cardholder_name=null,sia_scraped_name=null,sia_scraped_status=null,sia_scraped_licence_type=null,sia_verified=false where user_id=r.user_id;
  update app.users set sia_license_number=null,sia_verification_details=null,sia_sectors=null where id=r.user_id;
  delete from app.sia_verifications where user_id=r.user_id or guard_id=r.profile_id;
  update app.account_closures set documents_purged_at=now() where id=p_id;
 elsif r.leased_stage='financial_review' then
  update app.account_closures set financial_review_required_at=now() where id=p_id;
 else raise exception 'Invalid retention stage'; end if;
 insert into app.account_retention_events(closure_id,event_type,details) values(p_id,'purge_completed',jsonb_build_object('stage',r.leased_stage));
 update app.account_closures set lease_token=null,lease_until=null,leased_stage=null,last_error=null,updated_at=now() where id=p_id;
end $$;

-- Browser users can only read their own closure. All mutations are service-only.
revoke all on function app.begin_account_closure(uuid,uuid),app.confirm_account_closure(uuid),app.keep_closed_account_inactive(),app.set_account_retention_hold(uuid,boolean,text,uuid),app.claim_account_retention_tasks(integer),app.check_account_retention_claim(uuid,uuid),app.finish_account_retention_task(uuid,uuid,text) from public,anon,authenticated;
grant execute on function app.begin_account_closure(uuid,uuid),app.confirm_account_closure(uuid),app.set_account_retention_hold(uuid,boolean,text,uuid),app.claim_account_retention_tasks(integer),app.check_account_retention_claim(uuid,uuid),app.finish_account_retention_task(uuid,uuid,text) to service_role;

-- BEGIN RETENTION SCHEDULER (excluded from local pure-SQL fixtures)
do $$ begin
 if not exists(select 1 from vault.secrets where name='qg_retention_worker_token') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'qg_retention_worker_token','QuickGuard nightly account-retention worker');
 end if;
end $$;
create function app.validate_retention_worker_token(p_token text) returns boolean language sql security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'role','')='service_role' and length(p_token)>=32 and exists(select 1 from vault.decrypted_secrets where name='qg_retention_worker_token' and decrypted_secret=p_token)
$$;
revoke all on function app.validate_retention_worker_token(text) from public,anon,authenticated;
grant execute on function app.validate_retention_worker_token(text) to service_role;
select cron.schedule('process-account-retention','20 3 * * *',$cron$
 select net.http_post(url:='https://vnywjfpkepjgclkbcmsj.supabase.co/functions/v1/process-account-retention',body:='{}'::jsonb,
 headers:=jsonb_build_object('Content-Type','application/json','x-qg-retention-worker-token',(select decrypted_secret from vault.decrypted_secrets where name='qg_retention_worker_token' limit 1)),timeout_milliseconds:=60000);
$cron$);
