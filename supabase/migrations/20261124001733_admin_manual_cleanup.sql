-- Manual admin execution of only the six existing schedules. No cleanup is run by this migration.
-- Preview/receipt rows are internal audit records; previews expire after five minutes.
create table app.admin_cleanup_requests (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '5 minutes',
  plan jsonb not null,
  status text not null default 'previewed' check (status in ('previewed','completed')),
  completed_at timestamptz,
  result jsonb,
  check ((status = 'previewed' and completed_at is null and result is null)
    or (status = 'completed' and completed_at is not null and result is not null))
);
alter table app.admin_cleanup_requests enable row level security;
revoke all on app.admin_cleanup_requests from public, anon, authenticated;
revoke all on app.admin_cleanup_requests from service_role;
grant select, insert, update on app.admin_cleanup_requests to service_role;
create policy admin_cleanup_requests_service on app.admin_cleanup_requests
  for all to service_role using (true) with check (true);

create function app.get_admin_cleanup_plan() returns jsonb
language plpgsql stable security invoker set search_path = ''
as $function$
declare target record;
begin
  -- Pin the reviewed routine bodies/settings. A future retention/code change needs review.
  if (select count(*) from (values
    ('fn_cleanup_admin_registration_audit', 'f760fbdb9e3734990dd55db8f5b43e29'),
    ('fn_cleanup_email_queue', '68c0e3374d0a2703229c5df0d77ae606'),
    ('fn_cleanup_email_send_log', '695773803099abe7e3fa9f080a243f2b'),
    ('fn_cleanup_notifications', '2c2fe8bfd9fb09b29f85733bd1d7e93e'),
    ('fn_cleanup_processed_stripe_events', '8092a7aaedab0ab12f3f71d0c55d4727'),
    ('fn_cleanup_rate_limit_events', '9dc05b8b8e218bdfe30d40732319785e')
  ) expected(name, source_hash)
  join pg_catalog.pg_namespace n on n.nspname = 'public'
  join pg_catalog.pg_proc p on p.pronamespace = n.oid and p.proname = expected.name
    and p.pronargs = 0 and p.prosecdef and p.proowner = 'postgres'::regrole
    and p.proconfig = array['search_path=""']::text[] and md5(p.prosrc) = expected.source_hash) <> 6 then
    raise exception using errcode='PCL05', message='Cleanup definitions changed';
  end if;
  if exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid in ('public.admin_registration_audit'::regclass, 'public.email_queue'::regclass,
      'public.email_send_log'::regclass, 'public.notifications'::regclass,
      'public.processed_stripe_events'::regclass, 'public.rate_limit_events'::regclass,
      'public.cleanup_log'::regclass, 'app.email_queue'::regclass,
      'app.notifications'::regclass, 'app.processed_stripe_events'::regclass,
      'app.admin_activity_log'::regclass, 'app.admin_cleanup_requests'::regclass)
      and not t.tgisinternal and ((t.tgtype & 8) <> 0 or t.tgrelid in ('public.cleanup_log'::regclass, 'app.admin_activity_log'::regclass, 'app.admin_cleanup_requests'::regclass))
  ) or exists (
    select 1 from pg_catalog.pg_rewrite r where r.ev_class in (
      'public.admin_registration_audit'::regclass, 'public.email_queue'::regclass,
      'public.email_send_log'::regclass, 'public.notifications'::regclass,
      'public.processed_stripe_events'::regclass, 'public.rate_limit_events'::regclass,
      'public.cleanup_log'::regclass, 'app.email_queue'::regclass,
      'app.notifications'::regclass, 'app.processed_stripe_events'::regclass,
      'app.admin_activity_log'::regclass, 'app.admin_cleanup_requests'::regclass)
      and not (r.rulename = '_RETURN' and r.ev_type = '1' and r.is_instead
        and r.ev_class in ('public.email_queue'::regclass, 'public.notifications'::regclass,
          'public.processed_stripe_events'::regclass))
  ) then
    raise exception using errcode='PCL05', message='Cleanup configuration requires review';
  end if;
  -- These three public compatibility views must still reference only their matching
  -- app table. Do not broaden retention onto a different relation or a function-backed view.
  for target in select * from (values
    ('email_queue'), ('notifications'), ('processed_stripe_events')
  ) as views(table_name) loop
    if not exists (select 1 from pg_catalog.pg_class c where c.oid = format('public.%I', target.table_name)::regclass and c.relkind = 'v')
      or not exists (select 1 from pg_catalog.pg_rewrite r join pg_catalog.pg_depend d on d.classid = 'pg_rewrite'::regclass and d.objid = r.oid
        where r.ev_class = format('public.%I', target.table_name)::regclass
          and d.refclassid = 'pg_class'::regclass and d.refobjid = format('app.%I', target.table_name)::regclass)
      or exists (select 1 from pg_catalog.pg_rewrite r join pg_catalog.pg_depend d on d.classid = 'pg_rewrite'::regclass and d.objid = r.oid
        where r.ev_class = format('public.%I', target.table_name)::regclass
          and (d.refclassid = 'pg_proc'::regclass or (d.refclassid = 'pg_class'::regclass
            and d.refobjid not in (r.ev_class, format('app.%I', target.table_name)::regclass)))) then
      raise exception using errcode='PCL05', message='Cleanup target mapping changed';
    end if;
  end loop;

  if exists (select 1 from pg_catalog.pg_constraint c where c.contype = 'f'
    and c.confrelid in ('public.admin_registration_audit'::regclass, 'public.email_send_log'::regclass,
      'public.rate_limit_events'::regclass, 'app.email_queue'::regclass,
      'app.notifications'::regclass, 'app.processed_stripe_events'::regclass)
    and c.confdeltype in ('c','n','d')) then
    raise exception using errcode='PCL05', message='Cleanup would cause additional reference changes';
  end if;

  return jsonb_build_object('inventory', app.get_admin_cleanup_inventory(), 'fingerprints', (
    select jsonb_object_agg(table_name, fingerprint) from (
      select 'admin_registration_audit'::text table_name,
        md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by id), '')) fingerprint
      from public.admin_registration_audit t where created_at < now() - interval '180 days'
      union all select 'email_queue', md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by id), ''))
      from public.email_queue t where created_at < now() - interval '90 days' and status in ('sent','failed','cancelled')
      union all select 'email_send_log', md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by id), ''))
      from public.email_send_log t where created_at < now() - interval '90 days'
      union all select 'notifications', md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by id), ''))
      from public.notifications t where created_at < now() - interval '180 days' and (read = true or is_read = true)
      union all select 'processed_stripe_events', md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by id), ''))
      from public.processed_stripe_events t where processed_at < now() - interval '365 days'
      union all select 'rate_limit_events', md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by id), ''))
      from public.rate_limit_events t where attempted_at < now() - interval '7 days'
    ) fingerprints
  ));
