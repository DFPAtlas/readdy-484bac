CREATE OR REPLACE FUNCTION app.sync_subscription_to_entitlements()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
DECLARE
  v_plan       app.plans%ROWTYPE;
  v_free_plan  app.plans%ROWTYPE;
  v_user_type  text;
BEGIN
  -- A closure is authoritative; preserve retained entitlement evidence and never rebuild access.
  IF EXISTS(SELECT 1 FROM app.account_closures WHERE user_id=NEW.user_id) THEN
    UPDATE app.user_entitlements_data SET subscription_status='canceled'
    WHERE user_id=NEW.user_id AND subscription_status IS DISTINCT FROM 'canceled';
    RETURN NEW;
  END IF;
  SELECT * INTO v_plan FROM app.plans WHERE slug = NEW.plan_slug AND active = true LIMIT 1;
  SELECT user_type INTO v_user_type FROM app.users WHERE id = NEW.user_id LIMIT 1;
  SELECT * INTO v_free_plan
    FROM app.plans
    WHERE audience = v_user_type AND slug IN ('client_free','guard_starter')
    LIMIT 1;

  IF NEW.status IN ('active', 'trialing') THEN
    INSERT INTO app.user_entitlements_data (
      user_id, plan_slug, plan_name, audience, features,
      monthly_price_pence, subscription_status, current_period_end,
      cancel_at_period_end, stripe_subscription_id
    ) VALUES (
      NEW.user_id,
      COALESCE(v_plan.slug,                v_free_plan.slug),
      COALESCE(v_plan.name,                v_free_plan.name),
      COALESCE(v_plan.audience,            v_free_plan.audience),
      COALESCE(v_plan.features,            v_free_plan.features),
      COALESCE(v_plan.monthly_price_pence, v_free_plan.monthly_price_pence),
      NEW.status,
      NEW.current_period_end,
      NEW.cancel_at_period_end,
      NEW.stripe_subscription_id
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan_slug              = EXCLUDED.plan_slug,
      plan_name              = EXCLUDED.plan_name,
      audience               = EXCLUDED.audience,
      features               = EXCLUDED.features,
      monthly_price_pence    = EXCLUDED.monthly_price_pence,
      subscription_status    = EXCLUDED.subscription_status,
      current_period_end     = EXCLUDED.current_period_end,
      cancel_at_period_end   = EXCLUDED.cancel_at_period_end,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      updated_at             = now();

  ELSIF NEW.status IN ('past_due', 'incomplete') THEN
    UPDATE app.user_entitlements_data
    SET subscription_status  = NEW.status,
        cancel_at_period_end = NEW.cancel_at_period_end,
        updated_at           = now()
    WHERE user_id = NEW.user_id;

  ELSIF NEW.status IN ('canceled', 'cancelled', 'incomplete_expired', 'unpaid') THEN
    INSERT INTO app.user_entitlements_data (
      user_id, plan_slug, plan_name, audience, features,
      monthly_price_pence, subscription_status, current_period_end,
      cancel_at_period_end, stripe_subscription_id
    ) VALUES (
      NEW.user_id,
      v_free_plan.slug,
      v_free_plan.name,
      v_free_plan.audience,
      v_free_plan.features,
      v_free_plan.monthly_price_pence,
      NEW.status,
      NULL,
      false,
      NULL
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan_slug              = EXCLUDED.plan_slug,
      plan_name              = EXCLUDED.plan_name,
      audience               = EXCLUDED.audience,
      features               = EXCLUDED.features,
      monthly_price_pence    = EXCLUDED.monthly_price_pence,
      subscription_status    = EXCLUDED.subscription_status,
      current_period_end     = NULL,
      cancel_at_period_end   = false,
      stripe_subscription_id = NULL,
      updated_at             = now();
  END IF;

  RETURN NEW;
END;
$function$
;

-- Only close unbilled catalogue free rows; paid/provider-backed history is untouched.
CREATE OR REPLACE FUNCTION app.reconcile_closed_free_subscriptions(p_closure_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $free$
DECLARE closure app.account_closures%ROWTYPE;
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN RAISE insufficient_privilege; END IF;
  SELECT * INTO STRICT closure FROM app.account_closures WHERE id=p_closure_id FOR UPDATE;
  IF closure.status NOT IN ('closing','closed') THEN RAISE EXCEPTION 'Account closure is not established'; END IF;
  IF NOT (
    (closure.profile_type='client' AND EXISTS(SELECT 1 FROM app.clients WHERE id=closure.profile_id AND user_id=closure.user_id AND is_active=false AND stripe_subscription_id IS NULL AND stripe_customer_id IS NULL))
    OR (closure.profile_type='guard' AND EXISTS(SELECT 1 FROM app.guards WHERE id=closure.profile_id AND user_id=closure.user_id AND is_active=false AND dashboard_access=false AND stripe_subscription_id IS NULL AND stripe_customer_id IS NULL))
  ) OR EXISTS(SELECT 1 FROM app.users WHERE id=closure.user_id AND (stripe_subscription_id IS NOT NULL OR stripe_customer_id IS NOT NULL)) THEN
    -- Provider-linked or already-minimised profiles stay on their existing review path.
    RETURN;
  END IF;
  WITH closed AS (
    UPDATE app.subscriptions s SET status='canceled', auto_renew=false,
      cancelled_at=coalesce(s.cancelled_at,now()),
      cancellation_reason=coalesce(s.cancellation_reason,'Account closed'),
      updated_at=now()
    FROM app.plans p
    WHERE s.user_id=closure.user_id AND s.account_type=closure.profile_type AND s.status='active'
      AND s.plan_slug=p.slug AND p.audience=closure.profile_type AND p.monthly_price_pence=0
      AND p.slug IN ('client_free','guard_starter')
      AND coalesce(s.plan_amount,0)=0 AND coalesce(s.amount_paid,0)=0
      AND s.stripe_subscription_id IS NULL AND s.stripe_customer_id IS NULL AND s.stripe_price_id IS NULL
      AND s.stripe_invoice_id IS NULL AND s.stripe_session_id IS NULL AND s.payment_method_id IS NULL
      AND s.current_period_start IS NULL AND s.current_period_end IS NULL
      AND s.next_payment_date IS NULL AND s.last_payment_date IS NULL
      AND NOT EXISTS(SELECT 1 FROM app.subscription_payments sp WHERE sp.subscription_id=s.id)
    RETURNING s.id,s.plan_slug
  )
  INSERT INTO app.account_retention_events(closure_id,event_type,details)
  SELECT closure.id,'free_subscription_closed',
    jsonb_build_object('subscription_id',id,'plan_slug',plan_slug,'previous_status','active',
      'status','canceled','reconciled_at',now(),'provider_write',false)
  FROM closed;
END
$free$;
REVOKE ALL ON FUNCTION app.reconcile_closed_free_subscriptions(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app.reconcile_closed_free_subscriptions(uuid) TO service_role;

CREATE OR REPLACE FUNCTION app.begin_account_closure(p_user_id uuid, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g app.guards%rowtype; c app.clients%rowtype; r app.account_closures%rowtype; typ text; pid uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('qg-client-team-membership',0));
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select * into r from app.account_closures where user_id=p_user_id for update;
 if found then
  perform app.reconcile_closed_free_subscriptions(r.id);
  return to_jsonb(r);
 end if;
 if p_actor_id<>p_user_id and not exists(select 1 from app.admin_users where user_id=p_actor_id and is_active and role='super_admin') then raise insufficient_privilege; end if;
 if exists(select 1 from app.admin_users where user_id=p_user_id) then raise exception 'Administrator accounts require separate review'; end if;
 select * into g from app.guards where user_id=p_user_id for update;
 select * into c from app.clients where user_id=p_user_id for update;
 if g.id is not null and c.id is not null then raise exception 'Review both role profiles before closure'; end if;
 if g.id is null and c.id is null then raise exception 'Account profile not found'; end if;
 typ:=case when g.id is not null then 'guard' else 'client' end; pid:=coalesce(g.id,c.id);
 if exists(select 1 from app.subscriptions where user_id=p_user_id and stripe_subscription_id is not null and coalesce(status,'') not in ('canceled','cancelled','incomplete_expired')) then
  raise exception 'Cancel the paid subscription and wait for cancellation to complete before closure'; end if;
 if (typ='client' and exists(select 1 from app.jobs where client_id=pid and coalesce(status,'') not in ('completed','cancelled','closed','draft'))) or
    (typ='guard' and exists(select 1 from app.job_assignments where guard_id=pid and coalesce(status,'') not in ('completed','cancelled','rejected'))) then
  raise exception 'Complete or cancel outstanding bookings before closure'; end if;
 if exists(select 1 from app.disputes where (guard_id=g.id or client_id=c.id) and coalesce(status,'') not in ('resolved','closed')) then raise exception 'Resolve the open dispute before closure'; end if;
 if typ='guard' and exists(select 1 from app.guard_bank_payouts where guard_id=pid and coalesce(status,'') not in ('paid','canceled','cancelled')) then raise exception 'Resolve bank payouts before closure'; end if;
 if typ='guard' and exists(select 1 from app.guard_payouts where guard_id=pid and coalesce(status,'') not in ('completed','paid','cancelled')) then raise exception 'Resolve outstanding payouts before closure'; end if;
 insert into app.account_closures(user_id,profile_id,profile_type,closed_by) values(p_user_id,pid,typ,p_actor_id) returning * into r;
 if typ='guard' then update app.guards set is_active=false,dashboard_access=false where id=pid;
 else update app.clients set is_active=false where id=pid; end if;
 update app.user_entitlements_data set subscription_status='canceled' where user_id=p_user_id;
 perform app.reconcile_closed_free_subscriptions(r.id);
 insert into app.account_retention_events(closure_id,event_type,actor_id) values(r.id,'closure_started',p_actor_id);
 return to_jsonb(r);
end $function$
;
REVOKE ALL ON FUNCTION app.begin_account_closure(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app.begin_account_closure(uuid,uuid) TO service_role;
