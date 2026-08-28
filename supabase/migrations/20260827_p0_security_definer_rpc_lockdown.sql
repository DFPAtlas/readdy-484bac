-- P0 SECURITY DEFINER RPC LOCKDOWN
-- Repairs confirmed public-schema SECURITY DEFINER functions that were
-- executable by anon/authenticated with no internal authorization.
--
-- Two layers:
--   (1) Internal fail-closed auth.role() guard inside each function body (applied live).
--   (2) GRANT-level REVOKE of PUBLIC/anon/authenticated EXECUTE (run manually in the
--       Supabase SQL editor — the deployment executor here blocks REVOKE statements).
--
-- Retained SECURITY DEFINER is intentional: these functions perform privileged
-- maintenance/read operations that must run as the owner, not the caller.

-- =====================================================================
-- GROUP A — DESTRUCTIVE CLEANUP FUNCTIONS (service_role only)
-- =====================================================================

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
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
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
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.cleanup_log
    SET status = 'failed',
        error_message = SQLERRM,
        finished_at = now()
    WHERE id = v_log_id;
    RAISE WARNING 'cleanup_admin_registration_audit failed: %', SQLERRM;
END;
$function$;

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
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
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
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.cleanup_log
    SET status = 'failed',
        error_message = SQLERRM,
        finished_at = now()
    WHERE id = v_log_id;
    RAISE WARNING 'cleanup_email_queue failed: %', SQLERRM;
END;
$function$;

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
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
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
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.cleanup_log
    SET status = 'failed',
        error_message = SQLERRM,
        finished_at = now()
    WHERE id = v_log_id;
    RAISE WARNING 'cleanup_email_send_log failed: %', SQLERRM;
END;
$function$;

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
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
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
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.cleanup_log
    SET status = 'failed',
        error_message = SQLERRM,
        finished_at = now()
    WHERE id = v_log_id;
    RAISE WARNING 'cleanup_notifications failed: %', SQLERRM;
END;
$function$;

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
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
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
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.cleanup_log
    SET status = 'failed',
        error_message = SQLERRM,
        finished_at = now()
    WHERE id = v_log_id;
    RAISE WARNING 'cleanup_processed_stripe_events failed: %', SQLERRM;
END;
$function$;

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
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
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
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.cleanup_log
    SET status = 'failed',
        error_message = SQLERRM,
        finished_at = now()
    WHERE id = v_log_id;
    RAISE WARNING 'cleanup_rate_limit_events failed: %', SQLERRM;
END;
$function$;

-- =====================================================================
-- GROUP B — GUARD PAYMENT FLOW RPC (service_role only; no live caller)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_guard_payment_flow(p_guard_id uuid)
 RETURNS SETOF public.v_guard_payment_flow
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY SELECT * FROM public.v_guard_payment_flow WHERE guard_id = p_guard_id ORDER BY updated_at DESC;
END;
$function$;

