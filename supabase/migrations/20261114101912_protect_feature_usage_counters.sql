-- The authoritative limit checks write counters through app.check_monthly_usage().
-- Signed-in users retain their existing own-counter read policy and usage RPC.
DROP POLICY "Users can update own usage" ON app.user_feature_usage;
DROP POLICY "Users can upsert own usage" ON app.user_feature_usage;

ALTER POLICY "Admins can read all usage" ON app.user_feature_usage
  TO authenticated USING ((SELECT app.is_active_admin()));
ALTER POLICY "Admins can update all usage" ON app.user_feature_usage
  TO authenticated USING ((SELECT app.is_active_admin()))
  WITH CHECK ((SELECT app.is_active_admin()));
ALTER POLICY "Admins can upsert all usage" ON app.user_feature_usage
  TO authenticated WITH CHECK ((SELECT app.is_active_admin()));

ALTER POLICY "Admins can read all usage events" ON app.usage_events
  TO authenticated USING ((SELECT app.is_active_admin()));
