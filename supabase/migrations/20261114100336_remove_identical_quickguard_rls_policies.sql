-- Remove a policy only when its retained counterpart has identical permissions.
SET LOCAL lock_timeout = '500ms';
SET LOCAL statement_timeout = '5s';

DO $migration$
DECLARE
  pair record;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('app.qg_launch_public_stats', 'Anyone can read public stats', 'Public can read public stats'),
      ('app.qg_launch_updates', 'Anyone can read published updates', 'Public can read published updates'),
      ('app.reviews', 'reviews_admin_all', 'reviews_admin_all_v2'),
      ('app.reviews', 'client_can_review', 'reviews_client_insert'),
      ('storage.objects', 'sia_licence_owner_delete_app_schema', 'sia_licence_owner_delete_v2'),
      ('storage.objects', 'sia_licence_owner_select_app_schema', 'sia_licence_owner_select_v2')
    ) AS pairs(relation_name, retained_name, redundant_name)
  LOOP
    EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE NOWAIT', to_regclass(pair.relation_name));

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policy AS retained
      JOIN pg_policy AS redundant ON redundant.polrelid = retained.polrelid
      WHERE retained.polrelid = to_regclass(pair.relation_name)
        AND retained.polname = pair.retained_name
        AND redundant.polname = pair.redundant_name
        AND retained.polpermissive AND redundant.polpermissive
        AND retained.polcmd = redundant.polcmd
        AND retained.polroles @> redundant.polroles
        AND redundant.polroles @> retained.polroles
        AND retained.polqual::text IS NOT DISTINCT FROM redundant.polqual::text
        AND retained.polwithcheck::text IS NOT DISTINCT FROM redundant.polwithcheck::text
    ) THEN
      RAISE EXCEPTION 'Policy % is no longer a duplicate on %', pair.redundant_name, pair.relation_name;
    END IF;

    EXECUTE format('DROP POLICY %I ON %s RESTRICT', pair.redundant_name, to_regclass(pair.relation_name));
  END LOOP;
END
$migration$;
