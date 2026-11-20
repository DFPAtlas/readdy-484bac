-- Existing-account team management, scoped to the current paid client owner.
-- Preserve private profile RLS; expose no partial-email client directory.
create unique index qg_team_one_owner_per_member on public.team_member_configs(member_user_id);

create table app.client_team_state(owner_user_id uuid primary key, revision bigint not null check(revision>=0 and revision<=9007199254740991));
alter table app.client_team_state enable row level security;
revoke all on app.client_team_state from public, anon, authenticated;
grant all on app.client_team_state to service_role;
create policy client_team_state_service on app.client_team_state to service_role using (true) with check (true);

create table app.client_team_operations (
  id uuid primary key,
  owner_user_id uuid not null,
  client_id uuid not null,
  request_payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table app.client_team_operations enable row level security;
revoke all on app.client_team_operations from public, anon, authenticated;
grant all on app.client_team_operations to service_role;
create policy client_team_operations_service on app.client_team_operations to service_role using (true) with check (true);

create function app.manage_my_client_team(p_request jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  action text;
  trace_id uuid;
  operation_id uuid;
  client_id uuid;
  company text;
  tier text;
  owner_features jsonb;
  allowed_features jsonb;
  member_id uuid;
  config_id uuid;
  after_id uuid;
  email_query text;
  desired jsonb;
  expected jsonb;
  current_features jsonb;
  cfg public.team_member_configs%rowtype;
  receipt app.client_team_operations%rowtype;
  payload jsonb;
  base jsonb;
  result jsonb;
  outcome text;
  page jsonb;
  more boolean;
  pass integer;
  owner_revision bigint;
  expected_revision bigint;
  next_revision bigint;
begin
  if actor is null then raise exception using errcode='42501', message='Sign in to manage your team'; end if;
  if jsonb_typeof(p_request) is distinct from 'object' or octet_length(p_request::text)>8192 then
    raise exception using errcode='22023', message='Invalid team request';
  end if;
  action := p_request->>'action'; trace_id := (p_request->>'request_id')::uuid;
  if action is null or action not in ('list','search','add','update','remove') or trace_id is null
     or (p_request->>'expected_user_id')::uuid is distinct from actor then
    raise exception using errcode='42501', message='Account context changed. Reload your team';
  end if;
  member_id := (p_request->>'member_user_id')::uuid;
  config_id := (p_request->>'config_id')::uuid;
  after_id := (p_request->>'after_id')::uuid;
  email_query := lower(btrim(p_request->>'email'));
  if action in ('search','add') and (email_query is null or length(email_query)>254 or email_query !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception using errcode='22023', message='Enter the full email address of an existing client';
  end if;
  if action in ('add','update','remove') then
    operation_id := (p_request->>'operation_id')::uuid;
    if operation_id is null or member_id is null or config_id is null or member_id=actor then
      raise exception using errcode='22023', message='Invalid team member change';
    end if;
    if jsonb_typeof(p_request->'expected_revision') is distinct from 'number' or (p_request->>'expected_revision') !~ '^[0-9]{1,16}$' then
      raise exception using errcode='22023', message='Invalid team revision. Reload your team';
    end if;
    expected_revision := (p_request->>'expected_revision')::bigint;
    if expected_revision>9007199254740990 then raise exception using errcode='22023', message='Team revision needs review'; end if;
  else
    member_id := null; config_id := null;
  end if;
  if action='update' then
    desired := p_request->'enabled_features'; expected := p_request->'expected_features';
    if jsonb_typeof(desired) is distinct from 'array' or jsonb_typeof(expected) is distinct from 'array'
       or jsonb_array_length(desired)>64 or jsonb_array_length(expected)>64 then
      raise exception using errcode='22023', message='Invalid feature selection';
    end if;
    if exists(select 1 from jsonb_array_elements(desired || expected) f where jsonb_typeof(f) <> 'string' or length(f#>>'{}') not between 1 and 100) then
      raise exception using errcode='22023', message='Invalid feature selection';
    end if;
    select coalesce(jsonb_agg(v order by v),'[]') into desired from (select distinct value v from jsonb_array_elements_text(desired)) x;
    select coalesce(jsonb_agg(v order by v),'[]') into expected from (select distinct value v from jsonb_array_elements_text(expected)) x;
  end if;
  -- Check eligibility before taking member locks, then recheck under locks.
  for pass in 1..2 loop
    if pass=2 then
      perform pg_advisory_xact_lock(hashtextextended(least(actor,coalesce(member_id,actor))::text,0));
      if member_id is not null and member_id<>actor then
        perform pg_advisory_xact_lock(hashtextextended(greatest(actor,member_id)::text,0));
      end if;
      perform 1 from app.clients where user_id=actor for share;
      perform 1 from app.users where id in (actor,member_id) for share;
      perform 1 from auth.users where id in (actor,member_id) for share;
      perform 1 from app.user_entitlements_data where user_id=actor for share;
    end if;
    select c.id,c.company_name,c.subscription_tier,e.features into client_id,company,tier,owner_features
    from app.clients c join app.users u on u.id=c.user_id
    join auth.users a on a.id=u.id join app.user_entitlements_data e on e.user_id=u.id
    where c.user_id=actor and c.is_active is true and coalesce(c.is_suspended,false)=false
      and u.user_type='client' and a.email_confirmed_at is not null and a.deleted_at is null
      and (a.banned_until is null or a.banned_until<=now())
      and e.is_active is true and e.audience='client' and jsonb_typeof(e.features)='array'
      and e.features @> '["client.team_access"]'
      and (select count(*) from app.clients where user_id=actor)=1
      and not exists(select 1 from app.account_closures where user_id=actor);
    if not found then raise exception using errcode='42501', message='An active owned Team Access plan is required'; end if;
    if (p_request->>'expected_client_id')::uuid is distinct from client_id then
      raise exception using errcode='42501', message='Company context changed. Reload your team';
    end if;
  end loop;
  select coalesce(jsonb_agg(v order by v),'[]') into allowed_features from (
    select distinct value v from jsonb_array_elements_text(owner_features)
    where value in ('client.post_job','client.view_guard_profiles','client.advanced_matching','client.priority_support','client.job_templates','client.analytics_dashboard','client.direct_contact','client.unlimited_jobs','client.bulk_posting','client.multi_site','client.team_access','client.custom_contracts','client.api_access','client.escrow_payments','client.job_history','client.job_tracker')
  ) keys;
  select revision into owner_revision from app.client_team_state where owner_user_id=actor;
  owner_revision := coalesce(owner_revision,0);
  base := jsonb_build_object('request_id',trace_id,'action',action,'owner_user_id',actor,'client_id',client_id,
    'company_name',company,'subscription_tier',tier,'allowed_features',allowed_features,'team_revision',owner_revision);
  if action='list' then
    if p_request->>'expected_revision' is not null and (p_request->>'expected_revision')::bigint<>owner_revision then
      raise exception using errcode='P0001', message='Team changed while loading. Retry';
    end if;
    select count(*)>200 into more from (select 1 from public.team_member_configs where admin_user_id=actor and (after_id is null or id>after_id) order by id limit 201) x;
    select coalesce(jsonb_agg(row_data order by id),'[]') into page from (
      select t.id,jsonb_build_object('config_id',t.id,'owner_user_id',t.admin_user_id,'member_user_id',t.member_user_id,
        'email',a.email,'full_name',u.full_name,'enabled_features',t.enabled_features,
        'member_available',coalesce(u.user_type='client' and a.email_confirmed_at is not null and a.deleted_at is null
          and (a.banned_until is null or a.banned_until<=now())
          and (select count(*) from app.clients c where c.user_id=t.member_user_id and c.is_active is true and coalesce(c.is_suspended,false)=false)=1
          and not exists(select 1 from app.account_closures where user_id=t.member_user_id),false)) row_data
      from public.team_member_configs t left join app.users u on u.id=t.member_user_id left join auth.users a on a.id=t.member_user_id
      where t.admin_user_id=actor and (after_id is null or t.id>after_id) order by t.id limit 200
    ) rows;
    return base || jsonb_build_object('members',page,'has_more',more,'next_after_id',case when more then page->-1->>'config_id' else null end);
  elsif action='search' then
    page := '[]';
    if (select count(*) from auth.users where lower(btrim(email))=email_query)=1 then
      select coalesce(jsonb_agg(jsonb_build_object('member_user_id',a.id,'email',a.email,'full_name',u.full_name)),'[]') into page
      from auth.users a join app.users u on u.id=a.id
      where lower(btrim(a.email))=email_query and a.id<>actor and u.user_type='client'
        and a.email_confirmed_at is not null and a.deleted_at is null and (a.banned_until is null or a.banned_until<=now())
        and (select count(*) from app.clients c where c.user_id=a.id and c.is_active is true and coalesce(c.is_suspended,false)=false)=1
        and not exists(select 1 from app.account_closures where user_id=a.id)
        and not exists(select 1 from public.team_member_configs where member_user_id=a.id);
    end if;
    return base || jsonb_build_object('candidates',page);
  end if;
  payload := jsonb_build_object('action',action,'owner_user_id',actor,'client_id',client_id,'member_user_id',member_id,'config_id',config_id,
    'email_hash',case when action='add' then encode(sha256(convert_to(email_query,'UTF8')),'hex') else null end,
    'enabled_features',desired,'expected_features',expected,'expected_revision',expected_revision);
  perform pg_advisory_xact_lock(hashtextextended(operation_id::text,1));
  select * into receipt from app.client_team_operations where id=operation_id;
  if found then
    if receipt.owner_user_id<>actor or receipt.client_id<>client_id or receipt.request_payload<>payload then
      raise exception using errcode='42501', message='Change reference belongs to a different request';
    end if;
    return base || receipt.result || jsonb_build_object('replayed',true);
  end if;
  if owner_revision<>expected_revision then
    raise exception using errcode='P0001', message='Team changed elsewhere. Reload before saving';
  end if;
  if action in ('add','update') then
    perform 1 from app.clients where user_id=member_id for share;
    if not exists(select 1 from auth.users a join app.users u on u.id=a.id where a.id=member_id and u.user_type='client'
      and a.email_confirmed_at is not null and a.deleted_at is null and (a.banned_until is null or a.banned_until<=now())
      and (action<>'add' or (lower(btrim(a.email))=email_query and (select count(*) from auth.users where lower(btrim(email))=email_query)=1)))
      or (select count(*) from app.clients where user_id=member_id and is_active is true and coalesce(is_suspended,false)=false)<>1
      or exists(select 1 from app.account_closures where user_id=member_id) then
      raise exception using errcode='P0001', message='Member account changed or is unavailable. Reload and search again';
    end if;
  end if;
  if action='add' then
    select * into cfg from public.team_member_configs where member_user_id=member_id for update;
    if found then
      if cfg.admin_user_id<>actor then raise exception using errcode='P0001', message='Account is not available to add'; end if;
      outcome := 'already_present';
    else
      if exists(select 1 from public.team_member_configs where id=config_id) then
        raise exception using errcode='P0001', message='Change reference is unavailable. Reload your team';
      end if;
      insert into public.team_member_configs(id,admin_user_id,member_user_id,enabled_features)
        values(config_id,actor,member_id,'[]') returning * into cfg;
      if not found or cfg.id is distinct from config_id or cfg.admin_user_id is distinct from actor or cfg.member_user_id is distinct from member_id or cfg.enabled_features<>'[]'::jsonb then
        raise exception 'Membership addition could not be confirmed';
      end if;
      outcome := 'added';
    end if;
  else
    select * into cfg from public.team_member_configs where id=config_id for update;
    if found then
      if cfg.admin_user_id<>actor or cfg.member_user_id<>member_id then
        raise exception using errcode='42501', message='Team member context changed. Reload your team';
      end if;
      if action='update' then
        if jsonb_typeof(cfg.enabled_features) is distinct from 'array'
          or exists(select 1 from jsonb_array_elements(cfg.enabled_features) v where jsonb_typeof(v)<>'string') then
          raise exception using errcode='P0001', message='Stored feature settings need review';
        end if;
        select coalesce(jsonb_agg(v order by v),'[]') into current_features from (select distinct value v from jsonb_array_elements_text(cfg.enabled_features)) x;
        if current_features<>expected and current_features<>desired then
          raise exception using errcode='P0001', message='Team settings changed elsewhere. Reload before saving';
        end if;
        if exists(select 1 from jsonb_array_elements_text(desired) v where not allowed_features @> jsonb_build_array(v) and not current_features @> jsonb_build_array(v)) then
          raise exception using errcode='42501', message='Your current plan cannot enable that feature';
        end if;
        update public.team_member_configs set enabled_features=desired where id=config_id and admin_user_id=actor and member_user_id=member_id returning * into cfg;
        if not found or cfg.id is distinct from config_id or cfg.admin_user_id is distinct from actor or cfg.member_user_id is distinct from member_id or cfg.enabled_features<>desired then raise exception 'Feature update could not be confirmed'; end if;
        outcome := 'updated';
      else
        delete from public.team_member_configs where id=config_id and admin_user_id=actor and member_user_id=member_id returning * into cfg;
        if not found then raise exception 'Membership removal could not be confirmed'; end if;
        outcome := 'removed';
      end if;
    elsif action='remove' and not exists(select 1 from public.team_member_configs where admin_user_id=actor and member_user_id=member_id) then
      cfg.id := config_id; cfg.member_user_id := member_id;
      outcome := 'already_absent';
    else
      raise exception using errcode='P0001', message='Team member changed. Reload before saving';
    end if;
  end if;
  if action in ('add','update') and not exists(select 1 from public.team_member_configs t where t.id=cfg.id and t.admin_user_id=actor and t.member_user_id=member_id and (action<>'update' or t.enabled_features=desired)) then
    raise exception 'Membership state could not be confirmed';
  elsif action='remove' and exists(select 1 from public.team_member_configs where admin_user_id=actor and member_user_id=member_id) then
    raise exception 'Membership absence could not be confirmed';
  end if;
  insert into app.client_team_state(owner_user_id,revision) values(actor,owner_revision+1)
    on conflict(owner_user_id) do update set revision=excluded.revision returning revision into next_revision;
  if not found or next_revision is distinct from owner_revision+1 then raise exception 'Team revision could not be confirmed'; end if;
  result := jsonb_build_object('operation_id',operation_id,'config_id',cfg.id,'member_user_id',member_id,'outcome',outcome,'committed',true,'operation_revision',owner_revision+1);
  insert into app.client_team_operations(id,owner_user_id,client_id,request_payload,result)
    values(operation_id,actor,client_id,payload,result) returning * into receipt;
  if receipt.id is distinct from operation_id or receipt.owner_user_id is distinct from actor or receipt.client_id is distinct from client_id or receipt.request_payload is distinct from payload or receipt.result is distinct from result then raise exception 'Change receipt could not be confirmed'; end if;
  return base || result || jsonb_build_object('replayed',false,'team_revision',owner_revision+1);
end;
$$;
revoke all on function app.manage_my_client_team(jsonb) from public, anon;
grant execute on function app.manage_my_client_team(jsonb) to authenticated, service_role;
-- Enforce this path for browser mutations, including already-published clients.
revoke insert, update, delete on public.team_member_configs from public, anon, authenticated;
revoke insert, update, delete on app.team_member_configs from public, anon, authenticated;
revoke insert(id,admin_user_id,member_user_id,enabled_features,created_at), update(id,admin_user_id,member_user_id,enabled_features,created_at) on public.team_member_configs from public, anon, authenticated;
revoke insert(id,admin_user_id,member_user_id,enabled_features,created_at), update(id,admin_user_id,member_user_id,enabled_features,created_at) on app.team_member_configs from public, anon, authenticated;
create policy qg_team_insert_rpc_only on public.team_member_configs as restrictive for insert to authenticated,anon with check(false);
create policy qg_team_update_rpc_only on public.team_member_configs as restrictive for update to authenticated,anon using(false) with check(false);
create policy qg_team_delete_rpc_only on public.team_member_configs as restrictive for delete to authenticated,anon using(false);
