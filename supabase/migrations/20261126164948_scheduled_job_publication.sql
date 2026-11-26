-- Publish due job drafts through the existing neutral matching/dedupe queue.
-- New schedules install PAUSED; activation is a separately reviewed rollout step.
CREATE OR REPLACE FUNCTION public.notify_matching_guards_on_job_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, pg_temp
AS $function$
DECLARE
  candidate record;
  direct_booking boolean;
  immediate_booking boolean;
  licence_label text;
  queue_prefix text;
  queue_key text;
BEGIN
  -- The trigger handles direct inserts, including bulk posting. The normal
  -- create-job endpoint can also queue a match using the same key.
  IF NEW.is_deleted IS TRUE OR NEW.is_draft IS TRUE
     OR (NEW.latitude BETWEEN -90 AND 90 AND NEW.longitude BETWEEN -180 AND 180) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(c.client_type IN ('venue', 'event_organiser', 'business', 'individual')
                  AND nullif(NEW.venue_category, '') IS NOT NULL, false)
  INTO direct_booking
  FROM app.clients c
  WHERE c.id = NEW.client_id;
  direct_booking := coalesce(direct_booking, false);

  licence_label := CASE coalesce(nullif(NEW.required_license_type, ''), NEW.security_type)
    WHEN 'door-supervisor' THEN 'Door Supervisor'
    WHEN 'door_supervisor' THEN 'Door Supervisor'
    WHEN 'event-security' THEN 'Event Security'
    WHEN 'retail-security' THEN 'Retail Security'
    WHEN 'close-protection' THEN 'Close Protection'
    WHEN 'close_protection' THEN 'Close Protection'
    WHEN 'cctv-operator' THEN 'CCTV Operator'
    WHEN 'cctv' THEN 'CCTV Operator'
    WHEN 'security-guard' THEN 'Security Guard'
    WHEN 'security_guard' THEN 'Security Guard'
    WHEN 'mobile-patrol' THEN 'Mobile Patrol'
    WHEN 'key-holding' THEN 'Key Holding'
    WHEN 'dog-handler' THEN 'Dog Handler'
    WHEN 'dog_handler' THEN 'Dog Handler'
    WHEN 'any' THEN 'any'
    ELSE NEW.security_type
  END;

  immediate_booking := coalesce(NEW.urgency = 'immediate', false)
    OR coalesce(NEW.booking_source = 'homepage_guard_now', false);
  queue_prefix := CASE WHEN immediate_booking THEN 'immediate-job' ELSE 'job' END;

  FOR candidate IN
    WITH eligible AS (
      SELECT g.id, g.user_id, g.email, coalesce(nullif(g.full_name, ''), 'Guard') AS guard_name,
        coalesce(
          CASE WHEN g.max_distance_miles > 0 THEN g.max_distance_miles END,
          CASE WHEN g.default_search_radius_km > 0 THEN g.default_search_radius_km * 0.621371 END,
          50
        ) AS max_miles,
        power(sin(radians(g.home_latitude - NEW.latitude) / 2), 2)
          + cos(radians(NEW.latitude)) * cos(radians(g.home_latitude))
          * power(sin(radians(g.home_longitude - NEW.longitude) / 2), 2) AS haversine
      FROM app.guards g
      WHERE g.is_active IS TRUE
        AND g.verification_status IN ('approved', 'verified')
        AND g.verified_by IS NOT NULL
        AND g.profile_completed IS TRUE
        AND g.willing_to_travel IS DISTINCT FROM false
        AND nullif(btrim(g.email), '') IS NOT NULL
        AND g.home_latitude BETWEEN -90 AND 90
        AND g.home_longitude BETWEEN -180 AND 180
        AND NEW.hourly_rate >= coalesce(g.min_hourly_rate, 0)
        AND (nullif(licence_label, '') IS NULL OR licence_label = 'any'
             OR g.licence_types @> ARRAY[licence_label])
        AND (NEW.sia_licence_required IS DISTINCT FROM true
             OR (g.sia_verified IS TRUE AND nullif(g.sia_licence_number, '') IS NOT NULL
                 AND g.sia_expiry_date >= (now() AT TIME ZONE 'UTC')::date))
        AND (NOT direct_booking OR (g.accepts_direct_bookings IS TRUE
             AND (coalesce(cardinality(g.preferred_venue_categories), 0) = 0
                  OR NEW.venue_category = ANY(g.preferred_venue_categories))))
    ), distances AS (
      SELECT eligible.*, 2 * 3958.8 * asin(sqrt(least(1, greatest(0, haversine)))) AS miles
      FROM eligible
    )
    SELECT * FROM distances WHERE miles <= max_miles ORDER BY miles, id
  LOOP
    queue_key := queue_prefix || ':' || NEW.id || ':guard:' || candidate.id;

    BEGIN
      PERFORM app.queue_job_match_notification(
        NEW.id, candidate.id, candidate.user_id, candidate.email, candidate.guard_name,
        'New job match: ' || NEW.job_title || ' — QuickGuard', queue_key,
        jsonb_build_object(
          'guard_email', candidate.email,
          'guard_name', candidate.guard_name,
          'job_title', NEW.job_title,
          'client_name', coalesce(nullif(NEW.contact_name, ''), 'Client'),
          'location', concat_ws(', ', NEW.venue_name, NEW.venue_city),
          'date', coalesce(to_char(NEW.start_date, 'FMDay, FMDD FMMonth YYYY'), 'TBC'),
          'start_time', coalesce(NEW.start_time::text, ''),
          'end_time', coalesce(NEW.end_time::text, ''),
          'hourly_rate', to_char(coalesce(NEW.hourly_rate, 0), 'FM999999990.00'),
          'distance_miles', CASE WHEN candidate.miles < 0.5 THEN 'Within 0.5 mi'
                            ELSE round(candidate.miles::numeric, 1)::text || ' miles' END,
          'job_type', licence_label,
          'is_direct_booking', direct_booking,
          'venue_category', coalesce(NEW.venue_category, '')
        ),
        CASE WHEN immediate_booking THEN 10 ELSE 5 END
      );
    EXCEPTION WHEN OTHERS THEN
      -- Scheduled publication must roll back if durable queueing fails.
      -- Preserve the existing direct-insert fallback behaviour.
      IF TG_NARGS > 0 AND TG_ARGV[0] = 'scheduled_publication' THEN
        RAISE;
      END IF;
      RAISE LOG 'QuickGuard job match queue failed for job % (SQLSTATE %)', NEW.id, SQLSTATE;
    END;
  END LOOP;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.notify_matching_guards_on_job_post() FROM PUBLIC, anon, authenticated;


