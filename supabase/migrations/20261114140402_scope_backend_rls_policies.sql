-- These policies already require the service role in their predicates.
SET LOCAL lock_timeout = '500ms';

ALTER POLICY "Service role manages activity log" ON app.admin_activity_log
  TO service_role;

ALTER POLICY "Service role can manage all consent" ON app.consent_records
  TO service_role;

ALTER POLICY "Service role inserts notifications" ON app.notifications
  TO service_role;

ALTER POLICY "Service role can manage pricing config" ON app.pricing_config
  TO service_role;

ALTER POLICY "processed_events_service_only" ON app.processed_events
  TO service_role;
