-- Match the existing optional Company Description form field. No backfill or
-- row update: existing accounts retain NULL until their owner saves a value.
ALTER TABLE app.clients ADD COLUMN IF NOT EXISTS description text;
COMMENT ON COLUMN app.clients.description IS
  'Optional company description entered by the account owner; subject to existing client RLS and profile retention.';

-- Make the new field available to PostgREST before publishing its export select.
NOTIFY pgrst, 'reload schema';
