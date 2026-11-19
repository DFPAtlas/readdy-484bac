-- New invitations only. No historical backfill or worker invocation.
begin;
set local lock_timeout = '2s';

create unique index if not exists uq_email_queue_job_invite
on app.email_queue(dedupe_key) where email_type = 'job_invite';

create or replace function app.validate_client_job_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare j app.jobs%rowtype; c app.clients%rowtype; g app.guards%rowtype;
begin
  if tg_op = 'UPDATE' then
    if (new.id,new.job_id,new.guard_id,new.client_id,new.message,new.invited_at)
       is distinct from (old.id,old.job_id,old.guard_id,old.client_id,old.message,old.invited_at) then
      raise exception 'qg_invite:immutable' using errcode='42501';
    end if;
    return new;
  end if;
  select * into c from app.clients where id=new.client_id;
  select * into j from app.jobs where id=new.job_id for share;
  select * into g from app.guards where id=new.guard_id for share;
  if c.id is null or c.is_active is false or j.client_id is distinct from c.id
     or exists(select 1 from app.account_closures where user_id=c.user_id)
     or (coalesce(nullif(current_setting('role',true),'none'),'') in ('authenticated','anon') and c.user_id is distinct from auth.uid()) then
    raise exception 'qg_invite:not_authorized' using errcode='42501';
  end if;
  if j.id is null or coalesce(j.is_deleted,false) or coalesce(j.is_draft,false)
     or j.payment_status in ('funded','processing','completed','paid_out','refunded')
     or j.status not in ('open','awaiting_guard_selection','pending') or j.status is null
     or j.start_date is null or ((j.start_date + coalesce(j.start_time,time '00:00')) at time zone 'Europe/London') <= now()
     or j.expires_at <= now() then
    raise exception 'qg_invite:job_unavailable';
  end if;
  if g.id is null or g.user_id is null or g.is_active is distinct from true
     or g.verification_status not in ('approved','verified') or g.verification_status is null or g.verified_by is null
     or not app.guard_has_current_sia(g.sia_verified,g.sia_licence_number,g.sia_expiry_date,(now() at time zone 'Europe/London')::date)
     or exists(select 1 from app.account_closures where user_id=g.user_id) then
    raise exception 'qg_invite:guard_unavailable';
  end if;
  if coalesce(new.status,'pending') <> 'pending' or new.responded_at is not null then raise exception 'qg_invite:invalid_status'; end if;
  new.status := 'pending';
  new.invited_at := now();
  new.message := coalesce(nullif(btrim(new.message),''),'You have been invited to view a job and apply.');
  if char_length(new.message)>2000 then raise exception 'qg_invite:message_too_long'; end if;
  return new;
end $$;
revoke all on function app.validate_client_job_invite() from public,anon,authenticated;
drop trigger if exists trg_validate_client_job_invite on app.job_invites;
create trigger trg_validate_client_job_invite before insert or update on app.job_invites
for each row execute function app.validate_client_job_invite();

create or replace function app.queue_client_job_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare guard_user uuid; recipient text; prefs app.notification_preferences%rowtype; queued uuid;
begin
  select g.user_id,u.email into guard_user,recipient from app.guards g join auth.users u on u.id=g.user_id where g.id=new.guard_id;
  if guard_user is null then raise exception 'qg_invite:guard_unavailable'; end if;
  select * into prefs from app.notification_preferences where user_id=guard_user;
  if prefs.job_matches is distinct from false and prefs.in_app_alerts is distinct from false then
    insert into app.notifications(user_id,user_type,title,message,type,category,link,data,is_read)
    values(guard_user,'guard','Job invitation','A client invited you to view a job and apply.','job_invite','jobs','/guard/job-invites',
      jsonb_build_object('invite_id',new.id,'job_id',new.job_id),false);
  end if;
  if nullif(btrim(recipient),'') is not null then
    insert into app.email_queue(user_id,email_type,recipient_email,subject,body_html,status,metadata,dedupe_key)
    values(null,'job_invite',recipient,'QuickGuard — Job invitation','<p>View your invitation in QuickGuard.</p>','pending',
      jsonb_build_object('source_record_id','job-invite:'||new.id::text,'invite_id',new.id,'job_id',new.job_id), 'job-invite:'||new.id::text)
    returning id into queued;
    if queued is null then raise exception 'qg_invite:queue_not_confirmed'; end if;
  end if;
  return new;
end $$;
revoke all on function app.queue_client_job_invite() from public,anon,authenticated;
drop trigger if exists trg_queue_client_job_invite on app.job_invites;
create trigger trg_queue_client_job_invite after insert on app.job_invites
for each row execute function app.queue_client_job_invite();

-- Keep RLS in force. The trigger handles private eligibility checks/queue writes;
-- this browser-callable RPC itself never elevates the caller's privileges.
create or replace function app.create_client_job_invite(p_job_id uuid,p_guard_id uuid,p_message text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c uuid; j uuid; i uuid; state text;
begin
  if auth.uid() is null then raise exception 'qg_invite:not_authorized' using errcode='42501'; end if;
  select id into c from app.clients where user_id=auth.uid() and is_active is distinct from false;
  if c is null or exists(select 1 from app.account_closures where user_id=auth.uid()) then raise exception 'qg_invite:not_authorized' using errcode='42501'; end if;
  select id into j from app.jobs where id=p_job_id and client_id=c for update;
  if j is null then raise exception 'qg_invite:not_authorized' using errcode='42501'; end if;
  select id,status into i,state from app.job_invites where job_id=j and guard_id=p_guard_id and client_id=c;
  if i is not null then return jsonb_build_object('invite_id',i,'status',state,'replayed',true); end if;
  insert into app.job_invites(job_id,guard_id,client_id,status,message)
  values(j,p_guard_id,c,'pending',p_message) on conflict(job_id,guard_id) do nothing returning id,status into i,state;
  if i is null then
    select id,status into i,state from app.job_invites where job_id=j and guard_id=p_guard_id and client_id=c;
    if i is null then raise exception 'qg_invite:not_confirmed'; end if;
    return jsonb_build_object('invite_id',i,'status',state,'replayed',true);
  end if;
  return jsonb_build_object('invite_id',i,'status',state,'replayed',false);
end $$;
revoke all on function app.create_client_job_invite(uuid,uuid,text) from public,anon;
grant execute on function app.create_client_job_invite(uuid,uuid,text) to authenticated;
-- Deleting/recreating an invitation would bypass its replay protection. Guard
-- responses and authoritative atomic application acceptance stay available.
revoke delete on app.job_invites from authenticated;
revoke insert,update,delete on app.job_invites from anon;
drop policy if exists job_invites_client_delete on app.job_invites;
drop policy if exists job_invites_client_insert on app.job_invites;
create policy job_invites_client_insert on app.job_invites for insert to authenticated
with check(client_id in(select id from app.clients where user_id=(select auth.uid()))
  and exists(select 1 from app.jobs j where j.id=job_invites.job_id and j.client_id=job_invites.client_id));
notify pgrst,'reload schema';
commit;
