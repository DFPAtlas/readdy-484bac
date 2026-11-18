-- Recover the app-schema singleton from the existing legacy configuration.
-- Preserve all dates/caps and never overwrite an app configuration edited by an admin.
LOCK TABLE app.promo_config IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO app.promo_config (
  id, launch_date, tier1_cap, tier2_cap, tier3_cap, tier3_window_days,
  tier1_lifetime_fee, standard_fee, is_paused, created_at, updated_at,
  client_tier1_cap, client_tier2_cap, client_tier3_cap, client_tier3_window_days,
  client_tier1_lifetime_discount, client_tier3_free_jobs, client_standard_service_fee
)
SELECT id, launch_date, tier1_cap, tier2_cap, tier3_cap, tier3_window_days,
  tier1_lifetime_fee, standard_fee, is_paused, created_at, updated_at,
  client_tier1_cap, client_tier2_cap, client_tier3_cap, client_tier3_window_days,
  client_tier1_lifetime_discount, client_tier3_free_jobs, client_standard_service_fee
FROM public.promo_config WHERE id = 1
  AND NOT EXISTS (SELECT 1 FROM app.promo_config WHERE id = 1);

DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app.promo_config WHERE id = 1) THEN
    RAISE EXCEPTION 'Guard promotion configuration unavailable in both schemas';
  END IF;
END;
$check$;

-- Public availability summary only. No guard rows, internal fee values or writes.
CREATE OR REPLACE FUNCTION app.get_guard_promotion_summary()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT coalesce((
    SELECT jsonb_build_object(
      'configured', true,
      'isPaused', config.is_paused,
      'tier1Cap', config.tier1_cap,
      'tier2Cap', config.tier2_cap,
      'tier3Cap', config.tier3_cap,
      'tier1Remaining', greatest(0, config.tier1_cap - allocated.last_number),
      'tier2Remaining', greatest(0, config.tier2_cap - greatest(config.tier1_cap, allocated.last_number)),
      'tier3Active', NOT config.is_paused AND allocated.last_number < config.tier3_cap
        AND now() >= config.launch_date
        AND now() <= config.launch_date + config.tier3_window_days * interval '1 day',
      'tier3EndsAt', config.launch_date + config.tier3_window_days * interval '1 day'
    )
    FROM app.promo_config config
    CROSS JOIN (SELECT coalesce(max(signup_number), 0) last_number FROM app.guards) allocated
    WHERE config.id = 1
  ), '{"configured":false}'::jsonb);
$function$;
REVOKE ALL ON FUNCTION app.get_guard_promotion_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.get_guard_promotion_summary() TO anon, authenticated, service_role;
COMMENT ON FUNCTION app.get_guard_promotion_summary() IS
  'Public recognition-programme availability only. No membership discount or guard commission promise; no personal data.';
