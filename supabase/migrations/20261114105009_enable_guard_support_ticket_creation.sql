-- Guard-originated tickets do not have a client profile.
SET LOCAL lock_timeout = '500ms';

ALTER TABLE app.support_tickets ALTER COLUMN client_id DROP NOT NULL;

-- Keep guard-originated tickets separate from the client-owned insert paths.
ALTER POLICY guard_tickets_insert ON app.support_tickets
  TO authenticated
  WITH CHECK (
    client_id IS NULL
    AND EXISTS (
      SELECT 1 FROM app.guards AS guard
      WHERE guard.id = support_tickets.guard_id
        AND guard.user_id = (SELECT auth.uid())
    )
  );
