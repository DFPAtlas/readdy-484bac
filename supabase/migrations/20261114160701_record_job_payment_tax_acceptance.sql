CREATE FUNCTION app.record_job_payment_tax_acceptance(
  p_job_id uuid,
  p_user_id uuid,
  p_accepted boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  booking_client_id uuid;
  already_accepted boolean;
  accepted_at timestamptz;
BEGIN
  SELECT j.client_id, j.tax_disclaimer_accepted
  INTO booking_client_id, already_accepted
  FROM app.jobs AS j
  JOIN app.clients AS c ON c.id = j.client_id
  WHERE j.id = p_job_id
    AND c.user_id = p_user_id
    AND j.status = 'awaiting_payment'
    AND COALESCE(j.payment_status, 'pending') IN ('pending', 'processing', 'failed')
    AND NOT EXISTS (
      SELECT 1
      FROM app.account_closures AS closure
      WHERE closure.user_id = p_user_id
    )
  FOR UPDATE OF j;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF already_accepted IS NOT TRUE THEN
    IF p_accepted IS NOT TRUE THEN
      RETURN false;
    END IF;

    accepted_at := pg_catalog.clock_timestamp();

    INSERT INTO app.tax_disclaimers_accepted (user_id, user_type, disclaimer_type, accepted_at)
    VALUES (p_user_id, 'client', 'job_payment', accepted_at);

    UPDATE app.jobs
    SET tax_disclaimer_accepted = true,
        tax_disclaimer_accepted_at = accepted_at
    WHERE id = p_job_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unable to update booking tax acknowledgement';
    END IF;
  END IF;

  -- A resumed Stripe session can already have a fee snapshot.
  UPDATE app.payment_fee_breakdowns
  SET tax_disclaimer_accepted = true
  WHERE job_id = p_job_id
    AND client_id = booking_client_id
    AND tax_disclaimer_accepted IS DISTINCT FROM true;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION app.record_job_payment_tax_acceptance(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.record_job_payment_tax_acceptance(uuid, uuid, boolean)
  TO service_role;
