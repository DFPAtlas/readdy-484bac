-- Intentionally public catalogue data only. Read the authoritative app rules,
-- rather than the stale public copy, without opening the operational rules table.
-- No arguments, dynamic SQL, account data, payout settings or write operations.
CREATE OR REPLACE FUNCTION app.get_public_client_pricing_fees()
RETURNS TABLE (
  plan_slug text,
  platform_fee_percent numeric,
  platform_fee_fixed_pence integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT rules.plan_slug, rules.platform_fee_percent, rules.platform_fee_fixed_pence
  FROM app.plan_fee_rules AS rules
  JOIN app.plans AS plan ON plan.slug = rules.plan_slug
  WHERE plan.active IS TRUE
    AND plan.audience = 'client'
    AND rules.plan_slug IN ('client_free', 'client-starter', 'client-pro', 'client-enterprise')
  ORDER BY rules.plan_slug;
$function$;

REVOKE ALL ON FUNCTION app.get_public_client_pricing_fees() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.get_public_client_pricing_fees() TO anon, authenticated, service_role;
COMMENT ON FUNCTION app.get_public_client_pricing_fees() IS
  'Public client-plan catalogue fees only; read-only projection of checkout rules. Anonymous access is intentional.';
