-- Existing sign-in/onboarding accepts an Auth user with an owned role profile
-- even when the optional legacy app.users mirror is absent. Keep the same
-- identity boundary for confirmed writes and notification recipients.
create or replace function app.qg_active_message_role(p_user uuid) returns text
language plpgsql security definer set search_path='' as $$
declare kind text; client_profiles integer; guard_profiles integer;
begin
  if p_user is null or not exists(select 1 from auth.users where id=p_user and deleted_at is null and (banned_until is null or banned_until<=now()))
     or exists(select 1 from app.account_closures where user_id=p_user) then return null; end if;
  if exists(select 1 from app.admin_users where user_id=p_user and is_active) then return 'admin'; end if;
  select user_type into kind from app.users where id=p_user;
  if not found then
    -- Derive only from server-owned profiles, never editable Auth metadata.
    -- Missing, duplicate and mixed-role profiles fail closed.
    select count(*) into client_profiles from app.clients where user_id=p_user;
    select count(*) into guard_profiles from app.guards where user_id=p_user;
    if client_profiles=1 and guard_profiles=0 then kind:='client';
    elsif guard_profiles=1 and client_profiles=0 then kind:='guard';
    else return null; end if;
  end if;
  if kind='client' and exists(select 1 from app.clients where user_id=p_user and is_active is distinct from false and is_suspended is distinct from true) then return kind; end if;
  if kind='guard' and exists(select 1 from app.guards where user_id=p_user and is_active is distinct from false) then return kind; end if;
  return null;
end $$;
revoke all on function app.qg_active_message_role(uuid) from public,anon,authenticated;

create or replace function app.get_my_message_partners(p_user_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
  if app.qg_active_message_role(actor) is null or coalesce(cardinality(p_user_ids),0)>200 then raise insufficient_privilege; end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'full_name',
    coalesce(nullif(g.full_name,''),nullif(c.company_name,''),nullif(c.contact_name,''),nullif(a.full_name,''),nullif(u.full_name,''),'Contact unavailable'),
    'profile_image_url',g.profile_image_url,'rating',g.rating,'user_type',
      case when a.is_active then 'admin' else coalesce(u.user_type,
        case when g.id is not null and c.id is null then 'guard' when c.id is not null and g.id is null then 'client' else 'unknown' end) end)),'[]'::jsonb)
    into result from (select distinct unnest(p_user_ids) as user_id) p
    join auth.users identity on identity.id=p.user_id
    left join app.users u on u.id=p.user_id left join app.guards g on g.user_id=p.user_id
    left join app.clients c on c.user_id=p.user_id left join app.admin_users a on a.user_id=p.user_id
    where exists(select 1 from app.messages m where
      (m.sender_id=actor and m.receiver_id=p.user_id) or (m.receiver_id=actor and m.sender_id=p.user_id));
  return result;
end $$;
revoke all on function app.get_my_message_partners(uuid[]) from public,anon;
grant execute on function app.get_my_message_partners(uuid[]) to authenticated;

notify pgrst, 'reload schema';
