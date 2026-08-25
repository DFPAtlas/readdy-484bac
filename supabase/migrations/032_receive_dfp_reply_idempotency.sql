-- receive-dfp-support-reply: idempotency + admin sender support

ALTER TABLE app.ticket_messages
  ADD COLUMN IF NOT EXISTS dfp_message_id uuid;

ALTER TABLE app.ticket_messages
  ALTER COLUMN sender_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ticket_messages_dfp_message_id_uniq_idx
  ON app.ticket_messages (dfp_message_id)
  WHERE dfp_message_id IS NOT NULL;