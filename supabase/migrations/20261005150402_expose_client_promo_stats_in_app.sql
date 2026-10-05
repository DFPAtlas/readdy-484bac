-- App-schema callers need aggregate promotional availability, not client records.
-- Reuse the existing calculation and canonical config without altering promotion rules.
CREATE OR REPLACE FUNCTION app.get_client_promo_stats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT jsonb_build_object(
    'counts', stats->'counts',
    'caps', stats->'caps',
    'tier3_window_end', stats->'tier3_window_end'
  )
  FROM (SELECT public.get_client_promo_stats() AS stats) aggregate_stats;
$function$;
REVOKE ALL ON FUNCTION app.get_client_promo_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app.get_client_promo_stats() TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
