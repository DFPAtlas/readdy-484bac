-- Preserve client routing and immutable service tiers while adding guard plans.
create or replace function app.set_support_service_tier() returns trigger
language plpgsql security definer set search_path='' as $$
declare requester uuid;
begin
  if tg_op='UPDATE' then
    new.support_tier:=old.support_tier;
    return new;
  end if;
  new.support_tier:='standard';
  if new.client_id is not null then
    select user_id into requester from app.clients where id=new.client_id;
    if coalesce(app.qg_client_has_owned_feature(requester,'client.priority_support'),false) then
      new.support_tier:='priority';
    end if;
  elsif new.guard_id is not null then
    select user_id into requester from app.guards where id=new.guard_id;
    if app.qg_active_message_role(requester)='guard' and exists (
      select 1 from app.user_entitlements_data e
      where e.user_id=requester and e.is_active is true and e.audience='guard'
        and jsonb_typeof(e.features)='array'
        and e.features @> jsonb_build_array('guard.priority_support')
    ) then
      new.support_tier:='priority';
    end if;
  end if;
  return new;
end $$;
revoke all on function app.set_support_service_tier() from public,anon,authenticated;
