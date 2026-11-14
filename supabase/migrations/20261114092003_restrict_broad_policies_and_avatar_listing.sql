-- The deployed SIA and completion handlers write with the backend service role.
ALTER POLICY "System can insert audit" ON app.guard_verification_audit
  TO service_role;
ALTER POLICY "Users can insert completion requests" ON app.job_completion_requests
  RENAME TO "Service role can insert completion requests";
ALTER POLICY "Service role can insert completion requests" ON app.job_completion_requests
  TO service_role;

-- Preserve the existing authenticated policy for a user's own payment events.
ALTER POLICY "Service role manages payment events" ON app.payment_events
  TO service_role;
ALTER POLICY "Service role can manage all consent" ON public.consent_records
  TO service_role;

-- The owner SELECT policy still supports listing and upserting a user's files.
-- The public bucket continues to serve direct image URLs.
DROP POLICY avatars_select_auth ON storage.objects;
