-- Service-only metadata read; exposes no table rows or private-schema metadata.
CREATE OR REPLACE FUNCTION app.get_admin_infrastructure_snapshot()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog
AS $snapshot$
WITH relations AS (
  SELECT c.oid,n.nspname::text schema_name,c.relname::text table_name,
    c.relrowsecurity rls_enabled,
    (NOT c.relrowsecurity AND has_schema_privilege('anon',n.oid,'USAGE')
      AND has_table_privilege('anon',c.oid,'SELECT')) public_access
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind IN ('r','p') AND n.nspname IN ('app','public')
)
SELECT jsonb_build_object(
  'tables',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY schema_name,table_name),'[]'::jsonb)
    FROM (SELECT schema_name,table_name,rls_enabled,public_access FROM relations) t),
  'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY schema_name,table_name),'[]'::jsonb)
    FROM (SELECT r.schema_name,r.table_name,count(p.oid) policy_count FROM relations r
      LEFT JOIN pg_policy p ON p.polrelid=r.oid GROUP BY r.schema_name,r.table_name) p),
  'indexes',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY schema_name,table_name),'[]'::jsonb)
    FROM (SELECT r.schema_name,r.table_name,count(i.indexrelid) index_count FROM relations r
      LEFT JOIN pg_index i ON i.indrelid=r.oid GROUP BY r.schema_name,r.table_name) i)
);
$snapshot$;
REVOKE ALL ON FUNCTION app.get_admin_infrastructure_snapshot() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app.get_admin_infrastructure_snapshot() TO service_role;
