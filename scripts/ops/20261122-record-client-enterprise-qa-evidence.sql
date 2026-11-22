-- Evidence verification only: preserve the existing QA entitlement and Starter billing.
-- Original operation: PR208 and QuickGuard-code-repair-backlog-2026-11-20.md v39,
-- QA quota configuration receipt. This is NOT a new grant or a billed plan change.
DO $evidence$
DECLARE
  client app.clients%ROWTYPE;
  subscription app.subscriptions%ROWTYPE;
  entitlement app.user_entitlements_data%ROWTYPE;
  enterprise app.plans%ROWTYPE;
  repair_key constant text := 'client-enterprise-qa-evidence-20261122';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(repair_key));
  SELECT * INTO STRICT client FROM app.clients WHERE id='567a2518-86ec-4b78-9230-12794f0ead27' FOR SHARE;
  SELECT * INTO STRICT subscription FROM app.subscriptions WHERE id='20cb7a4a-732c-4d14-9597-63a1d10ecc5e' FOR SHARE;
  SELECT * INTO STRICT entitlement FROM app.user_entitlements_data WHERE user_id='8a6451b5-6b9f-4b42-a1d2-1bf36e5a8a0b' FOR SHARE;
  SELECT * INTO STRICT enterprise FROM app.plans WHERE slug='client-enterprise' AND active=true;
  IF client.user_id IS DISTINCT FROM '8a6451b5-6b9f-4b42-a1d2-1bf36e5a8a0b'::uuid
    OR client.email IS DISTINCT FROM 'qgtest.client@digital-footprint.uk'
    OR client.company_name IS DISTINCT FROM 'Atlas Event Services Test Ltd'
    OR client.plan_slug IS DISTINCT FROM 'client-starter'
    OR client.stripe_subscription_id IS DISTINCT FROM 'sub_1UMlzYIMkpwfAEDTCmQU4dUd'
    OR subscription.user_id IS DISTINCT FROM client.user_id OR subscription.account_type IS DISTINCT FROM 'client'
    OR subscription.plan_slug IS DISTINCT FROM 'client-starter' OR subscription.plan_amount IS DISTINCT FROM 4900
    OR subscription.status IS DISTINCT FROM 'active' OR subscription.currency IS DISTINCT FROM 'gbp'
    OR subscription.stripe_subscription_id IS DISTINCT FROM client.stripe_subscription_id
    OR subscription.stripe_customer_id IS DISTINCT FROM 'cus_VMZvL3AHBodYba'
    OR client.stripe_customer_id IS DISTINCT FROM subscription.stripe_customer_id
    OR subscription.stripe_price_id IS DISTINCT FROM 'price_1TcvjNIMkpwfAEDTZ6QYTKZ3'
    OR subscription.current_period_end IS DISTINCT FROM '2026-12-04T09:46:00Z'::timestamptz
    OR entitlement.plan_slug IS DISTINCT FROM 'client-enterprise' OR entitlement.plan_name IS DISTINCT FROM 'Client Enterprise'
    OR entitlement.audience IS DISTINCT FROM 'client' OR entitlement.monthly_price_pence IS DISTINCT FROM 4900
    OR entitlement.subscription_status IS DISTINCT FROM 'active' OR entitlement.stripe_subscription_id IS DISTINCT FROM subscription.stripe_subscription_id
    OR entitlement.current_period_end IS DISTINCT FROM subscription.current_period_end
    OR entitlement.updated_at IS DISTINCT FROM '2026-11-21T18:08:17.920768Z'::timestamptz
    OR entitlement.features IS DISTINCT FROM enterprise.features OR jsonb_array_length(entitlement.features)<>16
    OR EXISTS(SELECT 1 FROM app.account_closures WHERE user_id=client.user_id) THEN
    RAISE EXCEPTION 'QA access or billing evidence changed; verification aborted';
  END IF;

  INSERT INTO app.admin_activity_log(admin_username,admin_name,action_type,action_description,target_type,target_name,entity_type,entity_id,metadata)
  SELECT 'codex-authorised-repair','Authorised QA evidence review','qa_entitlement_override_verified',
    'Verified existing PR208 Enterprise QA access override; Starter billing and all account data retained',
    'client','Atlas Event Services Test Ltd QA','client',client.id,
    jsonb_build_object('repair',repair_key,'scope','existing_access_entitlement_only','user_id',client.user_id,'subscription_id',subscription.id,
      'billing_plan',subscription.plan_slug,'access_plan',entitlement.plan_slug,'monthly_price_pence',entitlement.monthly_price_pence,
      'stripe_subscription_id',subscription.stripe_subscription_id,'stripe_customer_id',subscription.stripe_customer_id,'stripe_price_id',subscription.stripe_price_id,
      'current_period_end',entitlement.current_period_end,'cancel_at_period_end',entitlement.cancel_at_period_end,'features',entitlement.features,
      'original_entitlement_updated_at',entitlement.updated_at,'source_pr',208,'source_commit','d455c9e787d225a5426287c85efe98c3ad68cdba',
      'source_report','QuickGuard-code-repair-backlog-2026-11-20.md','source_report_version',39,'source_section','QA quota configuration receipt',
      'source_library_file_id','libfile_fde3_f-df2e41bf32248191a5c7c39bb06f2b93_a56126749ff081919e3bf3e44e3de502',
      'provider_account','acct_1SYmuoIMkpwfAEDT','provider_livemode',false,'provider_unit_amount',4900,
      'account_data_modified',false,'new_grant',false,'stripe_write',false,'workflow_changed',false,'verified_at',now())
  WHERE NOT EXISTS(SELECT 1 FROM app.admin_activity_log WHERE action_type='qa_entitlement_override_verified' AND metadata->>'repair'=repair_key);
END
$evidence$;