end;
$function$;
revoke all on function app.get_admin_cleanup_plan() from public, anon, authenticated;
grant execute on function app.get_admin_cleanup_plan() to service_role;

create function app.admin_manual_cleanup(
  p_actor_user_id uuid, p_action text, p_request_id uuid default null, p_confirmed boolean default false
) returns jsonb
language plpgsql security invoker set search_path = ''
as $function$
declare
  actor record;
  request app.admin_cleanup_requests%rowtype;
  current_plan jsonb;
  after_inventory jsonb;
  target jsonb;
  before_target jsonb;
  after_target jsonb;
  before_log_ids uuid[];
  completion public.cleanup_log%rowtype;
  new_log_count integer;
  outcomes jsonb := '[]'::jsonb;
  removed_total bigint := 0;
  receipt jsonb;
begin
  if p_action is null or p_action not in ('preview','execute','status') then
    raise exception using errcode='22023', message='Invalid cleanup action';
  end if;
  select a.id,a.email,a.full_name,a.role into actor from app.admin_users a
  where a.user_id = p_actor_user_id and a.is_active = true and a.role in ('super_admin','admin')
    and not exists (select 1 from app.account_closures c where c.user_id = p_actor_user_id)
  for share;
  if not found then raise exception using errcode='PCL01', message='Admin access required'; end if;

  if p_action = 'preview' then
    current_plan := app.get_admin_cleanup_plan();
    insert into app.admin_cleanup_requests(actor_user_id,plan)
      values(p_actor_user_id,current_plan) returning * into request;
  else
    if p_request_id is null then raise exception using errcode='22023', message='Request ID required'; end if;
    perform pg_catalog.set_config('lock_timeout','2s',true);
    select * into request from app.admin_cleanup_requests r
      where r.id = p_request_id and r.actor_user_id = p_actor_user_id for update nowait;
    if not found then raise exception using errcode='PCL02', message='Request not found'; end if;
    if request.status = 'completed' then return request.result; end if;
  end if;

  if p_action <> 'execute' then
    if request.expires_at <= clock_timestamp() or
      (p_action = 'status' and (app.get_admin_cleanup_plan()->'fingerprints') is distinct from (request.plan->'fingerprints')) then
      return jsonb_build_object('status','preview_expired','request_id',request.id);
    end if;
    return jsonb_build_object('status','previewed','request_id',request.id,
      'expires_at',request.expires_at,'inventory',request.plan->'inventory');
  end if;
  if p_confirmed is distinct from true then
    raise exception using errcode='PCL04', message='Explicit confirmation required';
  end if;
  if request.expires_at <= clock_timestamp() then
    raise exception using errcode='PCL03', message='Preview expired';
  end if;

  -- Serialize with existing cron's log-first lock order; no cron configuration lock/grant.
  lock table public.cleanup_log in share row exclusive mode;
  lock table public.admin_registration_audit, public.email_queue, public.email_send_log,
    public.notifications, public.processed_stripe_events, public.rate_limit_events,
    app.email_queue, app.notifications, app.processed_stripe_events in share row exclusive mode;
  if request.expires_at <= clock_timestamp() then raise exception using errcode='PCL03', message='Preview expired'; end if;
  current_plan := app.get_admin_cleanup_plan();
  if current_plan->'fingerprints' is distinct from request.plan->'fingerprints' then
    raise exception using errcode='PCL03', message='Eligible records changed; review a new preview';
  end if;

  for target in select value from jsonb_array_elements(current_plan #> '{inventory,targets}') loop
    select coalesce(array_agg(id), '{}'::uuid[]) into before_log_ids
      from public.cleanup_log where table_name = target->>'table_name';
    case target->>'table_name'
      when 'admin_registration_audit' then perform public.fn_cleanup_admin_registration_audit();
      when 'email_queue' then perform public.fn_cleanup_email_queue();
      when 'email_send_log' then perform public.fn_cleanup_email_send_log();
      when 'notifications' then perform public.fn_cleanup_notifications();
      when 'processed_stripe_events' then perform public.fn_cleanup_processed_stripe_events();
      when 'rate_limit_events' then perform public.fn_cleanup_rate_limit_events();
      else raise exception using errcode='PCL05', message='Unexpected cleanup target';
    end case;
    select count(*) into new_log_count from public.cleanup_log l
      where l.table_name = target->>'table_name' and not (l.id = any(before_log_ids));
    if new_log_count <> 1 then raise exception using errcode='PCL06', message='Completion evidence not confirmed'; end if;
    select * into strict completion from public.cleanup_log l
      where l.table_name = target->>'table_name' and not (l.id = any(before_log_ids));
    if completion.status <> 'completed' or completion.rows_removed is null
      or completion.rows_removed <> (target->>'eligible_rows')::bigint
      or completion.retention_days <> (target->>'retention_days')::integer
      or completion.started_at is null or completion.finished_at is null then
      raise exception using errcode='PCL06', message='Completion evidence not confirmed';
    end if;
    removed_total := removed_total + completion.rows_removed;
    outcomes := outcomes || jsonb_build_array(jsonb_build_object(
      'table_name',completion.table_name,'rows_removed',completion.rows_removed,
      'retention_days',completion.retention_days,'cleanup_log_id',completion.id));
  end loop;
  after_inventory := app.get_admin_cleanup_inventory();
  for before_target in select value from jsonb_array_elements(current_plan #> '{inventory,targets}') loop
    select value into after_target from jsonb_array_elements(after_inventory->'targets')
      where value->>'table_name' = before_target->>'table_name';
    if (after_target->>'total_rows')::bigint is distinct from
       (before_target->>'total_rows')::bigint - (before_target->>'eligible_rows')::bigint then
      raise exception using errcode='PCL06', message='Cleanup record counts not confirmed';
    end if;
  end loop;
  receipt := jsonb_build_object('status','completed','request_id',request.id,
    'completed_at',now(),'results',outcomes,'total_removed',removed_total);
  insert into app.admin_activity_log(admin_username,admin_name,admin_user_id,
    action_type,action_description,target_type,target_name,metadata,changes)
  values(actor.email,actor.full_name,actor.id,'manual_cleanup_completed',
    'Confirmed manual execution of the six existing scheduled cleanup routines',
    'maintenance','Scheduled cleanup',
    jsonb_build_object('request_id',request.id,'actor_user_id',p_actor_user_id,
      'admin_role',actor.role,'previewed_at',request.created_at,'receipt',receipt),
    jsonb_build_object('before',current_plan->'inventory','after',after_inventory));
  update app.admin_cleanup_requests set status='completed',completed_at=now(),result=receipt where id=request.id;
  return receipt;
end;
$function$;
revoke all on function app.admin_manual_cleanup(uuid,text,uuid,boolean) from public, anon, authenticated;
grant execute on function app.admin_manual_cleanup(uuid,text,uuid,boolean) to service_role;