DROP TRIGGER IF EXISTS notify_guards_on_scheduled_publication ON app.jobs;
CREATE TRIGGER notify_guards_on_scheduled_publication
AFTER UPDATE OF status, is_draft ON app.jobs
FOR EACH ROW
WHEN (OLD.status = 'draft' AND OLD.is_draft IS TRUE
  AND OLD.publish_at IS NOT NULL AND NEW.status = 'open' AND NEW.is_draft IS FALSE)
EXECUTE FUNCTION public.notify_matching_guards_on_job_post('scheduled_publication');

CREATE OR REPLACE FUNCTION app.publish_due_scheduled_jobs(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO pg_catalog, app
AS $function$
DECLARE
  candidate record;
  cutoff timestamptz := clock_timestamp();
  published_ids jsonb := '[]'::jsonb;
  failed integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'invalid_publication_batch_limit' USING ERRCODE = '22023';
  END IF;

  FOR candidate IN
    SELECT j.id FROM app.jobs j
    JOIN app.clients c ON c.id = j.client_id
    WHERE j.status = 'draft' AND j.is_draft IS TRUE
      AND j.is_deleted IS DISTINCT FROM true
      AND j.publish_at IS NOT NULL AND j.publish_at <= cutoff
      AND (j.expires_at IS NULL OR j.expires_at > cutoff)
      AND j.start_date IS NOT NULL AND j.start_time IS NOT NULL
      AND ((j.start_date + j.start_time) AT TIME ZONE 'Europe/London') > cutoff
      AND c.is_active IS TRUE AND c.is_suspended IS DISTINCT FROM true
      AND c.profile_completed IS TRUE
    ORDER BY j.publish_at, j.id
    LIMIT p_limit
    FOR UPDATE OF j SKIP LOCKED
  LOOP
    BEGIN
      -- The UPDATE trigger queues matches in this same transaction. Its strict
      -- mode propagates queue errors, leaving this job a draft for retry.
      UPDATE app.jobs SET status = 'open', is_draft = false,
        notification_status = 'none', notification_error = NULL,
        notification_attempts = coalesce(notification_attempts, 0) + 1,
        notification_last_attempt_at = cutoff
      WHERE id = candidate.id;
      PERFORM app.recompute_job_notification_status(candidate.id);
      published_ids := published_ids || jsonb_build_array(candidate.id);
    EXCEPTION WHEN OTHERS THEN
      failed := failed + 1;
      RAISE LOG 'QuickGuard scheduled publication failed for job % (SQLSTATE %)', candidate.id, SQLSTATE;
    END;
  END LOOP;

  RETURN jsonb_build_object('published', jsonb_array_length(published_ids),
    'failed', failed, 'job_ids', published_ids, 'timestamp', cutoff);
END;
$function$;
REVOKE ALL ON FUNCTION app.publish_due_scheduled_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.publish_due_scheduled_jobs(integer) TO service_role;

-- Never overwrite an unrelated named job or reactivate one on migration replay.
DO $cron$
DECLARE
  existing_command text;
  scheduled_id bigint;
BEGIN
  SELECT command INTO existing_command FROM cron.job WHERE jobname = 'publish-scheduled-jobs';
  IF FOUND THEN
    IF existing_command IS DISTINCT FROM 'select app.publish_due_scheduled_jobs(50);' THEN
      RAISE EXCEPTION 'scheduled_publication_cron_name_conflict';
    END IF;
  ELSE
    scheduled_id := cron.schedule('publish-scheduled-jobs', '* * * * *',
      'select app.publish_due_scheduled_jobs(50);');
    PERFORM cron.alter_job(job_id := scheduled_id, active := false);
  END IF;
END;
$cron$;
