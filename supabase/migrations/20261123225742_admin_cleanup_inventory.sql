-- Read the exact relations and predicates used by the six existing cleanup schedules.
-- This invoker RPC never invokes a cleanup routine or changes retention/data/API exposure.
create or replace function app.get_admin_cleanup_inventory()
returns jsonb
language sql stable security invoker set search_path = ''
as $function$
  with inventory as (
    select 'email_send_log'::text as table_name, 90 as retention_days,
      count(*) as total_rows,
      count(*) filter (where created_at < now() - interval '90 days') as eligible_rows
    from public.email_send_log
    union all
    select 'admin_registration_audit', 180, count(*),
      count(*) filter (where created_at < now() - interval '180 days')
    from public.admin_registration_audit
    union all
    select 'email_queue', 90, count(*),
      count(*) filter (where created_at < now() - interval '90 days'
        and status in ('sent', 'failed', 'cancelled'))
    from public.email_queue
    union all
    select 'rate_limit_events', 7, count(*),
      count(*) filter (where attempted_at < now() - interval '7 days')
    from public.rate_limit_events
    union all
    select 'notifications', 180, count(*),
      count(*) filter (where created_at < now() - interval '180 days'
        and (read = true or is_read = true))
    from public.notifications
    union all
    select 'processed_stripe_events', 365, count(*),
      count(*) filter (where processed_at < now() - interval '365 days')
    from public.processed_stripe_events
  )
  select jsonb_build_object('sampled_at', now(), 'targets', jsonb_agg(
    jsonb_build_object('table_name', i.table_name, 'target_relation', 'public.' || i.table_name,
      'relation_type', case when c.relkind = 'v' then 'view' else 'table' end,
      'retention_days', i.retention_days, 'total_rows', i.total_rows, 'eligible_rows', i.eligible_rows)
    order by i.table_name))
  from inventory i
  join pg_catalog.pg_namespace n on n.nspname = 'public'
  join pg_catalog.pg_class c on c.relnamespace = n.oid and c.relname = i.table_name
    and c.relkind in ('r', 'p', 'v');
$function$;
revoke all on function app.get_admin_cleanup_inventory() from public, anon, authenticated;
grant execute on function app.get_admin_cleanup_inventory() to service_role;
