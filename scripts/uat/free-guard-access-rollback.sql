-- Sandbox rollback for free core guard access. Restore frontend/Edge versions too.
CREATE OR REPLACE FUNCTION public.notify_matching_guards_on_job_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  candidate record;
  direct_booking boolean;
  immediate_booking boolean;
  licence_label text;
  queue_prefix text;
  queue_key text;
  required_level integer;
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

  required_level := CASE NEW.job_access_level
    WHEN 'professional' THEN 1 WHEN 'premium' THEN 2 WHEN 'elite' THEN 3 ELSE 0
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
      JOIN app.user_entitlements_data e ON e.user_id = g.user_id
      WHERE g.is_active IS TRUE
        AND g.verification_status IN ('approved', 'verified')
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
        AND e.plan_slug IS NOT NULL
        AND (CASE e.plan_slug
          WHEN 'guard-basic' THEN 1 WHEN 'guard-pro' THEN 2 WHEN 'guard-elite' THEN 3 ELSE 0
        END) >= required_level
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
      RAISE LOG 'QuickGuard job match queue failed for job % (SQLSTATE %)', NEW.id, SQLSTATE;
    END;
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION app.submit_job_application(p_actor_user_id uuid, p_guard_id uuid, p_job_id uuid, p_cover_message text DEFAULT NULL::text, p_invite_id uuid DEFAULT NULL::uuid, p_is_admin boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'pg_catalog'
AS $function$
declare
  v_guard record;
  v_job record;
  v_invite record;
  v_existing uuid;
  v_app_id uuid;
  v_plan text;
  v_usage jsonb;
  v_guard_level int;
  v_job_level int;
begin
  if p_guard_id is null or p_job_id is null then
    raise exception 'qg_apply:invalid_request';
  end if;

  select g.* into v_guard from app.guards g where g.id = p_guard_id;
  if v_guard.id is null then raise exception 'qg_apply:guard_not_found'; end if;
  -- guards.id identifies the profile; guards.user_id is the auth user that owns it.
  if not p_is_admin and v_guard.user_id is distinct from p_actor_user_id then
    raise exception 'qg_apply:forbidden';
  end if;

  -- One application decision per guard at a time (duplicates and limit races).
  perform pg_advisory_xact_lock(hashtextextended('guard_application:' || v_guard.user_id::text, 0));

  if p_invite_id is not null then
    select i.* into v_invite from app.job_invites i where i.id = p_invite_id for update;
    if v_invite.id is null or v_invite.guard_id is distinct from p_guard_id or v_invite.job_id is distinct from p_job_id then
      raise exception 'qg_apply:invite_not_found';
    end if;
    if v_invite.status not in ('pending', 'accepted') then
      raise exception 'qg_apply:invite_not_pending';
    end if;
  end if;

  -- Idempotency: an existing application is never duplicated or charged twice.
  select a.id into v_existing from app.job_applications a where a.job_id = p_job_id and a.guard_id = p_guard_id;
  if v_existing is not null then
    if p_invite_id is not null then
      update app.job_invites set status = 'accepted', responded_at = coalesce(responded_at, now())
      where id = p_invite_id and status <> 'accepted';
      return jsonb_build_object('applicationId', v_existing, 'replayed', true, 'guardUserId', v_guard.user_id, 'inviteAccepted', true);
    end if;
    raise exception 'qg_apply:already_applied';
  end if;

  select j.* into v_job from app.jobs j where j.id = p_job_id;
  if v_job.id is null then raise exception 'qg_apply:job_not_found'; end if;
  if coalesce(v_job.is_deleted, false) then raise exception 'qg_apply:job_removed'; end if;
  if v_job.status is distinct from 'open' then raise exception 'qg_apply:job_closed'; end if;

  if not coalesce(v_guard.is_active, false) then raise exception 'qg_apply:guard_inactive'; end if;
  if v_guard.verified_by is null or coalesce(v_guard.verification_status, '') not in ('verified', 'approved') then
    raise exception 'qg_apply:guard_not_verified';
  end if;
  if v_guard.sia_expiry_date < current_date then raise exception 'qg_apply:sia_expired'; end if;
  if coalesce(v_job.sia_licence_required, false)
    and not app.guard_has_current_sia(v_guard.sia_verified, v_guard.sia_licence_number, v_guard.sia_expiry_date, current_date) then
    raise exception 'qg_apply:sia_required';
  end if;

  if coalesce(v_job.sia_licence_required, false) and coalesce(array_length(v_job.required_licence_types, 1), 0) > 0 then
    if not exists (
      select 1 from unnest(v_job.required_licence_types) r(t), unnest(coalesce(v_guard.licence_types, array[]::text[])) l(t)
      where lower(r.t) = lower(l.t)
    ) then
      raise exception 'qg_apply:licence_mismatch';
    end if;
  end if;

  if not p_is_admin then
    select e.plan_slug into v_plan from app.user_entitlements e where e.user_id = v_guard.user_id;
    if v_plan is null then raise exception 'qg_apply:no_plan'; end if;
    if not exists (select 1 from app.plans p where p.slug = v_plan) then raise exception 'qg_apply:plan_not_found'; end if;

    v_guard_level := case v_plan when 'guard-basic' then 1 when 'guard-pro' then 2 when 'guard-elite' then 3 else 0 end;
    v_job_level := case coalesce(v_job.job_access_level, 'basic') when 'professional' then 1 when 'premium' then 2 when 'elite' then 3 else 0 end;
    if v_guard_level < v_job_level then raise exception 'qg_apply:tier_locked:%', coalesce(v_job.job_access_level, 'basic'); end if;

    -- Check first (never consume when already exhausted), then consume.
    v_usage := app.check_monthly_usage(v_guard.user_id, 'guard_application', false);
    if not coalesce((v_usage->>'allowed')::boolean, false) then
      raise exception 'qg_apply:limit_reached' using detail = v_usage::text;
    end if;
    v_usage := app.check_monthly_usage(v_guard.user_id, 'guard_application', true);
    if not coalesce((v_usage->>'allowed')::boolean, false) then
      raise exception 'qg_apply:limit_reached' using detail = v_usage::text;
    end if;
  end if;

  insert into app.job_applications (job_id, guard_id, cover_message, cover_letter, status, applied_at)
  values (p_job_id, p_guard_id, coalesce(p_cover_message, ''), nullif(p_cover_message, ''), 'pending', now())
  returning id into v_app_id;

  if p_invite_id is not null then
    update app.job_invites set status = 'accepted', responded_at = now() where id = p_invite_id;
  end if;

  return jsonb_build_object('applicationId', v_app_id, 'replayed', false, 'guardUserId', v_guard.user_id,
    'inviteAccepted', p_invite_id is not null, 'usage', v_usage);
end;
$function$
;

CREATE OR REPLACE FUNCTION app.get_my_feature_usage(p_feature_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'pg_catalog'
AS $function$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_feature_key not in ('guard_application', 'client_job_post') then raise exception 'invalid_feature_key'; end if;
  return app.check_monthly_usage(auth.uid(), p_feature_key, false);
end;
$function$
;

CREATE OR REPLACE FUNCTION app.get_guard_placement(p_guard_ids uuid[])
 RETURNS TABLE(id uuid, profile_boost boolean, priority_profile boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select g.id,
    coalesce(e.features ? 'guard.profile_boost', false),
    coalesce(e.features ? 'guard.priority_profile', false)
  from app.guards g
  left join app.user_entitlements_data e on e.user_id=g.user_id and e.audience='guard'
    and e.is_active and e.subscription_status in ('active','trialing')
    and e.current_period_end > now()
  where g.id=any(p_guard_ids) and cardinality(p_guard_ids)<=200
    and g.is_active and g.profile_completed and g.verified_by is not null
    and g.verification_status in ('approved','verified')
    and app.guard_has_current_sia(g.sia_verified,g.sia_licence_number,g.sia_expiry_date,current_date)
    and (not coalesce(g.is_test_account,false) or exists (
      select 1 from app.client_applicant_profiles a where a.guard_id=g.id
    ) or g.user_id=auth.uid());
$function$
;

