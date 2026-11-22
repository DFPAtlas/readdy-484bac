-- Private notes are for trusted QuickGuard backend/admin handling only.
-- A table-wide SELECT grant overrides column revokes; replace that grant with
-- the existing non-private columns on both the app table and legacy public view.
-- Keep RLS, the security-invoker view, writes and service-role grants unchanged.
REVOKE SELECT ON app.reviews FROM PUBLIC, anon, authenticated;
REVOKE SELECT (private_note) ON app.reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, job_id, guard_id, client_id, rating, review_text, created_at, status, punctuality, professionalism, communication, appearance, reliability, would_hire_again, attendance_status, issue_reported, issue_category, issue_description, review_status, site_instructions_followed, assignment_id) ON app.reviews TO anon, authenticated;

-- The invoker view must stop referencing the protected underlying column,
-- otherwise even safe projections require its privilege. Preserve its legacy
-- shape with an explicitly redacted value; canonical backend reads use app.
CREATE OR REPLACE VIEW public.reviews WITH (security_invoker=true) AS
SELECT id, job_id, guard_id, client_id, rating, review_text, created_at, status,
  punctuality, professionalism, communication, appearance, reliability,
  NULL::text AS private_note, would_hire_again, attendance_status, issue_reported,
  issue_category, issue_description, review_status, site_instructions_followed
FROM app.reviews;
NOTIFY pgrst, 'reload schema';

