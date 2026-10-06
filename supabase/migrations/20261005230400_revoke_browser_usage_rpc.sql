-- Findings 3-4 (final step). APPLY ONLY AFTER the updated frontend is live.
-- The previous frontend called app.check_monthly_usage(p_user_id, ...) directly from
-- the browser; the repaired frontend calls app.get_my_feature_usage(feature) instead.
-- check_monthly_usage accepts any user id and an increment flag, so while browser
-- roles can execute it any caller can read, or consume, another account's allowance.
revoke execute on function app.check_monthly_usage(uuid, text, boolean) from public, anon, authenticated;
grant execute on function app.check_monthly_usage(uuid, text, boolean) to service_role;
