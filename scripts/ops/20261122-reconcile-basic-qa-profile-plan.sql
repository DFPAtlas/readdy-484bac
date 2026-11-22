-- Restore display labels for the existing, authorised Basic sandbox QA fixture.
-- This is not a plan/access upgrade or a provider identity reconciliation.
DO $repair$
DECLARE
  guard app.guards%ROWTYPE;
  subscription app.subscriptions%ROWTYPE;
  entitlement app.user_entitlements_data%ROWTYPE;
  plan app.plans%ROWTYPE;
  repair_key constant text := 'basic-qa-profile-plan-20261122';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(repair_key));
  SELECT * INTO STRICT guard FROM app.guards WHERE id='20826398-1bcf-4a93-9b61-493c3e156610' FOR UPDATE;
  SELECT * INTO STRICT subscription FROM app.subscriptions WHERE id='58ea2b87-c8e7-484b-a97e-e8d0eccfdaae' FOR SHARE;
  SELECT * INTO STRICT entitlement FROM app.user_entitlements_data WHERE user_id=guard.user_id FOR SHARE;
  SELECT * INTO STRICT plan FROM app.plans WHERE slug='guard-basic' AND active=true FOR SHARE;
  IF guard.user_id IS DISTINCT FROM '8ec6113d-7b78-4c69-a90c-86d0e4b69714'::uuid
    OR guard.is_test_account IS DISTINCT FROM true OR guard.email IS DISTINCT FROM 'qgtest.guard@digital-footprint.uk'
    OR guard.stripe_customer_id IS DISTINCT FROM 'cus_VcfannyExX18cO' OR guard.stripe_subscription_id IS NOT NULL
    OR guard.subscription_status IS DISTINCT FROM 'active'
    OR (guard.plan_slug IS NOT NULL AND guard.plan_slug IS DISTINCT FROM plan.slug)
    OR (guard.subscription_plan IS NOT NULL AND guard.subscription_plan IS DISTINCT FROM plan.slug)
    OR (guard.plan_name IS NOT NULL AND guard.plan_name IS DISTINCT FROM plan.name)
    OR subscription.user_id IS DISTINCT FROM guard.user_id OR subscription.account_type IS DISTINCT FROM 'guard'
    OR subscription.plan_slug IS DISTINCT FROM plan.slug OR subscription.plan_name IS DISTINCT FROM plan.name
    OR subscription.status IS DISTINCT FROM 'active' OR subscription.currency IS DISTINCT FROM 'gbp'
    OR subscription.plan_amount IS DISTINCT FROM 1000 OR plan.monthly_price_pence IS DISTINCT FROM 1000
    OR plan.audience IS DISTINCT FROM 'guard' OR plan.name IS DISTINCT FROM 'Guard Basic'
    OR subscription.stripe_customer_id IS DISTINCT FROM 'cus_VO2jzA0T87Gutg'
    OR subscription.stripe_subscription_id IS DISTINCT FROM 'sub_1UNGf0IMkpwfAEDTfSohHVse'
    OR subscription.stripe_price_id IS DISTINCT FROM 'price_1TcvjKIMkpwfAEDTR040YjkP'
    OR subscription.current_period_end IS DISTINCT FROM '2026-12-05T18:30:50Z'::timestamptz
    OR entitlement.plan_slug IS DISTINCT FROM plan.slug OR entitlement.plan_name IS DISTINCT FROM plan.name
    OR entitlement.subscription_status IS DISTINCT FROM 'active' OR entitlement.audience IS DISTINCT FROM 'guard'
    OR entitlement.monthly_price_pence IS DISTINCT FROM 1000 OR entitlement.features IS DISTINCT FROM plan.features
    OR entitlement.stripe_subscription_id IS DISTINCT FROM subscription.stripe_subscription_id
    OR entitlement.current_period_end IS DISTINCT FROM subscription.current_period_end
    OR EXISTS(SELECT 1 FROM app.account_closures WHERE user_id=guard.user_id)
    OR NOT EXISTS(SELECT 1 FROM app.admin_activity_log WHERE id='9bc73b25-02d5-4032-a46d-f8e614f20274'
      AND entity_id=subscription.id AND entity_type='subscription'
      AND metadata->>'repair'='basic-sandbox-renewal-20261122'
      AND metadata->>'decision'='Keep sandbox fixture and reconcile renewal'
      AND metadata->>'profile_live_customer_preserved'='true') THEN
    RAISE EXCEPTION 'Basic QA fixture evidence changed; profile label repair aborted';
  END IF;

  UPDATE app.guards SET plan_slug=plan.slug,subscription_plan=plan.slug,plan_name=plan.name,updated_at=now()
    WHERE id=guard.id AND (plan_slug IS DISTINCT FROM plan.slug OR subscription_plan IS DISTINCT FROM plan.slug OR plan_name IS DISTINCT FROM plan.name);
  IF (SELECT to_jsonb(g)-'plan_slug'-'plan_name'-'subscription_plan'-'updated_at' FROM app.guards g WHERE id=guard.id)
      IS DISTINCT FROM (to_jsonb(guard)-'plan_slug'-'plan_name'-'subscription_plan'-'updated_at')
    OR (SELECT to_jsonb(s) FROM app.subscriptions s WHERE id=subscription.id) IS DISTINCT FROM to_jsonb(subscription)
    OR (SELECT to_jsonb(e) FROM app.user_entitlements_data e WHERE user_id=guard.user_id) IS DISTINCT FROM to_jsonb(entitlement) THEN
    RAISE EXCEPTION 'Protected guard, billing or entitlement fields changed';
  END IF;

  INSERT INTO app.admin_activity_log(admin_username,admin_name,action_type,action_description,target_type,target_name,entity_type,entity_id,metadata,changes)
  SELECT 'codex-authorised-repair','Authorised admin repair','qa_profile_plan_labels_reconciled',
    'Restored existing Guard Basic QA profile labels from matching subscription and entitlement; provider identities preserved',
    'guard','Controlled Basic QA guard','guard',guard.id,
    jsonb_build_object('repair',repair_key,'scope','existing_plan_labels_only','user_id',guard.user_id,'subscription_id',subscription.id,
      'plan_slug',plan.slug,'provider_account','acct_1SYmuoIMkpwfAEDT','provider_livemode',false,
      'provider_subscription_id',subscription.stripe_subscription_id,'profile_live_customer_preserved',true,
      'source_renewal_audit','9bc73b25-02d5-4032-a46d-f8e614f20274','eligibility_changed',false,'entitlement_changed',false,'stripe_write',false),
    jsonb_build_object('before',jsonb_build_object('plan_slug',guard.plan_slug,'plan_name',guard.plan_name,'subscription_plan',guard.subscription_plan),
      'after',jsonb_build_object('plan_slug',plan.slug,'plan_name',plan.name,'subscription_plan',plan.slug))
  WHERE NOT EXISTS(SELECT 1 FROM app.admin_activity_log WHERE action_type='qa_profile_plan_labels_reconciled' AND metadata->>'repair'=repair_key);
END
$repair$;
