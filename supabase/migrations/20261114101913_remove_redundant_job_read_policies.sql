SET LOCAL lock_timeout = '500ms';
SET LOCAL statement_timeout = '5s';

-- Verify that the surviving policies contain the exact OR of the existing
-- ownership/read branches before removing redundant permissive grants.
DO $migration$
DECLARE
  branch_set record;
  first_branch record;
  second_branch record;
  combined record;
BEGIN
  FOR branch_set IN
    SELECT * FROM (VALUES
      ('app.jobs', 'jobs_guards_view_open', 'jobs_owner_select', 'jobs_select', false),
      ('app.job_completion_requests', 'Clients read own completion requests',
       'Guards read own completion requests', 'Users can read own completion requests', true)
    ) AS rules(table_name, first_policy, second_policy, combined_policy, remove_combined)
  LOOP
    EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE NOWAIT', to_regclass(branch_set.table_name));

    SELECT * INTO STRICT first_branch FROM pg_policy
    WHERE polrelid = to_regclass(branch_set.table_name) AND polname = branch_set.first_policy;
    SELECT * INTO STRICT second_branch FROM pg_policy
    WHERE polrelid = to_regclass(branch_set.table_name) AND polname = branch_set.second_policy;
    SELECT * INTO STRICT combined FROM pg_policy
    WHERE polrelid = to_regclass(branch_set.table_name) AND polname = branch_set.combined_policy;

    IF NOT (
      first_branch.polpermissive AND second_branch.polpermissive AND combined.polpermissive
      AND first_branch.polcmd = 'r' AND second_branch.polcmd = 'r' AND combined.polcmd = 'r'
      AND first_branch.polwithcheck IS NULL AND second_branch.polwithcheck IS NULL AND combined.polwithcheck IS NULL
      AND combined.polroles = ARRAY['authenticated'::regrole::oid]
      AND first_branch.polroles = CASE WHEN branch_set.remove_combined THEN ARRAY[0::oid] ELSE combined.polroles END
      AND second_branch.polroles = first_branch.polroles
      AND pg_get_expr(combined.polqual, combined.polrelid) IS NOT DISTINCT FROM
          format('(%s OR %s)', pg_get_expr(first_branch.polqual, first_branch.polrelid),
                 pg_get_expr(second_branch.polqual, second_branch.polrelid))
    ) THEN
      RAISE EXCEPTION 'Read policies changed on %', branch_set.table_name;
    END IF;

    IF branch_set.remove_combined THEN
      EXECUTE format('DROP POLICY %I ON %s RESTRICT', branch_set.combined_policy, to_regclass(branch_set.table_name));
    ELSE
      EXECUTE format('DROP POLICY %I ON %s RESTRICT', branch_set.first_policy, to_regclass(branch_set.table_name));
      EXECUTE format('DROP POLICY %I ON %s RESTRICT', branch_set.second_policy, to_regclass(branch_set.table_name));
    END IF;
  END LOOP;
END
$migration$;
