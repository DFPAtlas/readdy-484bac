ALTER TABLE app.ticket_messages
  ADD COLUMN IF NOT EXISTS dfp_sync_status text,
  ADD COLUMN IF NOT EXISTS dfp_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS dfp_sync_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS dfp_sync_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_messages_dfp_sync_status_check'
  ) THEN
    ALTER TABLE app.ticket_messages
      ADD CONSTRAINT ticket_messages_dfp_sync_status_check
      CHECK (dfp_sync_status IS NULL OR dfp_sync_status IN ('pending','synced','failed'));
  END IF;
END $$;