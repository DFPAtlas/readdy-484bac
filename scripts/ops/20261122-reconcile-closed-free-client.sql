-- Existing account closure is authoritative. Reconcile one unbilled local free row only.
-- Requires service-role JWT claims; no Auth, provider, booking or retention schedule action.
DO $reconcile$
DECLARE
  closure app.account_closures%ROWTYPE;
  subscription app.subscriptions%ROWTYPE;
  entitlement_before jsonb;
  profile_before jsonb;
BEGIN
  SELECT * INTO STRICT closure FROM app.account_closures
    WHERE id='e7336199-d878-4fef-b439-ab84c017fca3' FOR UPDATE;
  SELECT * INTO STRICT subscription FROM app.subscriptions
    WHERE id='a6e45d09-f57b-45ed-ade4-3b12c3f77c78' FOR UPDATE;
  SELECT to_jsonb(e) INTO STRICT entitlement_before FROM app.user_entitlements_data e WHERE user_id=closure.user_id;
  SELECT to_jsonb(c) INTO STRICT profile_before FROM app.clients c WHERE id=closure.profile_id FOR UPDATE;
  IF closure.user_id IS DISTINCT FROM 'ecdf41db-1a51-437e-aed9-66078879d9bc'::uuid
    OR closure.profile_id IS DISTINCT FROM '7cf43655-7e07-47fe-88d7-c3a4e596000e'::uuid
    OR closure.profile_type IS DISTINCT FROM 'client' OR closure.status IS DISTINCT FROM 'closed'
    OR closure.closed_at IS DISTINCT FROM '2026-11-13T21:35:27.285727Z'::timestamptz
    OR subscription.user_id IS DISTINCT FROM closure.user_id
    OR subscription.plan_slug IS DISTINCT FROM 'client_free' OR subscription.account_type IS DISTINCT FROM 'client'
    OR subscription.status NOT IN ('active','canceled')
    OR entitlement_before->>'subscription_status' IS DISTINCT FROM 'canceled'
    OR entitlement_before->>'is_active' IS DISTINCT FROM 'false'
    OR profile_before->>'user_id' IS DISTINCT FROM closure.user_id::text
    OR profile_before->>'is_active' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'Closed client evidence changed; reconciliation aborted';
  END IF;
  PERFORM app.reconcile_closed_free_subscriptions(closure.id);
  IF NOT EXISTS(SELECT 1 FROM app.subscriptions WHERE id=subscription.id AND status='canceled' AND auto_renew=false)
    OR (SELECT to_jsonb(e) FROM app.user_entitlements_data e WHERE user_id=closure.user_id) IS DISTINCT FROM entitlement_before
    OR (SELECT to_jsonb(c) FROM app.clients c WHERE id=closure.profile_id) IS DISTINCT FROM profile_before
    OR (SELECT to_jsonb(c) FROM app.account_closures c WHERE id=closure.id) IS DISTINCT FROM to_jsonb(closure)
    OR (SELECT count(*) FROM app.account_retention_events WHERE closure_id=closure.id AND event_type='free_subscription_closed'
      AND details->>'subscription_id'=subscription.id::text) <> 1 THEN
    RAISE EXCEPTION 'Closed client reconciliation verification failed';
  END IF;
END
$reconcile$;
