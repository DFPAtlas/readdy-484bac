-- QG-R08: release membership locks on closure, retain a private audit snapshot
-- until that closure's existing profile-retention deadline, honoring holds.
create table app.team_closure_snapshots (
  closure_id uuid not null references app.account_closures(id), config_id uuid not null,
  owner_user_id uuid not null, member_user_id uuid not null, snapshot jsonb not null,
  detached_at timestamptz not null default now(), primary key(closure_id,config_id)
);
alter table app.team_closure_snapshots enable row level security;
revoke all on app.team_closure_snapshots from public,anon,authenticated;
grant all on app.team_closure_snapshots to service_role;
create policy team_closure_snapshot_service on app.team_closure_snapshots to service_role using(true) with check(true);

-- Closure, retention and team entry points take the same domain lock BEFORE their per-user/closure locks.
-- This makes closing a member and adding/removing them serializable without
-- opposite owner/member lock order or a stale membership surviving closure.
do $$
declare signature text; definition text; revised text;
begin
  foreach signature in array array['app.begin_account_closure(uuid,uuid)','app.confirm_account_closure(uuid)','app.finish_account_retention_task(uuid,uuid,text)','app.manage_my_client_team(jsonb)'] loop
    select pg_get_functiondef(signature::regprocedure) into definition;
    if strpos(definition,'qg-client-team-membership')=0 then
      revised:=regexp_replace(definition,E'\n[ \t]*begin[ \t]*\n',E'\nBEGIN\n  PERFORM pg_advisory_xact_lock(hashtextextended(''qg-client-team-membership'',0));\n','i');
      if revised=definition then raise exception 'Cannot locate team/closure transaction boundary: %',signature; end if;
      execute revised;
    end if;
  end loop;
end $$;

create function app.qg_detach_closed_team(p_closure uuid) returns void
language plpgsql security definer set search_path='' as $$
declare closed app.account_closures%rowtype; cfg record; owners uuid[]:='{}'; owner_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('qg-client-team-membership',0));
  select * into closed from app.account_closures where id=p_closure for update;
  if not found or closed.status not in ('closing','closed') then raise exception 'Account is not closing'; end if;
  for cfg in select * from public.team_member_configs where admin_user_id=closed.user_id or member_user_id=closed.user_id order by admin_user_id,id for update loop
    insert into app.team_closure_snapshots(closure_id,config_id,owner_user_id,member_user_id,snapshot)
      values(closed.id,cfg.id,cfg.admin_user_id,cfg.member_user_id,to_jsonb(cfg)) on conflict do nothing;
    delete from public.team_member_configs where id=cfg.id;
    owners:=array_append(owners,cfg.admin_user_id);
  end loop;
  for owner_id in select distinct unnest(owners) loop
    insert into app.client_team_state(owner_user_id,revision) values(owner_id,1)
      on conflict(owner_user_id) do update set revision=app.client_team_state.revision+1;
  end loop;
end $$;
revoke all on function app.qg_detach_closed_team(uuid) from public,anon,authenticated;
grant execute on function app.qg_detach_closed_team(uuid) to service_role;

create function app.qg_team_closure_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('closing','closed') then perform app.qg_detach_closed_team(new.id); end if;
  return new;
end $$;
create trigger qg_detach_team_on_closure after insert or update of status on app.account_closures
for each row execute function app.qg_team_closure_trigger();

create function app.qg_team_retention_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.profile_purged_at is not null and old.profile_purged_at is null then
    if new.legal_hold or new.status<>'closed' then raise exception 'Retention hold blocks team cleanup'; end if;
    perform app.qg_detach_closed_team(new.id);
    delete from app.client_team_operations where owner_user_id=new.user_id;
    delete from app.client_team_state where owner_user_id=new.user_id;
    delete from app.team_closure_snapshots where closure_id=new.id;
  end if;
  return new;
end $$;
create trigger qg_purge_team_with_profile after update of profile_purged_at on app.account_closures
for each row execute function app.qg_team_retention_trigger();
revoke all on function app.qg_team_closure_trigger(),app.qg_team_retention_trigger() from public,anon,authenticated;

-- Reconcile only accounts already closing/closed. No account is newly closed,
-- no member's own profile is disabled, and no financial record is modified.
do $$ declare c record; begin
  for c in select id,user_id,profile_purged_at,legal_hold from app.account_closures where status in ('closing','closed') order by id loop
    perform app.qg_detach_closed_team(c.id);
    if c.profile_purged_at is not null and not c.legal_hold then
      delete from app.client_team_operations where owner_user_id=c.user_id;
      delete from app.client_team_state where owner_user_id=c.user_id;
      delete from app.team_closure_snapshots where closure_id=c.id;
    end if;
  end loop;
end $$;
