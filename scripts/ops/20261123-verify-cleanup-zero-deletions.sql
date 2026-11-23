-- Run only after repair_cleanup_scheduler_evidence. Performs six real, zero-removal runs.
-- Locks preserve the checked row set. Any eligible row, custom trigger/rule, changed
-- target data, or unexpected completion record aborts the entire transaction.
-- This is not a general-purpose cleanup command and must not be weakened to purge data.
begin;
set local lock_timeout = '5s';
lock table public.admin_registration_audit, public.email_queue, public.email_send_log,
  public.notifications, public.processed_stripe_events, public.rate_limit_events,
  public.cleanup_log, app.email_queue, app.notifications, app.processed_stripe_events
  in share row exclusive mode;
-- Supabase owns cron.job: compare its configuration without requiring write/lock privileges.

do $verify$
declare
  target record;
  before_targets jsonb := '{}'::jsonb;
  before_cron text;
  after_cron text;
  before_logs bigint;
  eligible bigint;
  fingerprint text;
begin
  if session_user <> 'postgres' or current_setting('role', true) not in ('none', 'postgres')
     or auth.role() is not null
     or nullif(current_setting('request.jwt.claims', true), '') is not null
     or nullif(current_setting('request.jwt.claim.role', true), '') is not null then
    raise exception 'Verification requires the trusted postgres scheduler context';
  end if;
  if exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid in ('public.admin_registration_audit'::regclass, 'public.email_queue'::regclass,
      'public.email_send_log'::regclass, 'public.notifications'::regclass,
      'public.processed_stripe_events'::regclass, 'public.rate_limit_events'::regclass,
      'public.cleanup_log'::regclass, 'app.email_queue'::regclass,
      'app.notifications'::regclass, 'app.processed_stripe_events'::regclass)
      and not t.tgisinternal and ((t.tgtype & 8) <> 0 or t.tgrelid = 'public.cleanup_log'::regclass)
  ) or exists (
    select 1 from pg_catalog.pg_rewrite r where r.ev_class in (
      'public.admin_registration_audit'::regclass, 'public.email_queue'::regclass,
      'public.email_send_log'::regclass, 'public.notifications'::regclass,
      'public.processed_stripe_events'::regclass, 'public.rate_limit_events'::regclass,
      'public.cleanup_log'::regclass, 'app.email_queue'::regclass,
      'app.notifications'::regclass, 'app.processed_stripe_events'::regclass)
      and not (r.rulename = '_RETURN' and r.ev_type = '1' and r.is_instead
        and r.ev_class in ('public.email_queue'::regclass, 'public.notifications'::regclass,
          'public.processed_stripe_events'::regclass))
  ) then
    raise exception 'Unexpected trigger or rule: verification refused';
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
      raise exception 'Unexpected compatibility view mapping: %', target.table_name;
    end if;
    execute format('select md5(coalesce(string_agg(md5(to_jsonb(t)::text), '''' order by md5(to_jsonb(t)::text)), '''')) from app.%I t', target.table_name) into fingerprint;
    before_targets := before_targets || jsonb_build_object('app.' || target.table_name, fingerprint);
  end loop;
  select count(*) into before_logs from public.cleanup_log;
  select md5(coalesce(string_agg(to_jsonb(j)::text, '' order by jobid), ''))
    into before_cron from cron.job j;

  -- All predicates are fixed literals matching the existing scheduled functions.
  for target in select * from (values
    ('admin_registration_audit', 'created_at < now() - interval ''180 days'''),
    ('email_queue', 'created_at < now() - interval ''90 days'' and status in (''sent'',''failed'',''cancelled'')'),
    ('email_send_log', 'created_at < now() - interval ''90 days'''),
    ('notifications', 'created_at < now() - interval ''180 days'' and (read = true or is_read = true)'),
    ('processed_stripe_events', 'processed_at < now() - interval ''365 days'''),
    ('rate_limit_events', 'attempted_at < now() - interval ''7 days''')
  ) as targets(table_name, predicate) loop
    execute format('select count(*) from public.%I where %s', target.table_name, target.predicate) into eligible;
    if eligible <> 0 then
      raise exception 'Eligible rows exist in %: verification refused', target.table_name;
    end if;
    execute format('select md5(coalesce(string_agg(md5(to_jsonb(t)::text), '''' order by md5(to_jsonb(t)::text)), '''')) from public.%I t', target.table_name) into fingerprint;
    before_targets := before_targets || jsonb_build_object(target.table_name, fingerprint);
  end loop;

  perform public.fn_cleanup_admin_registration_audit();
  perform public.fn_cleanup_email_queue();
  perform public.fn_cleanup_email_send_log();
  perform public.fn_cleanup_notifications();
  perform public.fn_cleanup_processed_stripe_events();
  perform public.fn_cleanup_rate_limit_events();

  for target in select * from (values
    ('admin_registration_audit', 180), ('email_queue', 90), ('email_send_log', 90),
    ('notifications', 180), ('processed_stripe_events', 365), ('rate_limit_events', 7)
  ) as targets(table_name, retention_days) loop
    execute format('select md5(coalesce(string_agg(md5(to_jsonb(t)::text), '''' order by md5(to_jsonb(t)::text)), '''')) from public.%I t', target.table_name) into fingerprint;
    if fingerprint is distinct from before_targets ->> target.table_name then
      raise exception 'Target data changed: %', target.table_name;
    end if;
    if (select count(*) from public.cleanup_log l where l.started_at = transaction_timestamp()
      and l.finished_at >= l.started_at and l.finished_at <= now()
      and l.table_name = target.table_name and l.retention_days = target.retention_days
      and l.status = 'completed' and l.rows_removed = 0) <> 1 then
      raise exception 'Expected one actual zero-removal completion: %', target.table_name;
    end if;
  end loop;
  for target in select * from (values ('email_queue'), ('notifications'), ('processed_stripe_events')) as views(table_name) loop
    execute format('select md5(coalesce(string_agg(md5(to_jsonb(t)::text), '''' order by md5(to_jsonb(t)::text)), '''')) from app.%I t', target.table_name) into fingerprint;
    if fingerprint is distinct from before_targets ->> ('app.' || target.table_name) then
      raise exception 'Underlying app data changed: %', target.table_name;
    end if;
  end loop;
  if (select count(*) from public.cleanup_log) <> before_logs + 6 then
    raise exception 'Unexpected cleanup history change';
  end if;
  select md5(coalesce(string_agg(to_jsonb(j)::text, '' order by jobid), ''))
    into after_cron from cron.job j;
  if before_cron is distinct from after_cron then raise exception 'Cron configuration changed'; end if;
  if app.get_admin_maintenance_snapshot(0, 1) #>> '{cleanup,status}' <> 'healthy' then
    raise exception 'Fresh maintenance evidence did not validate';
  end if;
end;
$verify$;
commit;
