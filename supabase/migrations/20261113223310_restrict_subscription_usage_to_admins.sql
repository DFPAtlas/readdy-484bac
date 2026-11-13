CREATE OR REPLACE FUNCTION app.get_subscription_usage(
  p_client_ids uuid[],
  p_guard_ids uuid[],
  p_month_start timestamptz
)
RETURNS TABLE(entity_id uuid, usage_count bigint, entity_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT app.is_active_admin() THEN
    RAISE insufficient_privilege USING MESSAGE = 'Active administrator with MFA required';
  END IF;

  RETURN QUERY
  SELECT j.client_id, count(*), 'client'::text
  FROM app.jobs AS j
  WHERE j.client_id = ANY(p_client_ids) AND j.created_at >= p_month_start
  GROUP BY j.client_id
  UNION ALL
  SELECT a.guard_id, count(*), 'guard'::text
  FROM app.job_applications AS a
  WHERE a.guard_id = ANY(p_guard_ids) AND a.applied_at >= p_month_start
  GROUP BY a.guard_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION app.get_subscription_usage(uuid[], uuid[], timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app.get_subscription_usage(uuid[], uuid[], timestamptz)
  TO authenticated, service_role;
