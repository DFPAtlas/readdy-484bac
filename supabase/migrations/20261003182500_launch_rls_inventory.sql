-- Public schema is not exposed by this project's Data API. Keep the inventory
-- in app and service-role-only; browser clients cannot inspect table metadata.
create or replace function app.launch_rls_inventory()
returns table(schema_name text, table_name text, rls_enabled boolean)
language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  return query
    select n.nspname::text, c.relname::text, c.relrowsecurity
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'app' and c.relkind in ('r', 'p')
    order by c.relname;
end;
$$;
revoke all on function app.launch_rls_inventory() from public, anon, authenticated;
grant execute on function app.launch_rls_inventory() to service_role;
