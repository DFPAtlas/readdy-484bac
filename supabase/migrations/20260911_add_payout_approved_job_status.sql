ALTER TABLE app.jobs
  DROP CONSTRAINT IF EXISTS valid_job_status;

ALTER TABLE app.jobs
  ADD CONSTRAINT valid_job_status
  CHECK (
    status = ANY (ARRAY[
      'draft',
      'open',
      'pending',
      'awaiting_guard_selection',
      'awaiting_payment',
      'funded',
      'confirmed',
      'in_progress',
      'completed',
      'awaiting_client_approval',
      'awaiting_client_confirmation',
      'payout_approved',
      'paid_out',
      'review_pending',
      'cancelled',
      'closed'
    ]::text[])
  );