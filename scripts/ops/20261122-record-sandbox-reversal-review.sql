-- Provider evidence verified using Stripe's read-only transfer API on 22 November.
-- Transfer and reversal are sandbox; the original failed payout remains unchanged.
DO $review$
DECLARE payout app.guard_payouts%ROWTYPE;
BEGIN
  SELECT * INTO payout FROM app.guard_payouts
    WHERE id='a4cb0be5-6fa1-4b68-b8f5-e0e0c513ac4e' FOR UPDATE;
  IF NOT FOUND OR payout.status IS DISTINCT FROM 'failed' OR payout.amount IS DISTINCT FROM 80 OR payout.net_amount IS DISTINCT FROM 80
    OR payout.stripe_transfer_id IS DISTINCT FROM 'tr_3UMuNlIMkpwfAEDT1zhM9H4Z'
    OR payout.stripe_transfer_status IS DISTINCT FROM 'reversed' THEN
    RAISE EXCEPTION 'Payout reconciliation evidence changed; review aborted';
  END IF;
  INSERT INTO app.payment_audit_logs(job_id,assignment_id,guard_id,from_status,to_status,
    changed_by_role,reason,event_type,reference_type,reference_id,metadata)
  SELECT payout.job_id,payout.assignment_id,payout.guard_id,'failed','failed','admin_repair',
    'Independent Stripe retrieval confirms expected full sandbox UAT reversal; original financial states retained',
    'sandbox_reversal_reconciled','guard_payout',payout.id::text,
    jsonb_build_object('repair','admin-operations-20261122','stripe_context','acct_1SYmuoIMkpwfAEDT',
      'livemode',false,'currency','gbp','transfer_id',payout.stripe_transfer_id,
      'reversal_id','trr_1UMvlqIMkpwfAEDTRsF0NZ4N','amount_minor',8000,'amount_reversed_minor',8000,
      'evidence_source','Stripe GET /v1/transfers/{id}','verified_at',now())
  WHERE NOT EXISTS(SELECT 1 FROM app.payment_audit_logs WHERE event_type='sandbox_reversal_reconciled'
    AND reference_type='guard_payout' AND reference_id=payout.id::text
    AND metadata->>'reversal_id'='trr_1UMvlqIMkpwfAEDTRsF0NZ4N');
END
$review$;
