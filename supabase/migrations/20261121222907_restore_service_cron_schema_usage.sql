-- The backend already has SELECT on cron.job and cron.job_run_details,
-- but cannot resolve either table without schema USAGE. Keep the schema
-- outside PostgREST and leave browser roles and table grants unchanged.
grant usage on schema cron to service_role;
