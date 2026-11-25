-- Read cron history once instead of twice per configured job.
-- Keep the existing signature, JSON contract, cleanup evidence and pagination.
-- CREATE OR REPLACE preserves owner and existing service-only EXECUTE grants.
do $guard$
begin
  if to_regprocedure('app.get_admin_maintenance_snapshot(integer,integer)') is null then
    raise exception 'Existing maintenance snapshot function is required';
  end if;
end
$guard$;

CREATE OR REPLACE FUNCTION app.get_admin_maintenance_snapshot(p_offset integer DEFAULT 0, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY INVOKER
 STABLE
 SET search_path TO ''
AS $function$
  with cron_history as materialized (
    select jobid, runid, status, start_time, end_time,
      count(*) filter (where start_time > now() - interval '7 days')
        over (partition by jobid) as run_count_7d
    from cron.job_run_details
  ), latest_cron_runs as (
    select distinct on (jobid) jobid, status, start_time, end_time, run_count_7d
    from cron_history
    order by jobid, start_time desc nulls last, runid desc
  ), cleanup_evidence as (
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
        'last_run', case when h.jobid is null then null else jsonb_build_object(
          'status', h.status, 'start_time', h.start_time, 'end_time', h.end_time,
          'return_message', case when h.status = 'failed'
            then 'Run failed. Review database logs for details.' else h.status end
        ) end,
        'run_count_7d', coalesce(h.run_count_7d, 0)
      ) order by j.jobid) from cron.job j
      left join latest_cron_runs h on h.jobid = j.jobid
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
