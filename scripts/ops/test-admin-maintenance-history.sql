begin;
create schema qg_maintenance_fixture_20261125;
create table qg_maintenance_fixture_20261125.job(jobid bigint primary key, jobname text, schedule text,active boolean);
create table qg_maintenance_fixture_20261125.job_run_details(jobid bigint,runid bigint primary key,status text,start_time timestamptz,end_time timestamptz,return_message text);
create table qg_maintenance_fixture_20261125.cleanup_log(id uuid primary key,table_name text,started_at timestamptz,finished_at timestamptz,status text,rows_removed bigint,retention_days int,error_message text);
CREATE OR REPLACE FUNCTION qg_maintenance_fixture_20261125.baseline(p_offset integer DEFAULT 0, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with cleanup_evidence as (
    select count(distinct table_name) as recent_completed_tables
    from qg_maintenance_fixture_20261125.cleanup_log
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
        ) from qg_maintenance_fixture_20261125.job_run_details r where r.jobid = j.jobid
          order by r.start_time desc nulls last, r.runid desc limit 1),
        'run_count_7d', (select count(*) from qg_maintenance_fixture_20261125.job_run_details r
          where r.jobid = j.jobid and r.start_time > now() - interval '7 days')
      ) order by j.jobid) from qg_maintenance_fixture_20261125.job j
    ), '[]'::jsonb),
    'cleanup', jsonb_build_object(
      'status', case when exists (select 1 from qg_maintenance_fixture_20261125.cleanup_log where status = 'failed')
        then 'degraded' when (select recent_completed_tables from cleanup_evidence) = 6
        then 'healthy' else 'degraded' end,
      'recent_completed_tables', (select recent_completed_tables from cleanup_evidence),
      'required_tables', 6,
      'last_run', (select jsonb_build_object('table', table_name, 'at', started_at,
        'rows_removed', rows_removed) from qg_maintenance_fixture_20261125.cleanup_log where status = 'completed'
        order by started_at desc, id desc limit 1),
      'last_failure', (select jsonb_build_object('table', table_name, 'at', started_at,
        'error', error_message) from qg_maintenance_fixture_20261125.cleanup_log where status = 'failed'
        order by started_at desc, id desc limit 1),
      'total_count', (select count(*) from qg_maintenance_fixture_20261125.cleanup_log),
      'logs', coalesce((select jsonb_agg(to_jsonb(log) order by started_at desc, id desc)
        from (select id, table_name, rows_removed, retention_days, started_at,
          finished_at, status, error_message from qg_maintenance_fixture_20261125.cleanup_log
          order by started_at desc, id desc
          offset greatest(coalesce(p_offset, 0), 0)
          limit least(greatest(coalesce(p_limit, 20), 1), 100)) log), '[]'::jsonb)
    )
  );
$function$;

CREATE OR REPLACE FUNCTION qg_maintenance_fixture_20261125.optimized(p_offset integer DEFAULT 0, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with cron_history as materialized (
    select jobid, runid, status, start_time, end_time,
      count(*) filter (where start_time > now() - interval '7 days')
        over (partition by jobid) as run_count_7d
    from qg_maintenance_fixture_20261125.job_run_details
  ), latest_cron_runs as (
    select distinct on (jobid) jobid, status, start_time, end_time, run_count_7d
    from cron_history
    order by jobid, start_time desc nulls last, runid desc
  ), cleanup_evidence as (
    select count(distinct table_name) as recent_completed_tables
    from qg_maintenance_fixture_20261125.cleanup_log
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
      ) order by j.jobid) from qg_maintenance_fixture_20261125.job j
      left join latest_cron_runs h on h.jobid = j.jobid
    ), '[]'::jsonb),
    'cleanup', jsonb_build_object(
      'status', case when exists (select 1 from qg_maintenance_fixture_20261125.cleanup_log where status = 'failed')
        then 'degraded' when (select recent_completed_tables from cleanup_evidence) = 6
        then 'healthy' else 'degraded' end,
      'recent_completed_tables', (select recent_completed_tables from cleanup_evidence),
      'required_tables', 6,
      'last_run', (select jsonb_build_object('table', table_name, 'at', started_at,
        'rows_removed', rows_removed) from qg_maintenance_fixture_20261125.cleanup_log where status = 'completed'
        order by started_at desc, id desc limit 1),
      'last_failure', (select jsonb_build_object('table', table_name, 'at', started_at,
        'error', error_message) from qg_maintenance_fixture_20261125.cleanup_log where status = 'failed'
        order by started_at desc, id desc limit 1),
      'total_count', (select count(*) from qg_maintenance_fixture_20261125.cleanup_log),
      'logs', coalesce((select jsonb_agg(to_jsonb(log) order by started_at desc, id desc)
        from (select id, table_name, rows_removed, retention_days, started_at,
          finished_at, status, error_message from qg_maintenance_fixture_20261125.cleanup_log
          order by started_at desc, id desc
          offset greatest(coalesce(p_offset, 0), 0)
          limit least(greatest(coalesce(p_limit, 20), 1), 100)) log), '[]'::jsonb)
    )
  );
