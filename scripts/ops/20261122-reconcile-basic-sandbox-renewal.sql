-- Approved by Martin: keep this synthetic account as a sandbox UAT fixture.
-- Stripe GET independently verified the paid GBP 10 renewal; this never calls Stripe.
-- Preserve all Stripe IDs, the separate live profile customer, eligibility and plans.
DO $reconcile$
DECLARE
  prior app.subscriptions%ROWTYPE;
  guard_before jsonb;
  entitlement_before jsonb;
  existing app.subscription_payments%ROWTYPE;
  repair_key constant text := 'basic-sandbox-renewal-20261122';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(repair_key));
  SELECT * INTO STRICT prior FROM app.subscriptions
    WHERE id='58ea2b87-c8e7-484b-a97e-e8d0eccfdaae' FOR UPDATE;
  SELECT to_jsonb(g) INTO STRICT guard_before FROM app.guards g
    WHERE user_id=prior.user_id FOR UPDATE;
  SELECT to_jsonb(e) INTO STRICT entitlement_before FROM app.user_entitlements e WHERE user_id=prior.user_id;
  IF prior.user_id IS DISTINCT FROM '8ec6113d-7b78-4c69-a90c-86d0e4b69714'::uuid
    OR prior.stripe_subscription_id IS DISTINCT FROM 'sub_1UNGf0IMkpwfAEDTfSohHVse'
    OR prior.stripe_customer_id IS DISTINCT FROM 'cus_VO2jzA0T87Gutg'
    OR prior.stripe_price_id IS DISTINCT FROM 'price_1TcvjKIMkpwfAEDTR040YjkP'
    OR prior.plan_slug IS DISTINCT FROM 'guard-basic' OR prior.status IS DISTINCT FROM 'active'
    OR prior.account_type IS DISTINCT FROM 'guard' OR prior.currency IS DISTINCT FROM 'gbp'
    OR prior.current_period_end NOT IN ('2026-11-05T18:30:50Z'::timestamptz,'2026-12-05T18:30:50Z'::timestamptz)
    OR prior.current_period_end IS NULL
    OR guard_before->>'is_test_account' IS DISTINCT FROM 'true'
    OR guard_before->>'email' IS DISTINCT FROM 'qgtest.guard@digital-footprint.uk'
    OR guard_before->>'stripe_customer_id' IS DISTINCT FROM 'cus_VcfannyExX18cO'
    OR entitlement_before->>'stripe_subscription_id' IS DISTINCT FROM prior.stripe_subscription_id
    OR entitlement_before->>'plan_slug' IS DISTINCT FROM prior.plan_slug THEN
    RAISE EXCEPTION 'Sandbox fixture identity or billing evidence changed; reconciliation aborted';
  END IF;

  SELECT * INTO existing FROM app.subscription_payments WHERE stripe_invoice_id='in_1UYVRqIMkpwfAEDTE5wg03Vk' FOR UPDATE;
  IF FOUND AND (existing.subscription_id IS DISTINCT FROM prior.id OR existing.user_id IS DISTINCT FROM prior.user_id
    OR existing.amount IS DISTINCT FROM 10 OR existing.currency IS DISTINCT FROM 'gbp' OR existing.status IS DISTINCT FROM 'succeeded'
    OR existing.period_start IS DISTINCT FROM '2026-11-05T18:30:50Z'::timestamptz
    OR existing.period_end IS DISTINCT FROM '2026-12-05T18:30:50Z'::timestamptz
    OR existing.paid_at IS DISTINCT FROM '2026-11-05T19:32:17Z'::timestamptz) THEN
    RAISE EXCEPTION 'Existing renewal invoice conflicts with verified sandbox evidence';
  END IF;

  IF EXISTS(SELECT 1 FROM app.admin_activity_log WHERE action_type='sandbox_subscription_reconciled' AND metadata->>'repair'=repair_key) THEN
    IF prior.current_period_end IS DISTINCT FROM '2026-12-05T18:30:50Z'::timestamptz
      OR entitlement_before->>'current_period_end' IS NULL OR (entitlement_before->>'current_period_end')::timestamptz IS DISTINCT FROM prior.current_period_end
      OR existing.id IS NULL THEN RAISE EXCEPTION 'Previously reconciled fixture drifted; review required'; END IF;
    RETURN;
  END IF;

  INSERT INTO app.subscription_payments(subscription_id,user_id,stripe_invoice_id,amount,currency,status,billing_reason,period_start,period_end,paid_at,metadata)
    VALUES(prior.id,prior.user_id,'in_1UYVRqIMkpwfAEDTE5wg03Vk',10,'gbp','succeeded','subscription_cycle',
      '2026-11-05T18:30:50Z','2026-12-05T18:30:50Z','2026-11-05T19:32:17Z',
      jsonb_build_object('repair',repair_key,'stripe_context','acct_1SYmuoIMkpwfAEDT','livemode',false,'evidence_source','Stripe GET subscription and invoice','verified_at',now()))
    ON CONFLICT(stripe_invoice_id) DO NOTHING;

  SELECT * INTO STRICT existing FROM app.subscription_payments WHERE stripe_invoice_id='in_1UYVRqIMkpwfAEDTE5wg03Vk' FOR UPDATE;
  IF existing.subscription_id IS DISTINCT FROM prior.id OR existing.user_id IS DISTINCT FROM prior.user_id
    OR existing.amount IS DISTINCT FROM 10 OR existing.currency IS DISTINCT FROM 'gbp' OR existing.status IS DISTINCT FROM 'succeeded'
    OR existing.period_start IS DISTINCT FROM '2026-11-05T18:30:50Z'::timestamptz OR existing.period_end IS DISTINCT FROM '2026-12-05T18:30:50Z'::timestamptz THEN
    RAISE EXCEPTION 'Renewal invoice insert was not confirmed';
  END IF;

  UPDATE app.subscriptions SET current_period_start='2026-11-05T18:30:50Z',current_period_end='2026-12-05T18:30:50Z',
    last_payment_date='2026-11-05T19:32:17Z',payment_status='succeeded',stripe_invoice_id='in_1UYVRqIMkpwfAEDTE5wg03Vk',updated_at=now()
    WHERE id=prior.id;
  -- The existing subscription trigger updates the canonical entitlement period.
  IF NOT EXISTS(SELECT 1 FROM app.user_entitlements e WHERE e.user_id=prior.user_id
      AND e.current_period_end='2026-12-05T18:30:50Z' AND e.plan_slug=prior.plan_slug
      AND e.stripe_subscription_id=prior.stripe_subscription_id AND to_jsonb(e.features)=entitlement_before->'features'
      AND e.subscription_status=entitlement_before->>'subscription_status')
    OR (SELECT to_jsonb(g) FROM app.guards g WHERE g.user_id=prior.user_id) IS DISTINCT FROM guard_before THEN
    RAISE EXCEPTION 'Entitlement period not confirmed or protected guard/plan data changed';
  END IF;

  INSERT INTO app.admin_activity_log(admin_username,admin_name,action_type,action_description,target_type,target_name,entity_type,entity_id,metadata,changes)
    VALUES('codex-authorised-repair','Martin-authorised sandbox reconciliation','sandbox_subscription_reconciled',
      'Recorded independently verified sandbox renewal and corrected only existing test subscription/entitlement periods; no charge or webhook replay',
      'subscription','TEST Daniel Morgan Basic','subscription',prior.id,
      jsonb_build_object('repair',repair_key,'stripe_context','acct_1SYmuoIMkpwfAEDT','livemode',false,
        'invoice_id','in_1UYVRqIMkpwfAEDTE5wg03Vk','amount_gbp',10,'decision','Keep sandbox fixture and reconcile renewal',
        'profile_live_customer_preserved',true,'stripe_ids_preserved',true,'webhook_event_replayed',false),
      jsonb_build_object('previous_subscription',to_jsonb(prior),'previous_entitlement',entitlement_before,
        'new_period_start','2026-11-05T18:30:50Z','new_period_end','2026-12-05T18:30:50Z'));
END
$reconcile$;
