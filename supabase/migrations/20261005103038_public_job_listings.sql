-- Public advertisements only. Private job/client tables remain inaccessible to anon.
-- SECURITY DEFINER is intentional: callers can read this fixed projection, never arbitrary columns.
BEGIN;
CREATE OR REPLACE FUNCTION app.get_public_jobs()
RETURNS TABLE (
 id uuid, job_title text, job_description text, security_type text, number_of_guards integer,
 start_date date, end_date date, start_time time, end_time time, urgency text,
 sia_licence_required boolean, required_licence_types text[], required_license_type text,
 experience_level text, venue_name text, venue_city text, venue_postcode text,
 uniform_required boolean, uniform_details text, additional_requirements text,
 hourly_rate numeric, payment_terms text, status text, views integer, created_at timestamptz, updated_at timestamptz,
 is_featured boolean, is_urgent boolean, expires_at timestamptz, is_deleted boolean, clients jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
 SELECT j.id, j.job_title, j.job_description, j.security_type, j.number_of_guards,
 j.start_date, j.end_date, j.start_time, j.end_time, j.urgency,
 j.sia_licence_required, j.required_licence_types, j.required_license_type,
 j.experience_level, j.venue_name, j.venue_city, split_part(j.venue_postcode, ' ', 1),
 j.uniform_required, j.uniform_details, j.additional_requirements,
 j.hourly_rate, j.payment_terms, j.status, j.views, j.created_at, j.updated_at,
 j.is_featured, j.is_urgent, j.expires_at, false,
 jsonb_build_object('company_name', c.company_name, 'client_promo_tier', c.client_promo_tier,
                    'founding_client_badge', c.founding_client_badge)
 FROM app.jobs j LEFT JOIN app.clients c ON c.id = j.client_id
 WHERE j.status = 'open' AND COALESCE(j.is_deleted, false) = false;
$function$;
REVOKE ALL ON FUNCTION app.get_public_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.get_public_jobs() TO anon, authenticated, service_role;
COMMENT ON FUNCTION app.get_public_jobs() IS 'Public advertised open jobs; excludes contacts, full addresses, client IDs, payment data and private job states.';
NOTIFY pgrst, 'reload schema';
COMMIT;
