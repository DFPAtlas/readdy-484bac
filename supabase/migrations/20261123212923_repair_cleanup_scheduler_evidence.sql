-- Restore the existing postgres-owned scheduler without trusting SECURITY DEFINER current_user.
-- Retain every target, retention interval and deletion predicate. No cleanup is invoked here.
begin;

CREATE OR REPLACE FUNCTION public.fn_cleanup_admin_registration_audit()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_count integer := 0;
  v_log_id uuid;
  v_retention integer := 180;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT coalesce((session_user = 'postgres'
       AND current_setting('role', true) IN ('none', 'postgres')
       AND nullif(current_setting('request.jwt.claims', true), '') IS NULL
       AND nullif(current_setting('request.jwt.claim.role', true), '') IS NULL), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Access denied';
  END IF;
  v_log_id := extensions.gen_random_uuid();
  INSERT INTO public.cleanup_log (id, table_name, retention_days, started_at)
  VALUES (v_log_id, 'admin_registration_audit', v_retention, now());

  WITH deleted AS (
    DELETE FROM public.admin_registration_audit
    WHERE created_at < now() - (v_retention || ' days')::interval
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM deleted;

  UPDATE public.cleanup_log
  SET rows_removed = v_count,
      finished_at = now(),
      status = 'completed'
  WHERE id = v_log_id;
END;
$function$;

revoke all on function public.fn_cleanup_admin_registration_audit() from public, anon, authenticated;
grant execute on function public.fn_cleanup_admin_registration_audit() to service_role;

CREATE OR REPLACE FUNCTION public.fn_cleanup_email_queue()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_count integer := 0;
  v_log_id uuid;
  v_retention integer := 90;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT coalesce((session_user = 'postgres'
       AND current_setting('role', true) IN ('none', 'postgres')
       AND nullif(current_setting('request.jwt.claims', true), '') IS NULL
       AND nullif(current_setting('request.jwt.claim.role', true), '') IS NULL), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Access denied';
  END IF;
  v_log_id := extensions.gen_random_uuid();
  INSERT INTO public.cleanup_log (id, table_name, retention_days, started_at)
  VALUES (v_log_id, 'email_queue', v_retention, now());

  WITH deleted AS (
    DELETE FROM public.email_queue
    WHERE created_at < now() - (v_retention || ' days')::interval
      AND status IN ('sent', 'failed', 'cancelled')
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM deleted;

  UPDATE public.cleanup_log
  SET rows_removed = v_count,
      finished_at = now(),
      status = 'completed'
  WHERE id = v_log_id;
END;
$function$;

revoke all on function public.fn_cleanup_email_queue() from public, anon, authenticated;
grant execute on function public.fn_cleanup_email_queue() to service_role;

CREATE OR REPLACE FUNCTION public.fn_cleanup_email_send_log()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_count integer := 0;
  v_log_id uuid;
  v_retention integer := 90;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT coalesce((session_user = 'postgres'
       AND current_setting('role', true) IN ('none', 'postgres')
       AND nullif(current_setting('request.jwt.claims', true), '') IS NULL
       AND nullif(current_setting('request.jwt.claim.role', true), '') IS NULL), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Access denied';
  END IF;
  v_log_id := extensions.gen_random_uuid();
  INSERT INTO public.cleanup_log (id, table_name, retention_days, started_at)
  VALUES (v_log_id, 'email_send_log', v_retention, now());

  WITH deleted AS (
    DELETE FROM public.email_send_log
    WHERE created_at < now() - (v_retention || ' days')::interval
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM deleted;

  UPDATE public.cleanup_log
  SET rows_removed = v_count,
      finished_at = now(),
      status = 'completed'
  WHERE id = v_log_id;
END;
$function$;

revoke all on function public.fn_cleanup_email_send_log() from public, anon, authenticated;
grant execute on function public.fn_cleanup_email_send_log() to service_role;

CREATE OR REPLACE FUNCTION public.fn_cleanup_notifications()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_count integer := 0;
  v_log_id uuid;
  v_retention integer := 180;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT coalesce((session_user = 'postgres'
       AND current_setting('role', true) IN ('none', 'postgres')
       AND nullif(current_setting('request.jwt.claims', true), '') IS NULL
       AND nullif(current_setting('request.jwt.claim.role', true), '') IS NULL), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Access denied';
  END IF;
  v_log_id := extensions.gen_random_uuid();
  INSERT INTO public.cleanup_log (id, table_name, retention_days, started_at)
  VALUES (v_log_id, 'notifications', v_retention, now());

  WITH deleted AS (
    DELETE FROM public.notifications
    WHERE created_at < now() - (v_retention || ' days')::interval
      AND (read = true OR is_read = true)
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM deleted;

  UPDATE public.cleanup_log
  SET rows_removed = v_count,
      finished_at = now(),
      status = 'completed'
  WHERE id = v_log_id;
END;
$function$;

revoke all on function public.fn_cleanup_notifications() from public, anon, authenticated;
grant execute on function public.fn_cleanup_notifications() to service_role;

CREATE OR REPLACE FUNCTION public.fn_cleanup_processed_stripe_events()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_count integer := 0;
  v_log_id uuid;
  v_retention integer := 365;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT coalesce((session_user = 'postgres'
       AND current_setting('role', true) IN ('none', 'postgres')
       AND nullif(current_setting('request.jwt.claims', true), '') IS NULL
       AND nullif(current_setting('request.jwt.claim.role', true), '') IS NULL), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Access denied';
  END IF;
  v_log_id := extensions.gen_random_uuid();
  INSERT INTO public.cleanup_log (id, table_name, retention_days, started_at)
  VALUES (v_log_id, 'processed_stripe_events', v_retention, now());

  WITH deleted AS (
    DELETE FROM public.processed_stripe_events
    WHERE processed_at < now() - (v_retention || ' days')::interval
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM deleted;

  UPDATE public.cleanup_log
  SET rows_removed = v_count,
      finished_at = now(),
      status = 'completed'
  WHERE id = v_log_id;
END;
$function$;

revoke all on function public.fn_cleanup_processed_stripe_events() from public, anon, authenticated;
grant execute on function public.fn_cleanup_processed_stripe_events() to service_role;

CREATE OR REPLACE FUNCTION public.fn_cleanup_rate_limit_events()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_count integer := 0;
  v_log_id uuid;
  v_retention integer := 7;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT coalesce((session_user = 'postgres'
       AND current_setting('role', true) IN ('none', 'postgres')
       AND nullif(current_setting('request.jwt.claims', true), '') IS NULL
       AND nullif(current_setting('request.jwt.claim.role', true), '') IS NULL), false) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Access denied';
  END IF;
  v_log_id := extensions.gen_random_uuid();
  INSERT INTO public.cleanup_log (id, table_name, retention_days, started_at)
  VALUES (v_log_id, 'rate_limit_events', v_retention, now());

  WITH deleted AS (
    DELETE FROM public.rate_limit_events
    WHERE attempted_at < now() - (v_retention || ' days')::interval
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM deleted;

  UPDATE public.cleanup_log
  SET rows_removed = v_count,
      finished_at = now(),
      status = 'completed'
  WHERE id = v_log_id;
END;
$function$;

revoke all on function public.fn_cleanup_rate_limit_events() from public, anon, authenticated;
grant execute on function public.fn_cleanup_rate_limit_events() to service_role;

-- Keep private maintenance evidence in the existing service-only invoker RPC.
create or replace function app.get_admin_maintenance_snapshot(
  p_offset integer default 0, p_limit integer default 20
) returns jsonb
language sql stable security invoker set search_path = ''
as $function$
  with cleanup_evidence as (
    select count(distinct table_name) as recent_completed_tables
    from public.cleanup_log
    where table_name in ('rate_limit_events', 'email_send_log', 'admin_registration_audit',
      'email_queue', 'notifications', 'processed_stripe_events')
      and status = 'completed' and started_at >= now() - interval '48 hours'
      and started_at <= now() and finished_at >= started_at and finished_at <= now()
  )
  select jsonb_build_object(
    'cron_jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'jobid', j.jobid, 'jobname', j.jobname, 'schedule', j.schedule,
        'active', j.active,
        'last_run', (select jsonb_build_object(
          'status', r.status, 'start_time', r.start_time, 'end_time', r.end_time,
          'return_message', case when r.status = 'failed'
            then 'Run failed. Review database logs for details.' else r.status end
        ) from cron.job_run_details r where r.jobid = j.jobid
          order by r.start_time desc nulls last, r.runid desc limit 1),
        'run_count_7d', (select count(*) from cron.job_run_details r
          where r.jobid = j.jobid and r.start_time > now() - interval '7 days')
      ) order by j.jobid) from cron.job j
    ), '[]'::jsonb),
    'cleanup', jsonb_build_object(
      'status', case when exists (select 1 from public.cleanup_log where status = 'failed')
        then 'degraded' when (select recent_completed_tables from cleanup_evidence) = 6
        then 'healthy' else 'degraded' end,
      'recent_completed_tables', (select recent_completed_tables from cleanup_evidence),
      'required_tables', 6,
      'last_run', (select jsonb_build_object('table', table_name, 'at', started_at,
        'rows_removed', rows_removed) from public.cleanup_log where status = 'completed'
        order by started_at desc, id desc limit 1),
      'last_failure', (select jsonb_build_object('table', table_name, 'at', started_at,
        'error', error_message) from public.cleanup_log where status = 'failed'
        order by started_at desc, id desc limit 1),
      'total_count', (select count(*) from public.cleanup_log),
      'logs', coalesce((select jsonb_agg(to_jsonb(log) order by started_at desc, id desc)
        from (select id, table_name, rows_removed, retention_days, started_at,
          finished_at, status, error_message from public.cleanup_log
          order by started_at desc, id desc
          offset greatest(coalesce(p_offset, 0), 0)
          limit least(greatest(coalesce(p_limit, 20), 1), 100)) log), '[]'::jsonb)
    )
  );
$function$;
revoke all on function app.get_admin_maintenance_snapshot(integer, integer) from public, anon, authenticated;
grant execute on function app.get_admin_maintenance_snapshot(integer, integer) to service_role;
commit;