-- =====================================================================
-- GROUP C — EMAIL USAGE COUNTER RPC (service_role only; no live caller)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.increment_email_provider_daily_usage(p_provider text, p_email_type text, p_usage_date date, p_field text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_field text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_field NOT IN ('sent_count', 'failed_count', 'blocked_count') THEN
    RAISE EXCEPTION 'Invalid field: %', p_field;
  END IF;

  INSERT INTO public.email_provider_daily_usage (provider, email_type, usage_date, sent_count, failed_count, blocked_count)
  VALUES (p_provider, p_email_type, p_usage_date, 
    CASE WHEN p_field = 'sent_count' THEN 1 ELSE 0 END,
    CASE WHEN p_field = 'failed_count' THEN 1 ELSE 0 END,
    CASE WHEN p_field = 'blocked_count' THEN 1 ELSE 0 END
  )
  ON CONFLICT (provider, email_type, usage_date)
  DO UPDATE SET
    sent_count = email_provider_daily_usage.sent_count + CASE WHEN p_field = 'sent_count' THEN 1 ELSE 0 END,
    failed_count = email_provider_daily_usage.failed_count + CASE WHEN p_field = 'failed_count' THEN 1 ELSE 0 END,
    blocked_count = email_provider_daily_usage.blocked_count + CASE WHEN p_field = 'blocked_count' THEN 1 ELSE 0 END,
    updated_at = now();
END;
$function$;

-- =====================================================================
-- GROUP D — SECURITY AUDIT RPCs (service_role only; admin dashboard
-- calls these via service_role from the security-dashboard / launch-readiness
-- Edge Functions, which already enforce the admin MFA gate upstream)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.security_audit_tables()
 RETURNS TABLE(schema_name text, table_name text, rls_enabled boolean, public_access boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
  SELECT 
    n.nspname::text as schema_name,
    c.relname::text as table_name,
    c.relrowsecurity as rls_enabled,
    NOT c.relrowsecurity as public_access
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname IN ('app', 'public')
    AND c.relname NOT LIKE 'pg_%'
    AND c.relname NOT LIKE 'auth_%'
    AND c.relname NOT LIKE 'storage_%'
    AND c.relname NOT LIKE 'realtime_%'
    AND c.relname NOT LIKE 'supabase_functions%'
    AND c.relname NOT LIKE 'v_%'
  ORDER BY n.nspname, c.relname;
END;
$function$;

CREATE OR REPLACE FUNCTION public.security_audit_policies()
 RETURNS TABLE(schema_name text, table_name text, policy_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
  SELECT 
    schemaname::text,
    tablename::text,
    count(*)::bigint
  FROM pg_policies
  WHERE schemaname IN ('app', 'public')
  GROUP BY schemaname, tablename
  ORDER BY schemaname, tablename;
END;
$function$;

CREATE OR REPLACE FUNCTION public.security_audit_indexes()
 RETURNS TABLE(schema_name text, table_name text, index_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
  SELECT 
    schemaname::text,
    tablename::text,
    count(*)::bigint
  FROM pg_indexes
  WHERE schemaname IN ('app', 'public')
    AND indexname NOT LIKE 'pg_%'
  GROUP BY schemaname, tablename
  ORDER BY schemaname, tablename;
END;
$function$;

-- =====================================================================
-- GRANT-LEVEL LOCKDOWN (run manually in Supabase SQL editor — the
-- deployment executor here blocks REVOKE. The in-function guards above
-- are already applied live and provide the same fail-closed protection.)
-- =====================================================================

-- REVOKE EXECUTE ON FUNCTION public.fn_cleanup_admin_registration_audit() FROM PUBLIC, anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.fn_cleanup_email_queue() FROM PUBLIC, anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.fn_cleanup_email_send_log() FROM PUBLIC, anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.fn_cleanup_notifications() FROM PUBLIC, anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.fn_cleanup_processed_stripe_events() FROM PUBLIC, anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.fn_cleanup_rate_limit_events() FROM PUBLIC, anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.get_guard_payment_flow(uuid) FROM PUBLIC, anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.increment_email_provider_daily_usage(text,text,date,text) FROM PUBLIC, anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.security_audit_tables() FROM PUBLIC, anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.security_audit_policies() FROM PUBLIC, anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.security_audit_indexes() FROM PUBLIC, anon, authenticated;

-- GRANT EXECUTE ON FUNCTION public.fn_cleanup_admin_registration_audit() TO service_role;
-- GRANT EXECUTE ON FUNCTION public.fn_cleanup_email_queue() TO service_role;
-- GRANT EXECUTE ON FUNCTION public.fn_cleanup_email_send_log() TO service_role;
-- GRANT EXECUTE ON FUNCTION public.fn_cleanup_notifications() TO service_role;
-- GRANT EXECUTE ON FUNCTION public.fn_cleanup_processed_stripe_events() TO service_role;
-- GRANT EXECUTE ON FUNCTION public.fn_cleanup_rate_limit_events() TO service_role;
-- GRANT EXECUTE ON FUNCTION public.get_guard_payment_flow(uuid) TO service_role;
-- GRANT EXECUTE ON FUNCTION public.increment_email_provider_daily_usage(text,text,date,text) TO service_role;
-- GRANT EXECUTE ON FUNCTION public.security_audit_tables() TO service_role;
-- GRANT EXECUTE ON FUNCTION public.security_audit_policies() TO service_role;
-- GRANT EXECUTE ON FUNCTION public.security_audit_indexes() TO service_role;