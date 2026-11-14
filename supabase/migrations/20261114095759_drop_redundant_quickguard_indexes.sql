-- Keep the equivalent index for each pair and fail quickly if a table is busy.
SET LOCAL lock_timeout = '500ms';
SET LOCAL statement_timeout = '5s';

LOCK TABLE app.clients,
           app.guards,
           app.job_applications,
           app.job_assignments,
           app.jobs,
           app.notifications,
           app.subscriptions,
           app.transactions,
           app.users
  IN ACCESS EXCLUSIVE MODE NOWAIT;

DO $migration$
DECLARE
  pair record;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('app.idx_app_clients_stripe_customer_id', 'app.idx_app_clients_stripe_customer'),
      ('app.idx_clients_stripe_customer_id', 'app.idx_app_clients_stripe_customer'),
      ('app.idx_app_clients_stripe_subscription_id', 'app.idx_clients_stripe_subscription_id'),
      ('app.idx_clients_user_id', 'app.idx_app_clients_user_id'),
      ('app.idx_app_guards_stripe_customer_id', 'app.idx_app_guards_stripe_customer'),
      ('app.idx_guards_stripe_customer_id', 'app.idx_app_guards_stripe_customer'),
      ('app.idx_guards_stripe_subscription_id', 'app.idx_app_guards_stripe_subscription_id'),
      ('app.idx_guards_user_id', 'app.idx_app_guards_user_id'),
      ('app.idx_guards_verification_status', 'app.idx_app_guards_verification_status'),
      ('app.idx_job_applications_guard_id', 'app.idx_job_applications_guard'),
      ('app.idx_job_applications_job_id', 'app.idx_job_applications_job'),
      ('app.idx_job_assignments_job_status', 'app.idx_app_job_assignments_job_status'),
      ('app.idx_assignments_payment_status', 'app.idx_job_assignments_payment_status'),
      ('app.idx_jobs_status', 'app.idx_app_jobs_status'),
      ('app.idx_jobs_booking_reference', 'app.idx_jobs_booking_ref'),
      ('app.idx_jobs_client_id_status', 'app.idx_jobs_client_status'),
      ('app.idx_jobs_status_payment', 'app.idx_jobs_status_payment_status'),
      ('app.idx_notifications_user_id', 'app.idx_app_notifications_user_id'),
      ('app.idx_subscriptions_client_id', 'app.idx_app_subscriptions_client_id'),
      ('app.idx_subscriptions_status', 'app.idx_app_subscriptions_status'),
      ('app.idx_subscriptions_stripe_subscription_id', 'app.idx_app_subscriptions_stripe_sub'),
      ('app.idx_subscriptions_user_id', 'app.idx_app_subscriptions_user_id'),
      ('app.idx_app_transactions_client_id', 'app.idx_transactions_client_id'),
      ('app.idx_app_transactions_guard_id', 'app.idx_transactions_guard_id'),
      ('app.idx_transactions_status', 'app.idx_app_transactions_status'),
      ('app.idx_app_transactions_user_id', 'app.idx_transactions_user_id'),
      ('app.idx_users_email', 'app.idx_app_users_email'),
      ('app.idx_users_user_type', 'app.idx_app_users_user_type')
    ) AS pairs(redundant, retained)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_index AS redundant
      JOIN pg_index AS retained ON retained.indrelid = redundant.indrelid
      JOIN pg_class AS redundant_class ON redundant_class.oid = redundant.indexrelid
      JOIN pg_class AS retained_class ON retained_class.oid = retained.indexrelid
      WHERE redundant.indexrelid = to_regclass(pair.redundant)
        AND retained.indexrelid = to_regclass(pair.retained)
        AND redundant.indisvalid AND redundant.indisready AND redundant.indislive
        AND retained.indisvalid AND retained.indisready AND retained.indislive
        AND redundant_class.relkind = 'i'
        AND NOT (redundant.indisunique OR redundant.indisprimary
                 OR redundant.indisreplident OR redundant.indisclustered)
        AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conindid = redundant.indexrelid)
        AND NOT EXISTS (
          SELECT 1 FROM pg_depend
          WHERE refclassid = 'pg_class'::regclass AND refobjid = redundant.indexrelid
        )
        AND ROW(redundant_class.relam, redundant_class.reltablespace, redundant_class.reloptions,
                redundant.indnatts, redundant.indnkeyatts, redundant.indisunique,
                redundant.indnullsnotdistinct, redundant.indimmediate, redundant.indkey,
                redundant.indcollation, redundant.indclass, redundant.indoption,
                redundant.indexprs::text, redundant.indpred::text)
            IS NOT DISTINCT FROM
            ROW(retained_class.relam, retained_class.reltablespace, retained_class.reloptions,
                retained.indnatts, retained.indnkeyatts, retained.indisunique,
                retained.indnullsnotdistinct, retained.indimmediate, retained.indkey,
                retained.indcollation, retained.indclass, retained.indoption,
                retained.indexprs::text, retained.indpred::text)
    ) THEN
      RAISE EXCEPTION 'Index % is no longer a safe duplicate of %', pair.redundant, pair.retained;
    END IF;
  END LOOP;

  FOR pair IN
    SELECT unnest(ARRAY['app.idx_app_clients_stripe_customer_id', 'app.idx_clients_stripe_customer_id', 'app.idx_app_clients_stripe_subscription_id', 'app.idx_clients_user_id', 'app.idx_app_guards_stripe_customer_id', 'app.idx_guards_stripe_customer_id', 'app.idx_guards_stripe_subscription_id', 'app.idx_guards_user_id', 'app.idx_guards_verification_status', 'app.idx_job_applications_guard_id', 'app.idx_job_applications_job_id', 'app.idx_job_assignments_job_status', 'app.idx_assignments_payment_status', 'app.idx_jobs_status', 'app.idx_jobs_booking_reference', 'app.idx_jobs_client_id_status', 'app.idx_jobs_status_payment', 'app.idx_notifications_user_id', 'app.idx_subscriptions_client_id', 'app.idx_subscriptions_status', 'app.idx_subscriptions_stripe_subscription_id', 'app.idx_subscriptions_user_id', 'app.idx_app_transactions_client_id', 'app.idx_app_transactions_guard_id', 'app.idx_transactions_status', 'app.idx_app_transactions_user_id', 'app.idx_users_email', 'app.idx_users_user_type']) AS redundant
  LOOP
    EXECUTE format('DROP INDEX %s RESTRICT', to_regclass(pair.redundant));
  END LOOP;
END
$migration$;
