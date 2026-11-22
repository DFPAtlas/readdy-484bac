-- Read private maintenance metadata through the existing MFA-protected Edge Function.
-- SECURITY INVOKER: service_role already has SELECT; no table/schema grants change.
begin;
create or replace function app.get_admin_maintenance_snapshot(
  p_offset integer default 0, p_limit integer default 20
) returns jsonb
language sql stable security invoker set search_path = ''
as $function$
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
        then 'degraded' else 'healthy' end,
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