$function$;

do $test$
declare a jsonb;b jsonb;
begin
select qg_maintenance_fixture_20261125.baseline() into a;
select qg_maintenance_fixture_20261125.optimized() into b;
if a is distinct from b or a->'cron_jobs'<>'[]'::jsonb or a->'cleanup'->>'status'<>'degraded' then raise exception 'empty mismatch';end if;
end $test$;
insert into qg_maintenance_fixture_20261125.job
select n,'fixture-'||n,'0 * * * *',n%2=0 from generate_series(0,5)n;
insert into qg_maintenance_fixture_20261125.job_run_details values
(1,1,'succeeded',now()-interval '1 hour',now(),'private-result'),
(1,2,'failed',now()-interval '1 hour',null,'PRIVATE-DO-NOT-EXPOSE'),
(1,3,'succeeded',null,null,'null-start'),
(2,4,'running',null,null,'null-start'),
(2,5,'failed',null,null,'PRIVATE-DO-NOT-EXPOSE'),
(3,6,'succeeded',now()-interval '8 days',now()-interval '8 days','old'),
(4,7,'running',now()+interval '1 hour',null,'future'),
(5,8,'succeeded',now()-interval '7 days',now()-interval '7 days','boundary'),
(5,9,'succeeded',now()-interval '2 days',now()-interval '2 days','recent'),
(99,10,'failed',now(),null,'orphan');
insert into qg_maintenance_fixture_20261125.cleanup_log
select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,t,now()-interval '1 hour',now(),'completed',0,90,null
from unnest(array['rate_limit_events','email_send_log','admin_registration_audit','email_queue','notifications','processed_stripe_events']) with ordinality u(t,n);
do $test$
declare a jsonb;b jsonb;p record;
begin
for p in select * from (values (null::int,null::int),(-10,0),(0,1),(1,3),(0,500),(99,10),(0,20)) x(o,l) loop
a:=qg_maintenance_fixture_20261125.baseline(p.o,p.l);b:=qg_maintenance_fixture_20261125.optimized(p.o,p.l);
if a is distinct from b then raise exception 'pagination mismatch %, %',p.o,p.l;end if;
end loop;
if b->'cleanup'->>'status'<>'healthy' then raise exception 'fresh evidence mismatch';end if;
if b->'cron_jobs'->0->'last_run'<>'null'::jsonb then raise exception 'never-run mismatch';end if;
if b->'cron_jobs'->1->'last_run'->>'status'<>'failed' then raise exception 'tied-start mismatch';end if;
if b->'cron_jobs'->2->'last_run'->>'status'<>'failed' then raise exception 'null-start mismatch';end if;
if (b->'cron_jobs'->3->>'run_count_7d')::int<>0 then raise exception 'old count mismatch';end if;
if (b->'cron_jobs'->4->>'run_count_7d')::int<>1 then raise exception 'future parity mismatch';end if;
if (b->'cron_jobs'->5->>'run_count_7d')::int<>1 then raise exception '7-day boundary mismatch';end if;
if b::text like '%PRIVATE-DO-NOT-EXPOSE%' then raise exception 'private cron payload exposed';end if;
end $test$;
update qg_maintenance_fixture_20261125.cleanup_log set started_at=now()-interval '49 hours',finished_at=now()-interval '48 hours';
do $test$ begin
if qg_maintenance_fixture_20261125.baseline() is distinct from qg_maintenance_fixture_20261125.optimized() or qg_maintenance_fixture_20261125.optimized()->'cleanup'->>'status'<>'degraded' then raise exception 'stale evidence mismatch';end if;
end $test$;
update qg_maintenance_fixture_20261125.cleanup_log set status='failed',error_message='fixture failure' where table_name='email_queue';
do $test$ begin
if qg_maintenance_fixture_20261125.baseline() is distinct from qg_maintenance_fixture_20261125.optimized() or qg_maintenance_fixture_20261125.optimized()->'cleanup'->'last_failure'->>'error'<>'fixture failure' then raise exception 'failure parity mismatch';end if;
end $test$;
rollback;
select 'PASS' as result, 'Empty history; 7 pagination/bounds cases; no-run, tied, null, old, future, boundary and orphan histories; redaction; fresh/stale/failed cleanup parity; all fixture DDL/data rolled back' as checks;