-- Provider read: QuickGuard sandbox, canceled lifecycle UAT subscription on a test clock.
-- Correct local renewal metadata only; preserve historical dates, access and billing references.
DO $repair$
DECLARE
  subscription app.subscriptions%ROWTYPE;
  profile_before jsonb;
  entitlement_before jsonb;
  repair_key constant text := 'cancelled-starter-auto-renew-20261122';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(repair_key));
  SELECT * INTO STRICT subscription FROM app.subscriptions
    WHERE id='7a010528-5acb-431f-ae27-50def502fe79' FOR UPDATE;
  SELECT to_jsonb(c) INTO STRICT profile_before FROM app.clients c
    WHERE id='d8de02e0-6c9f-407c-9cca-cb2f5e3f9362' FOR SHARE;
  SELECT to_jsonb(e) INTO STRICT entitlement_before FROM app.user_entitlements_data e
    WHERE user_id=subscription.user_id FOR SHARE;
  IF subscription.user_id IS DISTINCT FROM 'f795cc3a-baf8-4654-8d7e-46c5160faec6'::uuid
    OR subscription.status IS DISTINCT FROM 'cancelled' OR subscription.account_type IS DISTINCT FROM 'client'
    OR subscription.plan_slug IS DISTINCT FROM 'client-starter' OR subscription.plan_amount IS DISTINCT FROM 4900
    OR subscription.currency IS DISTINCT FROM 'gbp'
    OR subscription.stripe_subscription_id IS DISTINCT FROM 'sub_1UMtnGIMkpwfAEDTPjI4GqFt'
    OR subscription.stripe_customer_id IS DISTINCT FROM 'cus_VNf6NZ3ZsI72dN'
    OR subscription.stripe_price_id IS DISTINCT FROM 'price_1TcvjNIMkpwfAEDTZ6QYTKZ3'
    OR subscription.cancelled_at IS DISTINCT FROM '2026-10-04T18:26:25.868Z'::timestamptz
    OR profile_before->>'user_id' IS DISTINCT FROM subscription.user_id::text
    OR profile_before->>'subscription_status' IS DISTINCT FROM 'cancelled'
    OR profile_before->>'stripe_subscription_id' IS DISTINCT FROM subscription.stripe_subscription_id
    OR profile_before->>'stripe_customer_id' IS DISTINCT FROM subscription.stripe_customer_id
    OR entitlement_before->>'subscription_status' IS DISTINCT FROM 'cancelled'
    OR entitlement_before->>'is_active' IS DISTINCT FROM 'false'
    OR EXISTS(SELECT 1 FROM app.account_closures WHERE user_id=subscription.user_id) THEN
    RAISE EXCEPTION 'Cancelled Starter fixture evidence changed; repair aborted';
  END IF;
  UPDATE app.subscriptions SET auto_renew=false,updated_at=now()
    WHERE id=subscription.id AND auto_renew IS DISTINCT FROM false;
  IF (SELECT to_jsonb(s)-'auto_renew'-'updated_at' FROM app.subscriptions s WHERE id=subscription.id)
      IS DISTINCT FROM (to_jsonb(subscription)-'auto_renew'-'updated_at')
    OR (SELECT to_jsonb(c) FROM app.clients c WHERE id=(profile_before->>'id')::uuid) IS DISTINCT FROM profile_before
    OR (SELECT to_jsonb(e) FROM app.user_entitlements_data e WHERE user_id=subscription.user_id) IS DISTINCT FROM entitlement_before THEN
    RAISE EXCEPTION 'Repair changed protected subscription, profile or entitlement fields';
  END IF;
  INSERT INTO app.admin_activity_log(admin_username,admin_name,action_type,action_description,target_type,target_name,entity_type,entity_id,metadata,changes)
  SELECT 'codex-authorised-repair','Authorised admin repair','terminal_subscription_renewal_reconciled',
    'Corrected stale local auto-renew flag on verified cancelled sandbox UAT subscription',
    'subscription','Cancelled Client Starter sandbox fixture','subscription',subscription.id,
    jsonb_build_object('repair',repair_key,'user_id',subscription.user_id,'provider_account','acct_1SYmuoIMkpwfAEDT',
      'provider_livemode',false,'provider_status','canceled','provider_subscription_id',subscription.stripe_subscription_id,
      'provider_test_clock','clock_1UMtllIMkpwfAEDTMvjM9Avs','provider_purpose','quickguard_lifecycle_uat',
      'stripe_write',false,'access_changed',false,'cancellation_dates_preserved',true),
    jsonb_build_object('auto_renew',jsonb_build_object('before',subscription.auto_renew,'after',false))
  WHERE NOT EXISTS(SELECT 1 FROM app.admin_activity_log WHERE action_type='terminal_subscription_renewal_reconciled' AND metadata->>'repair'=repair_key);
END
$repair$;
