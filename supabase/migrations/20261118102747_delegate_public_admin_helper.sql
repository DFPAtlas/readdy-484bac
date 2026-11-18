-- Retain the legacy policy/caller entry point without a second definer context.
-- The existing app helper remains responsible for active-admin and MFA checks.
SET LOCAL lock_timeout = '500ms';

DO $migration$
DECLARE
  legacy record;
  canonical record;
  updated record;
BEGIN
  SELECT * INTO legacy FROM pg_proc WHERE oid = to_regprocedure('public.is_active_admin()');
  IF NOT FOUND THEN RAISE EXCEPTION 'Legacy admin helper is missing; review dependencies before proceeding'; END IF;
  SELECT * INTO canonical FROM pg_proc WHERE oid = to_regprocedure('app.is_active_admin()');
  IF NOT FOUND THEN RAISE EXCEPTION 'Canonical admin helper is missing'; END IF;
  IF legacy.prorettype <> 'boolean'::regtype OR canonical.prorettype <> 'boolean'::regtype
     OR legacy.proretset OR canonical.proretset OR NOT canonical.prosecdef
     OR canonical.proowner <> legacy.proowner THEN
    RAISE EXCEPTION 'Admin helper contract differs from the reviewed configuration';
  END IF;
  IF legacy.prosecdef THEN
    IF btrim(legacy.prosrc) IS DISTINCT FROM btrim(canonical.prosrc) THEN
      RAISE EXCEPTION 'Admin helper bodies differ; delegation needs a fresh review';
    END IF;
  ELSIF btrim(legacy.prosrc) IS DISTINCT FROM 'SELECT app.is_active_admin();' THEN
    RAISE EXCEPTION 'Legacy invoker helper is not the reviewed delegate';
  END IF;
  IF NOT has_schema_privilege('authenticated', 'app', 'USAGE')
     OR NOT has_function_privilege('authenticated', canonical.oid, 'EXECUTE')
     OR NOT has_schema_privilege('service_role', 'app', 'USAGE')
     OR NOT has_function_privilege('service_role', canonical.oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Existing callers cannot execute the canonical admin helper';
  END IF;

  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION public.is_active_admin()
    RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER
    SET search_path = ''
    AS $function$ SELECT app.is_active_admin(); $function$;
  $ddl$;

  SELECT * INTO updated FROM pg_proc WHERE oid = legacy.oid;
  IF NOT FOUND OR updated.prosecdef OR updated.proowner <> legacy.proowner
     OR updated.proacl IS DISTINCT FROM legacy.proacl THEN
    RAISE EXCEPTION 'Legacy helper identity, owner or grants changed unexpectedly';
  END IF;
END;
$migration$;
